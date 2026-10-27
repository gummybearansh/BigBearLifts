import { appendFile, mkdir } from "fs/promises";
import path from "path";

const MAX_PER_MINUTE = 60;
let windowStart = 0;
let writes = 0;

function logPath(): string {
  return process.env.LOG_PATH || path.join(process.cwd(), "logs", "app.log");
}

function redact(value: string): string {
  return value
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .replace(/refresh_token=[^&\s]+/gi, "refresh_token=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, "Bearer [redacted]");
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack || error.message || error.name;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown failure";
  }
}

export async function logFailure(kind: string, error: unknown, detail = ""): Promise<void> {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    writes = 0;
  }
  writes += 1;
  if (writes > MAX_PER_MINUTE) return;

  const message = redact(describeError(error)).slice(0, 2000);
  const extra = redact(detail).slice(0, 1500);
  const line = `${JSON.stringify({ at: new Date(now).toISOString(), kind: kind.slice(0, 40), message, detail: extra })}\n`;
  console.error(`[bbl] ${kind}: ${message.split("\n")[0]}`);
  try {
    const file = logPath();
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, line, "utf8");
  } catch (writeError) {
    console.error(`[bbl] log file was not written: ${describeError(writeError).split("\n")[0]}`);
  }
}
