"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useSyncPhase } from "@/components/sync/sync-status";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { listDirtyQueue, syncTraining } from "@/lib/db/training-store";

const label: Record<"synced" | "pending" | "offline" | "failed", string> = {
  synced: "Synced",
  pending: "Changes waiting to sync",
  offline: "Offline",
  failed: "Sync failed",
};

export function SyncStatus() {
  const phase = useSyncPhase((state) => state.phase);
  const message = useSyncPhase((state) => state.message);
  const report = useSyncPhase((state) => state.report);
  const queue = useLiveQuery(listDirtyQueue);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const shown = !online ? "offline" : phase === "failed" ? "failed" : (queue?.length ?? 0) > 0 ? "pending" : phase;

  async function syncNow() {
    if (!online) {
      report("offline", "This phone is offline.");
      return;
    }
    setPending(true);
    try {
      await syncTraining();
      const left = await listDirtyQueue();
      report(left.length ? "pending" : "synced", null);
    } catch (error) {
      report("failed", error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="flex size-11 shrink-0 items-center justify-center"
        aria-label={label[shown]}
        onClick={() => setOpen(true)}
      >
        <span className="relative size-8 overflow-hidden rounded-lg bg-[#0A0A0B]">
          <img src="/mark.png" alt="" className="absolute left-1/2 top-1/2 h-[175%] w-[175%] max-w-none -translate-x-1/2 -translate-y-1/2" />
        </span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{label[shown]}</SheetTitle>
            <SheetDescription>{message ?? "Local changes sync when this phone is online."}</SheetDescription>
          </SheetHeader>
          <ul className="mt-4 max-h-64 overflow-y-auto">
            {(queue ?? []).length === 0 ? (
              <li className="text-sm text-muted-foreground">Nothing waiting.</li>
            ) : (
              (queue ?? []).map((item) => (
                <li key={`${item.table}-${item.id}`} className="flex min-h-11 items-center justify-between gap-3 border-b border-border text-sm">
                  <span className="truncate">{item.label}</span>
                  <span className="shrink-0 text-muted-foreground">{item.table}</span>
                </li>
              ))
            )}
          </ul>
          <Button type="button" className="mt-4 w-full" disabled={pending} onClick={() => void syncNow()}>
            {pending ? "Syncing…" : "Sync now"}
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
