"use client";

import { useEffect } from "react";
import { recordFailure, stackOf } from "@/lib/failure-log";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    recordFailure("app", error, [error.digest ? `digest ${error.digest}` : "", stackOf(error)].filter(Boolean).join("\n"));
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0a0b", color: "#f5f5f7", fontFamily: "Inter, sans-serif" }}>
        <main style={{ maxWidth: 32 * 16, margin: "0 auto", padding: "2rem 1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 500 }}>Something failed</h1>
          <p style={{ color: "#9a9aa2", lineHeight: 1.5 }}>The failure was sent to the server log.</p>
          <pre style={{ whiteSpace: "pre-wrap", border: "1px solid #26262a", borderRadius: 16, padding: 16, background: "#141416" }}>{error.message || "Unknown failure"}</pre>
          {error.digest ? <p style={{ color: "#9a9aa2" }}>Digest {error.digest}</p> : null}
          <button type="button" onClick={() => reset()} style={{ height: 44, border: 0, borderRadius: 12, background: "#ff5a1f", color: "#0a0a0b", fontWeight: 500 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
