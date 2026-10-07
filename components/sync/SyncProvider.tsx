"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSyncPhase } from "@/components/sync/sync-status";
import { db } from "@/lib/db/dexie";
import { listDirtyQueue, syncTraining } from "@/lib/db/training-store";

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const settings = useLiveQuery(() => db.settings.get("local"));
  const report = useSyncPhase((state) => state.report);

  useEffect(() => {
    const accent = settings?.accent || "#FF5A1F";
    const root = document.documentElement;
    root.style.setProperty("--primary", accent);
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--ring", accent);
  }, [settings?.accent]);

  useEffect(() => {
    const run = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        report("offline", "This phone is offline.");
        return;
      }
      void syncTraining()
        .then(async () => {
          const left = await listDirtyQueue();
          report(left.length ? "pending" : "synced", null);
        })
        .catch((error: unknown) => {
          report("failed", error instanceof Error ? error.message : "Sync failed.");
        });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    const onOffline = () => report("offline", "This phone is offline.");
    run();
    const timer = window.setInterval(run, 5000);
    window.addEventListener("online", run);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", run);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [report]);

  return children;
}
