"use client";

import Link from "next/link";
import { useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/layout/EmptyState";
import { ListSkeleton } from "@/components/layout/ListSkeleton";
import { sessionLine } from "@/components/progress/format";
import { bodyweightOn, finishedWorkouts, sessionStats, useProgressData } from "@/components/progress/use-progress-data";
import { formatWeight } from "@/lib/training";
import type { LocalWorkout } from "@/lib/records";

export function DayTonnage() {
  const data = useProgressData();
  const [open, setOpen] = useState<string | null>(null);
  if (data.loading) return <ListSkeleton />;

  const finished = finishedWorkouts(data.workouts);
  if (finished.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No day history"
        body="Finished sessions group here by program day."
        action={
          <Link href="/" className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">
            Start a workout
          </Link>
        }
      />
    );
  }

  const grouped = new Map<string, LocalWorkout[]>();
  for (const workout of finished) {
    const list = grouped.get(workout.label) ?? [];
    list.push(workout);
    grouped.set(workout.label, list);
  }
  const order = new Map(data.days.map((day) => [day.label, day.order]));
  const labels = [...grouped.keys()].sort(
    (a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99) || a.localeCompare(b),
  );

  return (
    <ul className="flex flex-col gap-2">
      {labels.map((label) => {
        const sessions = grouped.get(label) ?? [];
        const stats = sessions.map((workout) =>
          sessionStats(workout, data.blocks, data.sets, data.exercises, bodyweightOn(workout.finishedAt ?? workout.startedAt, data.metrics, data.bodyweightKg)),
        );
        const newest = stats[0]?.tonnage ?? 0;
        const best = stats.reduce((max, item) => Math.max(max, item.tonnage), 0);
        const average = stats.length ? stats.reduce((sum, item) => sum + item.tonnage, 0) / stats.length : 0;
        const series = [...sessions]
          .reverse()
          .map((workout, index) => ({
            index,
            tonnage: sessionStats(
              workout,
              data.blocks,
              data.sets,
              data.exercises,
              bodyweightOn(workout.finishedAt ?? workout.startedAt, data.metrics, data.bodyweightKg),
            ).tonnage,
          }));
        const expanded = open === label;
        return (
          <li key={label} className="rounded-2xl border border-border bg-card">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : label)}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{sessionLine(sessions[0] ?? { finishedAt: null, label })}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {sessions.length} sessions · last {formatWeight(newest, data.unit)} · best {formatWeight(best, data.unit)} · avg{" "}
                  {formatWeight(average, data.unit)}
                </span>
              </span>
              <span className="h-8 w-16 shrink-0" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <Line type="monotone" dataKey="tonnage" stroke="#FF5A1F" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </span>
            </button>
            {expanded ? (
              <ul className="border-t border-border">
                {sessions.map((workout) => {
                  const row = sessionStats(
                    workout,
                    data.blocks,
                    data.sets,
                    data.exercises,
                    bodyweightOn(workout.finishedAt ?? workout.startedAt, data.metrics, data.bodyweightKg),
                  );
                  return (
                    <li key={workout.id} className="border-b border-border last:border-b-0">
                      <Link href={`/progress/${workout.id}`} className="flex min-h-11 items-center justify-between px-4 py-3 text-sm active:bg-surface-elevated">
                        <span>{sessionLine(workout)}</span>
                        <span className="text-muted-foreground">{formatWeight(row.tonnage, data.unit)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
