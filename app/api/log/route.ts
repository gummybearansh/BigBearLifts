import { NextResponse } from "next/server";
import { z } from "zod";
import { logFailure } from "@/lib/server/app-log";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.string().min(1).max(40),
  message: z.string().min(1).max(500),
  detail: z.string().max(1500).optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid log." }, { status: 400 });
  await logFailure(parsed.data.kind, parsed.data.message, parsed.data.detail ?? "");
  return new NextResponse(null, { status: 204 });
}
