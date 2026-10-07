import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

export async function POST() {
  try {
    await execFileAsync("rclone", ["version"]);
  } catch {
    return NextResponse.json({ error: "rclone is not configured." }, { status: 503 });
  }
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  try {
    await execFileAsync("rclone", ["move", dir, "gdrive:bigbearlifts-progress/", "--min-age", "2m"]);
  } catch {
    return NextResponse.json({ error: "rclone could not move the files." }, { status: 500 });
  }
  await prisma.progressVideo.updateMany({
    where: { status: "on-ec2" },
    data: { status: "synced", syncedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
