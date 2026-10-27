import { spawn } from "child_process";
import { prisma } from "@/lib/db/prisma";
import { logFailure } from "@/lib/server/app-log";

export type SyncJob = {
  progress: number;
  done: boolean;
  error: string | null;
  status?: "synced";
  syncedAt?: string | null;
  updatedAt?: string;
};

const jobs = new Map<string, SyncJob>();

export function readSyncJob(id: string): SyncJob | null {
  return jobs.get(id) ?? null;
}

export function beginSyncJob(id: string, filePath: string, remote: string): SyncJob {
  const current = jobs.get(id);
  if (current && !current.done) return current;
  const job: SyncJob = { progress: 0, done: false, error: null };
  jobs.set(id, job);
  const child = spawn("rclone", ["move", filePath, remote, "--stats", "1s", "--stats-one-line", "-P"], {
    env: process.env,
  });
  const take = (chunk: Buffer) => {
    const matches = chunk.toString().match(/(\d+)%/g);
    if (!matches) return;
    const value = Number(matches[matches.length - 1]?.replace("%", ""));
    if (Number.isFinite(value)) job.progress = Math.min(0.99, value / 100);
  };
  child.stdout.on("data", take);
  child.stderr.on("data", take);
  child.on("close", (code) => {
    void (async () => {
      try {
        if (code !== 0) {
          job.error = "rclone could not move this video.";
          job.done = true;
          await logFailure("drive-sync", `rclone exited ${code ?? "unknown"}`, id);
          return;
        }
        const syncedAt = new Date();
        const updated = await prisma.progressVideo.update({
          where: { id },
          data: { status: "synced", syncedAt },
        });
        job.progress = 1;
        job.done = true;
        job.status = "synced";
        job.syncedAt = updated.syncedAt?.toISOString() ?? null;
        job.updatedAt = updated.updatedAt.toISOString();
      } catch (error) {
        job.error = "rclone could not move this video.";
        job.done = true;
        await logFailure("drive-sync", error, id);
      }
    })();
  });
  return job;
}
