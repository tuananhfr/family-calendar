import { isSpecialDayPreset } from "@/core/model/common";
import type { Item } from "@/core/model/item";
import { occurrenceKey } from "@/core/recurrence/occurrence-key";
import { parseLocalDate, type LocalDate } from "@/core/time/local-date";
import { datePart } from "@/core/time/zoned";
import { specialDayCountdown, type SpecialDayCountdown } from "./countdown";

export interface SpecialDayRow {
  item: Item;
  countdown: SpecialDayCountdown;
}

export function isSpecialDay(item: Item): boolean {
  return item.kind === "EVENT" && isSpecialDayPreset(item.preset);
}

/** Key of the occurrence on the counted-down date; timed special days keep their wall-clock start time. */
export function specialDayOccurrenceKey(item: Item, date: LocalDate): string {
  return occurrenceKey(item.id, item.schedule.allDay ? date : `${date}${item.schedule.start.slice(10)}`);
}

/** Special days by next date; one-off days already behind us have no countdown and are listed apart. */
export function specialDayList(items: Item[], today: LocalDate): { upcoming: SpecialDayRow[]; past: Item[] } {
  const upcoming: SpecialDayRow[] = [];
  const past: Item[] = [];
  for (const item of items) {
    if (!isSpecialDay(item)) continue;
    const countdown = specialDayCountdown(item, today);
    if (countdown) upcoming.push({ item, countdown });
    else past.push(item);
  }
  upcoming.sort((a, b) => a.countdown.daysLeft - b.countdown.daysLeft || a.item.title.localeCompare(b.item.title, "vi"));
  past.sort((a, b) => (a.schedule.start < b.schedule.start ? 1 : -1));
  return { upcoming, past };
}

/** "Tròn n tuổi / n năm" on `date`, when the stored start is a real past year (birth or wedding year). */
export function yearsOn(item: Item, date: LocalDate): number | undefined {
  if (item.preset !== "BIRTHDAY" && item.preset !== "ANNIVERSARY") return undefined;
  const n = parseLocalDate(date).year - parseLocalDate(datePart(item.schedule.start)).year;
  return n > 0 ? n : undefined;
}
