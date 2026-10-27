"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/layout/EmptyState";
import { ListSkeleton } from "@/components/layout/ListSkeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { REST_COLOR } from "@/components/charts/MonthCalendar";
import { db } from "@/lib/db/dexie";
import { discardWorkout, nextDayId, readActiveProgram, saveSettings, startWorkoutForDay } from "@/lib/db/training-store";
import { formatWeight, localDateKey, trainingStreak } from "@/lib/training";

const page = "flex min-w-0 flex-col gap-4 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]";

export function TodayHome() {
  const router = useRouter();
  const tree = useLiveQuery(readActiveProgram);
  const workouts = useLiveQuery(() => db.workouts.toArray());
  const settings = useLiveQuery(() => db.settings.get("local"));
  const upcomingId = useLiveQuery(nextDayId);
  const [pending, setPending] = useState(false);

  const sorted = [...(workouts ?? [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const open = sorted.find((workout) => workout.finishedAt === null) ?? null;
  const recent = sorted.filter((workout) => workout.finishedAt).slice(0, 3);
  const streak = trainingStreak(
    sorted.flatMap((workout) => (workout.finishedAt ? [workout.finishedAt] : [])),
    new Date(),
    settings?.restDays ?? [],
  );
  const nextDay = tree?.days.find((day) => day.id === upcomingId) ?? null;
  const unit = settings?.unit ?? "kg";
  const todayKey = localDateKey(new Date());
  const resting = (settings?.restDays ?? []).includes(todayKey);

  if (tree === undefined || workouts === undefined) {
    return (
      <>
        <PageHeader title="Today" />
        <main className={page}>
          <ListSkeleton />
        </main>
      </>
    );
  }

  async function start() {
    const dayId = open?.programDayId ?? nextDay?.id;
    if (!dayId && !open) return;
    setPending(true);
    try {
      const id = open?.id ?? (await startWorkoutForDay(dayId ?? ""));
      router.push(`/workout/${id}`);
    } finally {
      setPending(false);
    }
  }

  async function toggleRest() {
    const current = (await db.settings.get("local"))?.restDays ?? [];
    const marked = current.includes(todayKey);
    setPending(true);
    try {
      if (!marked && open) await discardWorkout(open.id);
      const restDays = marked ? current.filter((day) => day !== todayKey) : [...current, todayKey];
      await saveSettings({ restDays });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Today"
        action={<p className="text-sm font-medium text-primary">{streak} day streak</p>}
      />
      <main className={page}>
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="relative h-44 bg-black">
            <img src="/atmosphere/today-mark.jpg" alt="" className="h-full w-full object-contain object-right" />
          </div>
          <div className="px-4 pb-4 pt-4">
          <p className="text-sm text-primary">
            {resting ? "Rest day" : open ? "In progress" : tree?.program.name ?? "Program"}
          </p>
          <h2 className="mt-1 text-[32px] font-semibold leading-tight tracking-tight">
            {open && !resting ? open.label : (nextDay?.label ?? "Syncing program")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {resting ? "Queued for tomorrow" : settings?.workoutReminder ? `Reminder ${settings.workoutReminder}` : "No reminder set"}
          </p>
          {resting ? null : (
            <Button className="mt-5 w-full" disabled={pending || (!open && !nextDay)} onClick={() => void start()}>
              {pending ? "Opening…" : open ? "Resume workout" : "Start today's workout"}
            </Button>
          )}
          <Button
            className={resting ? "mt-5 w-full" : "mt-3 w-full"}
            variant={resting ? "primary" : "secondary"}
            style={resting ? { background: REST_COLOR, color: "#0A0A0B" } : undefined}
            aria-pressed={resting}
            disabled={pending || !nextDay}
            onClick={() => void toggleRest()}
          >
            Rest day
          </Button>
          </div>
        </section>
        <Link href="/body" className="flex h-14 items-center rounded-2xl border border-border bg-card px-4 font-medium">
          Log weight
        </Link>
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Recent sessions</h2>
          {recent.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No sessions yet"
              body="Finish a workout and it will show up here."
              action={
                <Button type="button" disabled={pending || (!open && !nextDay)} onClick={() => void start()}>
                  {open ? "Resume workout" : "Start today's workout"}
                </Button>
              }
            />
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-border bg-card">
              {recent.map((workout) => (
                <li key={workout.id} className="border-b border-border last:border-b-0">
                  <Link href={`/progress/${workout.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 active:bg-surface-elevated">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{workout.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {workout.finishedAt ? localDateKey(workout.finishedAt) : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-primary">{formatWeight(workout.totalVolume, unit)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
