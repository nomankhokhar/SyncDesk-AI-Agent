import 'dotenv/config';
import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as openai from '@livekit/agents-plugin-openai';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as silero from '@livekit/agents-plugin-silero';
import { SipClient } from 'livekit-server-sdk';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────
// One agent that handles BOTH directions:
//  - INBOUND:  Telnyx number -> Telnyx SIP connection (FQDN ->
//              LiveKit SIP) -> dispatch rule creates a room and
//              dispatches this agent automatically.
//  - OUTBOUND: make-call.ts dispatches this agent to a new room with
//              { phoneNumber } in job metadata; the agent then dials
//              out via the LiveKit outbound trunk -> sip.telnyx.com.
// Pipeline: Silero VAD -> Deepgram nova-3 (STT) -> Claude Haiku 4.5
//           (LLM, via Anthropic's OpenAI-compatible endpoint) ->
//           Cartesia sonic-3 "Katie" (TTS)
// ─────────────────────────────────────────────────────────────

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    // Load VAD once per process so sessions start fast
    proc.userData.vad = await silero.VAD.load();
  },

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

    const agent = new voice.Agent({
      instructions: `You are an AI Agent created by Noman Ali.
You have expertise in three areas: Web Development, AI, and DevOps.

Keep responses short and conversational — this is a voice call, not text.
Speak naturally, one or two sentences at a time.

When the caller asks about one of your areas, tell them the stack you know:
- Web Development: HTML/CSS, JavaScript, TypeScript, React, Next.js, Node.js, REST APIs, databases (SQL and MongoDB)
- AI: LLM integrations (Claude, GPT), AI voice agents, chatbots, RAG pipelines, prompt engineering, AI automation
- DevOps: Docker, Kubernetes, Ansible, Terraform, CI/CD pipelines (GitHub Actions, Jenkins), AWS and cloud infrastructure, Linux, monitoring

Name the technologies conversationally (this is speech, not a bulleted list), then ask a follow-up about what they need.
If the caller asks something outside these areas, politely steer back to Web Development, AI, or DevOps.
If the caller asks to speak to a human, say Noman will call them back.
${isOutbound ? 'You initiated this call. After your introduction, state the reason for calling.' : 'You are answering an incoming call.'}`,
      tools: {
        endCall: llm.tool({
          description:
            'End the phone call. Use this after saying goodbye, when the conversation is clearly over or the caller asks to hang up.',
          execute: async () => {
            // Give TTS a moment to finish the goodbye before tearing down
            setTimeout(() => ctx.deleteRoom().catch(() => {}), 2000);
            return 'Call is ending.';
          },
        }),
      },
    });

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      stt: new deepgram.STT({ model: 'nova-3' }),
      // Claude via Anthropic's OpenAI-compatible endpoint (LiveKit has no
      // Node.js Anthropic plugin and Claude isn't on LiveKit Inference)
      llm: new openai.LLM({
        model: 'claude-haiku-4-5',
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: 'https://api.anthropic.com/v1/',
      }),
      // sonic-3 (default model) + "Katie" — Cartesia's recommended
      // conversational en-US voice for phone agents. Swap the ID with any
      // voice from play.cartesia.ai. Other doc-recommended options:
      //   Jameson (en-US male):  a5136bf9-224c-4d76-b823-52bd5efcffcc
      //   Skylar  (en-US female): db6b0ed5-d5d3-463d-ae85-518a07d3c2b4
      tts: new cartesia.TTS({
        voice: 'f786b574-daa5-4673-aa0c-cbe3e8534c02',
      }),
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
        session.generateReply({
          // Anthropic requires ≥1 user message; OpenAI-only setups can omit this
          userInput: '[The person just picked up the phone.]',
          instructions:
            'The person just picked up. Greet them, then introduce yourself: you are an AI Agent created by Noman Ali with expertise in Web Development, AI, and DevOps. Then state the reason for calling.',
        });
      } catch (err) {
        console.error('Outbound call failed (busy / no answer / rejected):', err);
        // Clean up the room so the worker doesn't hang
        await ctx.deleteRoom();
      }
    } else {
      // ── INBOUND: caller is already in the room, greet immediately ──
      session.generateReply({
        // Anthropic requires ≥1 user message; OpenAI-only setups can omit this
        userInput: '[Incoming call connected — the caller is on the line.]',
        instructions:
          'Greet the caller warmly, then introduce yourself: you are an AI Agent created by Noman Ali with expertise in Web Development, AI, and DevOps. Ask which of those they would like to know about.',
      });
    }
  },
});

cli.runApp(
  new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    // Named agent = explicit dispatch (recommended for telephony).
    // This name must match the dispatch rule and make-call.ts.
    agentName: 'phone-agent',
  }),
);
