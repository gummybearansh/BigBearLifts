import type { Metadata } from "next";
import { EditExercise } from "@/components/exercises/EditExercise";

export const metadata: Metadata = { title: "Edit exercise" };

export default function EditExercisePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { returnTo?: string; replaceWorkoutExercise?: string };
}) {
  return (
    <EditExercise
      id={params.id}
      returnTo={searchParams.returnTo}
      replaceWorkoutExercise={searchParams.replaceWorkoutExercise}
    />
  );
}
