import type { Item } from "@/core/model/item";
import type { ItemExceptionRecord, OccurrenceState } from "@/core/model/occurrence";
import { expandOccurrences } from "@/core/recurrence/expand";
import { endOfMonth, type LocalDate } from "@/core/time/local-date";

export interface HabitRate {
  itemId: string;
  title: string;
  /** Days marked DONE. */
  done: number;
  /** Days that had an occurrence (up to `today` when given). */
  total: number;
  percent: number;
}

const DAILY = /(^|;)FREQ=DAILY(;|$)/;

export function isDailyHabit(item: Item): boolean {
  return item.deletedAt === null && (item.kind === "REMINDER" || item.kind === "TASK") && !!item.schedule.rrule && DAILY.test(item.schedule.rrule);
}

/**
 * "Thói quen nổi bật" (modules.md §10): daily REMINDER/TASK series, days DONE / days with an occurrence in the month.
 * Pass `today` for the current month so days still ahead don't count as missed.
 */
export function habitRates(items: Item[], states: OccurrenceState[], month: string, opts: { exceptions?: ItemExceptionRecord[]; today?: LocalDate } = {}): HabitRate[] {
  const from = `${month}-01`;
  let to = endOfMonth(from);
  if (opts.today && opts.today < to) to = opts.today;
  if (to < from) return [];
  const done = new Set(states.filter((s) => s.deletedAt === null && s.status === "DONE").map((s) => s.occurrenceKey));
  const out: HabitRate[] = [];
  for (const item of items.filter(isDailyHabit)) {
    const own = (opts.exceptions ?? []).filter((e) => e.itemId === item.id && e.deletedAt === null);
    const occs = expandOccurrences(item.id, item.schedule, { from, to }, own);
    if (occs.length === 0) continue;
    const doneCount = occs.filter((o) => done.has(o.occurrenceKey)).length;
    out.push({ itemId: item.id, title: item.title, done: doneCount, total: occs.length, percent: Math.round((doneCount / occs.length) * 100) });
  }
  return out.sort((a, b) => b.percent - a.percent || a.title.localeCompare(b.title, "vi"));
}
