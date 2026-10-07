"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AudioLines, Mic, RotateCcw, Square, Trash2, X } from "lucide-react";
import { db } from "@/core/db/db";
import { markBusy } from "@/core/platform/busy-guard";
import { createVoiceRecorder, MAX_RECORDING_MS, RecorderError, type RecorderLike, type VoiceRecorder } from "@/core/platform/media-recorder";
import { cn } from "@/design/cn";
import { Button } from "@/design/components";
import { useBlobUrl } from "@/features/members";
import { t } from "@/i18n/vi";
import { discardVoiceNote, saveVoiceNote } from "../model/voice-note";

type ErrorKey = "PERMISSION_DENIED" | "NO_MICROPHONE" | "UNSUPPORTED" | "BUSY" | "ERROR" | "STORAGE" | "EMPTY";

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function browserRecorder(): VoiceRecorder {
  return createVoiceRecorder({
    getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    createRecorder: (stream, options) => new MediaRecorder(stream, options) as unknown as RecorderLike,
    // Throws (caught by pickRecorderMime) where MediaRecorder does not exist.
    isTypeSupported: (mime) => MediaRecorder.isTypeSupported(mime),
  });
}

/** Plays a stored voice note; says so when the blob is gone instead of showing a dead player. */
export function VoiceNotePlayer({ blobId, className }: { blobId: string; className?: string }) {
  const row = useLiveQuery(() => db.blobs.get(blobId).then((r) => r ?? null), [blobId]);
  const url = useBlobUrl(blobId);
  if (row === null) return <p className={cn("text-sm text-muted", className)}>{t("audio.missing")}</p>;
  if (!url) return null;
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      <audio controls src={url} aria-label={t("audio.player")} className="h-10 min-w-0 max-w-full flex-1" />
      {row?.durationMs ? <span className="text-sm text-muted tabular-nums">{formatClock(row.durationMs)}</span> : null}
    </div>
  );
}

/**
 * Voice note for a reminder (≤ 60 s, ≤ 2 MB), stored on this device only. Idle it is one button in the form's
 * action row; recording or holding a note it takes a full row at the end of that row.
 */
export function AudioRecorder({ value, onChange }: { value?: string; onChange: (blobId: string | undefined) => void }) {
  const recorder = useRef<VoiceRecorder | null>(null);
  const release = useRef<(() => void) | null>(null);
  const [phase, setPhase] = useState<"idle" | "starting" | "recording" | "saving">("idle");
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  // Leaving the form mid-recording must still free the microphone.
  useEffect(
    () => () => {
      recorder.current?.cancel();
      release.current?.();
    },
    [],
  );

  const finishBusy = () => {
    release.current?.();
    release.current = null;
  };

  const keep = async (rec: Awaited<ReturnType<VoiceRecorder["stop"]>>) => {
    finishBusy();
    if (!rec) {
      setPhase("idle");
      setError("EMPTY");
      return;
    }
    setPhase("saving");
    try {
      const id = await saveVoiceNote(rec);
      const previous = valueRef.current;
      onChange(id);
      // A note saved on the item stays until the item stops pointing at it; discard only refuses then.
      if (previous) void discardVoiceNote(previous);
    } catch {
      setError("STORAGE");
    } finally {
      setPhase("idle");
    }
  };

  const start = async () => {
    setError(null);
    setNotice(null);
    const rec = browserRecorder();
    recorder.current = rec;
    rec.onAutoStop(({ reason, recording }) => {
      if (reason === "ERROR") {
        finishBusy();
        setPhase("idle");
        setError("ERROR");
        return;
      }
      setNotice(reason === "MAX_DURATION" ? t("audio.autoStopDuration", { s: MAX_RECORDING_MS / 1000 }) : t("audio.autoStopSize"));
      void keep(recording);
    });
    setPhase("starting");
    try {
      await rec.start();
      release.current = markBusy("recording");
      setStartedAt(Date.now());
      setElapsed(0);
      setPhase("recording");
    } catch (e) {
      setPhase("idle");
      setError(e instanceof RecorderError ? e.code : "UNSUPPORTED");
    }
  };

  const stop = async () => {
    const rec = recorder.current;
    if (!rec) return;
    await keep(await rec.stop());
  };

  const cancel = () => {
    recorder.current?.cancel();
    finishBusy();
    setPhase("idle");
  };

  const remove = () => {
    const previous = value;
    onChange(undefined);
    if (previous) void discardVoiceNote(previous);
  };

  const feedback = error ? (
    <p role="alert" className="basis-full text-sm text-danger">
      {t(`audio.errors.${error}`)}
    </p>
  ) : notice ? (
    <p role="status" className="basis-full text-sm text-muted">
      {notice}
    </p>
  ) : null;

  if (phase === "recording" || phase === "saving") {
    return (
      <div className="order-last flex basis-full flex-wrap items-center gap-3 rounded-control border border-danger/40 bg-danger-soft px-3 py-2">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-danger" role="status" aria-live="polite">
          <span aria-hidden className="size-2.5 shrink-0 animate-pulse rounded-full bg-danger motion-reduce:animate-none" />
          {t("audio.recording")}
          <span className="tabular-nums">
            {formatClock(elapsed)} / {formatClock(MAX_RECORDING_MS)}
          </span>
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" icon={<X className="size-4" />} onClick={cancel} disabled={phase === "saving"}>
            {t("audio.cancel")}
          </Button>
          <Button variant="secondary" size="sm" icon={<Square className="size-4" />} onClick={() => void stop()} loading={phase === "saving"}>
            {t("audio.stop")}
          </Button>
        </div>
      </div>
    );
  }

  if (value) {
    return (
      <div className="order-last flex basis-full flex-col gap-2 rounded-control border border-border bg-surface-2 p-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-text">
          <AudioLines aria-hidden className="size-4 text-primary" />
          {t("audio.label")}
        </span>
        <VoiceNotePlayer blobId={value} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => void start()} loading={phase === "starting"}>
            {t("audio.rerecord")}
          </Button>
          <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={remove}>
            {t("audio.remove")}
          </Button>
        </div>
        {feedback}
      </div>
    );
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon={<Mic className="size-4" />} onClick={() => void start()} loading={phase === "starting"} aria-describedby="audio-limit">
        {t("audio.start")}
      </Button>
      <span id="audio-limit" className="sr-only">
        {t("audio.limit", { s: MAX_RECORDING_MS / 1000 })}
      </span>
      {feedback ? <div className="order-last basis-full">{feedback}</div> : null}
    </>
  );
}
