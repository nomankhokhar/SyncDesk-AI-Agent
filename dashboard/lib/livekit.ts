import "server-only";

import { randomUUID } from "node:crypto";

import {
  AccessToken,
  AgentDispatchClient,
  RoomServiceClient,
} from "livekit-server-sdk";

const URL = process.env.LIVEKIT_URL;
const KEY = process.env.LIVEKIT_API_KEY;
const SECRET = process.env.LIVEKIT_API_SECRET;

function config() {
  if (!URL || !KEY || !SECRET) {
    throw new Error(
      "LiveKit is not configured — set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET",
    );
  }
  return { URL, KEY, SECRET };
}

export const AGENT_NAME = "phone-agent";

/** Dashboard-created outbound rooms and dispatch-rule inbound rooms. */
export function isCallRoom(name: string): boolean {
  return name.startsWith("call-") || name.startsWith("outbound-");
}

export function roomService(): RoomServiceClient {
  const { URL, KEY, SECRET } = config();
  return new RoomServiceClient(URL, KEY, SECRET);
}

export function agentDispatch(): AgentDispatchClient {
  const { URL, KEY, SECRET } = config();
  return new AgentDispatchClient(URL, KEY, SECRET);
}

/** Read-only join token: subscribe to a room, publish nothing. */
export async function mintViewerToken(
  room: string,
): Promise<{ token: string; serverUrl: string }> {
  const { URL, KEY, SECRET } = config();
  const at = new AccessToken(KEY, SECRET, {
    identity: `dashboard-${randomUUID().slice(0, 8)}`,
    name: "Dashboard viewer",
    ttl: "1h",
  });
  at.addGrant({
    roomJoin: true,
    room,
    canSubscribe: true,
    canPublish: false,
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  return { token: await at.toJwt(), serverUrl: URL };
}
