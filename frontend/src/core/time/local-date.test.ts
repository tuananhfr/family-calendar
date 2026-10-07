import { describe, expect, it } from "vitest";
import { FOREIGN_TIME_ZONES, withProcessTimeZone } from "../test-support/process-tz";
import {
  addDays,
  compareLocalDate,
  dayOfWeek,
  daysBetween,
  daysInMonth,
  endOfMonth,
  formatLocalDate,
  fromEpochDay,
  isLocalDate,
  parseLocalDate,
  startOfMonth,
  startOfWeek,
  toEpochDay,
} from "./local-date";

function runAll() {
  expect(addDays("2026-10-06", 1)).toBe("2026-10-07");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  // DST transition days in common zones must not shift a pure calendar date.
  expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  expect(addDays("2026-10-06", -365)).toBe("2025-10-06");
  expect(dayOfWeek("2026-10-05")).toBe(1);
  expect(dayOfWeek("2026-10-11")).toBe(0);
  expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
  expect(fromEpochDay(toEpochDay("1900-01-31"))).toBe("1900-01-31");
  expect(toEpochDay("1970-01-01")).toBe(0);
  expect(startOfWeek("2026-10-07")).toBe("2026-10-05");
  expect(startOfWeek("2026-10-11")).toBe("2026-10-05");
  expect(startOfWeek("2026-10-11", 0)).toBe("2026-10-11");
  expect(startOfWeek("2026-10-07", 0)).toBe("2026-10-04");
  expect(startOfMonth("2026-10-07")).toBe("2026-10-01");
  expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
}

describe("local-date", () => {
  it("does calendar arithmetic", () => {
    runAll();
  });

  it("validates and parses YYYY-MM-DD", () => {
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2028-02-29")).toBe(true);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("2026-1-01")).toBe(false);
    expect(isLocalDate("2026-10-06T00:00")).toBe(false);
    expect(parseLocalDate("2026-10-06")).toEqual({ year: 2026, month: 10, day: 6 });
    expect(() => parseLocalDate("06/10/2026")).toThrow();
    expect(formatLocalDate(2026, 1, 5)).toBe("2026-01-05");
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(compareLocalDate("2026-10-06", "2026-10-07")).toBeLessThan(0);
  });

  it.each(FOREIGN_TIME_ZONES)("gives identical results when the machine zone is %s", (tz) => {
    withProcessTimeZone(tz, runAll);
  });
});
