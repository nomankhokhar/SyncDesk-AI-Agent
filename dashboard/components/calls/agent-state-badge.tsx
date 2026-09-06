"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MAP: Record<
  string,
  { label: string; className: string; pulse?: boolean }
> = {
  connecting: { label: "Connecting", className: "text-muted-foreground" },
  "pre-connect-buffering": {
    label: "Connecting",
    className: "text-muted-foreground",
  },
  initializing: { label: "Connecting", className: "text-muted-foreground" },
  idle: { label: "Idle", className: "text-muted-foreground" },
  listening: {
    label: "Listening",
    className: "text-blue-600 dark:text-blue-400",
  },
  thinking: {
    label: "Thinking",
    className: "text-amber-600 dark:text-amber-400",
    pulse: true,
  },
  speaking: {
    label: "Speaking",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  failed: { label: "Failed", className: "text-destructive" },
};

export function AgentStateBadge({ state }: { state: string | null | undefined }) {
  const entry = state ? MAP[state] : undefined;
  return (
    <Badge variant="outline" className={cn("gap-1.5", entry?.className)}>
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          entry?.pulse && "animate-pulse",
        )}
      />
      {entry?.label ?? "—"}
    </Badge>
  );
}
