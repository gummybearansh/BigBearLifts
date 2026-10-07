import type { Metadata } from "next";
import { EditExercise } from "@/components/exercises/EditExercise";

export const metadata: Metadata = { title: "Edit exercise" };

export default function EditExercisePage({ params }: { params: { id: string } }) {
  return <EditExercise id={params.id} />;
}
