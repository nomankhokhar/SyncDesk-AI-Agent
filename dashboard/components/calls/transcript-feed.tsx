"use client";

import { useTranscriptions } from "@livekit/components-react";
import { useEffect, useMemo, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function TranscriptFeed({
  agentIdentity,
}: {
  agentIdentity: string | undefined;
}) {
  const transcriptions = useTranscriptions();
  const bottomRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(
    () =>
      [...transcriptions].sort(
        (a, b) => a.streamInfo.timestamp - b.streamInfo.timestamp,
      ),
    [transcriptions],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines]);

  if (lines.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-center text-sm">
        Waiting for the conversation to start…
      </p>
    );
  }

  return (
    <ScrollArea className="h-72">
      <div className="space-y-3 p-4">
        {lines.map((line) => {
          const isAgent =
            agentIdentity != null &&
            line.participantInfo.identity === agentIdentity;
          const final =
            line.streamInfo.attributes?.["lk.transcription_final"] !== "false";
          return (
            <div
              key={line.streamInfo.id}
              className={cn("text-sm", isAgent ? "text-left" : "text-left")}
            >
              <span
                className={cn(
                  "text-xs font-medium",
                  isAgent ? "text-primary" : "text-muted-foreground",
                )}
              >
                {isAgent ? "Agent" : "Caller"}
              </span>
              <p className={cn(!final && "text-muted-foreground italic")}>
                {line.text}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
