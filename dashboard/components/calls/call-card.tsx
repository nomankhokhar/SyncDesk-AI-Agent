"use client";

import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  PhoneOffIcon,
  RadioIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AgentStateBadge } from "@/components/calls/agent-state-badge";
import { CallMonitorDialog } from "@/components/calls/call-monitor-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";
import type { CallSummary } from "@/lib/types";

export function CallCard({
  call,
  onEnded,
}: {
  call: CallSummary;
  onEnded: () => void;
}) {
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const dialing =
    call.direction === "outbound" && call.agentPresent && !call.callerPresent;
  const waitingForAgent = !call.agentPresent;
  const label = call.phoneNumber ?? call.room;

  function end() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/calls/end", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ room: call.room }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Failed to end the call");
        toast.success("Call ended");
        onEnded();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to end the call");
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {call.direction === "outbound" ? (
              <ArrowUpRightIcon className="text-muted-foreground size-4" />
            ) : (
              <ArrowDownLeftIcon className="text-muted-foreground size-4" />
            )}
            <span className="truncate font-medium">{label}</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatDuration(call.startedAt)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            {dialing ? (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <RadioIcon className="size-3 animate-pulse" /> Dialing…
              </span>
            ) : waitingForAgent ? (
              <span className="text-amber-600 dark:text-amber-400 text-xs">
                Waiting for agent — is the phone-agent worker running?
              </span>
            ) : (
              <AgentStateBadge state={call.agentState} />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonitorOpen(true)}
            disabled={!call.agentPresent && !call.callerPresent}
          >
            Monitor
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={end}
            disabled={pending}
          >
            <PhoneOffIcon />
            End
          </Button>
        </div>
      </CardContent>

      <CallMonitorDialog
        room={call.room}
        label={label}
        open={monitorOpen}
        onOpenChange={setMonitorOpen}
      />
    </Card>
  );
}
