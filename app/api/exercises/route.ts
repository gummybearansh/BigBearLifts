import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { exerciseInclude, toExerciseRecord } from "@/lib/db/exercise-mapper";
import { prisma } from "@/lib/db/prisma";
import { exerciseInputSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  const exercises = await prisma.exercise.findMany({
    include: exerciseInclude,
    orderBy: { name: "asc" },
  });
  return NextResponse.json(exercises.map(toExerciseRecord));
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = exerciseInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the exercise fields." }, { status: 400 });
  }

  try {
    const created = await prisma.exercise.create({
      data: {
        id: parsed.data.id,
        name: parsed.data.name,
        primaryMuscle: parsed.data.primaryMuscle,
        secondaryMuscles: parsed.data.secondaryMuscles,
        equipment: parsed.data.equipment,
        isFavorite: parsed.data.isFavorite ?? false,
        isAssisted: parsed.data.isAssisted ?? false,
        isCustom: true,
        restSec: parsed.data.restSec ?? null,
        setupFields: {
          create: parsed.data.setupFields.map((field, index) => ({
            id: field.id,
            label: field.label,
            type: field.type,
            options: field.type === "enum" ? field.options : [],
            order: index,
            defaultValue: field.defaultValue ?? null,
          })),
        },
      },
      include: exerciseInclude,
    });
    return NextResponse.json(toExerciseRecord(created), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An exercise with that name already exists." }, { status: 409 });
    }
    throw error;
  }
}
