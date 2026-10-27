"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSyncPhase } from "@/components/sync/sync-status";
import { db } from "@/lib/db/dexie";
import { listDirtyQueue, syncTraining } from "@/lib/db/training-store";
import { recordFailure } from "@/lib/failure-log";

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
    let active = true;
    let resumeTimeout: NodeJS.Timeout | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const run = (isRetry = false) => {
      if (!active) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        report("offline", "This phone is offline.");
        return;
      }
      void syncTraining()
        .then(async () => {
          if (!active) return;
          const left = await listDirtyQueue();
          report(left.length ? "pending" : "synced", null);
        })
        .catch((error: unknown) => {
          if (!active) return;
          const msg = error instanceof Error ? error.message : "Sync failed.";
          const isTransient =
            msg.includes("cursor that doesn't exist") ||
            msg.includes("without an in-progress transaction") ||
            msg.includes("Load failed") ||
            msg.includes("Failed to fetch") ||
            msg.includes("NetworkError");

          if (!isRetry && isTransient) {
            if (retryTimeout) clearTimeout(retryTimeout);
            retryTimeout = setTimeout(() => {
              run(true);
            }, 1500);
            return;
          }

          recordFailure("sync", error);
          report("failed", msg);
        });
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        if (resumeTimeout) clearTimeout(resumeTimeout);
        // Delay 800ms so cellular/Wi-Fi and WebKit IndexedDB settle after phone unlock
        resumeTimeout = setTimeout(() => {
          run();
        }, 800);
      } else {
        if (resumeTimeout) clearTimeout(resumeTimeout);
        if (retryTimeout) clearTimeout(retryTimeout);
      }
    };

    const onOffline = () => report("offline", "This phone is offline.");
    run();
    const timer = window.setInterval(() => run(), 20000);
    window.addEventListener("online", () => run());
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      if (resumeTimeout) clearTimeout(resumeTimeout);
      if (retryTimeout) clearTimeout(retryTimeout);
      window.clearInterval(timer);
      window.removeEventListener("online", () => run());
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [report]);

  return children;
}
