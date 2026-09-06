"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed py-16 text-center">
      <p className="font-medium">Something went wrong</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
        {error.message}
      </p>
      <Button variant="outline" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
