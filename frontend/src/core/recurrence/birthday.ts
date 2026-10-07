import { daysInMonth, formatLocalDate, type LocalDate } from "../time/local-date";

/** Solar birthday in `year`; 29/02 is celebrated on 28/02 in non-leap years (unlike RRULE, which skips). */
export function nextBirthdayDate(month: number, day: number, year: number): LocalDate {
  return formatLocalDate(year, month, Math.min(day, daysInMonth(year, month)));
}
