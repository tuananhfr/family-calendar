import type { Item } from "@/core/model/item";
import type { Occurrence } from "@/core/recurrence/types";
import type { LocalDate } from "@/core/time/local-date";
import { datePart, timePart } from "@/core/time/zoned";
import { isPrintable } from "./printable";

export interface PrintRow {
  key: string;
  time: string | null;
  endTime: string | null;
  title: string;
  memberIds: string[];
  locationText?: string;
}

/** Printable occurrences per day of the week; one that began before the week is listed on its first day. */
export function printWeek(entries: Array<{ item: Item; occurrence: Occurrence }>, days: LocalDate[]): Map<LocalDate, PrintRow[]> {
  const byDay = new Map<LocalDate, PrintRow[]>(days.map((d) => [d, []]));
  for (const { item, occurrence: occ } of entries) {
    if (!isPrintable(item)) continue;
    const start = datePart(occ.start);
    const day = start < days[0] ? days[0] : start;
    byDay.get(day)?.push({
      key: occ.occurrenceKey,
      time: occ.allDay ? null : timePart(occ.start),
      endTime: occ.allDay || !occ.end ? null : timePart(occ.end),
      title: occ.title ?? item.title,
      memberIds: item.memberIds,
      locationText: item.locationText,
    });
  }
  // All-day first, then by time.
  for (const rows of byDay.values()) rows.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  return byDay;
}
