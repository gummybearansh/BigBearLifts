"use client";

import { create } from "zustand";

type RestState = {
  endsAt: number | null;
  start: (seconds: number) => void;
  add: (seconds: number) => void;
  clear: () => void;
};

export const useRestTimer = create<RestState>((set, get) => ({
  endsAt: null,
  start: (seconds) => set({ endsAt: Date.now() + seconds * 1000 }),
  add: (seconds) => {
    const current = get().endsAt;
    const base = current && current > Date.now() ? current : Date.now();
    set({ endsAt: base + seconds * 1000 });
  },
  clear: () => set({ endsAt: null }),
}));
