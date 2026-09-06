"use client";

import { LiveKitRoom } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";

import { LiveCallView } from "@/components/calls/live-call-view";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CallMonitorDialog({
  room,
  label,
  open,
  onOpenChange,
}: {
  room: string;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Monitoring {label}</DialogTitle>
        </DialogHeader>
        {/* Keyed so it fully remounts per room; only mounted while open so
            closing the dialog disconnects cleanly. */}
        {open ? <MonitorBody key={room} room={room} /> : null}
      </DialogContent>
    </Dialog>
  );
}

type TokenState =
  | { status: "loading" }
  | { status: "ready"; token: string; serverUrl: string }
  | { status: "error"; message: string }
  | { status: "ended" };

function MonitorBody({ room }: { room: string }) {
  const [state, setState] = useState<TokenState>({ status: "loading" });
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    (async () => {
      try {
        const res = await fetch("/api/calls/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ room }),
        });
        const body = await res.json().catch(() => null);
        if (cancelled.current) return;
        if (!res.ok) throw new Error(body?.error ?? "Could not join the call");
        setState({
          status: "ready",
          token: body.token,
          serverUrl: body.serverUrl,
        });
      } catch (e) {
        if (cancelled.current) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "Could not join the call",
        });
      }
    })();
    return () => {
      cancelled.current = true;
    };
  }, [room]);

  if (state.status === "loading") {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">Joining…</p>
    );
  }
  if (state.status === "ended") {
    return (
      <p className="text-muted-foreground p-6 text-center text-sm">
        Call ended.
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p className="text-destructive p-6 text-center text-sm">
        {state.message}
      </p>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={state.serverUrl}
      token={state.token}
      connect
      audio={false}
      video={false}
      onDisconnected={() => {
        if (!cancelled.current) setState({ status: "ended" });
      }}
      onError={(e) => {
        if (!cancelled.current)
          setState({ status: "error", message: e.message });
      }}
    >
      <LiveCallView />
    </LiveKitRoom>
  );
}
