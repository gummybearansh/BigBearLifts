"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Video } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/layout/EmptyState";
import { ListSkeleton } from "@/components/layout/ListSkeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { sessionDateLabel } from "@/components/progress/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db/dexie";
import { cleanStamp } from "@/lib/records";
import type { VideoStatus } from "@/lib/records";

function sizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

const STATUS_LABEL: Record<VideoStatus, string> = {
  "on-ec2": "On EC2",
  synced: "Synced",
  deleted: "Deleted from EC2",
};

export function VideosScreen() {
  const videos = useLiveQuery(() => db.videos.toArray());
  const [notes, setNotes] = useState("");
  const [storage, setStorage] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function upload(file: File) {
    const body = new FormData();
    body.set("file", file);
    if (notes.trim()) body.set("notes", notes.trim());
    const response = await fetch("/api/videos/upload", { method: "POST", body });
    const payload = (await response.json()) as { error?: string; video?: Parameters<typeof db.videos.put>[0] };
    if (!response.ok || !payload.video) {
      toast.error(payload.error ?? "Upload failed.");
      return;
    }
    await db.videos.put({ ...payload.video, ...cleanStamp(payload.video.updatedAt) });
    toast.success("Video is on EC2.");
    setNotes("");
    setCameraOpen(false);
  }

  async function syncOne(id: string) {
    setPendingId(id);
    try {
      const response = await fetch(`/api/videos/${id}/sync`, { method: "POST" });
      const payload = (await response.json()) as { error?: string; status?: VideoStatus; syncedAt?: string | null; updatedAt?: string };
      if (!response.ok || !payload.status || !payload.updatedAt) {
        toast.error(payload.error ?? "Sync failed.");
        return;
      }
      await db.videos.update(id, {
        status: payload.status,
        syncedAt: payload.syncedAt ?? null,
        playbackPath: null,
        ...cleanStamp(payload.updatedAt),
      });
      toast.success("Synced to Drive. You can delete it from EC2.");
    } finally {
      setPendingId(null);
    }
  }

  async function removeOne(id: string) {
    setPendingId(id);
    try {
      const response = await fetch(`/api/videos/${id}/remove`, { method: "POST" });
      const payload = (await response.json()) as { error?: string; status?: VideoStatus; updatedAt?: string };
      if (!response.ok || !payload.status || !payload.updatedAt) {
        toast.error(payload.error ?? "Could not delete it from EC2.");
        return;
      }
      await db.videos.update(id, { status: payload.status, playbackPath: null, ...cleanStamp(payload.updatedAt) });
      toast.success("Deleted from EC2.");
    } finally {
      setPendingId(null);
    }
  }

  async function loadStorage() {
    const response = await fetch("/api/videos/storage");
    if (!response.ok) return;
    const payload = (await response.json()) as { ec2Bytes: number };
    setStorage(`${Math.round(payload.ec2Bytes / (1024 * 1024))} MB on EC2`);
  }

  return (
    <>
      <PageHeader title="Physique" />
      <main className="flex min-w-0 flex-col gap-4 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <p className="text-sm leading-relaxed text-muted-foreground">One video of your whole physique after a workout.</p>
        <Input aria-label="Notes" placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <Button type="button" onClick={() => setCameraOpen(true)}>
          Record physique
        </Button>
        <button type="button" className="text-left text-sm text-muted-foreground" onClick={() => void loadStorage()}>
          {storage || "Check EC2 storage"}
        </button>
        {videos === undefined ? (
          <ListSkeleton />
        ) : videos.length === 0 ? (
          <EmptyState
            icon={Video}
            title="No physique updates"
            body="Record one after you train. It uploads to EC2, then you can sync it and delete the server copy."
            action={
              <Button type="button" onClick={() => setCameraOpen(true)}>
                Record physique
              </Button>
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {videos
              .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
              .map((video) => (
                <li key={video.id} className="border-b border-border px-4 py-3 last:border-b-0">
                  <p className="font-medium">{sessionDateLabel(video.uploadedAt)}</p>
                  {video.notes ? <p className="mt-1 text-sm leading-relaxed">{video.notes}</p> : null}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {STATUS_LABEL[video.status]} · {sizeLabel(video.sizeBytes)}
                  </p>
                  {video.status === "on-ec2" ? (
                    <Button type="button" variant="secondary" className="mt-3 w-full" disabled={pendingId === video.id} onClick={() => void syncOne(video.id)}>
                      {pendingId === video.id ? "Syncing…" : "Sync"}
                    </Button>
                  ) : null}
                  {video.status === "synced" ? (
                    <Button type="button" variant="secondary" className="mt-3 w-full" disabled={pendingId === video.id} onClick={() => void removeOne(video.id)}>
                      {pendingId === video.id ? "Deleting…" : "Delete from EC2"}
                    </Button>
                  ) : null}
                  {video.playbackPath && video.status === "on-ec2" ? (
                    <video className="mt-3 w-full rounded-xl" controls src={video.playbackPath} />
                  ) : null}
                </li>
              ))}
          </ul>
        )}
      </main>
      {cameraOpen ? <CameraSheet onClose={() => setCameraOpen(false)} onCapture={upload} /> : null}
    </>
  );
}

function CameraSheet({ onClose, onCapture }: { onClose: () => void; onCapture: (file: File) => Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const keepRecordingRef = useRef(true);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function open() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot open the camera.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        if (!cancelled) setError("Allow the camera for a physique update.");
      }
    }
    void open();
    return () => {
      cancelled = true;
      keepRecordingRef.current = false;
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function toggle() {
    if (saving) return;
    const stream = streamRef.current;
    if (!stream) return;
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }
    const mime = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((item) => MediaRecorder.isTypeSupported(item));
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      if (!keepRecordingRef.current) return;
      const type = (recorder.mimeType || "video/webm").split(";")[0] || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `physique.${ext}`, { type });
      setSaving(true);
      void onCapture(file).finally(() => {
        setSaving(false);
        stopTracks();
      });
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium">{saving ? "Sending to EC2…" : recording ? "Recording" : "Physique"}</p>
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
          Close
        </Button>
      </div>
      <video ref={videoRef} className="min-h-0 w-full flex-1 bg-black object-contain" playsInline muted />
      <div className="px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {error ? <p className="mb-3 text-sm text-muted-foreground">{error}</p> : null}
        <Button type="button" className="w-full" disabled={Boolean(error) || saving} onClick={() => void toggle()}>
          {saving ? "Sending to EC2…" : recording ? "Stop" : "Record"}
        </Button>
      </div>
    </div>
  );
}
