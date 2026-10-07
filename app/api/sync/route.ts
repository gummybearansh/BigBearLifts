import { NextResponse } from "next/server";
import { applyPush, readChanges } from "@/lib/server/sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sinceParam = new URL(request.url).searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(0);
  if (Number.isNaN(since.getTime())) {
    return NextResponse.json({ error: "Invalid since." }, { status: 400 });
  }
  return NextResponse.json(await readChanges(since));
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    await applyPush(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sync.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
