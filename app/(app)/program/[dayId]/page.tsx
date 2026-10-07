import type { Metadata } from "next";
import { OpenProgramWorkout } from "@/components/program/OpenProgramWorkout";

export const metadata: Metadata = { title: "Workout" };

export default function ProgramDayPage({ params }: { params: { dayId: string } }) {
  return <OpenProgramWorkout dayId={params.dayId} />;
}
