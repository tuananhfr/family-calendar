import { describe, expect, it, vi } from "vitest";
import { MAX_RECORDING_BYTES, MAX_RECORDING_MS, RECORDER_MIMES, createVoiceRecorder, pickRecorderMime, type RecorderLike } from "./media-recorder";

describe("pickRecorderMime", () => {
  it("prefers webm/opus, then mp4, then ogg", () => {
    expect(pickRecorderMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickRecorderMime((m) => m !== "audio/webm;codecs=opus")).toBe("audio/mp4");
    expect(pickRecorderMime((m) => m === "audio/ogg")).toBe("audio/ogg");
    expect(pickRecorderMime(() => false)).toBeNull();
    expect(RECORDER_MIMES).toEqual(["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"]);
  });

  it("a throwing support check counts as unsupported", () => {
    expect(
      pickRecorderMime((m) => {
        if (m === "audio/webm;codecs=opus") throw new Error("boom");
        return true;
      }),
    ).toBe("audio/mp4");
  });

  it("limits are 60 seconds and 2 MB", () => {
    expect(MAX_RECORDING_MS).toBe(60_000);
    expect(MAX_RECORDING_BYTES).toBe(2 * 1024 * 1024);
  });
});

class FakeRecorder implements RecorderLike {
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor(
    readonly stream: MediaStream,
    readonly options: { mimeType: string },
  ) {}
  start() {
    this.state = "recording";
  }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.onstop?.();
  }
  emit(bytes: number) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)], { type: this.options.mimeType }) });
  }
}

function setup(opts: { deny?: boolean } = {}) {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  let recorder!: FakeRecorder;
  let now = 0;
  const timers: Array<() => void> = [];
  const voice = createVoiceRecorder({
    getUserMedia: async () => {
      if (opts.deny) throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
      return stream;
    },
    createRecorder: (s, o) => (recorder = new FakeRecorder(s, o)),
    isTypeSupported: (m) => m === "audio/mp4",
    clock: () => now,
    setTimer: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimer: () => {},
  });
  return { voice, track, rec: () => recorder, advance: (ms: number) => (now += ms), fireTimers: () => timers.forEach((t) => t()) };
}

describe("createVoiceRecorder", () => {
  it("records, stops and releases the microphone", async () => {
    const s = setup();
    await s.voice.start();
    s.rec().emit(1000);
    s.advance(3200);
    const result = await s.voice.stop();
    expect(result).toMatchObject({ mime: "audio/mp4", durationMs: 3200, size: 1000 });
    expect(result?.blob.type).toBe("audio/mp4");
    expect(s.track.stop).toHaveBeenCalled();
  });

  it("cancel discards the audio and releases the microphone", async () => {
    const s = setup();
    await s.voice.start();
    s.rec().emit(500);
    s.voice.cancel();
    expect(s.track.stop).toHaveBeenCalled();
    expect(s.voice.state()).toBe("idle");
  });

  it("stops by itself at 60 seconds", async () => {
    const s = setup();
    const done = vi.fn();
    s.voice.onAutoStop(done);
    await s.voice.start();
    s.rec().emit(100);
    s.advance(60_000);
    s.fireTimers();
    await vi.waitFor(() => expect(done).toHaveBeenCalled());
    expect(done.mock.calls[0][0]).toMatchObject({ reason: "MAX_DURATION" });
    expect(s.track.stop).toHaveBeenCalled();
  });

  it("stops when the 2 MB limit is reached", async () => {
    const s = setup();
    const done = vi.fn();
    s.voice.onAutoStop(done);
    await s.voice.start();
    s.rec().emit(MAX_RECORDING_BYTES + 1);
    await vi.waitFor(() => expect(done).toHaveBeenCalled());
    expect(done.mock.calls[0][0]).toMatchObject({ reason: "MAX_SIZE" });
  });

  it("a recorder error releases the microphone and reports it", async () => {
    const s = setup();
    const done = vi.fn();
    s.voice.onAutoStop(done);
    await s.voice.start();
    s.rec().onerror?.(new Error("hw"));
    expect(s.track.stop).toHaveBeenCalled();
    expect(done.mock.calls[0][0]).toMatchObject({ reason: "ERROR" });
  });

  it("permission denied surfaces a stable code", async () => {
    const s = setup({ deny: true });
    await expect(s.voice.start()).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(s.voice.state()).toBe("idle");
  });
});
