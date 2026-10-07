import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format");
  const [exercises, workouts, sets, metrics, prs] = await Promise.all([
    prisma.exercise.findMany({ orderBy: { name: "asc" } }),
    prisma.workout.findMany({ include: { exercises: { include: { sets: true } } }, orderBy: { startedAt: "desc" } }),
    prisma.workoutSet.findMany(),
    prisma.bodyMetric.findMany({ orderBy: { date: "asc" } }),
    prisma.pR.findMany({ orderBy: { achievedAt: "desc" } }),
  ]);

  if (format === "csv") {
    const lines = ["date,label,exercise,type,weight,reps"];
    for (const workout of workouts) {
      for (const block of workout.exercises) {
        const name = exercises.find((exercise) => exercise.id === block.exerciseId)?.name ?? "";
        for (const set of block.sets) {
          lines.push(
            [workout.startedAt.toISOString(), workout.label, name, set.type, set.weight, set.reps]
              .map((value) => `"${String(value).replaceAll('"', '""')}"`)
              .join(","),
          );
        }
      }
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=bigbearlifts.csv",
      },
    });
  }

  return NextResponse.json({ exercises, workouts, sets, metrics, prs });
}
