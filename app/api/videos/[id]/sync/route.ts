import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const video = await prisma.progressVideo.findUnique({ where: { id: params.id } });
  if (!video || video.status === "deleted") return NextResponse.json({ error: "Video not found." }, { status: 404 });
  if (video.status === "synced") return NextResponse.json({ ok: true, status: "synced" });
  try {
    await execFileAsync("rclone", ["version"]);
  } catch {
    return NextResponse.json({ error: "rclone is not configured." }, { status: 503 });
  }
  const filePath = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"), video.filename);
  try {
    await execFileAsync("rclone", ["move", filePath, "gdrive:bigbearlifts-progress/"]);
  } catch {
    return NextResponse.json({ error: "rclone could not move this video." }, { status: 500 });
  }
  const syncedAt = new Date();
  const updated = await prisma.progressVideo.update({
    where: { id: video.id },
    data: { status: "synced", syncedAt },
  });
  return NextResponse.json({
    ok: true,
    status: updated.status,
    syncedAt: updated.syncedAt?.toISOString() ?? null,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
