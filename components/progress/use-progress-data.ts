"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalExercise } from "@/lib/db/dexie";
import type { LocalWorkout, LocalWorkoutExercise, LocalWorkoutSet, UnitSystem } from "@/lib/records";
import { sessionVolumeKg, workingReps, workingSetCount, type VolumeEntry, type VolumeExercise } from "@/lib/volume";

export function useProgressData() {
  const workouts = useLiveQuery(() => db.workouts.toArray());
  const blocks = useLiveQuery(() => db.workoutExercises.toArray());
  const sets = useLiveQuery(() => db.workoutSets.toArray());
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const variants = useLiveQuery(() => db.variants.toArray());
  const settings = useLiveQuery(() => db.settings.get("local"));
  const days = useLiveQuery(() => db.programDays.toArray());
  const metrics = useLiveQuery(() => db.bodyMetrics.toArray());
  const loading = [workouts, blocks, sets, exercises, variants, settings, days, metrics].some((value) => value === undefined);

  return {
    loading,
    workouts: workouts ?? [],
    blocks: blocks ?? [],
    sets: sets ?? [],
    exercises: exercises ?? [],
    variants: variants ?? [],
    days: days ?? [],
    metrics: metrics ?? [],
    bodyweightKg: settings?.bodyweightKg ?? 0,
    unit: settings?.unit ?? ("kg" as UnitSystem),
  };
}

export function bodyweightOn(
  when: string,
  metrics: { date: string; weightKg: number | null }[],
  fallback: number,
): number {
  const day = when.slice(0, 10);
  const known = metrics.filter((metric) => metric.weightKg != null && metric.weightKg > 0);
  const prior = known
    .filter((metric) => metric.date.slice(0, 10) <= day)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (prior?.weightKg) return prior.weightKg;
  const next = known
    .filter((metric) => metric.date.slice(0, 10) > day)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return next?.weightKg ?? fallback;
}

export function exerciseOf(exercises: LocalExercise[], exerciseId: string): VolumeExercise {
  const exercise = exercises.find((item) => item.id === exerciseId);
  return {
    name: exercise?.name ?? "Exercise",
    equipment: exercise?.equipment ?? "other",
    isAssisted: exercise?.isAssisted ?? false,
  };
}

export function entriesForBlocks(
  blocks: LocalWorkoutExercise[],
  sets: LocalWorkoutSet[],
  exercises: LocalExercise[],
): VolumeEntry[] {
  const entries: VolumeEntry[] = [];
  for (const block of blocks) {
    const exercise = exerciseOf(exercises, block.exerciseId);
    for (const set of sets) {
      if (set.workoutExerciseId === block.id) entries.push({ set, exercise });
    }
  }
  return entries;
}

export function finishedWorkouts(workouts: LocalWorkout[]): LocalWorkout[] {
  return workouts
    .filter((workout) => workout.finishedAt)
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
}

export function sessionStats(
  workout: LocalWorkout,
  blocks: LocalWorkoutExercise[],
  sets: LocalWorkoutSet[],
  exercises: LocalExercise[],
  bodyweightKg: number,
) {
  const mine = blocks.filter((block) => block.workoutId === workout.id);
  const mineSets = sets.filter((set) => mine.some((block) => block.id === set.workoutExerciseId));
  return {
    tonnage: sessionVolumeKg(entriesForBlocks(mine, mineSets, exercises), bodyweightKg),
    sets: workingSetCount(mineSets),
    reps: workingReps(mineSets),
  };
}
