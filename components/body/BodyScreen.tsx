"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Scale } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/layout/EmptyState";
import { ListSkeleton } from "@/components/layout/ListSkeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db/dexie";
import { saveBodyMetric, saveGoal } from "@/lib/db/training-store";
import { bmi, ffmi, kgToDisplay, localDateKey } from "@/lib/training";

export function BodyScreen() {
  const metrics = useLiveQuery(() => db.bodyMetrics.toArray());
  const goals = useLiveQuery(() => db.goals.toArray());
  const settings = useLiveQuery(() => db.settings.get("local"));
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [smm, setSmm] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [deadline, setDeadline] = useState("");
  const weightRef = useRef<HTMLInputElement>(null);
  const unit = settings?.unit ?? "kg";
  const sorted = [...(metrics ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const chart = sorted.map((row, index) => {
    const window = sorted.slice(Math.max(0, index - 6), index + 1);
    const samples = window.flatMap((item) => (item.weightKg ? [item.weightKg] : []));
    const trend = samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : null;
    return {
      date: row.date.slice(5),
      weight: row.weightKg ? kgToDisplay(row.weightKg, unit) : null,
      trend: trend ? kgToDisplay(trend, unit) : null,
    };
  });
  const weightKg = latest?.weightKg ?? settings?.bodyweightKg ?? 0;
  const height = settings?.heightCm ?? 0;
  const bodyMass = bmi(weightKg, height);
  const fatFree = ffmi(weightKg, height, latest?.bodyFatPct ?? null);
  const weightGoal = (goals ?? []).find((goal) => goal.type === "weight");

  async function save() {
    const parsedWeight = Number.parseFloat(weight);
    const parsedFat = Number.parseFloat(fat);
    const parsedSmm = Number.parseFloat(smm);
    await saveBodyMetric({
      date: localDateKey(new Date()),
      weightKg: Number.isFinite(parsedWeight) ? (unit === "lb" ? parsedWeight / 2.2046226218 : parsedWeight) : null,
      bodyFatPct: Number.isFinite(parsedFat) ? parsedFat : null,
      smmKg: Number.isFinite(parsedSmm) ? parsedSmm : null,
    });
    setWeight("");
    setFat("");
    setSmm("");
  }

  return (
    <>
      <PageHeader title="Body" />
      <main className="flex min-w-0 flex-col gap-4 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Today</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Input ref={weightRef} aria-label={`Weight ${unit}`} inputMode="decimal" placeholder={unit} value={weight} onChange={(event) => setWeight(event.target.value)} />
            <Input aria-label="Body fat percent" inputMode="decimal" placeholder="BF %" value={fat} onChange={(event) => setFat(event.target.value)} />
            <Input aria-label="Skeletal muscle kg" inputMode="decimal" placeholder="SMM" value={smm} onChange={(event) => setSmm(event.target.value)} />
          </div>
          <Button type="button" className="mt-3 w-full" onClick={() => void save()}>
            Save weigh-in
          </Button>
        </section>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="BMI" value={bodyMass === null ? "—" : String(bodyMass)} />
          <Stat label="FFMI" value={fatFree === null ? "—" : String(fatFree)} />
        </div>
        {metrics === undefined ? (
          <ListSkeleton rows={2} />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No weigh-ins"
            body="Save today's weight to start the trend."
            action={
              <Button type="button" onClick={() => weightRef.current?.focus()}>
                Log weight
              </Button>
            }
          />
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <XAxis dataKey="date" tick={{ fill: "#9A9AA2", fontSize: 12 }} />
                <YAxis tick={{ fill: "#9A9AA2", fontSize: 12 }} width={36} />
                <Tooltip />
                <Line dataKey="weight" stroke="#9A9AA2" dot={false} name="Weight" />
                <Line dataKey="trend" stroke="#FF5A1F" strokeWidth={2} dot={false} name="7-day" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Weight goal {weightGoal ? `· ${weightGoal.targetValue} kg` : ""}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Input aria-label="Target weight kg" inputMode="decimal" placeholder="Target kg" value={targetWeight} onChange={(event) => setTargetWeight(event.target.value)} />
            <Input aria-label="Deadline" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => {
              const value = Number.parseFloat(targetWeight);
              if (!Number.isFinite(value)) return;
              void saveGoal({ type: "weight", targetValue: value, deadline: deadline ? new Date(deadline).toISOString() : null });
            }}
          >
            Save goal
          </Button>
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
