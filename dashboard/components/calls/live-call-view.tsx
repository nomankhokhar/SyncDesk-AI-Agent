"use client";

import {
  useConnectionState,
  useParticipants,
  useVoiceAssistant,
} from "@livekit/components-react";

import { AgentStateBadge } from "@/components/calls/agent-state-badge";
import { TranscriptFeed } from "@/components/calls/transcript-feed";

export function LiveCallView() {
  const connection = useConnectionState();
  const { agent, state } = useVoiceAssistant();
  const participants = useParticipants();

  // Fallback: if useVoiceAssistant hasn't bound an agent, find the participant
  // carrying the lk.agent.state attribute ourselves.
  const attrAgent = participants.find(
    (p) => p.attributes?.["lk.agent.state"] != null,
  );
  const agentIdentity = agent?.identity ?? attrAgent?.identity;
  const resolvedState =
    state && state !== "disconnected"
      ? state
      : (attrAgent?.attributes?.["lk.agent.state"] ?? null);

  if (connection === "connecting") {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">
        Connecting to the call…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Live transcript</span>
        <AgentStateBadge state={resolvedState} />
      </div>
      <div className="rounded-lg border">
        <TranscriptFeed agentIdentity={agentIdentity} />
      </div>
    </div>
  );
}
