import { db, type LocalExercise, type LocalSetupField, type LocalVariant } from "@/lib/db/dexie";
import {
  equipmentFromUnknown,
  muscleFromUnknown,
  musclesFromUnknown,
  type ExerciseRecord,
  type SetupFieldRecord,
} from "@/lib/exercise-record";

function toRecord(
  exercise: LocalExercise,
  setupFields: LocalSetupField[],
  variants: LocalVariant[],
): ExerciseRecord {
  return {
    id: exercise.id,
    name: exercise.name,
    primaryMuscle: muscleFromUnknown(exercise.primaryMuscle),
    secondaryMuscles: musclesFromUnknown(exercise.secondaryMuscles),
    equipment: equipmentFromUnknown(exercise.equipment),
    isFavorite: exercise.isFavorite,
    isAssisted: exercise.isAssisted,
    isCustom: exercise.isCustom,
    restSec: exercise.restSec,
    warmupScheme: exercise.warmupScheme,
    createdAt: exercise.createdAt,
    updatedAt: exercise.updatedAt,
    setupFields: setupFields
      .map((field) => ({
        id: field.id,
        exerciseId: field.exerciseId,
        label: field.label,
        type: field.type,
        options: field.options,
        order: field.order,
        defaultValue: field.defaultValue,
        updatedAt: field.updatedAt,
      }))
      .sort((a, b) => a.order - b.order),
    variants: variants.map((variant) => ({
      id: variant.id,
      exerciseId: variant.exerciseId,
      setupValues: variant.setupValues,
      label: variant.label,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    })),
  };
}

export async function readExercise(id: string): Promise<ExerciseRecord | null> {
  const exercise = await db.exercises.get(id);
  if (!exercise) return null;
  const setupFields = await db.setupFields.where("exerciseId").equals(id).toArray();
  const variants = await db.variants.where("exerciseId").equals(id).toArray();
  return toRecord(exercise, setupFields, variants);
}

export async function readExercises(): Promise<ExerciseRecord[]> {
  const exercises = await db.exercises.orderBy("name").toArray();
  const setupFields = await db.setupFields.toArray();
  const variants = await db.variants.toArray();
  return exercises.map((exercise) =>
    toRecord(
      exercise,
      setupFields.filter((field) => field.exerciseId === exercise.id),
      variants.filter((variant) => variant.exerciseId === exercise.id),
    ),
  );
}

export async function saveExerciseLocal(exercise: ExerciseRecord, dirty: boolean): Promise<void> {
  const now = new Date().toISOString();
  const exerciseRow: LocalExercise = {
    id: exercise.id,
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: exercise.secondaryMuscles,
    equipment: exercise.equipment,
    isFavorite: exercise.isFavorite,
    isAssisted: exercise.isAssisted,
    isCustom: exercise.isCustom,
    restSec: exercise.restSec,
    warmupScheme: exercise.warmupScheme,
    createdAt: exercise.createdAt,
    updatedAt: exercise.updatedAt || now,
    _dirty: dirty,
    _syncedAt: dirty ? null : now,
  };
  const fieldRows: LocalSetupField[] = exercise.setupFields.map((field) => ({
    ...field,
    _dirty: dirty,
    _syncedAt: dirty ? null : now,
  }));
  const variantRows: LocalVariant[] = exercise.variants.map((variant) => ({
    ...variant,
    _dirty: dirty,
    _syncedAt: dirty ? null : now,
  }));

  await db.transaction("rw", db.exercises, db.setupFields, db.variants, async () => {
    const existingFields = await db.setupFields.where("exerciseId").equals(exercise.id).toArray();
    const nextFieldIds = new Set(fieldRows.map((field) => field.id));
    await db.setupFields.bulkDelete(
      existingFields.filter((field) => !nextFieldIds.has(field.id)).map((field) => field.id),
    );
    await db.exercises.put(exerciseRow);
    await db.setupFields.bulkPut(fieldRows);
    await db.variants.bulkPut(variantRows);
  });
}

export async function deleteExerciseLocal(id: string): Promise<void> {
  await db.transaction("rw", db.exercises, db.setupFields, db.variants, async () => {
    const fields = await db.setupFields.where("exerciseId").equals(id).primaryKeys();
    const variants = await db.variants.where("exerciseId").equals(id).primaryKeys();
    await db.setupFields.bulkDelete(fields);
    await db.variants.bulkDelete(variants);
    await db.exercises.delete(id);
  });
}

export function fieldsFromInput(
  exerciseId: string,
  fields: Array<{
    id?: string;
    label: string;
    type: SetupFieldRecord["type"];
    options: string[];
    order: number;
    defaultValue?: string | null;
  }>,
  createId: () => string,
): SetupFieldRecord[] {
  const now = new Date().toISOString();
  return fields.map((field, index) => ({
    id: field.id ?? createId(),
    exerciseId,
    label: field.label,
    type: field.type,
    options: field.type === "enum" ? field.options : [],
    order: index,
    defaultValue: field.defaultValue ?? null,
    updatedAt: now,
  }));
}

export type { ExerciseRecord };
