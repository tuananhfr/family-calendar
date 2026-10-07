import { canReadItem, type AccessContext } from "@/core/access/evaluate";
import type { Category } from "@/core/model/common";
import type { Item } from "@/core/model/item";
import { wallDurationMinutes } from "@/core/recurrence/floating";
import { expandOccurrences } from "@/core/recurrence/expand";
import type { Occurrence } from "@/core/recurrence/types";
import type { LocalDataView } from "@/core/repo/data-view";
import { normalizeVi } from "@/core/search/normalize";
import { addDays, daysBetween, endOfMonth, type LocalDate } from "@/core/time/local-date";
import { habitRates, type HabitRate } from "./habits";

export interface MonthReport {
  month: string;
  events: { count: number; deltaPercent: number | null };
  tasks: { done: number; total: number; percent: number };
  reminders: { count: number };
  members: { active: number; total: number };
  byCategory: Array<{ category: Category; count: number; percent: number }>;
  /** Hours of timed events per member and category; an event of two members counts for both. */
  memberTime: Array<{ memberId: string; displayName: string; hours: Partial<Record<Category, number>>; totalHours: number }>;
  habits: HabitRate[];
  topEvents: Array<{ title: string; count: number }>;
  /** Days since the last ACTIVITY/SPORT occurrence (60-day look-back), null when none. */
  daysSinceActivity: number | null;
}

const ACTIVITY_CATEGORIES: ReadonlySet<Category> = new Set(["ACTIVITY", "SPORT"]);
const TOP_EVENTS = 5;
const ACTIVITY_LOOKBACK_DAYS = 60;

function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Month report of modules.md §10, computed on the device from records `ctx` may read — another actor's PRIVATE
 * or health items the viewer can't open never reach a count.
 */
export function reportForMonth(data: LocalDataView, month: string, ctx: AccessContext, opts: { today?: LocalDate } = {}): MonthReport {
  const items = data.items.filter((i) => i.deletedAt === null && canReadItem(ctx, i));
  const exceptionsOf = (id: string) => data.exceptions.filter((e) => e.itemId === id && e.deletedAt === null);
  const expand = (from: LocalDate, to: LocalDate) =>
    items.flatMap((item) => expandOccurrences(item.id, item.schedule, { from, to }, exceptionsOf(item.id)).map((occ) => ({ item, occ })));

  const from = `${month}-01`;
  const to = endOfMonth(from);
  const inMonth = expand(from, to);
  const prevFrom = `${previousMonth(month)}-01`;
  const events = inMonth.filter((x) => x.item.kind === "EVENT");
  const prevEvents = expand(prevFrom, endOfMonth(prevFrom)).filter((x) => x.item.kind === "EVENT").length;

  const done = new Set(data.states.filter((s) => s.deletedAt === null && s.status === "DONE").map((s) => s.occurrenceKey));
  const isDone = (item: Item, occ: Occurrence) => done.has(occ.occurrenceKey) || (!item.schedule.rrule && !item.schedule.lunarRule && !!item.completedAt);
  const tasks = inMonth.filter((x) => x.item.kind === "TASK");
  const tasksDone = tasks.filter((x) => isDone(x.item, x.occ)).length;

  const occCount = new Map<string, number>();
  for (const x of inMonth) occCount.set(x.item.id, (occCount.get(x.item.id) ?? 0) + 1);
  const readable = new Set(items.map((i) => i.id));
  const reminders = data.rules
    .filter((r) => r.deletedAt === null && r.enabled !== false && readable.has(r.itemId))
    .reduce((n, r) => n + (occCount.get(r.itemId) ?? 0) * (r.offsetsMinutes.length + (r.offsetMonths?.length ?? 0)), 0);

  const members = data.members.filter((m) => m.deletedAt === null && m.status === "ACTIVE" && (m.sharingScope !== "PRIVATE" || m.createdByActorId === ctx.actorId));
  const involved = new Set(inMonth.flatMap((x) => x.item.memberIds));
  const actedInMonth = (actorId: string) =>
    data.states.some((s) => s.actedByActorId === actorId && s.actedAt.slice(0, 7) === month) ||
    items.some((i) => i.createdByActorId === actorId && i.createdAt.slice(0, 7) === month);
  const activeMembers = members.filter((m) => involved.has(m.id) || (!!m.linkedActorId && actedInMonth(m.linkedActorId))).length;

  const catCount = new Map<Category, number>();
  for (const x of events) catCount.set(x.item.category, (catCount.get(x.item.category) ?? 0) + 1);
  const byCategory = [...catCount]
    .map(([category, count]) => ({ category, count, percent: Math.round((count / events.length) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  const minutes = new Map<string, Map<Category, number>>();
  for (const { item, occ } of events) {
    if (occ.allDay || !occ.end) continue;
    const length = wallDurationMinutes(occ.start, occ.end);
    for (const id of item.memberIds) {
      const m = minutes.get(id) ?? new Map<Category, number>();
      m.set(item.category, (m.get(item.category) ?? 0) + length);
      minutes.set(id, m);
    }
  }
  const memberTime = members
    .filter((m) => minutes.has(m.id))
    .map((m) => {
      const hours: Partial<Record<Category, number>> = {};
      let total = 0;
      for (const [cat, min] of minutes.get(m.id)!) {
        hours[cat] = round2(min / 60);
        total += min;
      }
      return { memberId: m.id, displayName: m.displayName, hours, totalHours: round2(total / 60) };
    });

  const titles = new Map<string, { title: string; count: number }>();
  for (const { item, occ } of events) {
    const title = occ.title ?? item.title;
    const key = normalizeVi(title);
    const t = titles.get(key) ?? { title, count: 0 };
    t.count += 1;
    titles.set(key, t);
  }
  const topEvents = [...titles.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "vi")).slice(0, TOP_EVENTS);

  const ref = opts.today && opts.today < to ? opts.today : to;
  const lookFrom = addDays(ref, -ACTIVITY_LOOKBACK_DAYS);
  const activityDays = items
    .filter((i) => ACTIVITY_CATEGORIES.has(i.category))
    .flatMap((i) => expandOccurrences(i.id, i.schedule, { from: lookFrom, to: ref }, exceptionsOf(i.id)).map((o) => o.start.slice(0, 10)))
    .sort();
  const last = activityDays.at(-1);

  return {
    month,
    events: { count: events.length, deltaPercent: prevEvents === 0 ? null : Math.round(((events.length - prevEvents) / prevEvents) * 1000) / 10 },
    tasks: { done: tasksDone, total: tasks.length, percent: tasks.length === 0 ? 0 : Math.round((tasksDone / tasks.length) * 100) },
    reminders: { count: reminders },
    members: { active: activeMembers, total: members.length },
    byCategory,
    memberTime,
    habits: habitRates(items, data.states, month, { exceptions: data.exceptions, today: opts.today }),
    topEvents,
    daysSinceActivity: last ? daysBetween(last, ref) : null,
  };
}
