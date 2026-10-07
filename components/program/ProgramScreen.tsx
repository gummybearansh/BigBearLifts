"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/EmptyState";
import { ListSkeleton } from "@/components/layout/ListSkeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db/dexie";
import { importProgramJson, readActiveProgram, startWorkoutForDay } from "@/lib/db/training-store";
import { createId } from "@/lib/ids";
import { dirtyStamp } from "@/lib/records";

export function ProgramScreen() {
  const router = useRouter();
  const tree = useLiveQuery(readActiveProgram);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  async function openDay(dayId: string) {
    setOpening(dayId);
    try {
      const id = await startWorkoutForDay(dayId);
      router.push(`/workout/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open that workout.");
    } finally {
      setOpening(null);
    }
  }

  async function createProgram() {
    const label = name.trim();
    if (!label) return;
    setPending(true);
    const stamp = dirtyStamp();
    const programId = createId();
    const dayId = createId();
    try {
      await db.transaction("rw", [db.programs, db.programDays], async () => {
        const current = await db.programs.toArray();
        for (const program of current) {
          if (program.isActive) await db.programs.update(program.id, { isActive: false, ...dirtyStamp() });
        }
        await db.programs.add({ id: programId, name: label, isActive: true, ...stamp });
        await db.programDays.add({ id: dayId, programId, label: "Day 1", order: 0, ...stamp });
      });
      setName("");
    } finally {
      setPending(false);
    }
  }

  async function onImport(file: File) {
    try {
      const text = await file.text();
      const json: unknown = JSON.parse(text);
      const body = json && typeof json === "object" && "program" in json ? (json as { program: unknown }).program : json;
      await importProgramJson(body);
      toast.success("Program imported.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import that file.");
    }
  }

  return (
    <>
      <PageHeader title="Program" />
      <main className="flex min-w-0 flex-col gap-4 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Active</p>
          <h2 className="mt-1 text-2xl font-semibold">{tree === undefined ? "" : (tree?.program.name ?? "No program yet")}</h2>
        </section>
        {tree === undefined ? (
          <ListSkeleton />
        ) : tree && tree.days.length > 0 ? (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {tree.days.map((day) => {
              const count = tree.exercises.filter((exercise) => exercise.programDayId === day.id).length;
              return (
                <li key={day.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center justify-between px-4 py-3 text-left active:bg-surface-elevated"
                    disabled={opening === day.id}
                    onClick={() => void openDay(day.id)}
                  >
                    <span className="font-medium">{day.label}</span>
                    <span className="text-sm text-muted-foreground">{opening === day.id ? "Opening…" : `${count} exercises`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No program yet"
            body="Name a program below, or import one from JSON."
            action={
              <Button type="button" variant="secondary" onClick={() => nameRef.current?.focus()}>
                Name a program
              </Button>
            }
          />
        )}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input ref={nameRef} aria-label="New program name" placeholder="New program name" value={name} onChange={(event) => setName(event.target.value)} />
          <Button type="button" disabled={pending || name.trim().length === 0} onClick={() => void createProgram()}>
            Create
          </Button>
        </div>
        <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-secondary text-sm font-medium">
          Import JSON
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onImport(file);
              event.target.value = "";
            }}
          />
        </label>
      </main>
    </>
  );
}
