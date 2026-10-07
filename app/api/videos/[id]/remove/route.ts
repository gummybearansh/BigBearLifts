import { rm } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const video = await prisma.progressVideo.findUnique({ where: { id: params.id } });
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  if (video.status !== "synced") {
    return NextResponse.json({ error: "Sync this video before deleting it from the server." }, { status: 409 });
  }
  const filePath = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"), video.filename);
  await rm(filePath, { force: true });
  const updated = await prisma.progressVideo.update({
    where: { id: video.id },
    data: { status: "deleted" },
  });
  return NextResponse.json({ ok: true, status: updated.status, updatedAt: updated.updatedAt.toISOString() });
}
