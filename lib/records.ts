export type SyncMeta = {
  _dirty: boolean;
  _syncedAt: string | null;
};

export type SetStyle = "straight" | "amrap";
export type SetType = "warmup" | "working" | "amrap" | "drop" | "failure";
export type UnitSystem = "kg" | "lb";
export type GoalType = "weight" | "bodyFat";
export type VideoStatus = "on-ec2" | "synced" | "deleted";
export type PrType = "1rm" | "weight" | "reps" | "volume";

export type ProgramRecord = {
  id: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
};

export type ProgramDayRecord = {
  id: string;
  programId: string;
  label: string;
  order: number;
  updatedAt: string;
};

export type ProgramExerciseRecord = {
  id: string;
  programDayId: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  notes: string | null;
  presetSetup: Record<string, string | number> | null;
  setStyle: SetStyle;
  updatedAt: string;
};

export type WorkoutRecord = {
  id: string;
  programDayId: string | null;
  label: string;
  location: string | null;
  startedAt: string;
  finishedAt: string | null;
  notes: string | null;
  totalVolume: number;
  totalSets: number;
  updatedAt: string;
};

export type WorkoutExerciseRecord = {
  id: string;
  workoutId: string;
  exerciseId: string;
  variantId: string | null;
  order: number;
  notes: string | null;
  setupValues: Record<string, string | number>;
  updatedAt: string;
};

export type SetPartial = {
  reps: number | null;
  weight: number | null;
  label: string | null;
};

export type WorkoutSetRecord = {
  id: string;
  workoutExerciseId: string;
  order: number;
  type: SetType;
  weight: number;
  reps: number;
  parentSetId: string | null;
  dropLevel: number | null;
  isCompleted: boolean;
  partials: SetPartial[] | null;
  createdAt: string;
  updatedAt: string;
};

export function partialsFromUnknown(value: unknown): SetPartial[] | null {
  if (!Array.isArray(value)) return null;
  const partials: SetPartial[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const reps = typeof row.reps === "number" ? row.reps : null;
    const weight = typeof row.weight === "number" ? row.weight : null;
    const label = typeof row.label === "string" && row.label.trim() ? row.label.trim() : null;
    if (reps === null && weight === null && label === null) continue;
    partials.push({ reps, weight, label });
  }
  return partials.length ? partials : null;
}

export type BodyMetricRecord = {
  id: string;
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  smmKg: number | null;
  notes: string | null;
  updatedAt: string;
};

export type GoalRecord = {
  id: string;
  type: GoalType;
  targetValue: number;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PrRecord = {
  id: string;
  exerciseId: string;
  variantId: string | null;
  type: PrType;
  value: number;
  contextWeight: number | null;
  achievedAt: string;
  workoutSetId: string | null;
  updatedAt: string;
};

export type VideoRecord = {
  id: string;
  filename: string;
  sizeBytes: number;
  durationSec: number | null;
  exerciseId: string | null;
  notes: string | null;
  status: VideoStatus;
  uploadedAt: string;
  syncedAt: string | null;
  playbackPath: string | null;
  updatedAt: string;
};

export type SettingsRecord = {
  id: "local";
  accent: string;
  unit: UnitSystem;
  restSec: number;
  barWeightKg: number;
  platesKg: number[];
  heightCm: number;
  bodyweightKg: number;
  workoutReminder: string;
  weighInReminder: string;
  remindersEnabled: boolean;
  lastSync: string | null;
  restDays: string[];
};

export type LocalProgram = ProgramRecord & SyncMeta;
export type LocalProgramDay = ProgramDayRecord & SyncMeta;
export type LocalProgramExercise = ProgramExerciseRecord & SyncMeta;
export type LocalWorkout = WorkoutRecord & SyncMeta;
export type LocalWorkoutExercise = WorkoutExerciseRecord & SyncMeta;
export type LocalWorkoutSet = WorkoutSetRecord & SyncMeta;
export type LocalBodyMetric = BodyMetricRecord & SyncMeta;
export type LocalGoal = GoalRecord & SyncMeta;
export type LocalPr = PrRecord & SyncMeta;
export type LocalVideo = VideoRecord & SyncMeta;

export function nowIso(): string {
  return new Date().toISOString();
}

export function dirtyStamp(): SyncMeta & { updatedAt: string } {
  return { updatedAt: nowIso(), _dirty: true, _syncedAt: null };
}

export function cleanStamp(updatedAt: string): SyncMeta & { updatedAt: string } {
  return { updatedAt, _dirty: false, _syncedAt: nowIso() };
}
