import { NextResponse } from "next/server";

import { isCallRoom, roomService } from "@/lib/livekit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const room = (body as { room?: unknown })?.room;
  if (typeof room !== "string" || !isCallRoom(room)) {
    return NextResponse.json({ error: "Unknown room" }, { status: 400 });
  }

  try {
    await roomService().deleteRoom(room);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // deleteRoom on an already-gone room can 404 — treat as success.
    const msg = e instanceof Error ? e.message : "";
    if (/not found|does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: msg || "Failed to end the call" },
      { status: 502 },
    );
  }
}
