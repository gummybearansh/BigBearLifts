import type { Metadata } from "next";
import { ExerciseForm } from "@/components/exercises/ExerciseForm";

export const metadata: Metadata = { title: "New exercise" };

export default function NewExercisePage() {
  return <ExerciseForm />;
}
