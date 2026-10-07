import type { Metadata } from "next";
import { SessionDetail } from "@/components/progress/SessionDetail";

export const metadata: Metadata = { title: "Session" };

export default function SessionPage({ params }: { params: { workoutId: string } }) {
  return <SessionDetail workoutId={params.workoutId} />;
}
