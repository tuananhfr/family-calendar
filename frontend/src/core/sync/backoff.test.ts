import { describe, expect, it } from "vitest";
import { MAX_BACKOFF_MS, nextBackoffMs } from "./backoff";

describe("nextBackoffMs", () => {
  it("doubles from 1 s without jitter at the midpoint", () => {
    expect([0, 1, 2, 3, 8].map((n) => nextBackoffMs(n, () => 0.5))).toEqual([1000, 2000, 4000, 8000, 256000]);
  });

  it("caps at 5 minutes", () => {
    expect(nextBackoffMs(9, () => 0.5)).toBe(MAX_BACKOFF_MS);
    expect(nextBackoffMs(1000, () => 1)).toBe(MAX_BACKOFF_MS);
  });

  it("jitters ±20 %", () => {
    expect(nextBackoffMs(2, () => 0)).toBe(3200);
    expect(nextBackoffMs(2, () => 1)).toBe(4800);
    for (let i = 0; i < 50; i++) {
      const v = nextBackoffMs(4);
      expect(v).toBeGreaterThanOrEqual(12800);
      expect(v).toBeLessThanOrEqual(19200);
    }
  });
});
