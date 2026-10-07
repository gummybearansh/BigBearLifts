import { readdir, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

export async function GET() {
  const dir = uploadDir();
  let ec2Bytes = 0;
  try {
    const names = await readdir(dir);
    for (const name of names) {
      const info = await stat(path.join(dir, name));
      if (info.isFile()) ec2Bytes += info.size;
    }
  } catch {
    ec2Bytes = 0;
  }
  return NextResponse.json({ ec2Bytes, driveBytes: null });
}
