import { beforeEach, describe, expect, it, vi } from "vitest";
import { isBusy, markBusy, onBusyChange, resetBusyForTests } from "./busy-guard";

beforeEach(() => resetBusyForTests());

describe("busy guard", () => {
  it("stays busy until both reasons are released", () => {
    expect(isBusy()).toBe(false);
    const releaseForm = markBusy("form");
    const releaseRecording = markBusy("recording");
    expect(isBusy()).toBe(true);
    releaseForm();
    expect(isBusy()).toBe(true);
    releaseRecording();
    expect(isBusy()).toBe(false);
  });

  it("two holders of the same reason are counted separately", () => {
    const a = markBusy("form");
    const b = markBusy("form");
    a();
    expect(isBusy()).toBe(true);
    b();
    expect(isBusy()).toBe(false);
  });

  it("release is idempotent", () => {
    const a = markBusy("sos");
    const b = markBusy("form");
    a();
    a();
    expect(isBusy()).toBe(true);
    b();
    expect(isBusy()).toBe(false);
  });

  it("notifies only when busy flips", () => {
    const listener = vi.fn();
    const off = onBusyChange(listener);
    const a = markBusy("form");
    const b = markBusy("recording");
    a();
    b();
    expect(listener.mock.calls).toEqual([[true], [false]]);
    off();
    markBusy("sos")();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
