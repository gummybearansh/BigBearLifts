import { db } from "@/lib/db/dexie";
import { deleteExerciseLocal, saveExerciseLocal } from "@/lib/db/exercises";
import type { ExerciseRecord } from "@/lib/exercise-record";
import { exerciseInputSchema, type ExerciseInput } from "@/lib/validators";

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    return "Could not save.";
  }
  return "Could not save.";
}

export async function pullExercises(): Promise<void> {
  const response = await fetch("/api/exercises");
  if (!response.ok) return;
  const body: unknown = await response.json();
  if (!Array.isArray(body)) return;
  const remoteIds = new Set<string>();
  for (const entry of body) {
    const parsed = exerciseRecordSchema(entry);
    if (!parsed) continue;
    remoteIds.add(parsed.id);
    const row = await db.exercises.get(parsed.id);
    if (row?._dirty) continue;
    await saveExerciseLocal(parsed, false);
  }

  const localRows = await db.exercises.toArray();
  for (const row of localRows) {
    if (!row._dirty && !remoteIds.has(row.id)) await deleteExerciseLocal(row.id);
  }
}

function exerciseRecordSchema(value: unknown): ExerciseRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as ExerciseRecord;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;
  if (!Array.isArray(record.setupFields) || !Array.isArray(record.variants)) return null;
  return record;
}

export async function pushExercise(input: ExerciseInput, existing: ExerciseRecord | null): Promise<ExerciseRecord> {
  const parsed = exerciseInputSchema.parse(input);
  const response = await fetch(existing ? `/api/exercises/${existing.id}` : "/api/exercises", {
    method: existing ? "PATCH" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...parsed, id: existing?.id ?? parsed.id }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const saved: unknown = await response.json();
  const record = exerciseRecordSchema(saved);
  if (!record) throw new Error("Could not save.");
  await saveExerciseLocal(record, false);
  return record;
}

export async function pushExerciseDelete(id: string): Promise<void> {
  const response = await fetch(`/api/exercises/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(await readError(response));
  await deleteExerciseLocal(id);
}
