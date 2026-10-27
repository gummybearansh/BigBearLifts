import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { beginSyncJob, readSyncJob } from "@/lib/server/video-sync-jobs";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

function jobResponse(job: ReturnType<typeof readSyncJob>) {
  if (!job) return NextResponse.json({ error: "Sync has not started." }, { status: 404 });
  return NextResponse.json({
    progress: job.progress,
    done: job.done,
    error: job.error,
    status: job.status ?? null,
    syncedAt: job.syncedAt ?? null,
    updatedAt: job.updatedAt ?? null,
  });
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return jobResponse(readSyncJob(params.id));
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const video = await prisma.progressVideo.findUnique({ where: { id: params.id } });
  if (!video || video.status === "deleted") return NextResponse.json({ error: "Video not found." }, { status: 404 });
  if (video.status === "synced") {
    return NextResponse.json({
      progress: 1,
      done: true,
      error: null,
      status: "synced",
      syncedAt: video.syncedAt?.toISOString() ?? null,
      updatedAt: video.updatedAt.toISOString(),
    });
  }
  try {
    await execFileAsync("rclone", ["version"]);
  } catch {
    return NextResponse.json({ error: "rclone is not configured." }, { status: 503 });
  }
  const filePath = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"), video.filename);
  const remote = process.env.RCLONE_REMOTE || "gdrive:";
  const job = beginSyncJob(video.id, filePath, remote);
  return jobResponse(job);
}
