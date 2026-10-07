import { countdownLabel } from "@/design/countdown";
import type { Item } from "@/core/model/item";
import { expandOccurrences } from "@/core/recurrence/expand";
import { nextBirthdayDate } from "@/core/recurrence/birthday";
import { lunarRuleDates } from "@/core/recurrence/lunar-rule";
import { addDays, daysBetween, parseLocalDate, type LocalDate } from "@/core/time/local-date";
import { addMonthsClamped } from "@/core/time/month-offset";
import { datePart } from "@/core/time/zoned";

export { countdownLabel } from "@/design/countdown";

export type DocumentOffset = "6M" | "3M" | "30D" | "7D" | "1D" | { days: number };

/** Whole days from `today` to `target` (negative when past). */
export function daysUntil(target: LocalDate, today: LocalDate): number {
  return daysBetween(today, target);
}

/** Reminder dates before a document expiry; month offsets are calendar months clamped to month end. */
export function documentReminderDates(expiry: LocalDate, offsets: DocumentOffset[]): LocalDate[] {
  return offsets.map((o) => {
    if (o === "6M") return addMonthsClamped(expiry, -6);
    if (o === "3M") return addMonthsClamped(expiry, -3);
    if (o === "30D") return addDays(expiry, -30);
    if (o === "7D") return addDays(expiry, -7);
    if (o === "1D") return addDays(expiry, -1);
    if (!Number.isInteger(o.days) || o.days < 0) throw new RangeError(`Invalid offset: ${o.days}`);
    return addDays(expiry, -o.days);
  });
}

export interface SpecialDayCountdown {
  date: LocalDate;
  daysLeft: number;
  label: string;
  /** '(âm 10/3)' for lunar repetitions. */
  lunarNote?: string;
}

const YEARLY_SOLAR = /^FREQ=YEARLY(;BYMONTH=\d+;BYMONTHDAY=\d+)?$/;

function nextDate(item: Item, today: LocalDate): LocalDate | null {
  const s = item.schedule;
  const start = datePart(s.start);
  const from = start > today ? start : today;
  if (s.lunarRule) {
    const until = s.lunarRule.until;
    const to = addDays(from, 800);
    const hit = lunarRuleDates(s.lunarRule, from, until && until < to ? until : to)[0];
    return hit?.date ?? null;
  }
  if (!s.rrule) return start >= today ? start : null;
  if (YEARLY_SOLAR.test(s.rrule.toUpperCase())) {
    // Birthdays on 29/02 are kept on 28/02 in other years, unlike RRULE which would skip those years.
    const { month, day } = parseLocalDate(start);
    for (let y = parseLocalDate(from).year; y <= parseLocalDate(from).year + 1; y++) {
      const d = nextBirthdayDate(month, day, y);
      if (d >= from) return d;
    }
    return null;
  }
  const next = expandOccurrences(item.id, s, { from, to: addDays(from, 800) }, [], 1)[0];
  return next ? datePart(next.start) : null;
}

/** Next date of a special day (solar or lunar) with its countdown, or null when it has no future date. */
export function specialDayCountdown(item: Item, today: LocalDate): SpecialDayCountdown | null {
  const date = nextDate(item, today);
  if (!date) return null;
  const daysLeft = daysUntil(date, today);
  const out: SpecialDayCountdown = { date, daysLeft, label: countdownLabel(daysLeft) };
  const lr = item.schedule.lunarRule;
  if (lr) out.lunarNote = lr.freq === "YEARLY" ? `(âm ${lr.day}/${lr.month})` : `(âm ngày ${lr.day})`;
  return out;
}
