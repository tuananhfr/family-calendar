import type { Schedule } from "@/core/recurrence/types";
import { parseLocalDate } from "@/core/time/local-date";
import { datePart, timePart } from "@/core/time/zoned";

function dateLabel(s: Schedule): string {
  if (s.lunarRule) return s.lunarRule.freq === "YEARLY" ? `âm ${s.lunarRule.day}/${s.lunarRule.month}` : `âm ngày ${s.lunarRule.day}`;
  const { day, month, year } = parseLocalDate(datePart(s.start));
  const rule = s.rrule ?? "";
  if (!rule) return `${day}/${month}/${year}`;
  if (/FREQ=YEARLY/.test(rule)) return `${day}/${month}`;
  if (/FREQ=MONTHLY/.test(rule)) return `ngày ${day}`;
  return "";
}

/**
 * "Thời gian" column of /nhac (IMG-D): the time alone when the repeat already says which days ("07:00" + "Hằng ngày"),
 * the date as well when it does not ("Cả ngày 20/10" + "Hằng năm", "09:00 19/10/2026" + "Chỉ một lần").
 */
export function reminderTimeLabel(s: Schedule): string {
  const time = s.allDay ? "Cả ngày" : (timePart(s.start) ?? "");
  return [time, dateLabel(s)].filter(Boolean).join(" ");
}
