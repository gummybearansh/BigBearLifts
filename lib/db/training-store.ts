import { isEquipment, isMuscle } from "@/lib/catalog";
import { db } from "@/lib/db/dexie";
import { pullExercises, pushExercise, pushExerciseDelete } from "@/lib/db/sync-exercises";
import type { ExerciseRecord } from "@/lib/exercise-record";
import { createId } from "@/lib/ids";
import {
  cleanStamp,
  dirtyStamp,
  nowIso,
  type BodyMetricRecord,
  type GoalRecord,
  type LocalBodyMetric,
  type LocalGoal,
  type LocalPr,
  type LocalProgram,
  type LocalProgramDay,
  type LocalProgramExercise,
  type LocalVideo,
  type LocalWorkout,
  type LocalWorkoutExercise,
  type LocalWorkoutSet,
  type PrRecord,
  type ProgramDayRecord,
  type ProgramExerciseRecord,
  type ProgramRecord,
  type SettingsRecord,
  type VideoRecord,
  type WorkoutExerciseRecord,
  type WorkoutRecord,
  type WorkoutSetRecord,
} from "@/lib/records";
import type { VariantRecord } from "@/lib/exercise-record";
import { detectPrs, nextInRotation, warmupLoads } from "@/lib/training";
import { setVolumeKg } from "@/lib/volume";

const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

async function readProfile(): Promise<{ heightCm: number; bodyweightKg: number }> {
  try {
    const response = await fetch("/api/profile");
    if (!response.ok) return { heightCm: 0, bodyweightKg: 0 };
    const profile = (await response.json()) as { heightCm?: number; bodyweightKg?: number };
    return { heightCm: profile.heightCm ?? 0, bodyweightKg: profile.bodyweightKg ?? 0 };
  } catch {
    return { heightCm: 0, bodyweightKg: 0 };
  }
}

export async function ensureSettings(): Promise<SettingsRecord> {
  const existing = await db.settings.get("local");
  if (existing?.heightCm) return existing;
  const profile = await readProfile();
  if (existing) {
    const next = { ...existing, heightCm: profile.heightCm, restDays: existing.restDays ?? [] };
    await db.settings.put(next);
    return next;
  }
  const { heightCm, bodyweightKg } = profile;
  const created: SettingsRecord = {
    id: "local",
    accent: "#FF5A1F",
    unit: "kg",
    restSec: 180,
    barWeightKg: 20,
    platesKg: DEFAULT_PLATES,
    heightCm,
    bodyweightKg,
    workoutReminder: "17:00",
    weighInReminder: "07:00",
    remindersEnabled: true,
    lastSync: null,
    restDays: [],
  };
  await db.settings.put(created);
  return created;
}

export async function saveSettings(patch: Partial<Omit<SettingsRecord, "id">>): Promise<void> {
  const current = await ensureSettings();
  await db.settings.put({ ...current, ...patch, id: "local" });
}

function asProgram(row: ProgramRecord): LocalProgram {
  return { ...row, ...cleanStamp(row.updatedAt) };
}

function asDay(row: ProgramDayRecord): LocalProgramDay {
  return { ...row, ...cleanStamp(row.updatedAt) };
}

function asProgramExercise(row: ProgramExerciseRecord): LocalProgramExercise {
  return { ...row, ...cleanStamp(row.updatedAt) };
}

function asWorkout(row: WorkoutRecord): LocalWorkout {
  return { ...row, ...cleanStamp(row.updatedAt) };
}

function asWorkoutExercise(row: WorkoutExerciseRecord): LocalWorkoutExercise {
  return { ...row, ...cleanStamp(row.updatedAt) };
}

function asSet(row: WorkoutSetRecord): LocalWorkoutSet {
  return { ...row, ...cleanStamp(row.updatedAt) };
}

export type SyncBundle = {
  serverTime: string;
  programs: ProgramRecord[];
  programDays: ProgramDayRecord[];
  programExercises: ProgramExerciseRecord[];
  workouts: WorkoutRecord[];
  workoutExercises: WorkoutExerciseRecord[];
  workoutSets: WorkoutSetRecord[];
  bodyMetrics: BodyMetricRecord[];
  goals: GoalRecord[];
  prs: PrRecord[];
  videos: VideoRecord[];
  variants: VariantRecord[];
};

async function putIfClean<T extends { id: string; _dirty: boolean }>(
  get: (key: string) => Promise<T | undefined>,
  put: (row: T) => Promise<unknown>,
  row: T,
) {
  const local = await get(row.id);
  if (local?._dirty) return;
  await put(row);
}

export async function applySyncBundle(bundle: SyncBundle): Promise<void> {
  const buried = new Set((await db.tombstones.toArray()).map((row) => row.recordId));
  const buriedExercises = new Set(
    bundle.workoutExercises.filter((row) => buried.has(row.workoutId)).map((row) => row.id),
  );
  await db.transaction(
    "rw",
    [db.programs, db.programDays, db.programExercises, db.workouts, db.workoutExercises, db.workoutSets, db.bodyMetrics, db.goals, db.prs, db.videos, db.variants, db.settings],
    async () => {
      for (const row of bundle.programs) await putIfClean((key) => db.programs.get(key), (item) => db.programs.put(item), asProgram(row));
      for (const row of bundle.programDays) await putIfClean((key) => db.programDays.get(key), (item) => db.programDays.put(item), asDay(row));
      for (const row of bundle.programExercises)
        await putIfClean((key) => db.programExercises.get(key), (item) => db.programExercises.put(item), asProgramExercise(row));
      for (const row of bundle.workouts) {
        if (buried.has(row.id)) continue;
        await putIfClean((key) => db.workouts.get(key), (item) => db.workouts.put(item), asWorkout(row));
      }
      for (const row of bundle.workoutExercises) {
        if (buried.has(row.workoutId)) continue;
        await putIfClean((key) => db.workoutExercises.get(key), (item) => db.workoutExercises.put(item), asWorkoutExercise(row));
      }
      for (const row of bundle.workoutSets) {
        if (buriedExercises.has(row.workoutExerciseId)) continue;
        await putIfClean((key) => db.workoutSets.get(key), (item) => db.workoutSets.put(item), asSet(row));
      }
      for (const row of bundle.bodyMetrics)
        await putIfClean((key) => db.bodyMetrics.get(key), (item) => db.bodyMetrics.put(item), { ...row, ...cleanStamp(row.updatedAt) });
      for (const row of bundle.goals)
        await putIfClean((key) => db.goals.get(key), (item) => db.goals.put(item), { ...row, ...cleanStamp(row.updatedAt) });
      for (const row of bundle.prs)
        await putIfClean((key) => db.prs.get(key), (item) => db.prs.put(item), { ...row, ...cleanStamp(row.updatedAt) });
      for (const row of bundle.videos)
        await putIfClean((key) => db.videos.get(key), (item) => db.videos.put(item), { ...row, ...cleanStamp(row.updatedAt) });
      for (const row of bundle.variants ?? [])
        await putIfClean((key) => db.variants.get(key), (item) => db.variants.put(item), { ...row, ...cleanStamp(row.updatedAt) });
      const settings = await db.settings.get("local");
      if (settings) await db.settings.put({ ...settings, lastSync: bundle.serverTime });
    },
  );
}

async function pushDirtyTraining(): Promise<void> {
  const [programs, programDays, programExercises, workouts, workoutExercises, workoutSets, bodyMetrics, goals, prs, variants] =
    await Promise.all([
      db.programs.filter((row) => row._dirty).toArray(),
      db.programDays.filter((row) => row._dirty).toArray(),
      db.programExercises.filter((row) => row._dirty).toArray(),
      db.workouts.filter((row) => row._dirty).toArray(),
      db.workoutExercises.filter((row) => row._dirty).toArray(),
      db.workoutSets.filter((row) => row._dirty).toArray(),
      db.bodyMetrics.filter((row) => row._dirty).toArray(),
      db.goals.filter((row) => row._dirty).toArray(),
      db.prs.filter((row) => row._dirty).toArray(),
      db.variants.filter((row) => row._dirty).toArray(),
    ]);

  const dirty =
    programs.length +
    programDays.length +
    programExercises.length +
    workouts.length +
    workoutExercises.length +
    workoutSets.length +
    bodyMetrics.length +
    goals.length +
    prs.length +
    variants.length;
  if (dirty === 0) return;

  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      programs,
      programDays,
      programExercises,
      workouts,
      workoutExercises,
      workoutSets,
      bodyMetrics,
      goals,
      prs,
      variants,
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not sync.");
  }

  const mark = nowIso();
  await db.transaction(
    "rw",
    [db.programs, db.programDays, db.programExercises, db.workouts, db.workoutExercises, db.workoutSets, db.bodyMetrics, db.goals, db.prs, db.variants],
    async () => {
      for (const row of programs) await db.programs.update(row.id, { _dirty: false, _syncedAt: mark });
      for (const row of programDays) await db.programDays.update(row.id, { _dirty: false, _syncedAt: mark });
      for (const row of programExercises) await db.programExercises.update(row.id, { _dirty: false, _syncedAt: mark });
      for (const row of workouts) await db.workouts.update(row.id, { _dirty: false, _syncedAt: mark });
      for (const row of workoutExercises) await db.workoutExercises.update(row.id, { _dirty: false, _syncedAt: mark });
      for (const row of workoutSets) await db.workoutSets.update(row.id, { _dirty: false, _syncedAt: mark });
      for (const row of bodyMetrics) await db.bodyMetrics.update(row.id, { _dirty: false, _syncedAt: mark });
      for (const row of goals) await db.goals.update(row.id, { _dirty: false, _syncedAt: mark });
      for (const row of prs) await db.prs.update(row.id, { _dirty: false, _syncedAt: mark });
      for (const row of variants) await db.variants.update(row.id, { _dirty: false, _syncedAt: mark });
    },
  );
}

let syncing = false;

export async function syncTraining(): Promise<void> {
  if (syncing || typeof navigator !== "undefined" && !navigator.onLine) return;
  syncing = true;
  try {
    await ensureSettings();
    await pushTombstones();
    await pullExercises();
    const settings = await db.settings.get("local");
    const since = settings?.lastSync ?? "1970-01-01T00:00:00.000Z";
    const response = await fetch(`/api/sync?since=${encodeURIComponent(since)}`);
    if (!response.ok) throw new Error("Could not refresh.");
    const bundle = (await response.json()) as SyncBundle;
    await applySyncBundle(bundle);
    const dirtyExercises = await db.exercises.filter((row) => row._dirty).toArray();
    for (const exercise of dirtyExercises) {
      if (!isMuscle(exercise.primaryMuscle) || !isEquipment(exercise.equipment)) continue;
      const fields = await db.setupFields.where("exerciseId").equals(exercise.id).toArray();
      const variants = await db.variants.where("exerciseId").equals(exercise.id).toArray();
      const existing: ExerciseRecord = {
        id: exercise.id,
        name: exercise.name,
        primaryMuscle: exercise.primaryMuscle,
        secondaryMuscles: exercise.secondaryMuscles.filter(isMuscle),
        equipment: exercise.equipment,
        isFavorite: exercise.isFavorite,
        isAssisted: exercise.isAssisted,
        isCustom: exercise.isCustom,
        restSec: exercise.restSec,
        warmupScheme: exercise.warmupScheme,
        createdAt: exercise.createdAt,
        updatedAt: exercise.updatedAt,
        setupFields: fields,
        variants,
      };
      await pushExercise(
        {
          id: exercise.id,
          name: exercise.name,
          primaryMuscle: exercise.primaryMuscle,
          secondaryMuscles: existing.secondaryMuscles,
          equipment: exercise.equipment,
          isFavorite: exercise.isFavorite,
          isAssisted: exercise.isAssisted,
          restSec: exercise.restSec,
          setupFields: fields.map((field) => ({
            id: field.id,
            label: field.label,
            type: field.type,
            options: field.options,
            order: field.order,
            defaultValue: field.defaultValue,
          })),
        },
        existing,
      );
    }
    await pushDirtyTraining();
  } finally {
    syncing = false;
  }
}

async function pushTombstones(): Promise<void> {
  const tombstones = await db.tombstones.filter((row) => row._dirty).toArray();
  if (!tombstones.length) return;
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tombstones: tombstones.map((row) => ({ table: row.table, recordId: row.recordId })),
    }),
  });
  if (!response.ok) throw new Error("Could not sync.");
  const mark = nowIso();
  await db.transaction("rw", db.tombstones, async () => {
    for (const row of tombstones) await db.tombstones.update(row.id, { _dirty: false, _syncedAt: mark });
  });
}

export type DirtyItem = { table: string; id: string; label: string };

export async function listDirtyQueue(): Promise<DirtyItem[]> {
  const items: DirtyItem[] = [];
  const push = (table: string, rows: { id: string; _dirty: boolean }[], labelOf: (row: { id: string }) => string) => {
    for (const row of rows) {
      if (!row._dirty) continue;
      items.push({ table, id: row.id, label: labelOf(row) });
    }
  };
  const [exercises, setupFields, variants, programs, programDays, programExercises, workouts, workoutExercises, workoutSets, bodyMetrics, goals, prs, videos, tombstones] =
    await Promise.all([
      db.exercises.filter((row) => row._dirty).toArray(),
      db.setupFields.filter((row) => row._dirty).toArray(),
      db.variants.filter((row) => row._dirty).toArray(),
      db.programs.filter((row) => row._dirty).toArray(),
      db.programDays.filter((row) => row._dirty).toArray(),
      db.programExercises.filter((row) => row._dirty).toArray(),
      db.workouts.filter((row) => row._dirty).toArray(),
      db.workoutExercises.filter((row) => row._dirty).toArray(),
      db.workoutSets.filter((row) => row._dirty).toArray(),
      db.bodyMetrics.filter((row) => row._dirty).toArray(),
      db.goals.filter((row) => row._dirty).toArray(),
      db.prs.filter((row) => row._dirty).toArray(),
      db.videos.filter((row) => row._dirty).toArray(),
      db.tombstones.filter((row) => row._dirty).toArray(),
    ]);
  push("Exercises", exercises, (row) => exercises.find((item) => item.id === row.id)?.name ?? row.id.slice(0, 8));
  push("Setup fields", setupFields, (row) => setupFields.find((item) => item.id === row.id)?.label ?? row.id.slice(0, 8));
  push("Variants", variants, (row) => variants.find((item) => item.id === row.id)?.label ?? row.id.slice(0, 8));
  push("Programs", programs, (row) => programs.find((item) => item.id === row.id)?.name ?? row.id.slice(0, 8));
  push("Days", programDays, (row) => programDays.find((item) => item.id === row.id)?.label ?? row.id.slice(0, 8));
  push("Program exercises", programExercises, (row) => row.id.slice(0, 8));
  push("Workouts", workouts, (row) => workouts.find((item) => item.id === row.id)?.label ?? row.id.slice(0, 8));
  push("Workout exercises", workoutExercises, (row) => row.id.slice(0, 8));
  push("Sets", workoutSets, (row) => row.id.slice(0, 8));
  push("Body", bodyMetrics, (row) => bodyMetrics.find((item) => item.id === row.id)?.date ?? row.id.slice(0, 8));
  push("Goals", goals, (row) => goals.find((item) => item.id === row.id)?.type ?? row.id.slice(0, 8));
  push("PRs", prs, (row) => prs.find((item) => item.id === row.id)?.type ?? row.id.slice(0, 8));
  push("Videos", videos, (row) => videos.find((item) => item.id === row.id)?.filename ?? row.id.slice(0, 8));
  push("Deletes", tombstones, (row) => tombstones.find((item) => item.id === row.id)?.table ?? row.id.slice(0, 8));
  return items;
}

export async function readActiveProgram() {
  const programs = await db.programs.toArray();
  const active = programs.find((program) => program.isActive) ?? programs[0] ?? null;
  if (!active) return null;
  const days = (await db.programDays.where("programId").equals(active.id).toArray()).sort((a, b) => a.order - b.order);
  const dayIds = new Set(days.map((day) => day.id));
  const exercises = (await db.programExercises.toArray())
    .filter((row) => dayIds.has(row.programDayId))
    .sort((a, b) => a.order - b.order);
  return { program: active, days, exercises };
}

export async function discardWorkout(workoutId: string): Promise<void> {
  const blocks = await db.workoutExercises.where("workoutId").equals(workoutId).toArray();
  const sets = blocks.length
    ? await db.workoutSets.where("workoutExerciseId").anyOf(blocks.map((row) => row.id)).toArray()
    : [];
  const stamp = dirtyStamp();
  await db.transaction("rw", [db.workouts, db.workoutExercises, db.workoutSets, db.tombstones], async () => {
    if (sets.length) await db.workoutSets.bulkDelete(sets.map((row) => row.id));
    if (blocks.length) await db.workoutExercises.bulkDelete(blocks.map((row) => row.id));
    await db.workouts.delete(workoutId);
    await db.tombstones.add({
      id: createId(),
      table: "workouts",
      recordId: workoutId,
      updatedAt: stamp.updatedAt,
      _dirty: true,
      _syncedAt: null,
    });
  });
}

const openingDays = new Map<string, Promise<string>>();

export function startWorkoutForDay(dayId: string): Promise<string> {
  const current = openingDays.get(dayId);
  if (current) return current;
  const promise = openWorkoutForDay(dayId).finally(() => {
    if (openingDays.get(dayId) === promise) openingDays.delete(dayId);
  });
  openingDays.set(dayId, promise);
  return promise;
}

async function openWorkoutForDay(dayId: string): Promise<string> {
  const day = await db.programDays.get(dayId);
  if (!day) throw new Error("That day is not on the program.");
  const open = (await db.workouts.toArray()).find((workout) => workout.finishedAt === null);
  if (open?.programDayId === dayId) return open.id;
  if (open) {
    const blocks = await db.workoutExercises.where("workoutId").equals(open.id).toArray();
    const logged = blocks.length
      ? await db.workoutSets.where("workoutExerciseId").anyOf(blocks.map((row) => row.id)).toArray()
      : [];
    if (logged.some((set) => set.isCompleted)) return open.id;
    await discardWorkout(open.id);
  }

  const planned = (await db.programExercises.where("programDayId").equals(dayId).toArray()).sort(
    (a, b) => a.order - b.order,
  );
  const previous = (await db.workouts.toArray())
    .filter((workout) => workout.programDayId === dayId && workout.finishedAt)
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))[0];
  const previousExercises = previous
    ? await db.workoutExercises.where("workoutId").equals(previous.id).toArray()
    : [];
  const previousSets = previousExercises.length
    ? await db.workoutSets.where("workoutExerciseId").anyOf(previousExercises.map((row) => row.id)).toArray()
    : [];

  const workoutId = createId();
  const stamp = dirtyStamp();
  const workout: LocalWorkout = {
    id: workoutId,
    programDayId: dayId,
    label: day.label,
    location: null,
    startedAt: stamp.updatedAt,
    finishedAt: null,
    notes: null,
    totalVolume: 0,
    totalSets: 0,
    ...stamp,
  };

  const exerciseRows: LocalWorkoutExercise[] = [];
  const setRows: LocalWorkoutSet[] = [];

  for (const plannedExercise of planned) {
    const workoutExerciseId = createId();
    const prior = previousExercises.find((row) => row.exerciseId === plannedExercise.exerciseId);
    const priorSets = prior
      ? previousSets
          .filter((set) => set.workoutExerciseId === prior.id && set.type !== "warmup")
          .sort((a, b) => a.order - b.order)
      : [];
    exerciseRows.push({
      id: workoutExerciseId,
      workoutId,
      exerciseId: plannedExercise.exerciseId,
      variantId: prior?.variantId ?? null,
      order: plannedExercise.order,
      notes: null,
      setupValues: prior?.setupValues ?? plannedExercise.presetSetup ?? {},
      ...stamp,
    });

    const templates = priorSets.length
      ? priorSets
      : Array.from({ length: plannedExercise.targetSets }, (_, index) => ({
          type: plannedExercise.setStyle === "amrap" ? ("amrap" as const) : ("working" as const),
          weight: 0,
          reps: plannedExercise.targetRepsMin,
          parentSetId: null,
          dropLevel: null,
          order: index,
        }));

    templates.forEach((template, index) => {
      setRows.push({
        id: createId(),
        workoutExerciseId,
        order: index,
        type: template.type,
        weight: template.weight,
        reps: template.reps,
        parentSetId: null,
        dropLevel: template.dropLevel,
        partials: null,
        isCompleted: false,
        createdAt: stamp.updatedAt,
        ...stamp,
      });
    });
  }

  await db.transaction("rw", [db.workouts, db.workoutExercises, db.workoutSets], async () => {
    await db.workouts.add(workout);
    await db.workoutExercises.bulkAdd(exerciseRows);
    if (setRows.length) await db.workoutSets.bulkAdd(setRows);
  });
  return workoutId;
}

export async function nextDayId(): Promise<string | null> {
  const tree = await readActiveProgram();
  if (!tree) return null;
  const finished = (await db.workouts.toArray())
    .filter((workout) => workout.finishedAt && workout.programDayId)
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
  const last = finished[0];
  return nextInRotation(tree.days, last?.programDayId ?? null)?.id ?? null;
}

export async function touchWorkout(workoutId: string): Promise<void> {
  await db.workouts.update(workoutId, dirtyStamp());
}

export async function generateWarmups(workoutExerciseId: string, workingKg: number): Promise<void> {
  if (workingKg <= 0) return;
  const sets = await db.workoutSets.where("workoutExerciseId").equals(workoutExerciseId).toArray();
  if (sets.some((set) => set.type === "warmup")) return;
  const block = await db.workoutExercises.get(workoutExerciseId);
  const exercise = block ? await db.exercises.get(block.exerciseId) : undefined;
  const loads = warmupLoads(workingKg, exercise?.warmupScheme ?? null);
  const stamp = dirtyStamp();
  const warmups: LocalWorkoutSet[] = loads.map((load, index) => ({
    id: createId(),
    workoutExerciseId,
    order: index,
    type: "warmup",
    weight: load.weight,
    reps: load.reps,
    parentSetId: null,
    dropLevel: null,
    partials: null,
    isCompleted: false,
    createdAt: stamp.updatedAt,
    ...stamp,
  }));
  const shifted = sets.map((set) => ({ ...set, order: set.order + warmups.length, ...stamp }));
  await db.transaction("rw", db.workoutSets, async () => {
    await db.workoutSets.bulkPut([...warmups, ...shifted]);
  });
  if (block) await touchWorkout(block.workoutId);
}

export async function finishWorkout(workoutId: string): Promise<void> {
  const workout = await db.workouts.get(workoutId);
  if (!workout) throw new Error("Workout not found.");
  const blocks = await db.workoutExercises.where("workoutId").equals(workoutId).toArray();
  const sets = blocks.length
    ? await db.workoutSets.where("workoutExerciseId").anyOf(blocks.map((block) => block.id)).toArray()
    : [];
  const settings = await ensureSettings();
  const exercises = await db.exercises.toArray();
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  let totalVolume = 0;
  let totalSets = 0;
  const volumeByBlock = new Map<string, number>();
  for (const set of sets) {
    const block = blocks.find((item) => item.id === set.workoutExerciseId);
    const exercise = block ? byId.get(block.exerciseId) : undefined;
    const volume = setVolumeKg(
      set,
      { name: exercise?.name ?? "", equipment: exercise?.equipment ?? "other", isAssisted: exercise?.isAssisted ?? false },
      settings.bodyweightKg,
    );
    totalVolume += volume;
    if (set.isCompleted && set.type !== "warmup") totalSets += 1;
    if (block) volumeByBlock.set(block.id, (volumeByBlock.get(block.id) ?? 0) + volume);
  }

  const existing = await db.prs.toArray();
  const achievedAt = nowIso();
  const fresh = detectPrs(
    blocks.flatMap((block) =>
      sets
        .filter((set) => set.workoutExerciseId === block.id)
        .map((set) => ({
          exerciseId: block.exerciseId,
          variantId: block.variantId,
          set,
          sessionVolume: volumeByBlock.get(block.id) ?? 0,
        })),
    ),
    existing,
    achievedAt,
  );
  const stamp = dirtyStamp();
  await db.transaction("rw", [db.workouts, db.prs], async () => {
    await db.workouts.update(workoutId, {
      finishedAt: achievedAt,
      totalVolume,
      totalSets,
      ...stamp,
    });
    if (fresh.length) {
      await db.prs.bulkAdd(fresh.map((pr) => ({ ...pr, ...stamp, updatedAt: stamp.updatedAt })));
    }
  });
}

export async function saveBodyMetric(input: {
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  smmKg: number | null;
}): Promise<void> {
  const existing = (await db.bodyMetrics.toArray()).find((row) => row.date === input.date);
  const stamp = dirtyStamp();
  const row: LocalBodyMetric = {
    id: existing?.id ?? createId(),
    date: input.date,
    weightKg: input.weightKg,
    bodyFatPct: input.bodyFatPct,
    smmKg: input.smmKg,
    notes: existing?.notes ?? null,
    ...stamp,
  };
  await db.bodyMetrics.put(row);
  if (input.weightKg && input.weightKg > 0) await saveSettings({ bodyweightKg: input.weightKg });
}

export async function saveGoal(input: { type: "weight" | "bodyFat"; targetValue: number; deadline: string | null }): Promise<void> {
  const stamp = dirtyStamp();
  const row: LocalGoal = {
    id: createId(),
    type: input.type,
    targetValue: input.targetValue,
    deadline: input.deadline,
    createdAt: stamp.updatedAt,
    ...stamp,
  };
  await db.goals.add(row);
}

export async function importProgramJson(raw: unknown): Promise<void> {
  if (!raw || typeof raw !== "object") throw new Error("That file is not a program.");
  const body = raw as { name?: unknown; days?: unknown };
  if (typeof body.name !== "string" || !Array.isArray(body.days)) throw new Error("That file is not a program.");
  const exercises = await db.exercises.toArray();
  const byName = new Map(exercises.map((exercise) => [exercise.name, exercise]));
  const stamp = dirtyStamp();
  const programId = createId();
  const days: LocalProgramDay[] = [];
  const planned: LocalProgramExercise[] = [];
  body.days.forEach((day, dayIndex) => {
    if (!day || typeof day !== "object") return;
    const record = day as { label?: unknown; exercises?: unknown };
    const dayId = createId();
    days.push({
      id: dayId,
      programId,
      label: typeof record.label === "string" ? record.label : `Day ${dayIndex + 1}`,
      order: dayIndex,
      ...stamp,
    });
    if (!Array.isArray(record.exercises)) return;
    record.exercises.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const exercise = item as {
        name?: unknown;
        targetSets?: unknown;
        targetRepsMin?: unknown;
        targetRepsMax?: unknown;
        setStyle?: unknown;
        presetSetup?: unknown;
      };
      const match = typeof exercise.name === "string" ? byName.get(exercise.name) : undefined;
      if (!match) throw new Error("The program names an exercise that is not in the library.");
      planned.push({
        id: createId(),
        programDayId: dayId,
        exerciseId: match.id,
        order: index,
        targetSets: typeof exercise.targetSets === "number" ? exercise.targetSets : 3,
        targetRepsMin: typeof exercise.targetRepsMin === "number" ? exercise.targetRepsMin : 8,
        targetRepsMax: typeof exercise.targetRepsMax === "number" ? exercise.targetRepsMax : 8,
        notes: null,
        presetSetup:
          exercise.presetSetup && typeof exercise.presetSetup === "object" && !Array.isArray(exercise.presetSetup)
            ? (exercise.presetSetup as Record<string, string | number>)
            : null,
        setStyle: exercise.setStyle === "amrap" ? "amrap" : "straight",
        ...stamp,
      });
    });
  });
  if (!days.length) throw new Error("The program has no days.");
  await db.transaction("rw", [db.programs, db.programDays, db.programExercises], async () => {
    const current = await db.programs.toArray();
    for (const program of current) {
      if (program.isActive) await db.programs.update(program.id, { isActive: false, ...dirtyStamp() });
    }
    await db.programs.add({ id: programId, name: body.name as string, isActive: true, ...stamp });
    await db.programDays.bulkAdd(days);
    if (planned.length) await db.programExercises.bulkAdd(planned);
  });
}

export async function deleteExerciseAndSync(id: string): Promise<void> {
  await pushExerciseDelete(id);
}
