"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/layout/EmptyState";
import { ListSkeleton } from "@/components/layout/ListSkeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { durationLabel, sessionLine } from "@/components/progress/format";
import { bodyweightOn, exerciseOf, useProgressData } from "@/components/progress/use-progress-data";
import { formatRepCount, formatSetLoad, formatWeight } from "@/lib/training";
import { sessionVolumeKg, workingReps, workingSetCount } from "@/lib/volume";
import type { LocalWorkoutExercise, LocalWorkoutSet } from "@/lib/records";

export function SessionDetail({ workoutId }: { workoutId: string }) {
  const data = useProgressData();
  if (data.loading) {
    return (
      <>
        <PageHeader title="Session" />
        <main className="px-4 py-4">
          <ListSkeleton />
        </main>
      </>
    );
  }

  const workout = data.workouts.find((item) => item.id === workoutId) ?? null;
  if (!workout || !workout.finishedAt) {
    return (
      <>
        <PageHeader title="Session" />
        <main className="px-4 py-4">
          <EmptyState
            icon={CalendarDays}
            title="Session not on this phone"
            body="This workout is not in the local history."
            action={
              <Link href="/progress" className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">
                Back to sessions
              </Link>
            }
          />
        </main>
      </>
    );
  }

  const blocks = data.blocks
    .filter((block) => block.workoutId === workout.id)
    .sort((a, b) => a.order - b.order);
  const allSets = data.sets.filter((set) => blocks.some((block) => block.id === set.workoutExerciseId));
  const entries = blocks.flatMap((block) => {
    const exercise = exerciseOf(data.exercises, block.exerciseId);
    return allSets
      .filter((set) => set.workoutExerciseId === block.id)
      .map((set) => ({ set, exercise }));
  });
  const bodyweightKg = bodyweightOn(workout.finishedAt, data.metrics, data.bodyweightKg);
  const tonnage = sessionVolumeKg(entries, bodyweightKg);
  const duration = durationLabel(workout.startedAt, workout.finishedAt);

  return (
    <>
      <PageHeader
        title={workout.label}
        action={
          <Link href="/progress" className="text-sm font-medium text-muted-foreground">
            Sessions
          </Link>
        }
      />
      <main className="flex min-w-0 flex-col gap-4 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{sessionLine(workout)}</p>
          <p className="mt-2 text-2xl font-semibold">{formatWeight(tonnage, data.unit)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {workingSetCount(allSets)} sets · {formatRepCount(workingReps(allSets))} reps
            {duration ? ` · ${duration}` : ""}
          </p>
          {workout.notes ? <p className="mt-3 text-sm leading-relaxed">{workout.notes}</p> : null}
        </section>
        {blocks.map((block) => (
          <ExerciseBlock
            key={block.id}
            block={block}
            sets={allSets.filter((set) => set.workoutExerciseId === block.id).sort((a, b) => a.order - b.order)}
            name={exerciseOf(data.exercises, block.exerciseId).name}
            equipment={exerciseOf(data.exercises, block.exerciseId).equipment}
            assisted={exerciseOf(data.exercises, block.exerciseId).isAssisted}
            chip={setupChip(block, data.variants)}
            unit={data.unit}
            bodyweightKg={bodyweightKg}
          />
        ))}
      </main>
    </>
  );
}

function setupChip(
  block: LocalWorkoutExercise,
  variants: { id: string; label: string }[],
): string | null {
  const variant = variants.find((item) => item.id === block.variantId);
  if (variant?.label) return variant.label;
  const parts = Object.entries(block.setupValues).map(([label, value]) => `${label} ${value}`);
  return parts.length ? parts.join(", ") : null;
}

function ExerciseBlock({
  block,
  sets,
  name,
  equipment,
  assisted,
  chip,
  unit,
  bodyweightKg,
}: {
  block: LocalWorkoutExercise;
  sets: LocalWorkoutSet[];
  name: string;
  equipment: string;
  assisted: boolean;
  chip: string | null;
  unit: "kg" | "lb";
  bodyweightKg: number;
}) {
  const exercise = { name, equipment, isAssisted: assisted };
  const tonnage = sessionVolumeKg(
    sets.map((set) => ({ set, exercise })),
    bodyweightKg,
  );
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-base font-medium">{name}</h2>
        {chip ? <span className="shrink-0 rounded-full bg-surface-elevated px-2 py-1 text-xs text-muted-foreground">{chip}</span> : null}
      </div>
      {block.notes ? <p className="mt-2 text-sm text-muted-foreground">{block.notes}</p> : null}
      <ul className="mt-3">
        {sets.map((set) => {
          const drop = set.type === "drop";
          return (
            <li
              key={set.id}
              className={`flex items-baseline justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0 ${
                drop ? "ml-3 border-l border-border pl-3" : ""
              } ${set.type === "warmup" ? "text-muted-foreground" : ""}`}
            >
              <span>
                <span className="mr-2 font-medium">{drop ? "D" : "W"}</span>
                {formatSetLoad(set, unit, equipment)}
              </span>
              <span className="text-muted-foreground">{setLabel(set)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        {formatWeight(tonnage, unit)} · {workingSetCount(sets)} working sets
      </p>
    </section>
  );
}

function setLabel(set: LocalWorkoutSet): string {
  if (set.type === "drop") return `drop ${set.dropLevel ?? 1}`;
  return set.type;
}
