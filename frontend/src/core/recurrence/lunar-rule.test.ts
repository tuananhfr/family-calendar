import { describe, expect, it } from "vitest";
import { addDays } from "../time/local-date";
import { lunarMonthLength, lunarToSolar, solarToLunar } from "../lunar/lunar";
import { withProcessTimeZone } from "../test-support/process-tz";
import { expandOccurrences } from "./expand";
import type { Schedule } from "./types";

const VN = "Asia/Ho_Chi_Minh";

function lunarYearWindow(year: number) {
  const from = lunarToSolar({ day: 1, month: 1, year, leap: false })!;
  const nextTet = lunarToSolar({ day: 1, month: 1, year: year + 1, leap: false })!;
  return { from, to: addDays(nextTet, -1) };
}

describe("lunar recurrence", () => {
  it("yearly 10/3 ignores the leap 2nd month of 2023 and lands on 2023-04-29", () => {
    const schedule: Schedule = {
      allDay: true,
      start: "2020-01-01",
      timeZone: VN,
      lunarRule: { freq: "YEARLY", day: 10, month: 3, includeLeap: false },
    };
    expect(expandOccurrences("gio", schedule, { from: "2023-01-01", to: "2023-12-31" }).map((o) => o.start)).toEqual([
      "2023-04-29",
    ]);
    const in2026 = expandOccurrences("gio", schedule, { from: "2026-01-01", to: "2026-12-31" });
    expect(in2026.map((o) => o.start)).toEqual([lunarToSolar({ day: 10, month: 3, year: 2026, leap: false })]);
    expect(in2026[0].occurrenceKey).toBe(`gio@${in2026[0].start}`);
  });

  it("day 30 in a 29-day month falls back to day 29 and is flagged", () => {
    let shortMonth = 0;
    for (let m = 1; m <= 12 && !shortMonth; m++) if (lunarMonthLength(2026, m, false) === 29) shortMonth = m;
    expect(shortMonth).toBeGreaterThan(0);
    const schedule: Schedule = {
      allDay: true,
      start: "2026-01-01",
      timeZone: VN,
      lunarRule: { freq: "YEARLY", day: 30, month: shortMonth, includeLeap: false },
    };
    const occ = expandOccurrences("x", schedule, { from: "2026-01-01", to: "2026-12-31" });
    const window = lunarYearWindow(2026);
    const inYear = occ.filter((o) => o.start >= window.from && o.start <= window.to);
    expect(inYear).toHaveLength(1);
    expect(solarToLunar(inYear[0].start)).toEqual({ day: 29, month: shortMonth, year: 2026, leap: false });
    expect(inYear[0].lunarShortMonth).toBe(true);
  });

  it("monthly rằm gives 12 occurrences in lunar year 2026", () => {
    const schedule: Schedule = {
      allDay: true,
      start: "2020-01-01",
      timeZone: VN,
      lunarRule: { freq: "MONTHLY", day: 15, includeLeap: true },
    };
    const occ = expandOccurrences("ram", schedule, lunarYearWindow(2026));
    expect(occ).toHaveLength(12);
    expect(occ.every((o) => solarToLunar(o.start).day === 15)).toBe(true);
  });

  it("monthly rằm in lunar year 2025 (leap 6th month) gives 13 with includeLeap, 12 without", () => {
    const base: Schedule = { allDay: true, start: "2020-01-01", timeZone: VN };
    const withLeap = expandOccurrences(
      "ram",
      { ...base, lunarRule: { freq: "MONTHLY", day: 15, includeLeap: true } },
      lunarYearWindow(2025),
    );
    const withoutLeap = expandOccurrences(
      "ram",
      { ...base, lunarRule: { freq: "MONTHLY", day: 15, includeLeap: false } },
      lunarYearWindow(2025),
    );
    expect(withLeap).toHaveLength(13);
    expect(withoutLeap).toHaveLength(12);
    expect(withLeap.filter((o) => solarToLunar(o.start).leap)).toHaveLength(1);
  });

  it("keeps the time of day for a timed lunar rule and respects the series start and until", () => {
    const schedule: Schedule = {
      allDay: false,
      start: "2026-03-01T19:30",
      end: "2026-03-01T20:00",
      timeZone: VN,
      lunarRule: { freq: "MONTHLY", day: 1, includeLeap: false, until: "2026-06-30" },
    };
    const occ = expandOccurrences("cung", schedule, { from: "2026-01-01", to: "2026-12-31" });
    expect(occ.length).toBeGreaterThan(0);
    for (const o of occ) {
      expect(o.start >= "2026-03-01").toBe(true);
      expect(o.start <= "2026-06-30T23:59").toBe(true);
      expect(o.start.slice(11)).toBe("19:30");
      expect(o.end?.slice(11)).toBe("20:00");
      expect(solarToLunar(o.start.slice(0, 10)).day).toBe(1);
    }
  });

  it("does not depend on the machine zone", () => {
    withProcessTimeZone("America/Los_Angeles", () => {
      const schedule: Schedule = {
        allDay: true,
        start: "2020-01-01",
        timeZone: VN,
        lunarRule: { freq: "YEARLY", day: 10, month: 3, includeLeap: false },
      };
      expect(expandOccurrences("gio", schedule, { from: "2023-01-01", to: "2023-12-31" }).map((o) => o.start)).toEqual([
        "2023-04-29",
      ]);
    });
  });
});
