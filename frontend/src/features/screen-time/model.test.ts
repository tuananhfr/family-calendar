import { describe, expect, it } from "vitest";
import {
  durationLabel,
  screenRange,
  screenStats,
  type UsageDay,
} from "./model";

const day = (
  date: string,
  seconds: number | null,
  coverage: UsageDay["coverage"] = "COMPLETE",
): UsageDay => ({
  date,
  total_seconds: seconds,
  coverage,
  apps: [],
  updated_at: null,
  device_count: seconds === null ? 0 : 1,
});

describe("screen-time reports", () => {
  it("does not display missing data as zero", () => {
    expect(durationLabel(null)).toBe("Chưa có dữ liệu");
    expect(durationLabel(0)).toBe("0 phút");
    expect(durationLabel(30)).toBe("Dưới 1 phút");
  });
  it("formats durations without rounding beyond observed usage", () => {
    expect(durationLabel(8099)).toBe("2 giờ 14 phút");
  });
  it("excludes missing days from the average", () => {
    expect(
      screenStats([
        day("2026-11-01", 3600),
        day("2026-11-02", null, "UNKNOWN"),
      ]),
    ).toMatchObject({ average: 3600, total: 3600, observedDays: 1 });
  });
  it("preserves a real observed zero and flags partial data", () => {
    expect(screenStats([day("2026-11-01", 0, "PARTIAL")])).toMatchObject({
      average: 0,
      total: 0,
      partial: true,
    });
    expect(screenStats([day("2026-11-01", null, "UNKNOWN")])).toMatchObject({
      total: null,
      average: null,
    });
  });
  it("handles month and year boundaries in a seven-day window", () => {
    expect(screenRange("2027-01-02", 7)).toEqual({
      from: "2026-12-27",
      to: "2027-01-02",
    });
    expect(screenRange("2026-11-03", 1)).toEqual({
      from: "2026-11-03",
      to: "2026-11-03",
    });
  });
});
