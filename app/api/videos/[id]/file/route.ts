import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const video = await prisma.progressVideo.findUnique({ where: { id: params.id } });
  if (!video || video.status === "deleted") return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const filePath = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"), video.filename);
  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "File is not on this server." }, { status: 404 });
  }
  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  const type = video.filename.endsWith(".mov") ? "video/quicktime" : video.filename.endsWith(".webm") ? "video/webm" : "video/mp4";
  return new NextResponse(stream, { headers: { "content-type": type } });
}
