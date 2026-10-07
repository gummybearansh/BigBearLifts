import type { Metadata } from "next";
import { ExerciseDetail } from "@/components/exercises/ExerciseDetail";

export const metadata: Metadata = { title: "Exercise" };

export default function ExerciseDetailPage({ params }: { params: { id: string } }) {
  return <ExerciseDetail id={params.id} />;
}
