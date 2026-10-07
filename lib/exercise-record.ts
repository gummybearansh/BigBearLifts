import type { Equipment, Muscle, SetupFieldType } from "@/lib/catalog";
import { isEquipment, isMuscle } from "@/lib/catalog";

export type WarmupScheme = {
  percents: number[];
  reps: number[];
};

export type SetupFieldRecord = {
  id: string;
  exerciseId: string;
  label: string;
  type: SetupFieldType;
  options: string[];
  order: number;
  defaultValue: string | null;
  updatedAt: string;
};

export type VariantRecord = {
  id: string;
  exerciseId: string;
  setupValues: Record<string, string | number>;
  label: string;
  createdAt: string;
  updatedAt: string;
};

export type ExerciseRecord = {
  id: string;
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  isFavorite: boolean;
  isAssisted: boolean;
  isCustom: boolean;
  restSec: number | null;
  warmupScheme: WarmupScheme | null;
  createdAt: string;
  updatedAt: string;
  setupFields: SetupFieldRecord[];
  variants: VariantRecord[];
};

export function warmupFromUnknown(value: unknown): WarmupScheme | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.percents) || !Array.isArray(record.reps)) return null;
  if (!record.percents.every((item) => typeof item === "number")) return null;
  if (!record.reps.every((item) => typeof item === "number")) return null;
  return { percents: record.percents, reps: record.reps };
}

export function setupValuesFromUnknown(value: unknown): Record<string, string | number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string | number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "number") result[key] = entry;
  }
  return result;
}

export function musclesFromUnknown(values: string[]): Muscle[] {
  return values.filter(isMuscle);
}

export function equipmentFromUnknown(value: string): Equipment {
  return isEquipment(value) ? value : "other";
}

export function muscleFromUnknown(value: string): Muscle {
  return isMuscle(value) ? value : "chest";
}
