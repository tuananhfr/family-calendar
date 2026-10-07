import { afterEach, describe, expect, it, vi } from "vitest";
import { ensurePersistentStorage, estimateStorage } from "./persist";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ensurePersistentStorage", () => {
  it("reports unsupported when the Storage API is missing", async () => {
    vi.stubGlobal("navigator", {});
    expect(await ensurePersistentStorage()).toBe("unsupported");
    expect(await estimateStorage()).toBeNull();
  });

  it("does not ask again when storage is already persisted", async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal("navigator", { storage: { persisted: async () => true, persist } });
    expect(await ensurePersistentStorage()).toBe("granted");
    expect(persist).not.toHaveBeenCalled();
  });

  it("returns the browser decision", async () => {
    vi.stubGlobal("navigator", { storage: { persisted: async () => false, persist: async () => false } });
    expect(await ensurePersistentStorage()).toBe("denied");
    vi.stubGlobal("navigator", { storage: { persisted: async () => false, persist: async () => true } });
    expect(await ensurePersistentStorage()).toBe("granted");
  });

  it("treats a throwing persist() as denied rather than crashing onboarding", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        persisted: async () => false,
        persist: async () => {
          throw new Error("nope");
        },
      },
    });
    expect(await ensurePersistentStorage()).toBe("denied");
  });

  it("estimates free space ratio", async () => {
    vi.stubGlobal("navigator", { storage: { estimate: async () => ({ usage: 95, quota: 100 }) } });
    expect(await estimateStorage()).toEqual({ usage: 95, quota: 100, freeRatio: 0.05 });
  });
});
