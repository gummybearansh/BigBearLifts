"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { CalendarDays } from "lucide-react";
import { MonthCalendar } from "@/components/charts/MonthCalendar";
import { EmptyState } from "@/components/layout/EmptyState";
import { ListSkeleton } from "@/components/layout/ListSkeleton";
import { Button } from "@/components/ui/button";
import { durationLabel, sessionLine, weekHeading } from "@/components/progress/format";
import { bodyweightOn, finishedWorkouts, sessionStats, useProgressData } from "@/components/progress/use-progress-data";
import { db } from "@/lib/db/dexie";
import { formatRepCount, formatWeight, localDateKey } from "@/lib/training";
import type { LocalWorkout } from "@/lib/records";

type Row = { kind: "week"; key: string; label: string } | { kind: "session"; key: string; workout: LocalWorkout };

export function SessionList() {
  const data = useProgressData();
  const settings = useLiveQuery(() => db.settings.get("local"));
  const listRef = useRef<HTMLDivElement>(null);

  if (data.loading) return <ListSkeleton rows={5} />;

  const finished = finishedWorkouts(data.workouts);
  const dates = finished.flatMap((workout) => (workout.finishedAt ? [workout.finishedAt] : []));
  const links: Record<string, string> = {};
  for (const workout of finished) {
    if (!workout.finishedAt) continue;
    links[localDateKey(workout.finishedAt)] = `/progress/${workout.id}`;
  }
  const rows = groupRows(finished);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Calendar</h2>
        <MonthCalendar trained={dates} rest={settings?.restDays ?? []} links={links} />
      </section>
      {finished.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No sessions yet"
          body="Finish a workout and it will show up here."
          action={
            <Button asChild>
              <Link href="/">Start a workout</Link>
            </Button>
          }
        />
      ) : (
        <SessionRows rows={rows} listRef={listRef} metrics={data.metrics} fallbackKg={data.bodyweightKg} unit={data.unit} blocks={data.blocks} sets={data.sets} exercises={data.exercises} />
      )}
    </div>
  );
}

function groupRows(finished: LocalWorkout[]): Row[] {
  const rows: Row[] = [];
  let week = "";
  for (const workout of finished) {
    const finishedAt = workout.finishedAt;
    if (!finishedAt) continue;
    const heading = weekHeading(finishedAt);
    if (heading !== week) {
      week = heading;
      rows.push({ kind: "week", key: `week-${finishedAt}`, label: heading });
    }
    rows.push({ kind: "session", key: workout.id, workout });
  }
  return rows;
}

function SessionRows({
  rows,
  listRef,
  metrics,
  fallbackKg,
  unit,
  blocks,
  sets,
  exercises,
}: {
  rows: Row[];
  listRef: RefObject<HTMLDivElement>;
  metrics: { date: string; weightKg: number | null }[];
  fallbackKg: number;
  unit: "kg" | "lb";
  blocks: ReturnType<typeof useProgressData>["blocks"];
  sets: ReturnType<typeof useProgressData>["sets"];
  exercises: ReturnType<typeof useProgressData>["exercises"];
}) {
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node) return;
    setScrollMargin(node.getBoundingClientRect().top + window.scrollY);
  }, [listRef, rows.length]);
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (index) => (rows[index]?.kind === "week" ? 36 : 96),
    overscan: 8,
    scrollMargin,
  });
  const items = virtualizer.getVirtualItems();

  return (
    <div ref={listRef}>
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {items.map((item) => {
          const row = rows[item.index];
          if (!row) return null;
          return (
            <div
              key={row.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${item.start - scrollMargin}px)` }}
            >
              {row.kind === "week" ? (
                <p className="px-1 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</p>
              ) : (
                <SessionCard workout={row.workout} bodyweightKg={bodyweightOn(row.workout.finishedAt ?? row.workout.startedAt, metrics, fallbackKg)} unit={unit} blocks={blocks} sets={sets} exercises={exercises} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionCard({
  workout,
  bodyweightKg,
  unit,
  blocks,
  sets,
  exercises,
}: {
  workout: LocalWorkout;
  bodyweightKg: number;
  unit: "kg" | "lb";
  blocks: ReturnType<typeof useProgressData>["blocks"];
  sets: ReturnType<typeof useProgressData>["sets"];
  exercises: ReturnType<typeof useProgressData>["exercises"];
}) {
  const stats = sessionStats(workout, blocks, sets, exercises, bodyweightKg);
  const duration = durationLabel(workout.startedAt, workout.finishedAt);
  return (
    <Link href={`/progress/${workout.id}`} className="mb-2 block rounded-2xl border border-border bg-card px-4 py-3 active:bg-surface-elevated">
      <span className="block font-medium">{sessionLine(workout)}</span>
      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{formatWeight(stats.tonnage, unit)}</span>
        <span>{stats.sets} sets</span>
        <span>{formatRepCount(stats.reps)} reps</span>
        {duration ? <span>{duration}</span> : null}
      </span>
    </Link>
  );
}
