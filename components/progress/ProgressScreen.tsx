"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { ListSkeleton } from "@/components/layout/ListSkeleton";
import { DayTonnage } from "@/components/progress/DayTonnage";
import { SessionList } from "@/components/progress/SessionList";
import { bodyweightOn, finishedWorkouts, useProgressData } from "@/components/progress/use-progress-data";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MUSCLE_LABELS, isMuscle } from "@/lib/catalog";
import { db } from "@/lib/db/dexie";
import { countableSet, epley, formatWeight, kgToDisplay, localDateKey } from "@/lib/training";
import { setVolumeKg } from "@/lib/volume";

const MUSCLE_FILLS: Record<string, string> = {
  Chest: "#FF5A1F",
  Back: "#2EC8FF",
  Shoulders: "#FFB020",
  Biceps: "#A78BFA",
  Triceps: "#FF4FA3",
  Quads: "#3DDC84",
  Hamstrings: "#FF8A3D",
  Glutes: "#6C7CFF",
  Calves: "#E7C229",
  Abs: "#2EE0D0",
  Other: "#8E8E99",
};

const CHART_TOOLTIP = {
  contentStyle: { background: "#16161A", border: "1px solid #3F3F46", borderRadius: 12, color: "#F5F5F7" },
  labelStyle: { color: "#F5F5F7" },
  itemStyle: { color: "#F5F5F7" },
};

export function ProgressScreen() {
  const [tab, setTab] = useState("sessions");

  return (
    <>
      <PageHeader title="Progress" />
      <main className="min-w-0 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="days">Days</TabsTrigger>
            <TabsTrigger value="lifts">Lifts</TabsTrigger>
            <TabsTrigger value="volume">Volume</TabsTrigger>
          </TabsList>
          <TabsContent value="sessions">{tab === "sessions" ? <SessionList /> : null}</TabsContent>
          <TabsContent value="days">{tab === "days" ? <DayTonnage /> : null}</TabsContent>
          <TabsContent value="lifts">{tab === "lifts" ? <LiftsPanel /> : null}</TabsContent>
          <TabsContent value="volume">{tab === "volume" ? <VolumePanel /> : null}</TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function LiftsPanel() {
  const data = useProgressData();
  const [exerciseId, setExerciseId] = useState("");
  const chosen = exerciseId || data.exercises[0]?.id || "";
  const prs = useLiveQuery(async () => {
    if (!chosen) return [];
    return db.prs.where("exerciseId").equals(chosen).toArray();
  }, [chosen]);
  const points = useMemo(() => {
    return finishedWorkouts(data.workouts).flatMap((workout) => {
      const mine = data.blocks.filter((block) => block.workoutId === workout.id && block.exerciseId === chosen);
      const done = data.sets.filter((set) => mine.some((block) => block.id === set.workoutExerciseId) && set.isCompleted);
      const mineSets = done.filter((set) => countableSet(set.type));
      const finishedAt = workout.finishedAt;
      if (!done.length || !finishedAt) return [];
      const best = mineSets.reduce((max, set) => Math.max(max, epley(set.weight, set.reps)), 0);
      const top = mineSets.reduce((max, set) => Math.max(max, Math.abs(set.weight)), 0);
      const exercise = data.exercises.find((item) => item.id === chosen);
      const volumeExercise = {
        name: exercise?.name ?? "",
        equipment: exercise?.equipment ?? "other",
        isAssisted: exercise?.isAssisted ?? false,
      };
      const bodyweight = bodyweightOn(finishedAt, data.metrics, data.bodyweightKg);
      let tonnage = 0;
      let sets = 0;
      for (const set of done) {
        const volume = setVolumeKg(set, volumeExercise, bodyweight);
        if (volume <= 0) continue;
        tonnage += volume;
        sets += 1;
      }
      return [
        {
          date: localDateKey(finishedAt),
          epley: Math.round(kgToDisplay(best, data.unit)),
          top: kgToDisplay(top, data.unit),
          tonnage: Math.round(kgToDisplay(tonnage, data.unit)),
          sets,
        },
      ];
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [chosen, data.blocks, data.bodyweightKg, data.exercises, data.metrics, data.sets, data.unit, data.workouts]);

  if (data.loading) return <ListSkeleton />;

  return (
    <div>
      <NativeSelect aria-label="Exercise" value={chosen} onChange={(event) => setExerciseId(event.target.value)}>
        {data.exercises.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
          </option>
        ))}
      </NativeSelect>
      <p className="mt-4 text-sm text-muted-foreground">Tonnage is the sum of these sets.</p>
      {points.length ? (
        <p className="mt-2 text-2xl font-semibold">
          {points[points.length - 1]?.sets} sets · {points[points.length - 1]?.tonnage} {data.unit}
        </p>
      ) : null}
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <XAxis dataKey="date" tick={{ fill: "#A1A1AA", fontSize: 12 }} />
            <YAxis tick={{ fill: "#A1A1AA", fontSize: 12 }} width={36} />
            <Tooltip {...CHART_TOOLTIP} content={<LiftsTooltip unit={data.unit} />} />
            <Line type="monotone" dataKey="tonnage" stroke="#FF5A1F" strokeWidth={2.5} dot={false} name="Tonnage" />
            <Line type="monotone" dataKey="epley" stroke="#2EC8FF" strokeWidth={2} dot={false} name="Est. 1RM" />
            <Line type="monotone" dataKey="top" stroke="#F5F5F7" strokeWidth={2} dot={false} name="Top set" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {(prs ?? []).length ? (
        <ul className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          {(prs ?? []).slice(0, 8).map((pr) => (
            <li key={pr.id} className="flex items-center justify-between border-b border-border px-4 py-3 text-sm last:border-b-0">
              <span className="text-pr-gold">{pr.type}</span>
              <span>{pr.type === "reps" ? pr.value : formatWeight(pr.value, data.unit)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function VolumePanel() {
  const data = useProgressData();
  const volumeData = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const workout of finishedWorkouts(data.workouts)) {
      const week = workout.finishedAt ? localDateKey(workout.finishedAt).slice(0, 7) : "";
      const mine = data.blocks.filter((block) => block.workoutId === workout.id);
      for (const block of mine) {
        const exercise = data.exercises.find((item) => item.id === block.exerciseId);
        const muscle = exercise && isMuscle(exercise.primaryMuscle) ? MUSCLE_LABELS[exercise.primaryMuscle] : "Other";
        const volumeExercise = {
          name: exercise?.name ?? "",
          equipment: exercise?.equipment ?? "other",
          isAssisted: exercise?.isAssisted ?? false,
        };
        for (const set of data.sets.filter((item) => item.workoutExerciseId === block.id)) {
          const volume = setVolumeKg(set, volumeExercise, bodyweightOn(workout.finishedAt ?? workout.startedAt, data.metrics, data.bodyweightKg));
          const key = `${week}|${muscle}`;
          buckets.set(key, (buckets.get(key) ?? 0) + volume);
        }
      }
    }
    const weeks = [...new Set([...buckets.keys()].map((key) => key.split("|")[0] ?? ""))];
    return weeks.map((week) => {
      const row: Record<string, string | number> = { week };
      for (const [key, value] of buckets) {
        const [bucketWeek, muscle] = key.split("|");
        if (bucketWeek === week && muscle) row[muscle] = Math.round(kgToDisplay(value, data.unit));
      }
      return row;
    });
  }, [data.blocks, data.bodyweightKg, data.exercises, data.metrics, data.sets, data.unit, data.workouts]);
  const muscles = [...new Set(volumeData.flatMap((row) => Object.keys(row).filter((key) => key !== "week")))];

  if (data.loading) return <ListSkeleton />;

  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={volumeData}>
            <XAxis dataKey="week" tick={{ fill: "#A1A1AA", fontSize: 12 }} axisLine={{ stroke: "#3F3F46" }} tickLine={false} />
            <YAxis tick={{ fill: "#A1A1AA", fontSize: 12 }} width={52} axisLine={false} tickLine={false} />
            <Tooltip {...CHART_TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.06)" }} />
            {muscles.map((muscle) => (
              <Bar key={muscle} dataKey={muscle} stackId="volume" fill={MUSCLE_FILLS[muscle] ?? MUSCLE_FILLS.Other} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
        {muscles.map((muscle) => (
          <li key={muscle} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ background: MUSCLE_FILLS[muscle] ?? MUSCLE_FILLS.Other }} />
            {muscle}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiftsTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { payload: { tonnage: number; sets: number; epley: number; top: number } }[];
  label?: string;
  unit: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div style={CHART_TOOLTIP.contentStyle} className="px-3 py-2 text-sm">
      <p>{label}</p>
      <p>{row.sets} sets</p>
      <p>Tonnage {row.tonnage} {unit}</p>
      <p>Est. 1RM {row.epley}</p>
      <p>Top set {row.top}</p>
    </div>
  );
}
