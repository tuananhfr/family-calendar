import { describe, expect, it } from "vitest";
import { monthMatrix, monthTitle, shiftMonth } from "./month-matrix";

describe("monthMatrix", () => {
  it("October 2026, Monday first: 6 rows starting 2026-09-28 with lunar dates", () => {
    const m = monthMatrix(2026, 10, 1);
    expect(m).toHaveLength(6);
    for (const row of m) expect(row).toHaveLength(7);
    expect(m[0][0]).toMatchObject({ date: "2026-09-28", inMonth: false });
    expect(m[0][3]).toMatchObject({ date: "2026-10-01", inMonth: true });
    expect(m[5][6]).toMatchObject({ date: "2026-11-08", inMonth: false });
    const oct6 = m.flat().find((c) => c.date === "2026-10-06")!;
    expect(oct6.lunar).toEqual({ day: 26, month: 8, year: 2026, leap: false });
    for (const c of m.flat()) expect(c.lunar.day).toBeGreaterThan(0);
  });

  it("Sunday first starts on 2026-09-27", () => {
    expect(monthMatrix(2026, 10, 0)[0][0].date).toBe("2026-09-27");
  });

  it("a month starting on the first weekday has no leading days", () => {
    // 2026-06-01 is a Monday.
    expect(monthMatrix(2026, 6, 1)[0][0]).toMatchObject({ date: "2026-06-01", inMonth: true });
  });

  it("marks lunar day 1 and 15 so the grid can bold them", () => {
    const cells = monthMatrix(2026, 10, 1).flat();
    expect(cells.filter((c) => c.lunarHighlight).map((c) => c.lunar.day)).toEqual(expect.arrayContaining([1, 15]));
    for (const c of cells) expect(c.lunarHighlight).toBe(c.lunar.day === 1 || c.lunar.day === 15);
  });

  it("rejects an invalid month", () => {
    expect(() => monthMatrix(2026, 13, 1)).toThrow(RangeError);
  });
});

describe("month helpers", () => {
  it("monthTitle", () => {
    expect(monthTitle(2026, 10)).toBe("Tháng 10, 2026");
  });

  it("shiftMonth across years", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});
