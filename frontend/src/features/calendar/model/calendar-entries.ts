import { addDays, daysBetween, dayOfWeek, parseLocalDate, type LocalDate } from "@/core/time/local-date";
import { datePart } from "@/core/time/zoned";
import type { OccurrenceEntry } from "@/features/items";

export type WeekdayCode = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";
const CODES: WeekdayCode[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function weekdayCode(d: LocalDate): WeekdayCode {
  return CODES[dayOfWeek(d)];
}

/** '6/10/2026' — the short solar label used in aria-labels and agenda headers. */
export function shortDateVi(d: LocalDate): string {
  const { day, month, year } = parseLocalDate(d);
  return `${day}/${month}/${year}`;
}

/**
 * What the calendar draws: timed things on the calendar, filtered by member. Tasks stay on /viec and the Today
 * rail, matching the Today board. Items without members belong to everyone, so a filter never hides them.
 */
export function calendarEntries(entries: OccurrenceEntry[], filter: string[] | "ALL"): OccurrenceEntry[] {
  return entries.filter(
    (e) =>
      e.item.kind !== "TASK" &&
      e.item.showOnCalendar &&
      (filter === "ALL" || e.item.memberIds.length === 0 || e.item.memberIds.some((id) => filter.includes(id))),
  );
}

/** Groups entries onto every day they touch (multi-day events repeat), all-day ones first. */
export function entriesByDay(entries: OccurrenceEntry[], from: LocalDate, to: LocalDate): Map<LocalDate, OccurrenceEntry[]> {
  const map = new Map<LocalDate, OccurrenceEntry[]>();
  for (const e of entries) {
    const start = datePart(e.occurrence.start);
    const end = e.occurrence.end ? datePart(e.occurrence.end) : start;
    // An event ending exactly at midnight does not occupy the next day.
    const last = e.occurrence.end && !e.occurrence.allDay && end > start && e.occurrence.end.slice(11, 16) === "00:00" ? addDays(end, -1) : end;
    for (let d = start < from ? from : start; d <= last && d <= to; d = addDays(d, 1)) {
      const list = map.get(d);
      if (list) list.push(e);
      else map.set(d, [e]);
    }
  }
  for (const list of map.values()) list.sort((a, b) => Number(!a.occurrence.allDay) - Number(!b.occurrence.allDay) || (a.occurrence.start < b.occurrence.start ? -1 : a.occurrence.start > b.occurrence.start ? 1 : 0));
  return map;
}

export interface UpcomingEvent {
  entry: OccurrenceEntry;
  date: LocalDate;
  daysLeft: number;
}

/** Next EVENT occurrences from today (IMG-D "Sự kiện sắp tới"); ones already finished today drop out. */
export function upcomingEvents(entries: OccurrenceEntry[], today: LocalDate, nowTime: string, limit: number): UpcomingEvent[] {
  return entries
    .filter((e) => e.item.kind === "EVENT" && e.state?.status !== "SKIPPED")
    .map((entry) => ({ entry, date: datePart(entry.occurrence.start) }))
    .filter(({ entry, date }) => {
      if (date > today) return true;
      if (date < today) return false;
      if (entry.occurrence.allDay) return true;
      return (entry.occurrence.end ?? entry.occurrence.start).slice(11, 16) >= nowTime;
    })
    .sort((a, b) => (a.entry.occurrence.start < b.entry.occurrence.start ? -1 : 1))
    .slice(0, limit)
    .map(({ entry, date }) => ({ entry, date, daysLeft: daysBetween(today, date) }));
}
