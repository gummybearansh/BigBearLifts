import Dexie, { type EntityTable } from "dexie";
import type { SetupFieldRecord, VariantRecord } from "@/lib/exercise-record";
import type {
  LocalBodyMetric,
  LocalGoal,
  LocalPr,
  LocalProgram,
  LocalProgramDay,
  LocalProgramExercise,
  LocalVideo,
  LocalWorkout,
  LocalWorkoutExercise,
  LocalWorkoutSet,
  SettingsRecord,
} from "@/lib/records";

export type LocalExercise = {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
  isFavorite: boolean;
  isAssisted: boolean;
  isCustom: boolean;
  restSec: number | null;
  warmupScheme: { percents: number[]; reps: number[] } | null;
  createdAt: string;
  updatedAt: string;
  _dirty: boolean;
  _syncedAt: string | null;
};

export type LocalSetupField = SetupFieldRecord & {
  _dirty: boolean;
  _syncedAt: string | null;
};

export type LocalVariant = VariantRecord & {
  _dirty: boolean;
  _syncedAt: string | null;
};

export type LocalTombstone = {
  id: string;
  table: string;
  recordId: string;
  updatedAt: string;
  _dirty: boolean;
  _syncedAt: string | null;
};

class BigBearDB extends Dexie {
  exercises!: EntityTable<LocalExercise, "id">;
  setupFields!: EntityTable<LocalSetupField, "id">;
  variants!: EntityTable<LocalVariant, "id">;
  programs!: EntityTable<LocalProgram, "id">;
  programDays!: EntityTable<LocalProgramDay, "id">;
  programExercises!: EntityTable<LocalProgramExercise, "id">;
  workouts!: EntityTable<LocalWorkout, "id">;
  workoutExercises!: EntityTable<LocalWorkoutExercise, "id">;
  workoutSets!: EntityTable<LocalWorkoutSet, "id">;
  bodyMetrics!: EntityTable<LocalBodyMetric, "id">;
  goals!: EntityTable<LocalGoal, "id">;
  prs!: EntityTable<LocalPr, "id">;
  videos!: EntityTable<LocalVideo, "id">;
  settings!: EntityTable<SettingsRecord, "id">;
  tombstones!: EntityTable<LocalTombstone, "id">;

  constructor() {
    super("bigbearlifts");
    this.version(1).stores({
      exercises: "id, name, primaryMuscle, equipment, isFavorite, updatedAt, _dirty",
      setupFields: "id, exerciseId, order, _dirty",
      variants: "id, exerciseId, _dirty",
    });
    this.version(2).stores({
      exercises: "id, name, primaryMuscle, equipment, isFavorite, updatedAt, _dirty",
      setupFields: "id, exerciseId, order, _dirty",
      variants: "id, exerciseId, _dirty",
      programs: "id, isActive, updatedAt, _dirty",
      programDays: "id, programId, order, _dirty",
      programExercises: "id, programDayId, exerciseId, order, _dirty",
      workouts: "id, programDayId, startedAt, finishedAt, updatedAt, _dirty",
      workoutExercises: "id, workoutId, exerciseId, order, _dirty",
      workoutSets: "id, workoutExerciseId, order, _dirty",
      bodyMetrics: "id, date, updatedAt, _dirty",
      goals: "id, type, updatedAt, _dirty",
      prs: "id, exerciseId, type, achievedAt, updatedAt, _dirty",
      videos: "id, status, uploadedAt, updatedAt, _dirty",
      settings: "id",
      tombstones: "id, table, recordId, _dirty",
    });
  }
}

export const db = new BigBearDB();

export function isTransientDbError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("cursor that doesn't exist") ||
    msg.includes("without an in-progress transaction") ||
    msg.includes("Indexed Database server") ||
    msg.includes("Transaction aborted") ||
    msg.includes("Connection to Indexed Database server lost")
  );
}

export async function withDbRetry<T>(operation: () => Promise<T>, retries = 2, delayMs = 300): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0 && isTransientDbError(error)) {
      console.warn("[bbl] WebKit IndexedDB error caught, reconnecting db:", error);
      try {
        if (db.isOpen()) db.close();
      } catch {
        // ignore
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        await db.open();
      } catch {
        // ignore
      }
      return withDbRetry(operation, retries - 1, delayMs * 2);
    }
    throw error;
  }
}
