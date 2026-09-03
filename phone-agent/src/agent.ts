import 'dotenv/config';
import {
  type JobContext,
  WorkerOptions,
  cli,
  defineAgent,
  inference,
  llm,
  metrics,
  voice,
} from '@livekit/agents';
import { SipClient } from 'livekit-server-sdk';
import { fileURLToPath } from 'node:url';
import { connectBookingTools } from './booking-mcp.js';

// ─────────────────────────────────────────────────────────────
// AI receptionist that handles BOTH directions on one number:
//  - INBOUND:  Telnyx -> LiveKit SIP -> dispatch rule -> this agent
//  - OUTBOUND: make-call.ts dispatches with { phoneNumber } metadata
// Reservations are managed through the Go booking MCP server
// (booking/cmd/mcp -> booking REST API) — see booking-mcp.ts.
//
// Speech stack — all via LiveKit Cloud Inference (one gateway, auth by the
// LIVEKIT_* keys, no per-provider keys). Best latency when the worker runs
// near the gateway (US); from far away the gateway hop adds ~1s.
//   bundled Silero VAD
//   -> Deepgram Flux (STT)      — end-of-turn detection server-side, so
//      `endpoint` + `stt` latency is ~0
//   -> Gemma 4 31B (LLM)        — livekit.com/products/inference/gemma-4
//   -> Rime Mist v3 (TTS)
// Overrides: STT_MODEL / LLM_MODEL / TTS_MODEL / TTS_VOICE.
// ─────────────────────────────────────────────────────────────

const BUSINESS_NAME = process.env.BUSINESS_NAME ?? 'SyncDesk';

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    // If metadata contains a phone number, this is an OUTBOUND call
    let dialInfo: { phoneNumber?: string } = {};
    try {
      dialInfo = JSON.parse(ctx.job.metadata || '{}');
    } catch {
      /* no metadata -> inbound call */
    }
    const isOutbound = Boolean(dialInfo.phoneNumber);

    // Booking tools come from the MCP server; the agent still answers
    // (and apologizes) if the booking system is down
    let bookingTools: Awaited<ReturnType<typeof connectBookingTools>> = [];
    try {
      bookingTools = await connectBookingTools();
    } catch (err) {
      console.error('Booking MCP unavailable — running without reservation tools:', err);
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });

    const agent = new voice.Agent({
      instructions: `You are the AI receptionist for ${BUSINESS_NAME}, created by Noman Ali, handling reservations over the phone.
Today is ${weekday}, ${today}.

Reservations (use your booking tools):
- NEW BOOKING: collect name, phone number, party size, date and time (plus any special requests). Confirm in ONE short sentence ("That's 4 for tomorrow at 7pm under Noman — shall I book it?"), then call create_reservation ONCE and give the caller their reservation ID.
- CANCEL: find the booking with list_reservations, confirm which one with the caller, then cancel_reservation.
- QUESTIONS: use list_reservations or get_booking_analysis for questions about existing bookings or busy days.
${bookingTools.length === 0 ? '- NOTE: the booking system is currently unavailable — apologize and offer that Noman will call them back.' : ''}

Rules:
- Convert relative dates ("tomorrow", "next Friday") to YYYY-MM-DD and times to 24-hour HH:MM before calling tools.
- Never assume a missing detail — if the caller has not stated a time, ask; do not call create_reservation until every field is known.
- Phone numbers: only add "+<country code>" if the caller gives one; otherwise read the digits back and ask for their country.
- Call create_reservation exactly once per booking. Once you have a reservation ID, the booking is done — never call it again.
- Never read out raw JSON or IDs unprompted — summarize naturally.
- Voice call: 1-2 short sentences per reply, one question at a time. Never speak lists or field-by-field readbacks.
- If the caller asks for a human, say Noman will call them back.
${isOutbound ? '- You initiated this call. After introducing yourself, state the reason for calling.' : '- You are answering an incoming call.'}`,
      tools: [
        ...bookingTools,
        llm.tool({
          name: 'endCall',
          description:
            'End the phone call. Use this after saying goodbye, when the conversation is clearly over or the caller asks to hang up.',
          execute: async () => {
            // Give TTS a moment to finish the goodbye before tearing down
            setTimeout(() => ctx.deleteRoom().catch(() => {}), 2000);
            return 'Call is ending.';
          },
        }),
      ],
    });

    const tts = new inference.TTS({
      model: process.env.TTS_MODEL ?? 'rime/mistv3',
      voice: process.env.TTS_VOICE ?? 'cove',
    });
    tts.prewarm(); // open the gateway websocket now so the greeting isn't cold

    const session = new voice.AgentSession({
      // VAD omitted → AgentSession auto-loads the bundled Silero VAD.
      stt: new inference.STT({
        model: process.env.STT_MODEL ?? 'deepgram/flux-general-en',
      }),
      // Gemma 4 (31B) via LiveKit Inference — https://livekit.com/products/inference/gemma-4
      llm: new inference.LLM({
        model: process.env.LLM_MODEL ?? 'google/gemma-4-31b-it',
      }),
      tts,
      // Deepgram Flux detects end-of-turn server-side — trust its signal
      // instead of the separate VAD turn-detector wait. minDelay 0 = no
      // extra pad on top of Flux's own eot_timeout.
      turnHandling: {
        turnDetection: 'stt',
        endpointing: { mode: 'fixed', minDelay: 0, maxDelay: 800 },
      },
    });

    // ─────────────────────────────────────────────────────────────
    // LATENCY INSTRUMENTATION
    // Per user turn, the caller's perceived lag = time from "caller stopped
    // talking" to "agent starts talking". LiveKit reports it in pieces:
    //   endpoint  — pad after Flux's end-of-turn signal (minDelay, now 0)
    //   stt       — end of speech → final transcript (Deepgram Flux)
    //   llm-ttft  — transcript → LLM first token (network + model)
    //   tts-ttfb  — text → Rime's first audio byte
    // The line prints when the agent begins speaking. Worker region is the
    // big lever on llm-ttft / tts-ttfb (gateway hop); endpointing is yours.
    // ─────────────────────────────────────────────────────────────
    const turn: Record<string, Partial<Record<string, number>>> = {};
    const done = new Set<string>();
    const ms = (n?: number) => (n == null ? '   –  ' : `${Math.round(n).toString().padStart(4)}ms`);

    // Wall-clock for the greeting: how long from "we asked the agent to speak"
    // to "the caller actually hears audio". This is the cold-start cost that
    // per-turn metrics don't capture.
    let greetingRequestedAt = 0;
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
      if (ev.newState === 'speaking' && greetingRequestedAt) {
        console.log(`⏱  greeting: ${Math.round(Date.now() - greetingRequestedAt)}ms from say() to first audio`);
        greetingRequestedAt = 0;
      }
    });

    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      const m = ev.metrics;
      if (process.env.METRICS_VERBOSE) metrics.logMetrics(m); // raw per-component lines
      const sid = 'speechId' in m && m.speechId ? m.speechId : '_';
      const t = (turn[sid] ??= {});

      if (m.type === 'eou_metrics') {
        t.endpoint = m.endOfUtteranceDelayMs;
        t.stt = m.transcriptionDelayMs;
      } else if (m.type === 'llm_metrics') {
        t.llmTtft = m.ttftMs;
        t.llmTotal = m.durationMs;
        t.prompt = m.promptTokens;
        t.cached = m.promptCachedTokens;
      } else if (m.type === 'tts_metrics' && !done.has(sid)) {
        done.add(sid);
        t.ttsTtfb = m.ttfbMs;
        const toFirstAudio =
          (t.endpoint ?? 0) + (t.stt ?? 0) + (t.llmTtft ?? 0) + (t.ttsTtfb ?? 0);
        console.log(
          `⏱  turn ${sid.slice(-4)}  endpoint ${ms(t.endpoint)} + stt ${ms(t.stt)} + ` +
            `llm-ttft ${ms(t.llmTtft)} + tts-ttfb ${ms(t.ttsTtfb)}  ≈ ${ms(toFirstAudio)} to first audio` +
            `   | llm total ${ms(t.llmTotal)}, prompt ${t.prompt ?? '?'}tok (${t.cached ?? 0} cached)`,
        );
        delete turn[sid];
      }
    });

    await session.start({ agent, room: ctx.room });

    if (isOutbound) {
      // ── OUTBOUND: dial the number and wait for pickup ──
      const sipClient = new SipClient(
        process.env.LIVEKIT_URL!,
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!,
      );

      console.log(`Dialing ${dialInfo.phoneNumber} ...`);
      try {
        await sipClient.createSipParticipant(
          process.env.SIP_OUTBOUND_TRUNK_ID!,
          dialInfo.phoneNumber!,
          ctx.room.name!,
          {
            participantIdentity: 'phone_user',
            // Blocks until the callee answers (or throws on busy/no-answer)
            waitUntilAnswered: true,
          },
        );
        console.log('Call answered');
        // Static greeting via TTS only — skips the ~1.5s LLM round-trip (and the
        // cold-start on the first call) that generateReply() would put on the
        // critical path before the caller hears anything.
        greetingRequestedAt = Date.now();
        session.say(
          `Hi, this is the ${BUSINESS_NAME} receptionist. I'm calling about a reservation — is now a good time?`,
        );
      } catch (err) {
        console.error('Outbound call failed (busy / no answer / rejected):', err);
        // Clean up the room so the worker doesn't hang
        await ctx.deleteRoom();
      }
    } else {
      // ── INBOUND: caller is already in the room, greet immediately ──
      // Static greeting via TTS only (see outbound note above).
      greetingRequestedAt = Date.now();
      session.say(
        `Thanks for calling ${BUSINESS_NAME}! How can I help — a new booking, or a change to an existing one?`,
      );
    }
  },
});

cli.runApp(
  new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    // Named agent = explicit dispatch (recommended for telephony).
    // This name must match the dispatch rule and make-call.ts.
    agentName: 'phone-agent',
    // Keep a warm process ready so the first call of the day doesn't eat the
    // ~10s model/inference warmup before the agent can speak.
    numIdleProcesses: 1,
  }),
);
