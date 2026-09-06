import { NextResponse } from "next/server";

import { callDispatchSchema, firstIssue } from "@/lib/schemas";
import { AGENT_NAME, agentDispatch } from "@/lib/livekit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = callDispatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssue(parsed.error).message },
      { status: 400 },
    );
  }

  const room = `outbound-${Date.now()}`;
  try {
    await agentDispatch().createDispatch(room, AGENT_NAME, {
      metadata: JSON.stringify({ phoneNumber: parsed.data.phoneNumber }),
    });
    return NextResponse.json({ room });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dispatch failed" },
      { status: 502 },
    );
  }
}
