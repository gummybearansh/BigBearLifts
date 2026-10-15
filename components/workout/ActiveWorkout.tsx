"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { db } from "@/lib/db/dexie";
import { addExerciseToWorkout, discardWorkout, finishWorkout, removeExerciseFromWorkout, touchWorkout } from "@/lib/db/training-store";
import { createId } from "@/lib/ids";
import { dirtyStamp, type LocalWorkoutExercise, type LocalWorkoutSet, type SetType } from "@/lib/records";
import { displayToKg, formatWeight, kgToDisplay, platesPerSide } from "@/lib/training";
import { useRestTimer } from "@/components/workout/rest-timer";

export function ActiveWorkout({ id }: { id: string }) {
  const router = useRouter();
  const workout = useLiveQuery(() => db.workouts.get(id), [id]);
  const blocks = useLiveQuery(() => db.workoutExercises.where("workoutId").equals(id).sortBy("order"), [id]);
  const sets = useLiveQuery(async () => {
    const rows = await db.workoutExercises.where("workoutId").equals(id).toArray();
    if (!rows.length) return [];
    return db.workoutSets.where("workoutExerciseId").anyOf(rows.map((row) => row.id)).toArray();
  }, [id]);
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const fields = useLiveQuery(() => db.setupFields.toArray());
  const settings = useLiveQuery(() => db.settings.get("local"));
  const [now, setNow] = useState(() => Date.now());
  const [confirm, setConfirm] = useState(false);
  const [plateKg, setPlateKg] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [addExerciseId, setAddExerciseId] = useState("");
  const unit = settings?.unit ?? "kg";

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsed = workout ? formatElapsed(now - new Date(workout.startedAt).getTime()) : "0:00";
  const ordered = blocks ?? [];
  const open = Boolean(workout && !workout.finishedAt);
  const exerciseOptions = [...(exercises ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((exercise) => ({ value: exercise.id, label: exercise.name }));

  async function addExercise() {
    if (!addExerciseId || !open) return;
    await addExerciseToWorkout(id, addExerciseId);
    setAddExerciseId("");
  }

  async function moveBlock(blockId: string, direction: -1 | 1) {
    if (!blocks || !open) return;
    const index = blocks.findIndex((row) => row.id === blockId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    const next = blocks.slice();
    const moved = next[index];
    if (!moved) return;
    next.splice(index, 1);
    next.splice(target, 0, moved);
    const stamp = dirtyStamp();
    await db.workoutExercises.bulkPut(next.map((row, index) => ({ ...row, order: index, ...stamp })));
    await touchWorkout(id);
  }

  async function finish() {
    setPending(true);
    try {
      await finishWorkout(id);
      useRestTimer.getState().clear();
      router.push("/");
    } finally {
      setPending(false);
    }
  }

  async function dontSave() {
    setPending(true);
    try {
      useRestTimer.getState().clear();
      await discardWorkout(id);
      router.push("/");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title={workout?.label ?? "Workout"}
        action={
          <Button type="button" size="sm" onClick={() => setConfirm(true)} disabled={!workout || Boolean(workout.finishedAt)}>
            Finish
          </Button>
        }
      />
      <main className="flex min-w-0 flex-col gap-4 px-4 py-4 pb-28">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold tabular-nums">{elapsed}</p>
          </div>
          <RestPill />
        </div>
        {ordered.map((block, index) => (
          <ExerciseBlock
            key={block.id}
            block={block}
            sets={(sets ?? []).filter((set) => set.workoutExerciseId === block.id).sort((a, b) => a.order - b.order)}
            name={exercises?.find((exercise) => exercise.id === block.exerciseId)?.name ?? "Exercise"}
            restSec={exercises?.find((exercise) => exercise.id === block.exerciseId)?.restSec ?? null}
            setupFields={(fields ?? []).filter((field) => field.exerciseId === block.exerciseId).sort((a, b) => a.order - b.order)}
            unit={unit}
            workoutId={id}
            onPlate={setPlateKg}
            onRemove={open ? () => void removeExerciseFromWorkout(block.id) : undefined}
            onMoveUp={open && index > 0 ? () => void moveBlock(block.id, -1) : undefined}
            onMoveDown={open && index < ordered.length - 1 ? () => void moveBlock(block.id, 1) : undefined}
          />
        ))}
        {open ? (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Combobox
              ariaLabel="Add exercise"
              value={addExerciseId}
              placeholder="Add exercise"
              searchPlaceholder="Search exercises"
              emptyMessage="No exercises"
              options={exerciseOptions}
              onChange={setAddExerciseId}
            />
            <Button type="button" disabled={!addExerciseId} onClick={() => void addExercise()}>
              Add
            </Button>
          </div>
        ) : null}
      </main>
      <Sheet open={confirm} onOpenChange={setConfirm}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Finish this workout?</SheetTitle>
            <SheetDescription>Save keeps the session. Don’t save drops it.</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button type="button" disabled={pending} onClick={() => void finish()}>
              {pending ? "Saving…" : "Save workout"}
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => void dontSave()}>
              Don’t save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Sheet open={plateKg !== null} onOpenChange={(open) => !open && setPlateKg(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Plates per side</SheetTitle>
            <SheetDescription>
              {plateKg === null ? "" : formatWeight(plateKg, unit)} on a {settings?.barWeightKg ?? 20} kg bar.
            </SheetDescription>
          </SheetHeader>
          <PlateList totalKg={plateKg ?? 0} barKg={settings?.barWeightKg ?? 20} plates={settings?.platesKg ?? [25, 20, 15, 10, 5, 2.5, 1.25]} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function ExerciseBlock({
  block,
  sets,
  name,
  restSec,
  setupFields,
  unit,
  workoutId,
  onPlate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  block: LocalWorkoutExercise;
  sets: LocalWorkoutSet[];
  name: string;
  restSec: number | null;
  setupFields: { id: string; label: string; type: string; options: string[] }[];
  unit: "kg" | "lb";
  workoutId: string;
  onPlate: (kg: number) => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const customText = setupFields
    .flatMap((field) => {
      const value = block.setupValues[field.label];
      if (value === undefined || value === null || String(value).trim() === "") return [];
      return [`${field.label} ${value}`];
    })
    .join(" · ");

  async function commitSet(set: LocalWorkoutSet, patch: Partial<LocalWorkoutSet>, completed?: boolean) {
    const nextCompleted = completed ?? set.isCompleted;
    await db.workoutSets.update(set.id, { ...patch, isCompleted: nextCompleted, ...dirtyStamp() });
    await touchWorkout(workoutId);
    if (completed) useRestTimer.getState().start(restFor(restSec));
  }

  async function saveRest(seconds: number) {
    const next = Math.min(600, Math.max(30, seconds));
    await db.exercises.update(block.exerciseId, { restSec: next, ...dirtyStamp() });
  }

  async function addSet(completed = false) {
    const last = [...sets].reverse().find((set) => set.isCompleted) ?? sets[sets.length - 1];
    const stamp = dirtyStamp();
    await db.workoutSets.add({
      id: createId(),
      workoutExerciseId: block.id,
      order: sets.length,
      type: last?.type === "warmup" ? "working" : last?.type ?? "working",
      weight: last?.weight ?? 0,
      reps: last?.reps ?? 0,
      parentSetId: null,
      dropLevel: null,
      partials: null,
      isCompleted: completed,
      createdAt: stamp.updatedAt,
      ...stamp,
    });
    await touchWorkout(workoutId);
    if (completed) useRestTimer.getState().start(restFor(restSec));
  }

  async function removeSet(setId: string) {
    await db.workoutSets.delete(setId);
    await touchWorkout(workoutId);
  }

  async function changeSetup(label: string, value: string) {
    const next = { ...block.setupValues, [label]: value };
    const existing = await db.variants.where("exerciseId").equals(block.exerciseId).toArray();
    const found = existing.find((variant) => JSON.stringify(variant.setupValues) === JSON.stringify(next));
    const stamp = dirtyStamp();
    const variantId = found?.id ?? createId();
    if (!found) {
      await db.variants.add({
        id: variantId,
        exerciseId: block.exerciseId,
        setupValues: next,
        label: Object.values(next).join(" · ") || "Default",
        createdAt: stamp.updatedAt,
        ...stamp,
      });
    }
    await db.workoutExercises.update(block.id, { setupValues: next, variantId, ...stamp });
    await touchWorkout(workoutId);
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{name}</h2>
          {customText ? <p className="mt-1 text-sm text-muted-foreground">Custom: {customText}</p> : null}
        </div>
        <div className="flex shrink-0 items-center">
          {setupFields.length > 0 ? (
            <button type="button" className="h-11 w-11 text-lg leading-none text-muted-foreground" aria-label="Custom" onClick={() => setCustomOpen(true)}>
              ···
            </button>
          ) : null}
          {onMoveUp || onMoveDown ? (
            <div className="flex flex-col">
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center text-muted-foreground disabled:opacity-20"
                aria-label={`Move ${name} up`}
                disabled={!onMoveUp}
                onClick={onMoveUp}
              >
                <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center text-muted-foreground disabled:opacity-20"
                aria-label={`Move ${name} down`}
                disabled={!onMoveDown}
                onClick={onMoveDown}
              >
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {setupFields.length > 0 ? (
        <Sheet open={customOpen} onOpenChange={setCustomOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Custom</SheetTitle>
              <SheetDescription>{name}</SheetDescription>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-3">
              {setupFields.map((field) =>
                field.type === "enum" ? (
                  <NativeSelect
                    key={field.id}
                    aria-label={field.label}
                    value={String(block.setupValues[field.label] ?? "")}
                    onChange={(event) => void changeSetup(field.label, event.target.value)}
                  >
                    <option value="">{field.label}</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <input
                    key={field.id}
                    aria-label={field.label}
                    placeholder={field.label}
                    defaultValue={String(block.setupValues[field.label] ?? "")}
                    className="h-11 min-w-0 rounded-xl border border-input bg-surface-elevated px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onBlur={(event) => void changeSetup(field.label, event.target.value.trim())}
                  />
                ),
              )}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
      <div className="mt-3 flex h-11 items-center justify-between rounded-xl bg-surface-elevated px-3">
        <span className="text-sm text-muted-foreground">Rest</span>
        <div className="flex items-center">
          <button type="button" className="h-11 w-11 text-lg" aria-label="Shorter rest" onClick={() => void saveRest(restFor(restSec) - 30)}>
            −
          </button>
          <span className="w-12 text-center text-sm font-medium">{formatClock(restFor(restSec))}</span>
          <button type="button" className="h-11 w-11 text-lg" aria-label="Longer rest" onClick={() => void saveRest(restFor(restSec) + 30)}>
            +
          </button>
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {sets.map((set, index) => (
          <SetRow
            key={set.id}
            set={set}
            index={index}
            unit={unit}
            onType={(type) => void commitSet(set, { type })}
            onLog={(reps, weightKg) => void commitSet(set, { reps, weight: weightKg }, true)}
            onPlate={() => onPlate(set.weight)}
            onDelete={() => void removeSet(set.id)}
          />
        ))}
      </ul>
      <Button type="button" className="mt-3 w-full" variant="secondary" onClick={() => void addSet(false)}>
        Add set
      </Button>
      {onRemove ? (
        <Button type="button" className="mt-2 w-full" variant="danger" onClick={onRemove}>
          Remove exercise
        </Button>
      ) : null}
    </article>
  );
}

function SetRow({
  set,
  index,
  unit,
  onType,
  onLog,
  onPlate,
  onDelete,
}: {
  set: LocalWorkoutSet;
  index: number;
  unit: "kg" | "lb";
  onType: (type: SetType) => void;
  onLog: (reps: number, weightKg: number) => void;
  onPlate: () => void;
  onDelete: () => void;
}) {
  const [reps, setReps] = useState(set.isCompleted || set.weight > 0 ? String(set.reps) : "");
  const [weight, setWeight] = useState(set.weight ? String(kgToDisplay(set.weight, unit)) : "");

  function log() {
    const parsedReps = Number.parseInt(reps, 10);
    const parsedWeight = Number.parseFloat(weight);
    if (!Number.isFinite(parsedReps) || parsedReps < 0) return;
    if (!Number.isFinite(parsedWeight)) return;
    onLog(parsedReps, displayToKg(parsedWeight, unit));
  }

  return (
    <li className="rounded-xl border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Set {index + 1}</span>
        <NativeSelect
          aria-label={`Set ${index + 1} type`}
          value={set.type}
          className="h-11 w-28"
          onChange={(event) => {
            if (isType(event.target.value)) onType(event.target.value);
          }}
        >
          <option value="warmup">Warm</option>
          <option value="working">Work</option>
          <option value="amrap">AMRAP</option>
          <option value="drop">Drop</option>
          <option value="failure">Fail</option>
        </NativeSelect>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_1fr_4.75rem] items-end gap-2">
        <label className="block min-w-0 text-xs text-muted-foreground">
          Reps
          <input
            aria-label={`Set ${index + 1} reps`}
            inputMode="numeric"
            value={reps}
            placeholder="Reps"
            className="mt-1 h-11 w-full rounded-xl border border-input bg-surface-elevated px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => setReps(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") log();
            }}
          />
        </label>
        <label className="block min-w-0 text-xs text-muted-foreground">
          {unit}
          <input
            aria-label={`Set ${index + 1} weight`}
            inputMode="decimal"
            value={weight}
            placeholder={unit}
            className="mt-1 h-11 w-full rounded-xl border border-input bg-surface-elevated px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => setWeight(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") log();
            }}
          />
        </label>
        <button
          type="button"
          className={`h-11 rounded-xl text-sm font-semibold ${set.isCompleted ? "bg-primary text-primary-foreground" : "border border-border"}`}
          onClick={log}
        >
          {set.isCompleted ? "Logged" : "Log"}
        </button>
      </div>
      <div className="mt-1 flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onPlate}>
          Plates
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </li>
  );
}

function RestPill() {
  const endsAt = useRestTimer((state) => state.endsAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    let timer = 0;
    const tick = () => setNow(Date.now());
    const start = () => {
      window.clearInterval(timer);
      tick();
      timer = window.setInterval(tick, 250);
    };
    const stop = () => window.clearInterval(timer);
    const onVisible = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [endsAt]);
  useEffect(() => {
    if (!endsAt || endsAt > Date.now()) return;
    useRestTimer.getState().clear();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(200);
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.15);
  }, [endsAt, now]);
  if (!endsAt || endsAt <= now) return null;
  const seconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  return (
    <div className="flex items-center gap-2">
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Set</p>
        <p className="text-2xl font-semibold tabular-nums text-primary">{formatClock(seconds)}</p>
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={() => useRestTimer.getState().add(30)}>
        +30
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => useRestTimer.getState().clear()}>
        Skip
      </Button>
    </div>
  );
}

function PlateList({ totalKg, barKg, plates }: { totalKg: number; barKg: number; plates: number[] }) {
  const result = platesPerSide(totalKg, barKg, plates);
  return (
    <div className="mt-4">
      <p className="text-2xl font-semibold">{result.plates.length ? result.plates.join(" + ") : "Empty bar"}</p>
      {result.remainderKg > 0.05 ? (
        <p className="mt-2 text-sm text-warning">{result.remainderKg} kg left over per side.</p>
      ) : null}
    </div>
  );
}

function restFor(restSec: number | null): number {
  return restSec && restSec > 0 ? restSec : 180;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function isType(value: string): value is SetType {
  return value === "warmup" || value === "working" || value === "amrap" || value === "drop" || value === "failure";
}
