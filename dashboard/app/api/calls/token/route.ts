import { NextResponse } from "next/server";

import { isCallRoom, mintViewerToken } from "@/lib/livekit";

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
    return NextResponse.json(await mintViewerToken(room));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create token" },
      { status: 502 },
    );
  }
}
