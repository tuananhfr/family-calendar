import { describe, expect, it } from "vitest";
import { FOREIGN_TIME_ZONES, withProcessTimeZone } from "@/core/test-support/process-tz";
import { shiftWeek, weekRange, weekRangeLabel } from "./week-range";

describe("weekRange", () => {
  it("Monday-first week containing 2026-10-06", () => {
    const r = weekRange("2026-10-06", 1);
    expect(r.from).toBe("2026-10-05");
    expect(r.to).toBe("2026-10-11");
    expect(r.days).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  });

  it("Sunday-first week containing 2026-10-06", () => {
    expect(weekRange("2026-10-06", 0)).toMatchObject({ from: "2026-10-04", to: "2026-10-10" });
  });

  it("anchor on the first day of the week is its own start", () => {
    expect(weekRange("2026-10-05", 1).from).toBe("2026-10-05");
    expect(weekRange("2026-10-04", 0).from).toBe("2026-10-04");
    expect(weekRange("2026-10-04", 1).from).toBe("2026-09-28");
  });

  it("crosses a year boundary", () => {
    expect(weekRange("2027-01-01", 1)).toMatchObject({ from: "2026-12-28", to: "2027-01-03" });
  });

  it("does not depend on the machine time zone", () => {
    for (const tz of FOREIGN_TIME_ZONES) {
      expect(withProcessTimeZone(tz, () => weekRange("2026-10-06", 1).from)).toBe("2026-10-05");
    }
  });
});

describe("shiftWeek", () => {
  it("moves the anchor by whole weeks", () => {
    expect(shiftWeek("2026-10-06", 1)).toBe("2026-10-13");
    expect(shiftWeek("2026-10-06", -1)).toBe("2026-09-29");
  });
});

describe("weekRangeLabel", () => {
  it("same month", () => {
    expect(weekRangeLabel(weekRange("2026-10-06", 1))).toBe("5 – 11/10/2026");
  });

  it("across months", () => {
    expect(weekRangeLabel(weekRange("2026-10-01", 1))).toBe("28/9 – 4/10/2026");
  });

  it("across years", () => {
    expect(weekRangeLabel(weekRange("2027-01-01", 1))).toBe("28/12/2026 – 3/1/2027");
  });
});
