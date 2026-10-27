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
import { dismissSync, dismissUpload, startDriveSync, startUpload, useTransfers } from "@/lib/videos/transfers";

function sizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

const STATUS_LABEL: Record<VideoStatus, string> = {
  "on-ec2": "On EC2",
  synced: "Synced",
  deleted: "Deleted from EC2",
};

function ProgressBar({ progress }: { progress: number }) {
  const width = `${Math.round(Math.max(progress, 0.08) * 100)}%`;
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
      <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width }} />
    </div>
  );
}

export function VideosScreen() {
  const videos = useLiveQuery(() => db.videos.toArray());
  const { uploads, syncs } = useTransfers();
  const [notes, setNotes] = useState("");
  const [storage, setStorage] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playError, setPlayError] = useState("");

  function record(file: File) {
    const note = notes.trim();
    setNotes("");
    setCameraOpen(false);
    startUpload(file, note);
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

  const sorted = [...(videos ?? [])].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const onDrive = sorted.filter((video) => video.status === "synced" || video.status === "deleted");

  return (
    <>
      <PageHeader title="Physique" />
      <main className="flex min-w-0 flex-col gap-4 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <p className="text-sm leading-relaxed text-muted-foreground">One video of your whole physique after a workout.</p>
        <Input aria-label="Notes" placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <Button type="button" onClick={() => setCameraOpen(true)}>
          Record physique
        </Button>
        {uploads.map((upload) => (
          <div key={upload.id} className="rounded-2xl border border-border bg-card px-4 py-3">
            <p className="text-sm font-medium">{upload.error ?? "Uploading to EC2"}</p>
            <ProgressBar progress={upload.progress} />
            {upload.error ? (
              <Button type="button" variant="ghost" className="mt-2 h-11 px-0" onClick={() => dismissUpload(upload.id)}>
                Dismiss
              </Button>
            ) : null}
          </div>
        ))}
        <button type="button" className="text-left text-sm text-muted-foreground" onClick={() => void loadStorage()}>
          {storage || "Check EC2 storage"}
        </button>
        {videos === undefined ? (
          <ListSkeleton />
        ) : videos.length === 0 && uploads.length === 0 ? (
          <EmptyState
            icon={Video}
            title="No physique updates"
            body="Record one after you train. It uploads to EC2 in the background, then you can sync it to Drive."
            action={
              <Button type="button" onClick={() => setCameraOpen(true)}>
                Record physique
              </Button>
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {sorted.map((video) => {
              const sync = syncs.find((item) => item.id === video.id);
              return (
                <li key={video.id} className="border-b border-border px-4 py-3 last:border-b-0">
                  <p className="font-medium">{sessionDateLabel(video.uploadedAt)}</p>
                  {video.notes ? <p className="mt-1 text-sm leading-relaxed">{video.notes}</p> : null}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {STATUS_LABEL[video.status]} · {sizeLabel(video.sizeBytes)}
                  </p>
                  {sync ? (
                    <>
                      <p className="mt-3 text-sm">{sync.error ?? "Syncing to Drive"}</p>
                      <ProgressBar progress={sync.progress} />
                      {sync.error ? (
                        <Button type="button" variant="ghost" className="mt-2 h-11 px-0" onClick={() => dismissSync(video.id)}>
                          Dismiss
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  {video.status === "on-ec2" && !sync ? (
                    <Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => startDriveSync(video.id)}>
                      Sync
                    </Button>
                  ) : null}
                  {video.status === "synced" && !sync ? (
                    <Button type="button" variant="secondary" className="mt-3 w-full" disabled={pendingId === video.id} onClick={() => void removeOne(video.id)}>
                      {pendingId === video.id ? "Deleting…" : "Delete from EC2"}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Gallery</h2>
          {onDrive.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">Synced videos play from Drive.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {onDrive.map((video) => (
                <li key={video.id}>
                  <button type="button" className="w-full overflow-hidden rounded-2xl border border-border bg-card text-left" onClick={() => { setPlayError(""); setPlayingId(video.id); }}>
                    <img src="/atmosphere/empty-mark.jpg" alt="" className="aspect-[3/4] w-full object-cover" />
                    <span className="block px-3 py-2 text-sm font-medium">{sessionDateLabel(video.uploadedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      {cameraOpen ? <CameraSheet onClose={() => setCameraOpen(false)} onRecorded={record} /> : null}
      {playingId ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex justify-end px-4 py-3">
            <Button type="button" variant="ghost" className="text-white" onClick={() => setPlayingId(null)}>
              Close
            </Button>
          </div>
          {playError ? <p className="px-4 text-sm text-white">{playError}</p> : null}
          <video
            key={playingId}
            className="min-h-0 w-full flex-1 bg-black"
            controls
            playsInline
            src={`/api/videos/${playingId}/stream`}
            onError={() => setPlayError("Drive could not play this video.")}
          />
        </div>
      ) : null}
    </>
  );
}

function CameraSheet({ onClose, onRecorded }: { onClose: () => void; onRecorded: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const saveOnStopRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState("");

  async function attach(next: "environment" | "user") {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const constraints = { video: { facingMode: { exact: next } }, audio: true };
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: true });
    }
    streamRef.current = stream;
    setFacing(next);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function open() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot open the camera.");
        return;
      }
      try {
        await attach("environment");
        if (cancelled) streamRef.current?.getTracks().forEach((track) => track.stop());
      } catch {
        if (!cancelled) setError("Allow the camera for a physique update.");
      }
    }
    void open();
    return () => {
      cancelled = true;
      saveOnStopRef.current = false;
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function flip() {
    if (recording) return;
    setError("");
    try {
      await attach(facing === "environment" ? "user" : "environment");
    } catch {
      setError("That camera is not available.");
    }
  }

  async function toggle() {
    const stream = streamRef.current;
    if (!stream) return;
    if (recording && recorderRef.current) {
      saveOnStopRef.current = true;
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
      if (!saveOnStopRef.current) return;
      saveOnStopRef.current = false;
      const type = (recorder.mimeType || "video/webm").split(";")[0] || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes("mp4") ? "mp4" : "webm";
      stopTracks();
      onRecorded(new File([blob], `physique.${ext}`, { type }));
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium">{recording ? "Recording" : facing === "user" ? "Front camera" : "Back camera"}</p>
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      <video
        ref={videoRef}
        className={`min-h-0 w-full flex-1 bg-black object-contain ${facing === "user" ? "-scale-x-100" : ""}`}
        playsInline
        muted
      />
      <div className="px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {error ? <p className="mb-3 text-sm text-muted-foreground">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" disabled={Boolean(error) || recording} onClick={() => void flip()}>
            Flip
          </Button>
          <Button type="button" className="flex-[2]" disabled={Boolean(error)} onClick={() => void toggle()}>
            {recording ? "Stop" : "Record"}
          </Button>
        </div>
      </div>
    </div>
  );
}
