"use client";

import Link from "next/link";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { SignOutButton } from "@/app/(app)/more/sign-out-button";
import { PageHeader } from "@/components/layout/PageHeader";
import { ListSkeleton } from "@/components/layout/ListSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { enableReminders } from "@/components/reminders/Reminders";
import { db } from "@/lib/db/dexie";
import { saveSettings } from "@/lib/db/training-store";

export function MoreScreen() {
  const settings = useLiveQuery(() => db.settings.get("local"));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function changePassword() {
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) toast.error(payload.error ?? "Could not change the password.");
    else {
      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    }
  }

  if (settings === undefined) {
    return (
      <>
        <PageHeader title="More" />
        <main className="px-4 py-4">
          <ListSkeleton />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title="More" />
      <main className="flex min-w-0 flex-col gap-4 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <Link href="/exercises" className="flex h-14 items-center rounded-2xl border border-border bg-card px-4 font-medium">
          Exercises
        </Link>
        <Link href="/videos" className="flex h-14 items-center rounded-2xl border border-border bg-card px-4 font-medium">
          Physique
        </Link>
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <label className="text-sm text-muted-foreground">
            Accent
            <input
              type="color"
              className="mt-1 h-11 w-full bg-transparent"
              value={settings?.accent ?? "#FF5A1F"}
              onChange={(event) => void saveSettings({ accent: event.target.value })}
            />
          </label>
          <NativeSelect
            aria-label="Units"
            value={settings?.unit ?? "kg"}
            onChange={(event) => void saveSettings({ unit: event.target.value === "lb" ? "lb" : "kg" })}
          >
            <option value="kg">Kilograms</option>
            <option value="lb">Pounds</option>
          </NativeSelect>
          <Input
            aria-label="Default rest seconds"
            inputMode="numeric"
            defaultValue={settings ? String(settings.restSec) : "180"}
            key={settings?.restSec ?? "rest"}
            onBlur={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(value) && value > 0) void saveSettings({ restSec: value });
            }}
          />
          <Input
            aria-label="Height cm"
            inputMode="decimal"
            defaultValue={settings?.heightCm ? String(settings.heightCm) : ""}
            placeholder="Height cm"
            key={`h-${settings?.heightCm ?? 0}`}
            onBlur={(event) => {
              const value = Number.parseFloat(event.target.value);
              if (Number.isFinite(value) && value > 0) void saveSettings({ heightCm: value });
            }}
          />
          <div className="rounded-xl bg-surface-elevated px-4 py-3 text-sm">
            <p>Workout reminder at 5:00.</p>
            <p className="mt-1 text-muted-foreground">If nothing is logged, a second one lands at 9:00 pm. A rest day skips that one.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void enableReminders().then((permission) => {
                if (permission === "granted") toast.success("Reminders are on.");
                else if (permission === "unsupported") toast.error("This browser can't show reminders.");
                else toast.error("Reminders stay off until the browser allows them.");
              });
            }}
          >
            Allow reminders
          </Button>
        </section>
        <section className="flex flex-col gap-2">
          <a href="/api/export" className="flex h-11 items-center justify-center rounded-xl border border-border text-sm font-medium">
            Export JSON
          </a>
          <a href="/api/export?format=csv" className="flex h-11 items-center justify-center rounded-xl border border-border text-sm font-medium">
            Export CSV
          </a>
        </section>
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <Input type="password" aria-label="Current password" placeholder="Current password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <Input type="password" aria-label="New password" placeholder="New password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <Button type="button" variant="secondary" onClick={() => void changePassword()}>
            Change password
          </Button>
        </section>
        <SignOutButton />
      </main>
    </>
  );
}
