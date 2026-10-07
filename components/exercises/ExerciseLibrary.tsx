"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, Star } from "lucide-react";
import { useExerciseSync } from "@/components/exercises/use-exercise-sync";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { EQUIPMENT, EQUIPMENT_LABELS, MUSCLE_LABELS, MUSCLES, isEquipment, isMuscle } from "@/lib/catalog";
import { readExercises } from "@/lib/db/exercises";

export function ExerciseLibrary() {
  useExerciseSync();
  const exercises = useLiveQuery(readExercises);
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (exercises ?? []).filter((exercise) => {
      if (needle && !exercise.name.toLowerCase().includes(needle)) return false;
      if (muscle && exercise.primaryMuscle !== muscle) return false;
      if (equipment && exercise.equipment !== equipment) return false;
      if (favoritesOnly && !exercise.isFavorite) return false;
      return true;
    });
  }, [equipment, exercises, favoritesOnly, muscle, query]);

  return (
    <>
      <PageHeader
        title="Exercises"
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/exercises/new">New</Link>
          </Button>
        }
      />
      <main className="flex min-w-0 flex-col gap-3 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <div className="flex min-w-0 items-center gap-2">
          <Input
            className="min-w-0 flex-1"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search exercises"
            enterKeyHint="search"
          />
          <Button
            type="button"
            variant={favoritesOnly ? "primary" : "secondary"}
            size="icon"
            aria-pressed={favoritesOnly}
            aria-label={favoritesOnly ? "Showing favorites" : "Show favorites"}
            onClick={() => setFavoritesOnly((current) => !current)}
          >
            <Star className={favoritesOnly ? "fill-current" : undefined} />
          </Button>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <NativeSelect
            aria-label="Muscle"
            value={muscle ?? ""}
            onChange={(event) => setMuscle(isMuscle(event.target.value) ? event.target.value : null)}
          >
            <option value="">All muscles</option>
            {MUSCLES.map((item) => (
              <option key={item} value={item}>
                {MUSCLE_LABELS[item]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Equipment"
            value={equipment ?? ""}
            onChange={(event) => setEquipment(isEquipment(event.target.value) ? event.target.value : null)}
          >
            <option value="">All equipment</option>
            {EQUIPMENT.map((item) => (
              <option key={item} value={item}>
                {EQUIPMENT_LABELS[item]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {exercises === undefined ? (
          <div className="overflow-hidden rounded-2xl border border-border">
            <Skeleton className="h-16 rounded-none" />
            <Skeleton className="h-16 rounded-none" />
            <Skeleton className="h-16 rounded-none" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Search}
            title={exercises.length === 0 ? "No exercises" : "No matches"}
            body={exercises.length === 0 ? "Add the first exercise to the library." : "Nothing matches these filters."}
            action={
              exercises.length === 0 ? (
                <Button asChild>
                  <Link href="/exercises/new">New exercise</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setMuscle(null);
                    setEquipment(null);
                    setFavoritesOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {visible.map((exercise) => (
              <li key={exercise.id} className="border-b border-border last:border-b-0">
                <Link
                  href={`/exercises/${exercise.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 active:bg-surface-elevated"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium">{exercise.name}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {MUSCLE_LABELS[exercise.primaryMuscle]} · {EQUIPMENT_LABELS[exercise.equipment]}
                    </span>
                  </span>
                  {exercise.isFavorite ? (
                    <Star className="size-4 shrink-0 fill-primary text-primary" aria-label="Favorite" />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
