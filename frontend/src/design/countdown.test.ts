import { describe, expect, it } from "vitest";
import { countdownLabel, daysBetween } from "./countdown";

describe("daysBetween", () => {
  it("counts calendar days between local dates", () => {
    expect(daysBetween("2026-10-06", "2026-10-20")).toBe(14);
    expect(daysBetween("2026-10-06", "2026-10-06")).toBe(0);
    expect(daysBetween("2026-10-06", "2026-10-05")).toBe(-1);
  });

  it("is not shifted by a DST change", () => {
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });
});

describe("countdownLabel", () => {
  it("uses today / tomorrow / days-left wording", () => {
    expect(countdownLabel(0)).toBe("Hôm nay");
    expect(countdownLabel(1)).toBe("Ngày mai");
    expect(countdownLabel(14)).toBe("Còn 14 ngày");
  });
});
