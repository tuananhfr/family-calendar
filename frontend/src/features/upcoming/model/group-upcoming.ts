import type { Item } from "@/core/model/item";
import type { OccurrenceState } from "@/core/model/occurrence";
import type { Occurrence } from "@/core/recurrence/types";
import { addDays, daysBetween, type LocalDate } from "@/core/time/local-date";
import { datePart } from "@/core/time/zoned";

export interface UpcomingEntry {
  item: Item;
  occurrence: Occurrence;
  due: LocalDate;
  done: boolean;
  /** Negative when overdue. Filled by groupUpcoming. */
  daysLeft?: number;
  /** Open occurrences before today, this one included when it is overdue. Filled by firstOpenPerItem. */
  overdueCount?: number;
}

export const UPCOMING_KINDS = ["DOCUMENT", "PAYMENT", "APPOINTMENT", "TASK"] as const;
export type UpcomingKind = (typeof UPCOMING_KINDS)[number];

export interface UpcomingGroups {
  overdue: UpcomingEntry[];
  next7: UpcomingEntry[];
  next30: UpcomingEntry[];
  later: UpcomingEntry[];
}

/** Deadlines shown on /sap-den-han: documents, payments, appointments and tasks (v3.0 "Sắp đến hạn"). */
export function isUpcomingItem(item: Item): boolean {
  return item.kind === "TASK" || item.preset === "DOCUMENT" || item.preset === "PAYMENT" || item.preset === "APPOINTMENT";
}

/** Tab of /sap-den-han; a task is a task whatever its category. */
export function upcomingKindOf(item: Item): UpcomingKind {
  if (item.kind === "TASK") return "TASK";
  if (item.preset === "DOCUMENT" || item.preset === "PAYMENT") return item.preset;
  return "APPOINTMENT";
}

export function toUpcomingEntries(entries: Array<{ item: Item; occurrence: Occurrence }>, states: OccurrenceState[]): UpcomingEntry[] {
  const closed = new Set(
    states.filter((s) => s.deletedAt === null && (s.status === "DONE" || s.status === "SKIPPED")).map((s) => s.occurrenceKey),
  );
  return entries
    .filter((e) => isUpcomingItem(e.item))
    .map(({ item, occurrence }) => {
      const recurring = !!item.schedule.rrule || !!item.schedule.lunarRule;
      return {
        item,
        occurrence,
        due: datePart(occurrence.start),
        done: closed.has(occurrence.occurrenceKey) || (!recurring && !!item.completedAt),
      };
    });
}

/**
 * Quá hạn / 7 ngày tới (today..+7) / 30 ngày tới (+8..+30) / Sau đó. Finished deadlines are hidden; unfinished past
 * ones stay as overdue even without any reminder job (reminders.md).
 */
export function groupUpcoming(entries: UpcomingEntry[], today: LocalDate): UpcomingGroups {
  const groups: UpcomingGroups = { overdue: [], next7: [], next30: [], later: [] };
  const in7 = addDays(today, 7);
  const in30 = addDays(today, 30);
  const sorted = entries.filter((e) => !e.done).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  for (const e of sorted) {
    const entry = { ...e, daysLeft: daysBetween(today, e.due) };
    if (e.due < today) groups.overdue.push(entry);
    else if (e.due <= in7) groups.next7.push(entry);
    else if (e.due <= in30) groups.next30.push(entry);
    else groups.later.push(entry);
  }
  return groups;
}

/**
 * One row per item: its earliest open occurrence. A monthly bill expanded over two years would otherwise fill
 * "Sau đó" with 24 copies; missed past ones are folded into `overdueCount` instead of listed.
 */
export function firstOpenPerItem(entries: UpcomingEntry[], today: LocalDate): UpcomingEntry[] {
  const first = new Map<string, UpcomingEntry>();
  const overdue = new Map<string, number>();
  for (const e of entries) {
    if (e.done) continue;
    if (e.due < today) overdue.set(e.item.id, (overdue.get(e.item.id) ?? 0) + 1);
    const cur = first.get(e.item.id);
    if (!cur || e.due < cur.due) first.set(e.item.id, e);
  }
  return [...first.values()].map((e) => ({ ...e, overdueCount: overdue.get(e.item.id) ?? 0 }));
}
