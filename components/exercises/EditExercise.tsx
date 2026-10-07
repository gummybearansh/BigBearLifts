"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { readExercise } from "@/lib/db/exercises";

export function EditExercise({ id }: { id: string }) {
  const exercise = useLiveQuery(() => readExercise(id), [id]);

  if (exercise === undefined) {
    return (
      <>
        <PageHeader title="Edit exercise" />
        <main className="px-4 py-6 text-sm text-muted-foreground">Loading…</main>
      </>
    );
  }

  if (exercise === null) {
    return (
      <>
        <PageHeader title="Edit exercise" />
        <main className="px-4">
          <EmptyState title="Not on this phone" body="This exercise is not in the local library." />
        </main>
      </>
    );
  }

  return <ExerciseForm initial={exercise} />;
}
