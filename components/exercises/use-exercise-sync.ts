"use client";

import { useEffect } from "react";
import { pullExercises } from "@/lib/db/sync-exercises";

export function useExerciseSync() {
  useEffect(() => {
    void pullExercises().catch(() => undefined);
  }, []);
}
