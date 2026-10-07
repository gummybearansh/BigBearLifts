import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { exerciseInclude, toExerciseRecord } from "@/lib/db/exercise-mapper";
import { prisma } from "@/lib/db/prisma";
import { exercisePatchSchema } from "@/lib/validators";

type Context = { params: { id: string } };

export async function GET(_request: Request, { params }: Context) {
  const exercise = await prisma.exercise.findUnique({
    where: { id: params.id },
    include: exerciseInclude,
  });
  if (!exercise) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toExerciseRecord(exercise));
}

export async function PATCH(request: Request, { params }: Context) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = exercisePatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the exercise fields." }, { status: 400 });
  }

  const existing = await prisma.exercise.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.setupField.deleteMany({ where: { exerciseId: params.id } });
      return tx.exercise.update({
        where: { id: params.id },
        data: {
          name: parsed.data.name,
          primaryMuscle: parsed.data.primaryMuscle,
          secondaryMuscles: parsed.data.secondaryMuscles,
          equipment: parsed.data.equipment,
          isFavorite: parsed.data.isFavorite ?? existing.isFavorite,
          isAssisted: parsed.data.isAssisted ?? existing.isAssisted,
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
    });
    return NextResponse.json(toExerciseRecord(updated));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An exercise with that name already exists." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    await prisma.exercise.delete({ where: { id: params.id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: "This exercise is still used in a program." }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}
