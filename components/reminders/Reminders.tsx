"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { localDateKey } from "@/lib/training";

const WORKOUT_MINUTES = 17 * 60;
const MISSED_MINUTES = 21 * 60;

const WORKOUT_NOTE = {
  title: "Train",
  body: "5:00. Time to train.",
  tag: "bbl-workout",
};

const MISSED_NOTE = {
  title: "Nothing logged",
  body: "It's 9:00 pm. No session today. The program showed up. You didn't.",
  tag: "bbl-missed",
};

export function Reminders() {
  const workouts = useLiveQuery(() => db.workouts.toArray());
  const settings = useLiveQuery(() => db.settings.get("local"));

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    if (!workouts || settings === undefined) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const today = localDateKey(new Date());
    const trained = workouts.some((workout) => workout.finishedAt && localDateKey(workout.finishedAt) === today);
    const resting = (settings?.restDays ?? []).includes(today);

    void scheduleAhead(trained, resting);
    void fireIfDue(trained, resting);
    const timer = window.setInterval(() => {
      void fireIfDue(trained, resting);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [settings, workouts]);

  return null;
}

export async function enableReminders(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission === "granted") await navigator.serviceWorker.register("/sw.js");
  return permission;
}

async function scheduleAhead(trained: boolean, resting: boolean) {
  const registration = await navigator.serviceWorker.ready;
  const now = Date.now();
  registration.active?.postMessage({ type: "schedule", ...WORKOUT_NOTE, at: nextAt(WORKOUT_MINUTES, now) });
  registration.active?.postMessage({
    type: "schedule",
    ...MISSED_NOTE,
    at: trained || resting ? 0 : nextAt(MISSED_MINUTES, now),
  });
}

async function fireIfDue(trained: boolean, resting: boolean) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = localDateKey(now);
  if (inWindow(minutes, WORKOUT_MINUTES) && !alreadySent("workout", today)) {
    markSent("workout", today);
    await showNow(WORKOUT_NOTE);
  }
  if (inWindow(minutes, MISSED_MINUTES) && !trained && !resting && !alreadySent("missed", today)) {
    markSent("missed", today);
    await showNow(MISSED_NOTE);
  }
}

async function showNow(note: { title: string; body: string; tag: string }) {
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(note.title, { body: note.body, tag: note.tag, icon: "/icon" });
}

function inWindow(minutes: number, target: number): boolean {
  return minutes >= target && minutes < target + 2;
}

function nextAt(minutes: number, now: number): number {
  const date = new Date(now);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (date.getTime() <= now) date.setDate(date.getDate() + 1);
  return date.getTime();
}

function alreadySent(kind: string, today: string): boolean {
  return window.localStorage.getItem(`bbl-note-${kind}`) === today;
}

function markSent(kind: string, today: string) {
  window.localStorage.setItem(`bbl-note-${kind}`, today);
}
