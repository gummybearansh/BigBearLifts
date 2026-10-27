import type { PrRecord, PrType, SetPartial, UnitSystem, WorkoutSetRecord } from "@/lib/records";

export { sessionVolumeKg, setVolumeKg } from "@/lib/volume";

const LB_PER_KG = 2.2046226218;

export function kgToDisplay(kg: number, unit: UnitSystem): number {
  const value = unit === "lb" ? kg * LB_PER_KG : kg;
  return Math.round(value * 10) / 10;
}

export function displayToKg(value: number, unit: UnitSystem): number {
  const kg = unit === "lb" ? value / LB_PER_KG : value;
  return Math.round(kg * 1000) / 1000;
}

export function formatWeight(kg: number, unit: UnitSystem): string {
  return `${kgToDisplay(kg, unit)} ${unit}`;
}

export function formatRepCount(reps: number): string {
  return Number.isInteger(reps) ? String(reps) : reps.toFixed(1);
}

export function formatSetLoad(
  set: { weight: number; reps: number; partials?: SetPartial[] | null },
  unit: UnitSystem,
  equipment: string,
): string {
  if (set.partials?.length) return set.partials.map((part) => formatPartial(part, unit, equipment)).join(" + ");
  return `${formatLoad(set.weight, unit, equipment)} × ${formatRepCount(set.reps)}`;
}

function formatPartial(part: SetPartial, unit: UnitSystem, equipment: string): string {
  const reps = part.reps == null ? null : formatRepCount(part.reps);
  const weight = part.weight == null ? null : formatLoad(part.weight, unit, equipment);
  const label = part.label;
  if (weight && reps) return label ? `${weight} × ${reps} ${label}` : `${weight} × ${reps}`;
  if (reps && label) return `${reps} ${label}`;
  if (weight && label) return `${label} ${weight}`;
  if (weight) return weight;
  if (reps) return reps;
  return label ?? "";
}

function formatLoad(kg: number, unit: UnitSystem, equipment: string): string {
  if (kg === 0 && equipment === "bodyweight") return "bw";
  return formatWeight(kg, unit);
}

export function epley(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function nextInRotation<T extends { id: string; order: number }>(
  days: T[],
  lastDayId: string | null,
): T | null {
  const sorted = [...days].sort((a, b) => a.order - b.order);
  const first = sorted[0];
  if (!first) return null;
  if (!lastDayId) return first;
  const index = sorted.findIndex((day) => day.id === lastDayId);
  if (index < 0) return first;
  return sorted[(index + 1) % sorted.length] ?? first;
}

export function countableSet(type: string): boolean {
  return type === "working" || type === "amrap" || type === "drop" || type === "failure" || type === "negative";
}

export function platesPerSide(
  totalKg: number,
  barKg: number,
  available: number[],
): { plates: number[]; remainderKg: number } {
  let remaining = (totalKg - barKg) / 2;
  if (remaining <= 0.05) {
    return { plates: [], remainderKg: Math.max(0, Math.round((totalKg - barKg) * 100) / 100) };
  }
  const plates: number[] = [];
  for (const plate of [...available].sort((a, b) => b - a)) {
    while (remaining + 0.001 >= plate) {
      plates.push(plate);
      remaining -= plate;
    }
  }
  return { plates, remainderKg: Math.max(0, Math.round(remaining * 100) / 100) };
}

export function localDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function trainingStreak(finishedAt: string[], now = new Date(), restDays: string[] = []): number {
  const trained = new Set(finishedAt.map(localDateKey));
  const markedRest = new Set(restDays.filter((day) => !trained.has(day)));
  const today = localDateKey(now);
  const kind = (key: string): "train" | "rest" | "open" => {
    if (trained.has(key)) return "train";
    if (key === today && !markedRest.has(key)) return "open";
    return "rest";
  };

  let cursor = today;
  if (kind(cursor) === "open") cursor = addDaysKey(cursor, -1);

  let count = 0;
  let pendingRest = false;
  for (let step = 0; step < 366; step += 1) {
    const state = kind(cursor);
    if (state === "train") {
      if (pendingRest) count += 1;
      pendingRest = false;
      count += 1;
    } else if (pendingRest) {
      break;
    } else {
      pendingRest = true;
    }
    cursor = addDaysKey(cursor, -1);
  }
  return count;
}

export function bmi(weightKg: number, heightCm: number): number | null {
  if (weightKg <= 0 || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return Math.round((weightKg / (meters * meters)) * 10) / 10;
}

export function ffmi(weightKg: number, heightCm: number, bodyFatPct: number | null): number | null {
  if (bodyFatPct === null || weightKg <= 0 || heightCm <= 0) return null;
  const meters = heightCm / 100;
  const lean = weightKg * (1 - bodyFatPct / 100);
  return Math.round((lean / (meters * meters)) * 10) / 10;
}

export type PrCandidate = {
  exerciseId: string;
  variantId: string | null;
  set: WorkoutSetRecord;
  sessionVolume: number;
};

export function detectPrs(candidates: PrCandidate[], existing: PrRecord[], achievedAt: string): PrRecord[] {
  const created: PrRecord[] = [];
  const best = new Map<string, PrRecord>();
  for (const pr of existing) best.set(prKey(pr.exerciseId, pr.variantId, pr.type, pr.contextWeight), pr);

  for (const candidate of candidates) {
    if (!countableSet(candidate.set.type) || !candidate.set.isCompleted) continue;
    const { weight, reps } = candidate.set;
    if (weight <= 0 || reps <= 0) continue;
    const estimate = epley(weight, reps);
    consider(created, best, candidate, "1rm", estimate, null, achievedAt);
    consider(created, best, candidate, "weight", weight, null, achievedAt);
    consider(created, best, candidate, "reps", reps, weight, achievedAt);
    consider(created, best, candidate, "volume", candidate.sessionVolume, null, achievedAt);
  }
  return created;
}

function prKey(exerciseId: string, variantId: string | null, type: PrType, contextWeight: number | null): string {
  return `${exerciseId}|${variantId ?? ""}|${type}|${contextWeight ?? ""}`;
}

function consider(
  created: PrRecord[],
  best: Map<string, PrRecord>,
  candidate: PrCandidate,
  type: PrType,
  value: number,
  contextWeight: number | null,
  achievedAt: string,
) {
  if (value <= 0) return;
  const key = prKey(candidate.exerciseId, candidate.variantId, type, contextWeight);
  const current = best.get(key);
  if (current && current.value >= value) return;
  const record: PrRecord = {
    id: crypto.randomUUID(),
    exerciseId: candidate.exerciseId,
    variantId: candidate.variantId,
    type,
    value,
    contextWeight,
    achievedAt,
    workoutSetId: candidate.set.id,
    updatedAt: achievedAt,
  };
  best.set(key, record);
  created.push(record);
}

export { isSetType } from "@/lib/records";
