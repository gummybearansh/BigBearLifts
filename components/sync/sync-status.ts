"use client";

import { create } from "zustand";

export type SyncPhase = "synced" | "pending" | "offline" | "failed";

type SyncState = {
  phase: SyncPhase;
  message: string | null;
  report: (phase: SyncPhase, message?: string | null) => void;
};

export const useSyncPhase = create<SyncState>((set) => ({
  phase: "synced",
  message: null,
  report: (phase, message = null) => set({ phase, message }),
}));
