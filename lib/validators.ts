import { z } from "zod";
import { EQUIPMENT, MUSCLES, SETUP_FIELD_TYPES } from "@/lib/catalog";

export const setupFieldInputSchema = z.object({
  id: z.string().min(8).max(64).optional(),
  label: z.string().trim().min(1).max(40),
  type: z.enum(SETUP_FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  order: z.number().int().nonnegative(),
  defaultValue: z.string().trim().max(40).nullable().optional(),
});

export const exerciseInputSchema = z
  .object({
    id: z.string().min(8).max(64).optional(),
    name: z.string().trim().min(1).max(80),
    primaryMuscle: z.enum(MUSCLES),
    secondaryMuscles: z.array(z.enum(MUSCLES)).max(4).default([]),
    equipment: z.enum(EQUIPMENT),
    isFavorite: z.boolean().optional(),
    isAssisted: z.boolean().optional(),
    restSec: z.number().int().positive().max(600).nullable().optional(),
    setupFields: z.array(setupFieldInputSchema).max(8).default([]),
  })
  .superRefine((value, context) => {
    if (value.secondaryMuscles.includes(value.primaryMuscle)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryMuscles"],
        message: "Secondary muscles have to differ from the primary muscle.",
      });
    }
    value.setupFields.forEach((field, index) => {
      if (field.type === "enum" && field.options.length < 2) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["setupFields", index, "options"],
          message: "Enum fields need at least two options.",
        });
      }
    });
  });

export const exercisePatchSchema = exerciseInputSchema;

export type ExerciseInput = z.infer<typeof exerciseInputSchema>;

const seedSetupFieldSchema = z.object({
  label: z.string().min(1),
  type: z.enum(SETUP_FIELD_TYPES),
  options: z.array(z.string()).default([]),
  defaultValue: z.string().nullable().optional(),
});

const seedExerciseSchema = z.object({
  name: z.string().min(1),
  primaryMuscle: z.enum(MUSCLES),
  secondaryMuscles: z.array(z.enum(MUSCLES)).default([]),
  equipment: z.enum(EQUIPMENT),
  isAssisted: z.boolean().default(false),
  setupFields: z.array(seedSetupFieldSchema).default([]),
});

const seedProgramExerciseSchema = z.object({
  name: z.string().min(1),
  targetSets: z.number().int().positive(),
  targetRepsMin: z.number().int().positive(),
  targetRepsMax: z.number().int().positive(),
  setStyle: z.enum(["straight", "amrap"]).default("straight"),
  presetSetup: z.record(z.union([z.string(), z.number()])).nullable().optional(),
});

export const personalSeedSchema = z.object({
  exercises: z.array(seedExerciseSchema).min(1),
  program: z.object({
    name: z.string().min(1),
    days: z.array(
      z.object({
        label: z.string().min(1),
        order: z.number().int().nonnegative(),
        exercises: z.array(seedProgramExerciseSchema).min(1),
      }),
    ),
  }),
});

export type PersonalSeed = z.infer<typeof personalSeedSchema>;
