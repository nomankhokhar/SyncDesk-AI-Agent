# LiveKit Phone Agent (Node.js)

One AI voice agent that both **answers** and **makes** phone calls on +1-562-605-0826 via Telnyx SIP trunking + LiveKit.

Architecture:

```
INBOUND:  Caller -> Telnyx number -> Telnyx SIP connection -> LiveKit SIP -> Room -> Agent
OUTBOUND: make-call.ts -> dispatch agent -> Agent dials via LiveKit SIP -> sip.telnyx.com -> Callee
```

## Prerequisites

- Node.js 20+
- LiveKit Cloud account (free tier is fine) -> https://cloud.livekit.io
- LiveKit CLI: `brew install livekit-cli` (or `curl -sSL https://get.livekit.io/cli | bash`)
- API keys: Deepgram (STT), OpenAI (LLM), Cartesia (TTS)
- Telnyx account with the number +1-562-605-0826

## Step 1 — Telnyx SIP Connection

1. Telnyx Portal -> **Voice** -> **SIP Trunking** -> create a SIP Connection
2. Connection type: **FQDN** (this routes **inbound** calls to LiveKit)
   - Add FQDN: `YOUR-PROJECT-ID.sip.livekit.cloud`, port `5060`
   - Find your project SIP URI in LiveKit Cloud -> Settings -> Project SIP URI
3. **Outbound calls authentication**: Credentials — set a SIP username/password
   (these go in `outbound-trunk.json` as `authUsername` / `authPassword`)
4. **Outbound** tab -> attach an **Outbound Voice Profile**
   (Voice -> Outbound Voice Profiles -> create one; enable the destination
   countries you plan to call, e.g. Pakistan). Without a profile, all
   outgoing calls are rejected.
5. Telnyx Portal -> **Numbers** -> assign **+1-562-605-0826** to this SIP connection

## Step 2 — LiveKit credentials

LiveKit Cloud -> Settings -> Keys -> create an API key. Then:

```bash
cp .env.example .env
# fill in LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET + AI provider keys,
# plus SIP_FROM_NUMBER and your Telnyx SIP credentials
# (TELNYX_SIP_USERNAME / TELNYX_SIP_PASSWORD)
```

Authenticate the CLI:

```bash
lk cloud auth
```

## Step 3 & 4 — Create the SIP trunks + dispatch rule

The JSON files are **templates** — `${SIP_FROM_NUMBER}`, `${TELNYX_SIP_USERNAME}` and
`${TELNYX_SIP_PASSWORD}` are filled in from `.env` at creation time, so no
credentials ever live in git. Once `.env` is complete, run:

```bash
npm run setup:sip
```

This creates, in order:
- the **inbound trunk** (`inbound-trunk.json`) — receives calls on your number
- the **dispatch rule** (`dispatch-rule.json`) — puts every incoming call in its own room (`call-xxxx`) and dispatches the agent named `phone-agent`
- the **outbound trunk** (`outbound-trunk.json`) — dials out via `sip.telnyx.com` (Telnyx's SIP proxy — same for all accounts) using your Telnyx SIP credentials from Step 1

The last step prints a trunk ID like `ST_xxxx` — put it in `.env` as `SIP_OUTBOUND_TRUNK_ID`.

## Step 5 — Run the agent

```bash
npm install
npm run download-files   # downloads Silero VAD model (first time only)
npm run dev
```

Keep this running — it's the worker that handles all calls.

## Test it

**Receive a call:** dial **+1-562-605-0826** from your phone. The agent picks up and greets you.

**Make a call:** in a second terminal:

```bash
npm run call -- +923100660762
```

The agent dials that number and starts talking when answered.

## Troubleshooting

- **Inbound call gets busy tone / drops** → check the dispatch rule exists (`lk sip dispatch list`), the agent worker is running with the exact name `phone-agent`, and the number is assigned to the Telnyx SIP connection with the LiveKit FQDN.
- **Outbound fails with 404 "object cannot be found"** → `SIP_OUTBOUND_TRUNK_ID` in `.env` doesn't match a real trunk — check `lk sip outbound list`.
- **Outbound fails with 403** → wrong SIP username/password, no Outbound Voice Profile attached to the Telnyx connection, or the profile doesn't allow the destination country.
- **Agent answers but is silent** → missing/invalid Deepgram, OpenAI, or Cartesia key.

## Security

Never commit `.env` or put your Telnyx SIP password in code or chats. All secrets live only in `.env` (gitignored) — the trunk JSON files are placeholders-only templates rendered at setup time.

## Customizing

The agent's personality/behavior is the `instructions` string in `src/agent.ts`. You can also add tools (booking, lookups, transfers) via `llm.tool()` — see https://docs.livekit.io/agents/
