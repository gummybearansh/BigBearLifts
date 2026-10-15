import { Prisma } from "@prisma/client";
import { z } from "zod";
import { setupValuesFromUnknown } from "@/lib/exercise-record";
import { partialsFromUnknown } from "@/lib/records";
import { prisma } from "@/lib/db/prisma";

const iso = z.string().datetime();
const id = z.string().min(8).max(64);

const programSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  isActive: z.boolean(),
  updatedAt: iso,
});

const daySchema = z.object({
  id,
  programId: id,
  label: z.string().min(1).max(80),
  order: z.number().int().nonnegative(),
  updatedAt: iso,
});

const presetSchema = z.record(z.union([z.string(), z.number()]));

const programExerciseSchema = z.object({
  id,
  programDayId: id,
  exerciseId: id,
  order: z.number().int().nonnegative(),
  targetSets: z.number().int().positive(),
  targetRepsMin: z.number().int().positive(),
  targetRepsMax: z.number().int().positive(),
  notes: z.string().max(500).nullable(),
  presetSetup: presetSchema.nullable(),
  setStyle: z.enum(["straight", "amrap"]),
  updatedAt: iso,
});

const workoutSchema = z.object({
  id,
  programDayId: id.nullable(),
  label: z.string().min(1).max(80),
  location: z.string().max(80).nullable().default(null),
  startedAt: iso,
  finishedAt: iso.nullable(),
  notes: z.string().max(2000).nullable(),
  totalVolume: z.number().nonnegative(),
  totalSets: z.number().int().nonnegative(),
  updatedAt: iso,
});

const workoutExerciseSchema = z.object({
  id,
  workoutId: id,
  exerciseId: id,
  variantId: id.nullable(),
  order: z.number().int().nonnegative(),
  notes: z.string().max(500).nullable(),
  updatedAt: iso,
});

const partialSchema = z.object({
  reps: z.number().nullable(),
  weight: z.number().nullable(),
  label: z.string().max(80).nullable(),
});

const setSchema = z.object({
  id,
  workoutExerciseId: id,
  order: z.number().int().nonnegative(),
  type: z.enum(["warmup", "working", "amrap", "drop", "failure"]),
  weight: z.number(),
  reps: z.number().int().nonnegative(),
  parentSetId: id.nullable(),
  dropLevel: z.number().int().nullable(),
  isCompleted: z.boolean(),
  partials: z.array(partialSchema).max(8).nullable().default(null),
  createdAt: iso,
  updatedAt: iso,
});

const metricSchema = z.object({
  id,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().positive().nullable(),
  bodyFatPct: z.number().min(0).max(80).nullable(),
  smmKg: z.number().positive().nullable(),
  notes: z.string().max(500).nullable(),
  updatedAt: iso,
});

const goalSchema = z.object({
  id,
  type: z.enum(["weight", "bodyFat"]),
  targetValue: z.number().positive(),
  deadline: iso.nullable(),
  createdAt: iso,
  updatedAt: iso,
});

const prSchema = z.object({
  id,
  exerciseId: id,
  variantId: id.nullable(),
  type: z.enum(["1rm", "weight", "reps", "volume"]),
  value: z.number().positive(),
  contextWeight: z.number().positive().nullable(),
  achievedAt: iso,
  workoutSetId: id.nullable(),
  updatedAt: iso,
});

const variantSchema = z.object({
  id,
  exerciseId: id,
  setupValues: presetSchema,
  label: z.string().min(1).max(80),
  createdAt: iso,
  updatedAt: iso,
});

const pushSchema = z.object({
  programs: z.array(programSchema).default([]),
  programDays: z.array(daySchema).default([]),
  programExercises: z.array(programExerciseSchema).default([]),
  workouts: z.array(workoutSchema).default([]),
  workoutExercises: z.array(workoutExerciseSchema).default([]),
  workoutSets: z.array(setSchema).default([]),
  bodyMetrics: z.array(metricSchema).default([]),
  goals: z.array(goalSchema).default([]),
  prs: z.array(prSchema).default([]),
  variants: z.array(variantSchema).default([]),
  tombstones: z
    .array(z.object({ table: z.string(), recordId: id }))
    .default([]),
});

function newer(existing: Date | undefined, incoming: string): boolean {
  if (!existing) return true;
  return new Date(incoming).getTime() >= existing.getTime();
}

function jsonValue(value: Record<string, string | number> | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value ?? Prisma.JsonNull;
}

const DELETE_TABLES = new Set([
  "programs",
  "programDays",
  "programExercises",
  "workouts",
  "workoutExercises",
  "goals",
  "bodyMetrics",
]);

export async function readChanges(since: Date) {
  const where = { updatedAt: { gt: since } };
  const [programs, programDays, programExercises, workouts, workoutExercises, metrics, goals, prs, videos, variants] =
    await Promise.all([
      prisma.program.findMany({ where, orderBy: { updatedAt: "asc" } }),
      prisma.programDay.findMany({ where, orderBy: { order: "asc" } }),
      prisma.programExercise.findMany({ where, orderBy: { order: "asc" } }),
      prisma.workout.findMany({ where, orderBy: { startedAt: "desc" }, take: 200 }),
      prisma.workoutExercise.findMany({ where, include: { variant: true }, orderBy: { order: "asc" } }),
      prisma.bodyMetric.findMany({ where, orderBy: { date: "asc" } }),
      prisma.goal.findMany({ where, orderBy: { createdAt: "desc" } }),
      prisma.pR.findMany({ where, orderBy: { achievedAt: "desc" } }),
      prisma.progressVideo.findMany({ where, orderBy: { uploadedAt: "desc" } }),
      prisma.exerciseVariant.findMany({ where }),
    ]);

  const exerciseIds = workoutExercises.map((row) => row.id);
  const workoutSets = exerciseIds.length
    ? await prisma.workoutSet.findMany({
        where: { workoutExerciseId: { in: exerciseIds }, updatedAt: { gt: since } },
        orderBy: { order: "asc" },
      })
    : [];

  return {
    serverTime: new Date().toISOString(),
    programs: programs.map((row) => ({
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      updatedAt: row.updatedAt.toISOString(),
    })),
    programDays: programDays.map((row) => ({
      id: row.id,
      programId: row.programId,
      label: row.label,
      order: row.order,
      updatedAt: row.updatedAt.toISOString(),
    })),
    programExercises: programExercises.map((row) => ({
      id: row.id,
      programDayId: row.programDayId,
      exerciseId: row.exerciseId,
      order: row.order,
      targetSets: row.targetSets,
      targetRepsMin: row.targetRepsMin,
      targetRepsMax: row.targetRepsMax,
      notes: row.notes,
      presetSetup: setupValuesFromUnknown(row.presetSetup),
      setStyle: row.setStyle === "amrap" ? "amrap" : "straight",
      updatedAt: row.updatedAt.toISOString(),
    })),
    workouts: workouts.map((row) => ({
      id: row.id,
      programDayId: row.programDayId,
      label: row.label,
      location: row.location,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
      notes: row.notes,
      totalVolume: row.totalVolume,
      totalSets: row.totalSets,
      updatedAt: row.updatedAt.toISOString(),
    })),
    workoutExercises: workoutExercises.map((row) => ({
      id: row.id,
      workoutId: row.workoutId,
      exerciseId: row.exerciseId,
      variantId: row.variantId,
      order: row.order,
      notes: row.notes,
      setupValues: setupValuesFromUnknown(row.variant?.setupValues),
      updatedAt: row.updatedAt.toISOString(),
    })),
    workoutSets: workoutSets.map((row) => ({
      id: row.id,
      workoutExerciseId: row.workoutExerciseId,
      order: row.order,
      type: row.type,
      weight: row.weight,
      reps: row.reps,
      parentSetId: row.parentSetId,
      dropLevel: row.dropLevel,
      isCompleted: row.isCompleted,
      partials: partialsFromUnknown(row.partials),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    bodyMetrics: metrics.map((row) => ({
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      weightKg: row.weightKg,
      bodyFatPct: row.bodyFatPct,
      smmKg: row.smmKg,
      notes: row.notes,
      updatedAt: row.updatedAt.toISOString(),
    })),
    goals: goals.map((row) => ({
      id: row.id,
      type: row.type === "bodyFat" ? "bodyFat" : "weight",
      targetValue: row.targetValue,
      deadline: row.deadline?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    prs: prs.map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      variantId: row.variantId,
      type: row.type,
      value: row.value,
      contextWeight: row.contextWeight,
      achievedAt: row.achievedAt.toISOString(),
      workoutSetId: row.workoutSetId,
      updatedAt: row.updatedAt.toISOString(),
    })),
    videos: videos.map((row) => ({
      id: row.id,
      filename: row.filename,
      sizeBytes: row.sizeBytes,
      durationSec: row.durationSec,
      exerciseId: row.exerciseId,
      notes: row.notes,
      status: row.status,
      uploadedAt: row.uploadedAt.toISOString(),
      syncedAt: row.syncedAt?.toISOString() ?? null,
      playbackPath: row.status === "deleted" ? null : `/api/videos/${row.id}/file`,
      updatedAt: row.updatedAt.toISOString(),
    })),
    variants: variants.map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      setupValues: setupValuesFromUnknown(row.setupValues),
      label: row.label,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function applyPush(body: unknown): Promise<void> {
  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Sync payload was rejected.");
  }
  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    for (const tomb of data.tombstones) {
      if (!DELETE_TABLES.has(tomb.table)) continue;
      if (tomb.table === "programExercises") await tx.programExercise.deleteMany({ where: { id: tomb.recordId } });
      if (tomb.table === "programDays") await tx.programDay.deleteMany({ where: { id: tomb.recordId } });
      if (tomb.table === "programs") await tx.program.deleteMany({ where: { id: tomb.recordId } });
      if (tomb.table === "workouts") await tx.workout.deleteMany({ where: { id: tomb.recordId } });
      if (tomb.table === "workoutExercises") await tx.workoutExercise.deleteMany({ where: { id: tomb.recordId } });
      if (tomb.table === "goals") await tx.goal.deleteMany({ where: { id: tomb.recordId } });
      if (tomb.table === "bodyMetrics") await tx.bodyMetric.deleteMany({ where: { id: tomb.recordId } });
    }

    for (const row of data.variants) {
      const current = await tx.exerciseVariant.findUnique({ where: { id: row.id } });
      if (!newer(current?.updatedAt, row.updatedAt)) continue;
      const exercise = await tx.exercise.findUnique({ where: { id: row.exerciseId } });
      if (!exercise) continue;
      await tx.exerciseVariant.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          exerciseId: row.exerciseId,
          setupValues: row.setupValues,
          label: row.label,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
        update: {
          setupValues: row.setupValues,
          label: row.label,
          updatedAt: new Date(row.updatedAt),
        },
      });
    }

    for (const row of data.programs) {
      const current = await tx.program.findUnique({ where: { id: row.id } });
      if (!newer(current?.updatedAt, row.updatedAt)) continue;
      if (row.isActive) await tx.program.updateMany({ where: { NOT: { id: row.id } }, data: { isActive: false } });
      await tx.program.upsert({
        where: { id: row.id },
        create: { id: row.id, name: row.name, isActive: row.isActive, updatedAt: new Date(row.updatedAt) },
        update: { name: row.name, isActive: row.isActive, updatedAt: new Date(row.updatedAt) },
      });
    }

    for (const row of data.programDays) {
      const current = await tx.programDay.findUnique({ where: { id: row.id } });
      if (!newer(current?.updatedAt, row.updatedAt)) continue;
      const program = await tx.program.findUnique({ where: { id: row.programId } });
      if (!program) continue;
      await tx.programDay.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          programId: row.programId,
          label: row.label,
          order: row.order,
          updatedAt: new Date(row.updatedAt),
        },
        update: { label: row.label, order: row.order, updatedAt: new Date(row.updatedAt) },
      });
    }

    for (const row of data.programExercises) {
      const current = await tx.programExercise.findUnique({ where: { id: row.id } });
      if (!newer(current?.updatedAt, row.updatedAt)) continue;
      const day = await tx.programDay.findUnique({ where: { id: row.programDayId } });
      const exercise = await tx.exercise.findUnique({ where: { id: row.exerciseId } });
      if (!day || !exercise) continue;
      await tx.programExercise.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          programDayId: row.programDayId,
          exerciseId: row.exerciseId,
          order: row.order,
          targetSets: row.targetSets,
          targetRepsMin: row.targetRepsMin,
          targetRepsMax: row.targetRepsMax,
          notes: row.notes,
          presetSetup: jsonValue(row.presetSetup),
          setStyle: row.setStyle,
          updatedAt: new Date(row.updatedAt),
        },
        update: {
          order: row.order,
          targetSets: row.targetSets,
          targetRepsMin: row.targetRepsMin,
          targetRepsMax: row.targetRepsMax,
          notes: row.notes,
          presetSetup: jsonValue(row.presetSetup),
          setStyle: row.setStyle,
          updatedAt: new Date(row.updatedAt),
        },
      });
    }

    for (const row of data.workouts) {
      const current = await tx.workout.findUnique({ where: { id: row.id } });
      if (!newer(current?.updatedAt, row.updatedAt)) continue;
      await tx.workout.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          programDayId: row.programDayId,
          label: row.label,
          location: row.location,
          startedAt: new Date(row.startedAt),
          finishedAt: row.finishedAt ? new Date(row.finishedAt) : null,
          notes: row.notes,
          totalVolume: row.totalVolume,
          totalSets: row.totalSets,
          updatedAt: new Date(row.updatedAt),
        },
        update: {
          programDayId: row.programDayId,
          label: row.label,
          location: row.location,
          finishedAt: row.finishedAt ? new Date(row.finishedAt) : null,
          notes: row.notes,
          totalVolume: row.totalVolume,
          totalSets: row.totalSets,
          updatedAt: new Date(row.updatedAt),
        },
      });
    }

    for (const row of data.workoutExercises) {
      const current = await tx.workoutExercise.findUnique({ where: { id: row.id } });
      if (!newer(current?.updatedAt, row.updatedAt)) continue;
      const workout = await tx.workout.findUnique({ where: { id: row.workoutId } });
      const exercise = await tx.exercise.findUnique({ where: { id: row.exerciseId } });
      if (!workout || !exercise) continue;
      await tx.workoutExercise.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          workoutId: row.workoutId,
          exerciseId: row.exerciseId,
          variantId: row.variantId,
          order: row.order,
          notes: row.notes,
          updatedAt: new Date(row.updatedAt),
        },
        update: {
          variantId: row.variantId,
          order: row.order,
          notes: row.notes,
          updatedAt: new Date(row.updatedAt),
        },
      });
    }

    const setParents = data.workoutSets.filter((row) => !row.parentSetId);
    const setChildren = data.workoutSets.filter((row) => row.parentSetId);
    for (const row of [...setParents, ...setChildren]) {
      const current = await tx.workoutSet.findUnique({ where: { id: row.id } });
      if (!newer(current?.updatedAt, row.updatedAt)) continue;
      const block = await tx.workoutExercise.findUnique({ where: { id: row.workoutExerciseId } });
      if (!block) continue;
      const payload = {
        order: row.order,
        type: row.type,
        weight: row.weight,
        reps: row.reps,
        parentSetId: row.parentSetId,
        dropLevel: row.dropLevel,
        isCompleted: row.isCompleted,
        partials: row.partials ?? Prisma.DbNull,
        updatedAt: new Date(row.updatedAt),
      };
      await tx.workoutSet.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          workoutExerciseId: row.workoutExerciseId,
          createdAt: new Date(row.createdAt),
          ...payload,
        },
        update: payload,
      });
    }

    for (const row of data.bodyMetrics) {
      const date = new Date(`${row.date}T00:00:00.000Z`);
      const current = await tx.bodyMetric.findUnique({ where: { date } });
      if (current && !newer(current.updatedAt, row.updatedAt)) continue;
      const values = {
        weightKg: row.weightKg,
        bodyFatPct: row.bodyFatPct,
        smmKg: row.smmKg,
        notes: row.notes,
        updatedAt: new Date(row.updatedAt),
      };
      if (current) {
        await tx.bodyMetric.update({ where: { id: current.id }, data: values });
      } else {
        await tx.bodyMetric.create({ data: { id: row.id, date, ...values } });
      }
    }

    for (const row of data.goals) {
      const current = await tx.goal.findUnique({ where: { id: row.id } });
      if (!newer(current?.updatedAt, row.updatedAt)) continue;
      await tx.goal.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          type: row.type,
          targetValue: row.targetValue,
          deadline: row.deadline ? new Date(row.deadline) : null,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
        update: {
          targetValue: row.targetValue,
          deadline: row.deadline ? new Date(row.deadline) : null,
          updatedAt: new Date(row.updatedAt),
        },
      });
    }

    for (const row of data.prs) {
      const current = await tx.pR.findUnique({ where: { id: row.id } });
      if (!newer(current?.updatedAt, row.updatedAt)) continue;
      const exercise = await tx.exercise.findUnique({ where: { id: row.exerciseId } });
      if (!exercise) continue;
      await tx.pR.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          exerciseId: row.exerciseId,
          variantId: row.variantId,
          type: row.type,
          value: row.value,
          contextWeight: row.contextWeight,
          achievedAt: new Date(row.achievedAt),
          workoutSetId: row.workoutSetId,
          updatedAt: new Date(row.updatedAt),
        },
        update: {
          value: row.value,
          updatedAt: new Date(row.updatedAt),
        },
      });
    }
  });
}
