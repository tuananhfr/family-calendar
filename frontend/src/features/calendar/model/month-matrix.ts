import { solarToLunar, type LunarDate } from "@/core/lunar/lunar";
import { addDays, formatLocalDate, startOfWeek, type LocalDate } from "@/core/time/local-date";

export interface MonthCell {
  date: LocalDate;
  inMonth: boolean;
  lunar: LunarDate;
  /** Lunar day 1 (mùng 1) or 15 (rằm), shown bold (modules.md §5). */
  lunarHighlight: boolean;
}

/** Always 6 rows × 7 days so the grid height never jumps between months. */
export function monthMatrix(year: number, month: number, weekStartsOn: 1 | 0): MonthCell[][] {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError(`Invalid month: ${month}`);
  const first = formatLocalDate(year, month, 1);
  const start = startOfWeek(first, weekStartsOn);
  const prefix = first.slice(0, 7);
  return Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => {
      const date = addDays(start, r * 7 + c);
      const lunar = solarToLunar(date);
      return { date, inMonth: date.startsWith(prefix), lunar, lunarHighlight: lunar.day === 1 || lunar.day === 15 };
    }),
  );
}

/** 'Tháng 10, 2026' (toolbar title in IMG-D). */
export function monthTitle(year: number, month: number): string {
  return `Tháng ${month}, ${year}`;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  const y = Math.floor(index / 12);
  return { year: y, month: index - y * 12 + 1 };
}
