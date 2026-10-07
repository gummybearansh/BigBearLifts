import type { Metadata } from "next";
import { ActiveWorkout } from "@/components/workout/ActiveWorkout";

export const metadata: Metadata = { title: "Workout" };

export default function WorkoutPage({ params }: { params: { id: string } }) {
  return <ActiveWorkout id={params.id} />;
}
