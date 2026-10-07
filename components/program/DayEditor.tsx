"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { ListSkeleton } from "@/components/layout/ListSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { NativeSelect } from "@/components/ui/native-select";
import { db } from "@/lib/db/dexie";
import { createId } from "@/lib/ids";
import { dirtyStamp, type SetStyle } from "@/lib/records";

export function DayEditor({ dayId }: { dayId: string }) {
  const day = useLiveQuery(() => db.programDays.get(dayId), [dayId]);
  const planned = useLiveQuery(
    () => db.programExercises.where("programDayId").equals(dayId).sortBy("order"),
    [dayId],
  );
  const exercises = useLiveQuery(() => db.exercises.orderBy("name").toArray());
  const [exerciseId, setExerciseId] = useState("");

  async function rename(label: string) {
    await db.programDays.update(dayId, { label, ...dirtyStamp() });
  }

  async function addExercise() {
    if (!exerciseId) return;
    const order = planned?.length ?? 0;
    await db.programExercises.add({
      id: createId(),
      programDayId: dayId,
      exerciseId,
      order,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 8,
      notes: null,
      presetSetup: null,
      setStyle: "straight",
      ...dirtyStamp(),
    });
    setExerciseId("");
  }

  async function updateRow(id: string, patch: { targetSets?: number; targetRepsMin?: number; targetRepsMax?: number; setStyle?: SetStyle }) {
    await db.programExercises.update(id, { ...patch, ...dirtyStamp() });
  }

  async function remove(id: string) {
    await db.transaction("rw", [db.programExercises, db.tombstones], async () => {
      await db.programExercises.delete(id);
      await db.tombstones.add({ id: createId(), table: "programExercises", recordId: id, ...dirtyStamp() });
    });
  }

  async function move(id: string, direction: -1 | 1) {
    if (!planned) return;
    const index = planned.findIndex((row) => row.id === id);
    const nextIndex = index + direction;
    const current = planned[index];
    const swap = planned[nextIndex];
    if (!current || !swap) return;
    const stamp = dirtyStamp();
    await db.programExercises.bulkPut([
      { ...current, order: swap.order, ...stamp },
      { ...swap, order: current.order, ...stamp },
    ]);
  }

  if (planned === undefined || exercises === undefined) {
    return (
      <>
        <PageHeader title="Day" />
        <main className="px-4 py-4">
          <ListSkeleton />
        </main>
      </>
    );
  }

  if (!day) {
    return (
      <>
        <PageHeader title="Day" />
        <main className="px-4 py-4">
          <EmptyState
            icon={ClipboardList}
            title="Day not on this phone"
            body="This program day is not in the local program."
            action={
              <Button asChild>
                <Link href="/program">Back to program</Link>
              </Button>
            }
          />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={day?.label ?? "Day"} />
      <main className="flex min-w-0 flex-col gap-4 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <Input
          aria-label="Day name"
          defaultValue={day?.label ?? ""}
          key={day?.label ?? "day"}
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (next && next !== day?.label) void rename(next);
          }}
        />
        <ul className="flex flex-col gap-3">
          {(planned ?? []).map((row, index) => {
            const exercise = exercises?.find((item) => item.id === row.exerciseId);
            return (
              <li key={row.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{exercise?.name ?? "Exercise"}</p>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => void move(row.id, -1)}>
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={index === (planned?.length ?? 0) - 1}
                      onClick={() => void move(row.id, 1)}
                    >
                      Down
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <NumberField label="Sets" value={row.targetSets} onCommit={(value) => void updateRow(row.id, { targetSets: value })} />
                  <NumberField label="Min reps" value={row.targetRepsMin} onCommit={(value) => void updateRow(row.id, { targetRepsMin: value })} />
                  <NumberField label="Max reps" value={row.targetRepsMax} onCommit={(value) => void updateRow(row.id, { targetRepsMax: value })} />
                </div>
                <NativeSelect
                  className="mt-2"
                  aria-label="Set style"
                  value={row.setStyle}
                  onChange={(event) => void updateRow(row.id, { setStyle: event.target.value === "amrap" ? "amrap" : "straight" })}
                >
                  <option value="straight">Straight sets</option>
                  <option value="amrap">AMRAP</option>
                </NativeSelect>
                <Button type="button" variant="danger" className="mt-3 w-full" onClick={() => void remove(row.id)}>
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Combobox
            ariaLabel="Add exercise"
            value={exerciseId}
            placeholder="Add exercise"
            searchPlaceholder="Search exercises"
            emptyMessage="No exercises"
            options={(exercises ?? []).map((exercise) => ({ value: exercise.id, label: exercise.name }))}
            onChange={setExerciseId}
          />
          <Button type="button" disabled={!exerciseId} onClick={() => void addExercise()}>
            Add
          </Button>
        </div>
      </main>
    </>
  );
}

function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  return (
    <label className="block min-w-0 text-xs text-muted-foreground">
      {label}
      <input
        inputMode="numeric"
        defaultValue={String(value)}
        key={`${label}-${value}`}
        className="mt-1 h-11 w-full rounded-xl border border-input bg-surface-elevated px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onBlur={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(next) && next > 0 && next !== value) onCommit(next);
        }}
      />
    </label>
  );
}
