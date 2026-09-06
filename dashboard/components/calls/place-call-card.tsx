"use client";

import { PhoneCallIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { E164_RE } from "@/lib/schemas";

export function PlaceCallCard({ onPlaced }: { onPlaced?: () => void }) {
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const invalid = phone.length > 0 && !E164_RE.test(phone.trim());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!E164_RE.test(phone.trim())) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/calls/dispatch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phoneNumber: phone.trim() }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Dispatch failed");
        toast.success(`Calling ${phone.trim()} …`);
        setPhone("");
        onPlaced?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Dispatch failed");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Place an AI call
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex items-start gap-2">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="call-phone" className="sr-only">
              Phone number
            </Label>
            <Input
              id="call-phone"
              type="tel"
              inputMode="tel"
              placeholder="+14155551234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={invalid}
              disabled={pending}
            />
            {invalid ? (
              <p className="text-destructive text-xs">
                Use E.164 format, e.g. +14155551234
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={pending || invalid || !phone}>
            <PhoneCallIcon />
            {pending ? "Dispatching…" : "Call"}
          </Button>
        </form>
        <p className="text-muted-foreground mt-2 text-xs">
          Dispatches the <code>phone-agent</code> worker to call and take a
          booking. It must be running.
        </p>
      </CardContent>
    </Card>
  );
}
