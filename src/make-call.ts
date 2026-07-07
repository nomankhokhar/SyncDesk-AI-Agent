import 'dotenv/config';
import { AgentDispatchClient } from 'livekit-server-sdk';

// Usage: npm run call -- +14155551234  (E.164 format)
// Dispatches the phone-agent into a fresh room with the number to dial.
// The agent (agent.ts) sees the phoneNumber in metadata and dials out
// through the LiveKit outbound SIP trunk -> sip.telnyx.com (Telnyx).

const phoneNumber = process.argv[2];
if (!phoneNumber || !phoneNumber.startsWith('+')) {
  console.error('Usage: npm run call -- +1XXXXXXXXXX  (E.164 format)');
  process.exit(1);
}

const dispatchClient = new AgentDispatchClient(
  process.env.LIVEKIT_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!,
);

const roomName = `outbound-${Date.now()}`;

const dispatch = await dispatchClient.createDispatch(roomName, 'phone-agent', {
  metadata: JSON.stringify({ phoneNumber }),
});

console.log(`Dispatched agent to room "${roomName}" to call ${phoneNumber}`);
console.log('Dispatch ID:', dispatch.id);
