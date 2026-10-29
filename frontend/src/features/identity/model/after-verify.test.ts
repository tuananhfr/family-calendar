import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rememberAfterVerify, takeAfterVerify } from "./after-verify";

describe("after-verify return path", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("returns the remembered path once", () => {
    rememberAfterVerify("/thanh-vien/them/?tab=link");
    expect(takeAfterVerify()).toBe("/thanh-vien/them/?tab=link");
    expect(takeAfterVerify()).toBeUndefined();
  });

  it("rejects paths that could leave the app", () => {
    rememberAfterVerify("//evil.example/");
    expect(takeAfterVerify()).toBeUndefined();
    rememberAfterVerify("https://evil.example/");
    expect(takeAfterVerify()).toBeUndefined();
    rememberAfterVerify("/\\evil.example/");
    expect(takeAfterVerify()).toBeUndefined();
  });

  it("ignores stale entries", () => {
    vi.useFakeTimers();
    rememberAfterVerify("/cai-dat/?tab=sharing");
    vi.advanceTimersByTime(31 * 60_000);
    expect(takeAfterVerify()).toBeUndefined();
  });
});
