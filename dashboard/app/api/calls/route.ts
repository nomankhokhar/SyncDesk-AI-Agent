import { NextResponse } from "next/server";
import type { ParticipantInfo } from "livekit-server-sdk";

import { buildCallSummaries } from "@/lib/calls";
import { isCallRoom, roomService } from "@/lib/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms),
    ),
  ]);
}

export async function GET() {
  try {
    const svc = roomService();
    const rooms = (
      await withTimeout(svc.listRooms(), 8000, "listRooms")
    ).filter((r) => isCallRoom(r.name));

    const entries = await Promise.all(
      rooms.map(async (r): Promise<[string, ParticipantInfo[]]> => {
        if (r.numParticipants === 0) return [r.name, []];
        try {
          return [
            r.name,
            await withTimeout(
              svc.listParticipants(r.name),
              5000,
              "listParticipants",
            ),
          ];
        } catch {
          return [r.name, []];
        }
      }),
    );

    return NextResponse.json(
      buildCallSummaries(rooms, Object.fromEntries(entries)),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Can't reach LiveKit" },
      { status: 502 },
    );
  }
}
