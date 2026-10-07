import type { Item } from "@/core/model/item";
import type { OccurrenceState } from "@/core/model/occurrence";
import type { Occurrence } from "@/core/recurrence/types";
import { dayOfWeek, daysBetween, parseLocalDate, type LocalDate } from "@/core/time/local-date";
import { datePart } from "@/core/time/zoned";

export const TASK_TABS = ["ALL", "MINE", "CHILDREN", "HOUSEWORK", "SHOPPING", "FINANCE", "STUDY", "HEALTH"] as const;
export type TaskTab = (typeof TASK_TABS)[number];

export interface TaskView {
  item: Item;
  occurrence: Occurrence;
  due: LocalDate | null;
  done: boolean;
}

export interface TaskFilterContext {
  /** "Đang dùng: …" member on a shared device. */
  usingMemberId?: string;
  childMemberIds: string[];
  actorId?: string;
}

const labels = {
  today: "Hôm nay",
  tomorrow: "Ngày mai",
  overdue: (n: number) => `Quá hạn ${n} ngày`,
  noDue: "Không có hạn",
  weekday: ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"],
};

/** One row per task occurrence; `done` comes from the occurrence state, or completedAt for one-off tasks. */
export function toTaskViews(entries: Array<{ item: Item; occurrence: Occurrence }>, states: OccurrenceState[]): TaskView[] {
  const doneKeys = new Set(states.filter((s) => s.deletedAt === null && s.status === "DONE").map((s) => s.occurrenceKey));
  return entries.map(({ item, occurrence }) => {
    const recurring = !!item.schedule.rrule || !!item.schedule.lunarRule;
    return {
      item,
      occurrence,
      due: datePart(occurrence.start),
      done: doneKeys.has(occurrence.occurrenceKey) || (!recurring && !!item.completedAt),
    };
  });
}

export function taskStatus(view: TaskView, today: LocalDate): "TODO" | "DONE" | "OVERDUE" {
  if (view.done) return "DONE";
  return view.due !== null && view.due < today ? "OVERDUE" : "TODO";
}

function involves(item: Item, memberIds: string[]): boolean {
  return item.memberIds.some((id) => memberIds.includes(id)) || (!!item.responsibleMemberId && memberIds.includes(item.responsibleMemberId));
}

function matches(item: Item, tab: TaskTab, ctx: TaskFilterContext): boolean {
  switch (tab) {
    case "ALL":
      return true;
    case "MINE":
      if (ctx.usingMemberId && involves(item, [ctx.usingMemberId])) return true;
      return !!ctx.actorId && item.memberIds.length === 0 && !item.responsibleMemberId && item.createdByActorId === ctx.actorId;
    case "CHILDREN":
      return involves(item, ctx.childMemberIds);
    case "HOUSEWORK":
      return item.preset === "HOUSEWORK" || item.category === "HOUSEWORK";
    case "SHOPPING":
      return item.preset === "SHOPPING" || item.category === "SHOPPING";
    case "FINANCE":
      return item.category === "FINANCE";
    case "STUDY":
      return item.category === "STUDY";
    case "HEALTH":
      return item.category === "HEALTH";
  }
}

/** Tabs of /viec (IMG-D). Access filtering happens before this; this only narrows what the viewer can read. */
export function filterTasks(tasks: TaskView[], tab: TaskTab, ctx: TaskFilterContext): TaskView[] {
  return tasks.filter((t) => matches(t.item, tab, ctx));
}

/** 'Hôm nay' | 'Ngày mai' | 'Thứ 7, 10/10' (within a week) | '19/10/2026' | 'Quá hạn 2 ngày'. */
export function dueLabel(due: LocalDate | null, today: LocalDate): string {
  if (due === null) return labels.noDue;
  const n = daysBetween(today, due);
  if (n < 0) return labels.overdue(-n);
  if (n === 0) return labels.today;
  if (n === 1) return labels.tomorrow;
  const { year, month, day } = parseLocalDate(due);
  if (n < 7) return `${labels.weekday[dayOfWeek(due)]}, ${day}/${month}`;
  return `${day}/${month}/${year}`;
}
