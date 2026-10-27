"use client";

import type { ReactNode } from "react";
import { SyncStatus } from "@/components/sync/SyncStatus";

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 bg-background/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center">
          <SyncStatus />
          <h1 className="truncate text-2xl font-semibold leading-tight tracking-tight">{title}</h1>
        </div>
        {action}
      </div>
      <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-primary via-primary/25 to-transparent" />
    </header>
  );
}
