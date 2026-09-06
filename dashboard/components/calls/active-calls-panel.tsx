"use client";

import { CallCard } from "@/components/calls/call-card";
import { PlaceCallCard } from "@/components/calls/place-call-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveCalls } from "@/hooks/use-active-calls";

export function AiCallsView() {
  const { calls, isLoading, error, refresh } = useActiveCalls();

  return (
    <div className="space-y-6">
      <PlaceCallCard onPlaced={refresh} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Live calls</h2>
          {error ? (
            <span className="text-amber-600 dark:text-amber-400 text-xs">
              {error} — retrying
            </span>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : calls.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
            No calls in progress. Place one above, or dial the inbound number.
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => (
              <CallCard key={call.room} call={call} onEnded={refresh} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
