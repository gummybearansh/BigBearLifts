let lastHiddenAt = 0;
let lastKey = "";
let lastAt = 0;

export function noteAppHidden() {
  lastHiddenAt = Date.now();
}

export function recordFailure(kind: string, error: unknown, detail = "") {
  if (typeof window === "undefined") return;
  const message = messageOf(error).slice(0, 500);
  const key = `${kind}:${message}`;
  const now = Date.now();
  if (key === lastKey && now - lastAt < 2000) return;
  lastKey = key;
  lastAt = now;
  const away = lastHiddenAt ? `${Math.round((now - lastHiddenAt) / 1000)}s since the app was hidden` : "app was not hidden this visit";
  const context = `${location.pathname} · ${document.visibilityState} · ${navigator.onLine ? "online" : "offline"} · ${away}`;
  void fetch("/api/log", {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      kind,
      message,
      detail: `${context}${detail ? `\n${detail}` : ""}`.slice(0, 1500),
    }),
  }).catch(() => undefined);
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || "Unknown failure";
  if (typeof error === "string") return error || "Unknown failure";
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  return "Unknown failure";
}

export function stackOf(error: unknown): string {
  if (!(error instanceof Error) || !error.stack) return "";
  return error.stack.split("\n").slice(0, 8).join("\n");
}
