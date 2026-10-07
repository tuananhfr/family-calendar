import { newId } from "@/core/ids";
import type { SpaceKind } from "@/core/model/common";
import { defaultsForPreset, type Item } from "@/core/model/item";
import { expandOccurrences } from "@/core/recurrence/expand";
import { addDays, daysBetween, dayOfWeek, type LocalDate } from "@/core/time/local-date";
import type { ImportRow } from "./parse-import";

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

const isTimetable = (i: Item) => i.deletedAt === null && i.preset === "TIMETABLE";

function shift(value: string, days: number): string {
  return `${addDays(value.slice(0, 10), days)}${value.slice(10)}`;
}

function freshCopy(source: Item, schedule: Item["schedule"], ctx: { actorId: string; now?: Date }): Item {
  const now = (ctx.now ?? new Date()).toISOString();
  const copy: Item = { ...source };
  delete copy.completedAt;
  delete copy.sourceReference;
  return { ...copy, id: newId(), schedule, createdByActorId: ctx.actorId, createdAt: now, updatedAt: now, deletedAt: null, revision: null, syncState: "LOCAL" };
}

function hasOccurrenceIn(item: Item, weekStart: LocalDate): { start: string } | undefined {
  return expandOccurrences(item.id, item.schedule, { from: weekStart, to: addDays(weekStart, 6) }, [], 50)[0];
}

/**
 * "Copy tuần" (modules.md §6): new records at the same weekday/time in the target week. A one-off lesson is copied
 * as a one-off; a weekly one as a weekly series starting in the target week — unless its series already reaches
 * that week, which would only duplicate it. Inputs are never mutated.
 */
export function copyWeek(items: Item[], fromWeek: LocalDate, toWeek: LocalDate, ctx: { actorId: string; now?: Date }): Item[] {
  const delta = daysBetween(fromWeek, toWeek);
  if (dayOfWeek(fromWeek) !== dayOfWeek(toWeek) || delta % 7 !== 0) throw new RangeError("fromWeek and toWeek must be starts of weeks");
  const out: Item[] = [];
  const lessons = items.filter(isTimetable);
  // Same title, time and people already there = an earlier copy; pressing "Sao chép tuần" twice must not double it.
  const sameLesson = (a: Item, start: string) => (b: Item) => b.schedule.start === start && b.title === a.title && b.memberIds.join() === a.memberIds.join();
  for (const item of lessons) {
    const occ = hasOccurrenceIn(item, fromWeek);
    if (!occ) continue;
    const s = item.schedule;
    if (!s.rrule && !s.lunarRule) {
      const start = shift(s.start, delta);
      if (lessons.some(sameLesson(item, start))) continue;
      out.push(freshCopy(item, { ...s, start, ...(s.end ? { end: shift(s.end, delta) } : {}) }, ctx));
      continue;
    }
    if (s.lunarRule || hasOccurrenceIn(item, toWeek)) continue;
    const length = s.end ? daysBetween(s.start.slice(0, 10), s.end.slice(0, 10)) : 0;
    const start = shift(occ.start, delta);
    // The source series ended (UNTIL/COUNT); the copy starts fresh and runs on.
    const rrule = s.rrule!.split(";").filter((p) => !/^(UNTIL|COUNT)=/.test(p)).join(";");
    const end = s.end ? `${addDays(start.slice(0, 10), length)}${s.end.slice(10)}` : undefined;
    out.push(freshCopy(item, { ...s, start, rrule, ...(end ? { end } : {}) }, ctx));
  }
  return out;
}

export interface RowsToItemsContext {
  spaceId: string;
  actorId: string;
  timeZone: string;
  /** First week the timetable applies to; each row starts on its weekday in this week. */
  weekStart: LocalDate;
  /** Last day of the school term, inclusive. */
  until?: LocalDate;
  spaceKind?: SpaceKind;
  now?: Date;
}

/** Confirmed import rows → weekly TIMETABLE items (one per row). */
export function rowsToItems(rows: ImportRow[], ctx: RowsToItemsContext): Item[] {
  const now = (ctx.now ?? new Date()).toISOString();
  const defaults = defaultsForPreset("EVENT", "TIMETABLE", ctx.spaceKind);
  const startDow = dayOfWeek(ctx.weekStart);
  return rows.map((row) => {
    const jsDow = row.weekday % 7;
    const date = addDays(ctx.weekStart, (jsDow - startDow + 7) % 7);
    const until = ctx.until ? `;UNTIL=${ctx.until.replace(/-/g, "")}T235959` : "";
    return {
      id: newId(),
      spaceId: ctx.spaceId,
      createdByActorId: ctx.actorId,
      dataClass: defaults.dataClass,
      sharingScope: defaults.sharingScope,
      revision: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncState: "LOCAL",
      kind: "EVENT",
      preset: "TIMETABLE",
      title: row.subject,
      subject: row.subject,
      schedule: { allDay: false, start: `${date}T${row.start}`, end: `${date}T${row.end}`, timeZone: ctx.timeZone, rrule: `FREQ=WEEKLY;BYDAY=${BYDAY[jsDow]}${until}` },
      memberIds: [row.memberId],
      category: row.category,
      priority: "MEDIUM",
      attachments: [],
      showOnCalendar: true,
      calendarSystem: "SOLAR",
    } satisfies Item;
  });
}
