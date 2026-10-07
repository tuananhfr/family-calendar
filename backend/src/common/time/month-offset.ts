// Deliberate copy of frontend/src/core/time/month-offset.ts (ARC-02); change both sides together.
import { daysInMonth, formatLocalDate, parseLocalDate, type LocalDate } from './local-date';

/**
 * Calendar-month shift for reminder offsets ("6 tháng trước"), clamped to the last day of the target month.
 * Deliberately differs from RRULE, which skips nonexistent dates (reminders.md).
 */
export function addMonthsClamped(d: LocalDate, months: number): LocalDate {
  const { year, month, day } = parseLocalDate(d);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
  return formatLocalDate(y, m, Math.min(day, daysInMonth(y, m)));
}
