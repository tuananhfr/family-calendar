// Order matters: Chrome/Android/Firefox take webm/opus, Safari only records mp4 (AAC).
export const RECORDER_MIMES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"] as const;
export const MAX_RECORDING_MS = 60_000;
export const MAX_RECORDING_BYTES = 2 * 1024 * 1024;
const CHUNK_MS = 1000;

export function pickRecorderMime(isTypeSupported: (mime: string) => boolean): string | null {
  for (const mime of RECORDER_MIMES) {
    try {
      if (isTypeSupported(mime)) return mime;
    } catch {
      // Some WebViews throw instead of returning false.
    }
  }
  return null;
}

export interface RecorderLike {
  state: string;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
  start(timesliceMs?: number): void;
  stop(): void;
}

export interface VoiceRecorderDeps {
  getUserMedia(): Promise<MediaStream>;
  createRecorder(stream: MediaStream, options: { mimeType: string }): RecorderLike;
  isTypeSupported(mime: string): boolean;
  clock?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface Recording {
  blob: Blob;
  mime: string;
  durationMs: number;
  size: number;
}

export type AutoStopReason = "MAX_DURATION" | "MAX_SIZE" | "ERROR";
export type RecorderErrorCode = "PERMISSION_DENIED" | "UNSUPPORTED" | "NO_MICROPHONE" | "BUSY";

export class RecorderError extends Error {
  constructor(readonly code: RecorderErrorCode, message?: string) {
    super(message ?? code);
    this.name = "RecorderError";
  }
}

export type VoiceRecorderState = "idle" | "starting" | "recording" | "stopping";

export interface VoiceRecorder {
  start(): Promise<void>;
  /** Resolves with the audio, or null when nothing was recorded. */
  stop(): Promise<Recording | null>;
  cancel(): void;
  state(): VoiceRecorderState;
  /** Called when recording ends without the user pressing stop; `recording` is null on ERROR. */
  onAutoStop(cb: (e: { reason: AutoStopReason; recording: Recording | null }) => void): void;
}

function errorCode(error: unknown): RecorderErrorCode {
  const name = (error as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "PERMISSION_DENIED";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "NO_MICROPHONE";
  if (name === "NotReadableError") return "BUSY";
  return "UNSUPPORTED";
}

/** Voice note recorder (≤ 60 s, ≤ 2 MB). The microphone is released on every exit path. */
export function createVoiceRecorder(deps: VoiceRecorderDeps): VoiceRecorder {
  const clock = deps.clock ?? (() => Date.now());
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let state: VoiceRecorderState = "idle";
  let stream: MediaStream | null = null;
  let recorder: RecorderLike | null = null;
  let chunks: Blob[] = [];
  let bytes = 0;
  let startedAt = 0;
  let mime = "";
  let timer: unknown = null;
  let pendingStop: ((r: Recording | null) => void) | null = null;
  let autoStopCb: ((e: { reason: AutoStopReason; recording: Recording | null }) => void) | null = null;

  const release = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };

  const reset = () => {
    release();
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
    }
    recorder = null;
    chunks = [];
    bytes = 0;
    state = "idle";
  };

  const collect = (): Recording | null => {
    if (bytes === 0) return null;
    const blob = new Blob(chunks, { type: mime });
    return { blob, mime, durationMs: Math.min(clock() - startedAt, MAX_RECORDING_MS), size: blob.size };
  };

  const finish = (): Promise<Recording | null> => {
    const rec = recorder;
    if (!rec || state !== "recording") return Promise.resolve(null);
    state = "stopping";
    return new Promise((resolve) => {
      pendingStop = resolve;
      rec.onstop = () => {
        const result = collect();
        reset();
        pendingStop = null;
        resolve(result);
      };
      if (rec.state === "inactive") rec.onstop();
      else rec.stop();
    });
  };

  const autoStop = (reason: Exclude<AutoStopReason, "ERROR">) => {
    void finish().then((recording) => autoStopCb?.({ reason, recording }));
  };

  return {
    async start() {
      if (state !== "idle") throw new RecorderError("BUSY");
      const picked = pickRecorderMime(deps.isTypeSupported);
      if (!picked) throw new RecorderError("UNSUPPORTED");
      state = "starting";
      try {
        stream = await deps.getUserMedia();
      } catch (error) {
        reset();
        throw new RecorderError(errorCode(error));
      }
      try {
        mime = picked;
        recorder = deps.createRecorder(stream, { mimeType: picked });
      } catch {
        reset();
        throw new RecorderError("UNSUPPORTED");
      }
      recorder.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        chunks.push(e.data);
        bytes += e.data.size;
        if (bytes > MAX_RECORDING_BYTES && state === "recording") autoStop("MAX_SIZE");
      };
      recorder.onerror = () => {
        const resolve = pendingStop;
        pendingStop = null;
        reset();
        resolve?.(null);
        autoStopCb?.({ reason: "ERROR", recording: null });
      };
      startedAt = clock();
      recorder.start(CHUNK_MS);
      state = "recording";
      timer = setTimer(() => {
        if (state === "recording") autoStop("MAX_DURATION");
      }, MAX_RECORDING_MS);
    },
    stop: finish,
    cancel() {
      const rec = recorder;
      const resolve = pendingStop;
      pendingStop = null;
      reset();
      try {
        if (rec && rec.state !== "inactive") rec.stop();
      } catch {
        // Already stopped by the browser.
      }
      resolve?.(null);
    },
    state: () => state,
    onAutoStop(cb) {
      autoStopCb = cb;
    },
  };
}
