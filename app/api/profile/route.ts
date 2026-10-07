import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getServerEnv();
  return NextResponse.json({ heightCm: env.HEIGHT_CM, bodyweightKg: env.BODYWEIGHT_KG });
}
