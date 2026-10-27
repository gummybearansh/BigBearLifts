import { execFile } from "child_process";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logFailure } from "@/lib/server/app-log";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

type Creds = { clientId: string; clientSecret: string; refreshToken: string };

let creds: Creds | null = null;
let access: { token: string; expiresAt: number } | null = null;
const fileIds = new Map<string, string>();

function remoteName(): string {
  return (process.env.RCLONE_REMOTE || "gdrive:").replace(/:$/, "");
}

async function loadCreds(remote: string): Promise<Creds> {
  if (creds) return creds;
  const dumped = await execFileAsync("rclone", ["config", "dump"], { encoding: "utf8" });
  const config = JSON.parse(dumped.stdout || "{}") as Record<
    string,
    { client_id?: string; client_secret?: string; token?: string | { access_token?: string; refresh_token?: string; expiry?: string } }
  >;
  const entry = config[remote];
  const token = typeof entry?.token === "string" ? (JSON.parse(entry.token) as { access_token?: string; refresh_token?: string; expiry?: string }) : entry?.token;
  if (!entry?.client_id || !entry.client_secret || !token?.refresh_token) {
    throw new Error("Drive is not signed in.");
  }
  creds = { clientId: entry.client_id, clientSecret: entry.client_secret, refreshToken: token.refresh_token };
  const expiry = token.expiry ? Date.parse(token.expiry) : 0;
  if (token.access_token && expiry > Date.now() + 60_000) {
    access = { token: token.access_token, expiresAt: expiry };
  }
  return creds;
}

async function accessToken(remote: string, force = false): Promise<string> {
  const loaded = await loadCreds(remote);
  if (!force && access && access.expiresAt > Date.now() + 60_000) return access.token;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: loaded.clientId,
      client_secret: loaded.clientSecret,
      refresh_token: loaded.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!response.ok || !payload.access_token) throw new Error("Drive sign-in expired.");
  access = { token: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
  return payload.access_token;
}

async function driveFileId(remote: string, filename: string): Promise<string | null> {
  const cached = fileIds.get(filename);
  if (cached) return cached;
  const listed = await execFileAsync("rclone", ["lsjson", `${remote}:${filename}`], { encoding: "utf8" });
  const rows = JSON.parse(listed.stdout || "[]") as Array<{ ID?: string }>;
  const id = rows[0]?.ID ?? null;
  if (id) fileIds.set(filename, id);
  return id;
}

function streamResponse(upstream: Response) {
  const headers = new Headers();
  for (const name of ["content-type", "content-length", "content-range"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, no-store");
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

async function openDrive(fileId: string, range: string | null, token: string) {
  const headers = new Headers({ authorization: `Bearer ${token}` });
  if (range) headers.set("range", range);
  return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers });
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const video = await prisma.progressVideo.findUnique({ where: { id: params.id } });
  if (!video || video.status === "on-ec2") {
    return NextResponse.json({ error: "This video is not on Drive yet." }, { status: 404 });
  }
  try {
    const remote = remoteName();
    const fileId = await driveFileId(remote, video.filename);
    if (!fileId) return NextResponse.json({ error: "That file is not in the Drive folder." }, { status: 404 });
    const range = request.headers.get("range");
    let upstream = await openDrive(fileId, range, await accessToken(remote));
    if (upstream.status === 401) {
      access = null;
      upstream = await openDrive(fileId, range, await accessToken(remote, true));
    }
    if (!upstream.ok && upstream.status !== 206) {
      await logFailure("drive-stream", `Drive returned ${upstream.status}`, video.filename);
      return NextResponse.json({ error: "Drive could not open this video." }, { status: 502 });
    }
    return streamResponse(upstream);
  } catch (error) {
    await logFailure("drive-stream", error, video.filename);
    return NextResponse.json({ error: "Drive could not open this video." }, { status: 502 });
  }
}
