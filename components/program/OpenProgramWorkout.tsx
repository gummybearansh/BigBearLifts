"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { startWorkoutForDay } from "@/lib/db/training-store";

export function OpenProgramWorkout({ dayId }: { dayId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("Opening workout…");

  useEffect(() => {
    let gone = false;
    startWorkoutForDay(dayId)
      .then((id) => {
        if (!gone) router.replace(`/workout/${id}`);
      })
      .catch((error: unknown) => {
        if (!gone) setMessage(error instanceof Error ? error.message : "Could not open that workout.");
      });
    return () => {
      gone = true;
    };
  }, [dayId, router]);

  return <main className="px-4 py-8 text-sm text-muted-foreground">{message}</main>;
}
