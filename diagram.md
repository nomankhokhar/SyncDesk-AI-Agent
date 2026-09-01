# SyncDesk AI Agent — System Design

An AI **receptionist** built on **LiveKit + Telnyx** that answers and places phone calls on +1‑562‑605‑0826, and manages reservations through a **Go booking service** connected over **MCP**.

## 1. High-level system design

```
                 ┌─────────────────────── TELEPHONY ───────────────────────┐
                 │                                                         │
 ┌────────┐ PSTN │ ┌────────────┐        ┌──────────────────────────┐      │
 │ Caller │◄────►│ │   Telnyx   │◄──SIP──►│      LiveKit Cloud      │      │
 └────────┘      │ │ (number +  │        │  inbound/outbound trunks │      │
                 │ │ SIP trunk) │        │  dispatch rule → rooms   │      │
                 │ └────────────┘        └────────────┬─────────────┘      │
                 └───────────────────────────────────┼─────────────────────┘
                                                     │ WebRTC (audio)
                 ┌─────────────────── AI AGENT ──────▼─────────────────────┐
                 │  phone-agent/  (Node.js worker, name: "phone-agent")    │
                 │                                                         │
                 │  Silero VAD → Deepgram nova-3 (STT)                     │
                 │             → Claude Haiku 4.5 (LLM)                    │
                 │             → Cartesia sonic-3 (TTS)                    │
                 │                                                         │
                 │  Tools: endCall + everything the MCP server publishes   │
                 └────────────────────────┬────────────────────────────────┘
                                          │ MCP (stdio, auto-spawned per call)
                 ┌────────────────────────▼──────────────────────────────────┐
                 │  booking/  (Go)                                           │
                 │  cmd/mcp (MCP server) ──HTTP──► cmd/api (Gin REST :8080)  │
                 │  controllers → services → storage (in-memory)             │
                 └───────────────────────────────────────────────────────────┘
```

```mermaid
flowchart LR
    Caller([📞 Caller / Callee])
    Telnyx[Telnyx<br/>number + SIP connection]
    LK[LiveKit Cloud<br/>SIP trunks · dispatch rule · rooms]
    Agent[phone-agent worker<br/>VAD → STT → Claude → TTS]
    MCP[booking/cmd/mcp<br/>MCP server]
    API[booking/cmd/api<br/>Gin REST API :8080]
    DB[(in-memory store)]

    Caller <-->|PSTN| Telnyx <-->|SIP| LK <-->|WebRTC audio| Agent
    Agent <-->|MCP stdio<br/>tool calls| MCP <-->|HTTP JSON| API --> DB
```

## 2. Inbound call — from ring to booked table

```mermaid
sequenceDiagram
    autonumber
    participant C as Caller
    participant T as Telnyx
    participant L as LiveKit Cloud
    participant A as phone-agent
    participant M as MCP server (Go)
    participant B as Booking API

    C->>T: dials +1-562-605-0826
    T->>L: SIP INVITE (FQDN → LiveKit SIP)
    L->>L: inbound trunk accepts,<br/>dispatch rule creates room "call-xxxx"
    L->>A: dispatch job (empty metadata → inbound)
    A->>M: spawn cmd/mcp + initialize (stdio)
    M-->>A: tools: create/cancel/list_reservations,<br/>get_booking_analysis
    A->>C: "Thanks for calling SyncDesk — how can I help?"

    loop every conversation turn
        C->>A: speech
        A->>A: VAD → Deepgram (STT) → Claude
        alt Claude decides to use a booking tool
            A->>M: tools/call (e.g. create_reservation)
            M->>B: HTTP (e.g. POST /api/reservations)
            B-->>M: JSON result / validation error
            M-->>A: tool result
            A->>A: Claude summarizes result naturally
        end
        A->>C: Cartesia TTS reply
    end

    C->>A: "That's all, thanks!"
    A->>A: Claude calls endCall tool
    A->>L: deleteRoom (after 2s TTS grace)
    L->>T: hang up
```

## 3. Outbound call

```mermaid
sequenceDiagram
    autonumber
    participant U as npm run call -- +92...
    participant L as LiveKit Cloud
    participant A as phone-agent
    participant T as Telnyx
    participant C as Callee

    U->>L: createDispatch(room "outbound-<ts>",<br/>metadata {phoneNumber})
    L->>A: dispatch job (metadata has number → outbound)
    A->>A: connect booking MCP (same as inbound)
    A->>L: createSipParticipant(trunk, number,<br/>waitUntilAnswered)
    L->>T: SIP dial via sip.telnyx.com<br/>(credential auth)
    T->>C: PSTN ring
    alt answered
        C-->>A: audio connected
        A->>C: greets, introduces itself,<br/>states reason for calling
    else busy / no answer / rejected
        A->>L: deleteRoom (worker doesn't hang)
    end
```

## 4. Receptionist decision flow — all conversation paths

```mermaid
flowchart TD
    Start([Call connected]) --> Greet[Greet as BUSINESS_NAME receptionist]
    Greet --> Intent{Caller intent?}

    Intent -->|book a table| Collect[Collect: name, phone,<br/>party size, date, time, notes]
    Collect --> Norm[Resolve relative dates<br/>tomorrow → YYYY-MM-DD, 7pm → 19:00]
    Norm --> Confirm{Caller confirms<br/>details?}
    Confirm -->|no| Collect
    Confirm -->|yes| Create[MCP: create_reservation]
    Create -->|201 created| Done[Give reservation ID,<br/>anything else?]
    Create -->|400 bad date/time| Fix[Apologize, re-ask,<br/>retry tool]
    Fix --> Create

    Intent -->|cancel| Find[MCP: list_reservations]
    Find --> Which{Booking found &<br/>confirmed with caller?}
    Which -->|yes| Cancel[MCP: cancel_reservation by ID]
    Which -->|not found| Sorry[Apologize — no matching booking]
    Cancel -->|200| Done
    Cancel -->|already cancelled / 404| Sorry
    Sorry --> Done

    Intent -->|questions: bookings,<br/>busy days, stats| Query[MCP: list_reservations /<br/>get_booking_analysis]
    Query --> Summarize[Summarize naturally —<br/>never read raw JSON]
    Summarize --> Done

    Intent -->|wants a human| Human[Noman will call back]
    Human --> Done

    Intent -->|booking system down| Apologize[Apologize, offer callback<br/>from Noman]
    Apologize --> Done

    Done -->|more requests| Intent
    Done -->|goodbye| End[endCall tool →<br/>deleteRoom after 2s]
    End --> Hangup([Call ends])
```

## 5. MCP tool bridge — how tools reach the receptionist

```mermaid
flowchart LR
    subgraph Node["phone-agent (per call)"]
        E[entry] --> BM[booking-mcp.ts:<br/>spawn + connect MCP client]
        BM --> LT[listTools]
        LT --> Reg["each MCP tool → llm.tool()<br/>(JSON Schema passed straight through)"]
        Reg --> Claude[Claude sees tools:<br/>create/cancel/list_reservations,<br/>get_booking_analysis, endCall]
    end
    subgraph Go["booking (Go)"]
        MCPS[cmd/mcp] --> REST[cmd/api REST]
        REST --> SVC[services: validation,<br/>analysis logic]
        SVC --> ST[(storage)]
    end
    Claude -->|tools/call| MCPS
```

Add a tool in `booking/cmd/mcp/main.go` → it appears to the receptionist automatically. If the MCP server can't start (booking API down), the agent still answers and apologizes.

## 6. Key design decisions

| Decision | Why |
|---|---|
| Named agent (`phone-agent`) | Explicit dispatch only — joins rooms via dispatch rule (inbound) or make-call.ts (outbound). Name must match in `agent.ts`, `dispatch-rule.json`, `make-call.ts` |
| Claude via OpenAI-compat endpoint | LiveKit has no Node.js Anthropic plugin; requires ≥1 user message (synthetic greeting input) and a non-empty tool list (endCall) |
| Static TTS greeting (`session.say`) | Skips an LLM round-trip on call pickup — caller hears the greeting in ~1 s instead of ~15 s. (LiveKit Inference stack — Gemini Flash-Lite + Rime — was benchmarked and reverted: ~400 ms/turn slower from a non-US worker.) |
| MCP between agent and booking | Tools are discovered at call time, not hardcoded — Go and Node.js sides evolve independently |
| MCP server as thin HTTP client | One source of truth (REST API); same tools usable from Claude Desktop / Claude Code directly |
| Validation in Go service layer | Bad dates/times return errors the LLM can read, apologize for, and retry |
| In-memory store behind `storage.Store` | Demo-simple; swap for a DB by reimplementing four methods |
| Config env-only, JSONs are templates | No credentials in git — `setup-sip.ts` renders `${VAR}` placeholders from `.env` |
