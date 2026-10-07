import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a video." }, { status: 400 });
  const maxMb = Number(process.env.MAX_UPLOAD_MB || 500);
  if (file.size > maxMb * 1024 * 1024) {
    return NextResponse.json({ error: "That video is too large." }, { status: 413 });
  }
  const type = file.type;
  if (type !== "video/mp4" && type !== "video/quicktime" && type !== "video/webm") {
    return NextResponse.json({ error: "Use an mp4, mov, or webm video." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const ext = type === "video/quicktime" ? ".mov" : type === "video/webm" ? ".webm" : ".mp4";
  const filename = `${id}${ext}`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  const exerciseId = form.get("exerciseId");
  const notes = form.get("notes");
  const created = await prisma.progressVideo.create({
    data: {
      id,
      filename,
      sizeBytes: file.size,
      exerciseId: typeof exerciseId === "string" && exerciseId ? exerciseId : null,
      notes: typeof notes === "string" && notes ? notes : null,
      status: "on-ec2",
    },
  });
  return NextResponse.json({
    video: {
      id: created.id,
      filename: created.filename,
      sizeBytes: created.sizeBytes,
      durationSec: created.durationSec,
      exerciseId: created.exerciseId,
      notes: created.notes,
      status: created.status,
      uploadedAt: created.uploadedAt.toISOString(),
      syncedAt: null,
      playbackPath: `/api/videos/${created.id}/file`,
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
