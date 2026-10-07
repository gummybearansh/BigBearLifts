import type { Exercise, ExerciseVariant, Prisma, SetupField } from "@prisma/client";
import {
  equipmentFromUnknown,
  muscleFromUnknown,
  musclesFromUnknown,
  setupValuesFromUnknown,
  warmupFromUnknown,
  type ExerciseRecord,
  type SetupFieldRecord,
  type VariantRecord,
} from "@/lib/exercise-record";
import { isSetupFieldType } from "@/lib/setup-field";

type ExerciseWithRelations = Exercise & {
  setupFields: SetupField[];
  variants: ExerciseVariant[];
};

function toField(field: SetupField): SetupFieldRecord {
  return {
    id: field.id,
    exerciseId: field.exerciseId,
    label: field.label,
    type: isSetupFieldType(field.type) ? field.type : "text",
    options: field.options,
    order: field.order,
    defaultValue: field.defaultValue,
    updatedAt: field.updatedAt.toISOString(),
  };
}

function toVariant(variant: ExerciseVariant): VariantRecord {
  return {
    id: variant.id,
    exerciseId: variant.exerciseId,
    setupValues: setupValuesFromUnknown(variant.setupValues),
    label: variant.label,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  };
}

export function toExerciseRecord(exercise: ExerciseWithRelations): ExerciseRecord {
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
    warmupScheme: warmupFromUnknown(exercise.warmupScheme),
    createdAt: exercise.createdAt.toISOString(),
    updatedAt: exercise.updatedAt.toISOString(),
    setupFields: [...exercise.setupFields].sort((a, b) => a.order - b.order).map(toField),
    variants: [...exercise.variants].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map(toVariant),
  };
}

export const exerciseInclude = {
  setupFields: true,
  variants: true,
} satisfies Prisma.ExerciseInclude;
