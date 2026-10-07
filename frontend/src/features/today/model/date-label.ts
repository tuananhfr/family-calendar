import { dayOfWeek, parseLocalDate, type LocalDate } from "@/core/time/local-date";
import { t } from "@/i18n/vi";

const WEEKDAY_KEYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

function weekdayWord(date: LocalDate): string {
  return t(`today.weekdays.${WEEKDAY_KEYS[dayOfWeek(date)]}`);
}

/** "Thứ Ba, 6 tháng 10, 2026" (IMG-A greeting). */
export function longDateVi(date: LocalDate): string {
  const { year, month, day } = parseLocalDate(date);
  return t("today.longDate", { weekday: weekdayWord(date), day, month, year });
}

/** "Thứ Ba, 6/10/2026" (IMG-A board header). */
export function boardDateVi(date: LocalDate): string {
  const { year, month, day } = parseLocalDate(date);
  return `${weekdayWord(date)}, ${day}/${month}/${year}`;
}
