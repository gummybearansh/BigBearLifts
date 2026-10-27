"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db/dexie";
import { cleanStamp } from "@/lib/records";

export type Transfer = {
  id: string;
  label: string;
  progress: number;
  error: string | null;
};

type Listener = () => void;

const uploads = new Map<string, Transfer>();
const syncs = new Map<string, Transfer>();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

function put(map: Map<string, Transfer>, transfer: Transfer) {
  map.set(transfer.id, transfer);
  emit();
}

export function useTransfers(): { uploads: Transfer[]; syncs: Transfer[] } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return { uploads: [...uploads.values()], syncs: [...syncs.values()] };
}

export function startUpload(file: File, notes: string) {
  const id = crypto.randomUUID();
  put(uploads, { id, label: "Uploading to EC2", progress: 0, error: null });
  const body = new FormData();
  body.set("file", file);
  if (notes.trim()) body.set("notes", notes.trim());
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/videos/upload");
  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable) return;
    put(uploads, { id, label: "Uploading to EC2", progress: event.loaded / event.total, error: null });
  };
  xhr.onerror = () => {
    put(uploads, { id, label: "Uploading to EC2", progress: uploads.get(id)?.progress ?? 0, error: "Upload failed." });
  };
  xhr.onload = () => {
    void (async () => {
      const payload = JSON.parse(xhr.responseText || "{}") as {
        error?: string;
        video?: Parameters<typeof db.videos.put>[0];
      };
      if (xhr.status < 200 || xhr.status >= 300 || !payload.video) {
        put(uploads, { id, label: "Uploading to EC2", progress: uploads.get(id)?.progress ?? 0, error: payload.error ?? "Upload failed." });
        return;
      }
      await db.videos.put({ ...payload.video, ...cleanStamp(payload.video.updatedAt) });
      uploads.delete(id);
      emit();
    })();
  };
  xhr.send(body);
}

export function dismissUpload(id: string) {
  uploads.delete(id);
  emit();
}

export function startDriveSync(id: string) {
  if (syncs.get(id) && !syncs.get(id)?.error) return;
  put(syncs, { id, label: "Syncing to Drive", progress: 0, error: null });
  void (async () => {
    const started = await fetch(`/api/videos/${id}/sync`, { method: "POST" });
    const first = (await started.json()) as { error?: string; done?: boolean; progress?: number; status?: "synced"; syncedAt?: string | null; updatedAt?: string };
    if (!started.ok) {
      put(syncs, { id, label: "Syncing to Drive", progress: 0, error: first.error ?? "Sync failed." });
      return;
    }
    if (first.done && first.updatedAt) {
      await finishSync(id, first);
      return;
    }
    const poll = async () => {
      const response = await fetch(`/api/videos/${id}/sync`);
      const job = (await response.json()) as { error?: string; done?: boolean; progress?: number; status?: "synced"; syncedAt?: string | null; updatedAt?: string };
      if (!response.ok) {
        put(syncs, { id, label: "Syncing to Drive", progress: syncs.get(id)?.progress ?? 0, error: job.error ?? "Sync failed." });
        return;
      }
      if (!job.done) {
        put(syncs, { id, label: "Syncing to Drive", progress: job.progress ?? 0, error: null });
        window.setTimeout(() => void poll(), 700);
        return;
      }
      if (job.error || !job.updatedAt) {
        put(syncs, { id, label: "Syncing to Drive", progress: job.progress ?? 0, error: job.error ?? "Sync failed." });
        return;
      }
      await finishSync(id, job);
    };
    window.setTimeout(() => void poll(), 700);
  })();
}

async function finishSync(
  id: string,
  job: { status?: "synced"; syncedAt?: string | null; updatedAt?: string },
) {
  if (job.updatedAt) {
    await db.videos.update(id, {
      status: job.status ?? "synced",
      syncedAt: job.syncedAt ?? null,
      playbackPath: null,
      ...cleanStamp(job.updatedAt),
    });
  }
  syncs.delete(id);
  emit();
}

export function dismissSync(id: string) {
  syncs.delete(id);
  emit();
}
