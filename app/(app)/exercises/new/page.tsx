import type { Metadata } from "next";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";

export const metadata: Metadata = { title: "New exercise" };

export default function NewExercisePage({
  searchParams,
}: {
  searchParams: { name?: string; returnTo?: string; addToWorkout?: string; addToDay?: string };
}) {
  return (
    <ExerciseForm
      defaultName={searchParams.name}
      returnTo={searchParams.returnTo}
      addToWorkout={searchParams.addToWorkout}
      addToDay={searchParams.addToDay}
    />
  );
}
