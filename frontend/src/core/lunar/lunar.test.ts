import { describe, expect, it } from "vitest";
import fixtures from "./lunar.fixtures.json";
import { addDays } from "../time/local-date";
import { withProcessTimeZone } from "../test-support/process-tz";
import { canChiYear, formatLunar, lunarMonthLength, lunarToSolar, solarToLunar } from "./lunar";

describe("lunar (Hồ Ngọc Đức, UTC+7)", () => {
  it.each(fixtures.tet)("%s is mùng 1 Tết", (solar) => {
    const l = solarToLunar(solar);
    expect({ day: l.day, month: l.month, leap: l.leap }).toEqual({ day: 1, month: 1, leap: false });
    expect(l.year).toBe(Number(solar.slice(0, 4)));
    expect(lunarToSolar(l)).toBe(solar);
  });

  it.each(fixtures.notTetInVietnam)("%s (Chinese New Year) is not Tết in Vietnam", (solar) => {
    const l = solarToLunar(solar);
    expect(l.day === 1 && l.month === 1).toBe(false);
  });

  it.each(fixtures.solarToLunar)("$solar → lunar", ({ solar, lunar }) => {
    expect(solarToLunar(solar)).toEqual(lunar);
    expect(lunarToSolar(lunar)).toBe(solar);
  });

  it.each(fixtures.leapMonths)("leap month $month exists in $year", ({ year, month }) => {
    const solar = lunarToSolar({ day: 1, month, year, leap: true });
    expect(solar).not.toBeNull();
    expect(solarToLunar(solar!)).toEqual({ day: 1, month, year, leap: true });
    expect(lunarMonthLength(year, month, true)).toBeGreaterThanOrEqual(29);
  });

  it.each(fixtures.missingLeapMonths)("leap month $month does not exist in $year", ({ year, month }) => {
    expect(lunarToSolar({ day: 1, month, year, leap: true })).toBeNull();
    expect(lunarMonthLength(year, month, true)).toBe(0);
  });

  it("rejects days beyond the month length", () => {
    for (let month = 1; month <= 12; month++) {
      const len = lunarMonthLength(2026, month, false);
      expect([29, 30]).toContain(len);
      expect(lunarToSolar({ day: len, month, year: 2026, leap: false })).not.toBeNull();
      expect(lunarToSolar({ day: len + 1, month, year: 2026, leap: false })).toBeNull();
    }
    expect(lunarToSolar({ day: 0, month: 1, year: 2026, leap: false })).toBeNull();
    expect(lunarToSolar({ day: 1, month: 13, year: 2026, leap: false })).toBeNull();
  });

  it.each(fixtures.canChi)("canChiYear($year) = $name", ({ year, name }) => {
    expect(canChiYear(year)).toBe(name);
  });

  it("formats lunar dates", () => {
    expect(formatLunar({ day: 26, month: 8, year: 2026, leap: false })).toBe("26 tháng 8 (Âm lịch)");
    expect(formatLunar({ day: 1, month: 4, year: 2020, leap: true })).toBe("1 tháng 4 nhuận (Âm lịch)");
  });

  it("does not depend on the machine time zone", () => {
    for (const tz of ["America/Los_Angeles", "Pacific/Kiritimati"]) {
      withProcessTimeZone(tz, () => {
        expect(solarToLunar("2026-10-06")).toEqual({ day: 26, month: 8, year: 2026, leap: false });
        expect(lunarToSolar({ day: 1, month: 1, year: 1985, leap: false })).toBe("1985-01-21");
      });
    }
  });

  it("round-trips every day from 1900-01-31 to 2100-12-31", { timeout: 120_000 }, () => {
    let d = "1900-01-31";
    let prev = solarToLunar(d);
    let checked = 0;
    while (d <= "2100-12-31") {
      const l = solarToLunar(d);
      if (lunarToSolar(l) !== d) throw new Error(`round trip failed at ${d}: ${JSON.stringify(l)}`);
      // Consecutive days either advance the lunar day by one or start a new month at day 1.
      if (checked > 0 && !(l.day === prev.day + 1 || (l.day === 1 && prev.day >= 29))) {
        throw new Error(`lunar day jump at ${d}: ${prev.day} -> ${l.day}`);
      }
      if (l.day === 1 && checked > 0 && lunarMonthLength(prev.year, prev.month, prev.leap) !== prev.day) {
        throw new Error(`month length mismatch before ${d}`);
      }
      prev = l;
      d = addDays(d, 1);
      checked++;
    }
    expect(checked).toBe(73_384);
  });
});
