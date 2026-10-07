import { rm } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  const videos = await prisma.progressVideo.findMany({ where: { status: "synced" } });
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  for (const video of videos) {
    await rm(path.join(dir, video.filename), { force: true });
  }
  await prisma.progressVideo.updateMany({
    where: { status: "synced" },
    data: { status: "deleted" },
  });
  return NextResponse.json({ ok: true, removed: videos.length });
}
