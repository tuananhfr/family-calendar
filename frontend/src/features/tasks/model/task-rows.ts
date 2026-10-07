import type { Priority } from "@/core/model/common";
import type { Item } from "@/core/model/item";
import type { OccurrenceState } from "@/core/model/occurrence";
import type { Occurrence } from "@/core/recurrence/types";
import type { LocalDate } from "@/core/time/local-date";
import { datePart } from "@/core/time/zoned";
import { taskStatus, toTaskViews, type TaskView } from "./task-filters";

export type TaskStatusFilter = "ALL" | "TODO" | "DONE" | "OVERDUE";
export type TaskPriorityFilter = "ALL" | Priority;

const PRIORITY_RANK: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const STATUS_RANK = { OVERDUE: 0, TODO: 1, DONE: 2 } as const;

function isRecurring(item: Item): boolean {
  return !!item.schedule.rrule || !!item.schedule.lunarRule;
}

/**
 * One row per task on /viec. A recurring chore shows today's occurrence (else the next one, else the last), never a
 * pile of missed past ones: "Quá hạn 30 ngày" on a daily chore is noise, not a deadline.
 */
export function taskRows(entries: Array<{ item: Item; occurrence: Occurrence }>, states: OccurrenceState[], today: LocalDate): TaskView[] {
  const byItem = new Map<string, Array<{ item: Item; occurrence: Occurrence }>>();
  for (const e of entries) {
    if (e.item.kind !== "TASK") continue;
    byItem.set(e.item.id, [...(byItem.get(e.item.id) ?? []), e]);
  }
  const picked: Array<{ item: Item; occurrence: Occurrence }> = [];
  for (const list of byItem.values()) {
    const sorted = [...list].sort((a, b) => (a.occurrence.start < b.occurrence.start ? -1 : 1));
    if (!isRecurring(sorted[0].item)) {
      picked.push(sorted[0]);
      continue;
    }
    picked.push(sorted.find((e) => datePart(e.occurrence.start) >= today) ?? sorted[sorted.length - 1]);
  }
  return sortTasks(toTaskViews(picked, states), today);
}

/** Overdue, then open, then done; inside each by due date, then priority. */
export function sortTasks(rows: TaskView[], today: LocalDate): TaskView[] {
  return [...rows].sort((a, b) => {
    const s = STATUS_RANK[taskStatus(a, today)] - STATUS_RANK[taskStatus(b, today)];
    if (s !== 0) return s;
    const da = a.due ?? "9999-12-31";
    const db = b.due ?? "9999-12-31";
    if (da !== db) return da < db ? -1 : 1;
    return PRIORITY_RANK[a.item.priority] - PRIORITY_RANK[b.item.priority] || a.item.title.localeCompare(b.item.title, "vi");
  });
}

/** "Bộ lọc" on /viec: status and priority, on top of the tab. */
export function applyTaskFilters(rows: TaskView[], f: { status: TaskStatusFilter; priority: TaskPriorityFilter }, today: LocalDate): TaskView[] {
  return rows.filter((r) => (f.status === "ALL" || taskStatus(r, today) === f.status) && (f.priority === "ALL" || r.item.priority === f.priority));
}
