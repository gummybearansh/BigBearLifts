"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useExerciseSync } from "@/components/exercises/use-exercise-sync";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/catalog";
import { readExercise, saveExerciseLocal } from "@/lib/db/exercises";
import { pushExercise } from "@/lib/db/sync-exercises";
import type { ExerciseRecord } from "@/lib/exercise-record";

function toInput(exercise: ExerciseRecord) {
  return {
    id: exercise.id,
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: exercise.secondaryMuscles,
    equipment: exercise.equipment,
    isFavorite: exercise.isFavorite,
    isAssisted: exercise.isAssisted,
    restSec: exercise.restSec,
    setupFields: exercise.setupFields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      options: field.options,
      order: field.order,
      defaultValue: field.defaultValue,
    })),
  };
}

export function ExerciseDetail({ id }: { id: string }) {
  useExerciseSync();
  const exercise = useLiveQuery(() => readExercise(id), [id]);

  async function toggleFavorite(current: ExerciseRecord) {
    const next = { ...current, isFavorite: !current.isFavorite, updatedAt: new Date().toISOString() };
    await saveExerciseLocal(next, true);
    try {
      await pushExercise(toInput(next), current);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saved on this phone.");
    }
  }

  if (exercise === undefined) {
    return (
      <>
        <PageHeader title="Exercise" />
        <main className="px-4 py-6 text-sm text-muted-foreground">Loading…</main>
      </>
    );
  }

  if (exercise === null) {
    return (
      <>
        <PageHeader title="Exercise" />
        <main className="px-4">
          <EmptyState title="Not on this phone" body="This exercise is not in the local library." />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={exercise.name}
        action={
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            aria-pressed={exercise.isFavorite}
            aria-label={exercise.isFavorite ? "Remove favorite" : "Add favorite"}
            onClick={() => void toggleFavorite(exercise)}
          >
            <Star className={exercise.isFavorite ? "size-5 fill-primary text-primary" : "size-5 text-muted-foreground"} />
          </button>
        }
      />
      <main className="flex flex-col gap-4 px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <p className="text-sm text-muted-foreground">
          {MUSCLE_LABELS[exercise.primaryMuscle]} · {EQUIPMENT_LABELS[exercise.equipment]}
        </p>
        {exercise.secondaryMuscles.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Also {exercise.secondaryMuscles.map((muscle) => MUSCLE_LABELS[muscle]).join(", ")}
          </p>
        ) : null}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Custom</h2>
          {exercise.setupFields.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {exercise.setupFields.map((field) => (
                <li key={field.id} className="text-sm">
                  <span className="font-medium">{field.label}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {field.type}
                    {field.options.length > 0 ? ` · ${field.options.join(", ")}` : ""}
                    {field.defaultValue ? ` · default ${field.defaultValue}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Variants</h2>
          {exercise.variants.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Variants show up when setup changes during a workout.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {exercise.variants.map((variant) => (
                <li key={variant.id} className="text-sm">
                  {variant.label}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">History</h2>
          <p className="mt-2 text-sm text-muted-foreground">Records and the lift chart show up after workouts are logged.</p>
        </section>
        <Button asChild variant="secondary" className="w-full">
          <Link href={`/exercises/${exercise.id}/edit`}>Edit exercise</Link>
        </Button>
      </main>
    </>
  );
}
