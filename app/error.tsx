"use client";

import { useEffect } from "react";
import { recordFailure, stackOf } from "@/lib/failure-log";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    recordFailure("screen", error, [error.digest ? `digest ${error.digest}` : "", stackOf(error)].filter(Boolean).join("\n"));
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-medium">Something failed</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">The failure was sent to the server log.</p>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed">{error.message || "Unknown failure"}</pre>
      {error.digest ? <p className="text-sm text-muted-foreground">Digest {error.digest}</p> : null}
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}
