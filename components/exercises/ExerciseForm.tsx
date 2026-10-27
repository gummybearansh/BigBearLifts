"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useExerciseSync } from "@/components/exercises/use-exercise-sync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  isEquipment,
  isMuscle,
  MUSCLE_LABELS,
  MUSCLES,
  type Equipment,
  type Muscle,
  type SetupFieldType,
} from "@/lib/catalog";
import { saveExerciseLocal } from "@/lib/db/exercises";
import { addExerciseToProgramDay, addExerciseToWorkout, adoptExerciseInProgram, retargetWorkoutExercise } from "@/lib/db/training-store";
import { pushExercise, pushExerciseDelete } from "@/lib/db/sync-exercises";
import type { ExerciseRecord } from "@/lib/exercise-record";
import { createId } from "@/lib/ids";
import { exerciseInputSchema } from "@/lib/validators";

function safePath(path: string | undefined, fallback: string): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

type DraftField = {
  key: string;
  id?: string;
  label: string;
  type: SetupFieldType;
  options: string;
  defaultValue: string;
};

function draftFromExercise(exercise: ExerciseRecord): DraftField[] {
  return exercise.setupFields.map((field) => ({
    key: field.id,
    id: field.id,
    label: field.label,
    type: field.type,
    options: field.options.join(", "),
    defaultValue: field.defaultValue ?? "",
  }));
}

export function ExerciseForm({
  initial,
  defaultName,
  returnTo,
  addToWorkout,
  addToDay,
  replaceWorkoutExercise,
}: {
  initial?: ExerciseRecord;
  defaultName?: string;
  returnTo?: string;
  addToWorkout?: string;
  addToDay?: string;
  replaceWorkoutExercise?: string;
}) {
  useExerciseSync();
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? defaultName ?? "");
  const [primaryMuscle, setPrimaryMuscle] = useState<Muscle>(initial?.primaryMuscle ?? "chest");
  const [secondaryMuscles, setSecondaryMuscles] = useState<Muscle[]>(initial?.secondaryMuscles ?? []);
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? "barbell");
  const [isAssisted, setIsAssisted] = useState(initial?.isAssisted ?? false);
  const [fields, setFields] = useState<DraftField[]>(initial ? draftFromExercise(initial) : []);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleSecondary(muscle: Muscle) {
    setSecondaryMuscles((current) =>
      current.includes(muscle) ? current.filter((item) => item !== muscle) : [...current, muscle],
    );
  }

  function updateField(key: string, patch: Partial<DraftField>) {
    setFields((current) => current.map((field) => (field.key === key ? { ...field, ...patch } : field)));
  }

  function moveField(key: string, direction: -1 | 1) {
    setFields((current) => {
      const index = current.findIndex((field) => field.key === key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const currentField = copy[index];
      const swapField = copy[nextIndex];
      if (!currentField || !swapField) return current;
      copy[index] = swapField;
      copy[nextIndex] = currentField;
      return copy;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const payload = {
      id: initial?.id ?? createId(),
      name,
      primaryMuscle,
      secondaryMuscles,
      equipment,
      isFavorite: initial?.isFavorite ?? false,
      isAssisted,
      restSec: initial?.restSec ?? null,
      setupFields: fields.map((field, index) => ({
        id: field.id ?? createId(),
        label: field.label,
        type: field.type,
        options: field.options
          .split(",")
          .map((option) => option.trim())
          .filter((option) => option.length > 0),
        order: index,
        defaultValue: field.defaultValue.trim() || null,
      })),
    };
    const parsed = exerciseInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the exercise fields.");
      return;
    }

    const fork = Boolean(initial && parsed.data.name.trim() !== initial.name.trim());
    const id = fork ? createId() : payload.id;
    const now = new Date().toISOString();
    const record: ExerciseRecord = {
      id,
      name: parsed.data.name,
      primaryMuscle: parsed.data.primaryMuscle,
      secondaryMuscles: parsed.data.secondaryMuscles,
      equipment: parsed.data.equipment,
      isFavorite: parsed.data.isFavorite ?? false,
      isAssisted: parsed.data.isAssisted ?? false,
      isCustom: fork ? true : (initial?.isCustom ?? true),
      restSec: parsed.data.restSec ?? null,
      warmupScheme: initial?.warmupScheme ?? null,
      createdAt: fork ? now : (initial?.createdAt ?? now),
      updatedAt: now,
      setupFields: parsed.data.setupFields.map((field) => ({
        id: fork ? createId() : (field.id ?? createId()),
        exerciseId: id,
        label: field.label,
        type: field.type,
        options: field.options,
        order: field.order,
        defaultValue: field.defaultValue ?? null,
        updatedAt: now,
      })),
      variants: fork
        ? (initial?.variants ?? []).map((variant) => ({
            ...variant,
            id: createId(),
            exerciseId: id,
            createdAt: now,
            updatedAt: now,
          }))
        : (initial?.variants ?? []),
    };

    setPending(true);
    await saveExerciseLocal(record, true);
    const input = {
      ...parsed.data,
      id,
      setupFields: record.setupFields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type,
        options: field.options,
        order: field.order,
        defaultValue: field.defaultValue,
      })),
    };
    try {
      const saved = await pushExercise(input, fork ? null : initial ?? null);
      if (fork && initial) await adoptExerciseInProgram(initial.id, saved.id);
      if (replaceWorkoutExercise) await retargetWorkoutExercise(replaceWorkoutExercise, saved.id);
      if (!initial && addToWorkout) await addExerciseToWorkout(addToWorkout, saved.id);
      if (!initial && addToDay) await addExerciseToProgramDay(addToDay, saved.id);
      router.push(safePath(returnTo, `/exercises/${saved.id}`));
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Saved on this phone.");
      if (fork && initial) await adoptExerciseInProgram(initial.id, record.id);
      if (replaceWorkoutExercise) await retargetWorkoutExercise(replaceWorkoutExercise, record.id);
      if (!initial && addToWorkout) await addExerciseToWorkout(addToWorkout, record.id);
      if (!initial && addToDay) await addExerciseToProgramDay(addToDay, record.id);
      router.push(safePath(returnTo, `/exercises/${record.id}`));
    }
  }

  async function onDelete() {
    if (!initial) return;
    setPending(true);
    try {
      await pushExerciseDelete(initial.id);
      router.push("/exercises");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Could not delete.");
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader title={initial ? "Edit exercise" : "New exercise"} />
      <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-5 px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <div className="space-y-2">
          <Label htmlFor="exercise-name">Name</Label>
          <Input id="exercise-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="primary-muscle">Muscle</Label>
            <Combobox
              id="primary-muscle"
              ariaLabel="Muscle"
              value={primaryMuscle}
              placeholder="Muscle"
              searchPlaceholder="Search muscles"
              options={MUSCLES.map((muscle) => ({ value: muscle, label: MUSCLE_LABELS[muscle] }))}
              onChange={(next) => {
                if (!isMuscle(next)) return;
                setPrimaryMuscle(next);
                setSecondaryMuscles((current) => current.filter((muscle) => muscle !== next));
              }}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="equipment">Equipment</Label>
            <Combobox
              id="equipment"
              ariaLabel="Equipment"
              value={equipment}
              placeholder="Equipment"
              searchPlaceholder="Search equipment"
              options={EQUIPMENT.map((item) => ({ value: item, label: EQUIPMENT_LABELS[item] }))}
              onChange={(next) => {
                if (isEquipment(next)) setEquipment(next);
              }}
            />
          </div>
        </div>
        <label className="flex h-11 items-center justify-between rounded-2xl border border-border bg-card px-4 text-sm">
          <span>Assisted</span>
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={isAssisted}
            onChange={(event) => setIsAssisted(event.target.checked)}
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Secondary muscles</legend>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {MUSCLES.filter((muscle) => muscle !== primaryMuscle).map((muscle) => {
              const selected = secondaryMuscles.includes(muscle);
              return (
                <label
                  key={muscle}
                  className="flex h-11 items-center justify-between border-b border-border px-4 text-sm last:border-b-0"
                >
                  <span>{MUSCLE_LABELS[muscle]}</span>
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={selected}
                    onChange={() => toggleSecondary(muscle)}
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Custom</h2>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setFields((current) => [
                  ...current,
                  { key: createId(), label: "", type: "number", options: "", defaultValue: "" },
                ])
              }
            >
              Add custom
            </Button>
          </div>
          {fields.map((field, index) => (
            <div key={field.key} className="space-y-3 rounded-2xl border border-border bg-card p-3">
              <Input
                aria-label="Field label"
                placeholder="Label"
                value={field.label}
                onChange={(event) => updateField(field.key, { label: event.target.value })}
              />
              <Combobox
                ariaLabel="Field type"
                value={field.type}
                placeholder="Field type"
                searchPlaceholder="Search field types"
                options={[
                  { value: "number", label: "Number" },
                  { value: "text", label: "Text" },
                  { value: "enum", label: "Choices" },
                ]}
                onChange={(next) => {
                  if (next === "number" || next === "text" || next === "enum") updateField(field.key, { type: next });
                }}
              />
              {field.type === "enum" ? (
                <Input
                  aria-label="Options"
                  placeholder="Options, comma separated"
                  value={field.options}
                  onChange={(event) => updateField(field.key, { options: event.target.value })}
                />
              ) : null}
              <Input
                aria-label="Default value"
                placeholder="Default value"
                value={field.defaultValue}
                onChange={(event) => updateField(field.key, { defaultValue: event.target.value })}
              />
              <div className="flex gap-2">
                <Button type="button" variant="ghost" disabled={index === 0} onClick={() => moveField(field.key, -1)}>
                  Up
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={index === fields.length - 1}
                  onClick={() => moveField(field.key, 1)}
                >
                  Down
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setFields((current) => current.filter((item) => item.key !== field.key))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save exercise"}
        </Button>
        {initial ? (
          <Button type="button" variant="danger" className="w-full" disabled={pending} onClick={() => void onDelete()}>
            Delete exercise
          </Button>
        ) : null}
      </form>
    </>
  );
}
