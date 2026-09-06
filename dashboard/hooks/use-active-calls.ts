"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CallSummary } from "@/lib/types";

const POLL_MS = 4000;
const REQUEST_TIMEOUT_MS = 12_000;

export function useActiveCalls() {
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  // Never rejects — all failures are folded into `error`, last-good `calls` kept.
  const poll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/calls", {
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = await res.json().catch(() => null);
      if (!mounted.current) return;
      if (!res.ok) {
        throw new Error(body?.error ?? "Failed to load calls");
      }
      setCalls(body as CallSummary[]);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(
        (e as Error)?.name === "TimeoutError"
          ? "LiveKit is slow to respond"
          : e instanceof Error
            ? e.message
            : "Failed to load calls",
      );
    } finally {
      inFlight.current = false;
      if (mounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!document.hidden) await poll();
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();

    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted.current = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  const refresh = useCallback(() => {
    void poll();
  }, [poll]);

  return { calls, isLoading, error, refresh };
}
