import "server-only";

import type { ParticipantInfo, Room } from "livekit-server-sdk";

import { isCallRoom } from "@/lib/livekit";
import type { CallSummary } from "@/lib/types";

// ParticipantInfo.kind enum values (from @livekit/protocol, not re-exported).
const KIND_SIP = 3;
const KIND_AGENT = 4;

function isSip(p: ParticipantInfo): boolean {
  return p.kind === KIND_SIP || p.attributes?.["sip.phoneNumber"] != null;
}

function isAgent(p: ParticipantInfo): boolean {
  return p.kind === KIND_AGENT || p.attributes?.["lk.agent.state"] != null;
}

function metaPhone(metadata: string): string | null {
  try {
    const parsed = JSON.parse(metadata) as { phoneNumber?: unknown };
    return typeof parsed.phoneNumber === "string" ? parsed.phoneNumber : null;
  } catch {
    return null;
  }
}

export function buildCallSummaries(
  rooms: Room[],
  participantsByRoom: Record<string, ParticipantInfo[]>,
): CallSummary[] {
  return rooms
    .filter((r) => isCallRoom(r.name))
    .map((r) => {
      const parts = participantsByRoom[r.name] ?? [];
      const sip = parts.find(isSip);
      const agent = parts.find(isAgent);
      const direction = r.name.startsWith("outbound-")
        ? ("outbound" as const)
        : ("inbound" as const);

      return {
        room: r.name,
        direction,
        phoneNumber:
          sip?.attributes?.["sip.phoneNumber"] ?? metaPhone(r.metadata) ?? null,
        agentState: agent?.attributes?.["lk.agent.state"] ?? null,
        agentPresent: Boolean(agent),
        callerPresent: Boolean(sip),
        numParticipants: r.numParticipants,
        startedAt: new Date(Number(r.creationTime) * 1000).toISOString(),
      };
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
