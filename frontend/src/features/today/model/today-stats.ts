import { isSpecialDayPreset } from "@/core/model/common";
import type { OccurrenceState } from "@/core/model/occurrence";
import { addDays, daysBetween, type LocalDate } from "@/core/time/local-date";
import { datePart } from "@/core/time/zoned";
import type { DayEntry } from "./day-layout";

export interface TodayStatsInput {
  /** Occurrences the viewer may read, expanded over at least [today − 30, today + 30]. */
  occurrences: DayEntry[];
  states: OccurrenceState[];
}

export interface TodayStats {
  tasksToday: number;
  tasksDoneToday: number;
  schedules: number;
  specialDays: { count: number; firstLabel?: string; firstDaysLeft?: number };
  medication: number;
  documentsDue: number;
  expensesToLog: number;
}

/** How far ahead "Ngày đặc biệt" and "Đến hạn giấy tờ" look. */
export const TODAY_LOOKAHEAD_DAYS = 30;

/** The six counters of the Today screen (IMG-A). */
export function computeTodayStats(input: TodayStatsInput, today: LocalDate): TodayStats {
  const status = new Map<string, OccurrenceState["status"]>();
  for (const s of input.states) if (s.deletedAt === null) status.set(s.occurrenceKey, s.status);
  const horizon = addDays(today, TODAY_LOOKAHEAD_DAYS);
  const stats: TodayStats = {
    tasksToday: 0,
    tasksDoneToday: 0,
    schedules: 0,
    specialDays: { count: 0 },
    medication: 0,
    documentsDue: 0,
    expensesToLog: 0,
  };
  let nearest: { date: LocalDate; title: string } | undefined;

  for (const { occurrence, item } of input.occurrences) {
    const day = datePart(occurrence.start);
    const st = status.get(occurrence.occurrenceKey);
    const open = st !== "DONE" && st !== "SKIPPED";
    const title = occurrence.title ?? item.title;
    if (item.kind === "TASK") {
      if (day === today && st !== "SKIPPED") {
        stats.tasksToday++;
        if (st === "DONE") stats.tasksDoneToday++;
      }
    } else if (item.kind === "EVENT" && isSpecialDayPreset(item.preset)) {
      if (day >= today && day <= horizon) {
        stats.specialDays.count++;
        if (!nearest || day < nearest.date) nearest = { date: day, title };
      }
    } else if (item.kind === "EVENT") {
      if (day === today) stats.schedules++;
    } else if (item.preset === "MEDICATION") {
      if (day === today) stats.medication++;
    } else if (item.preset === "DOCUMENT") {
      // Upcoming expiries plus ones already past but not handled (reminders.md: overdue stays visible).
      if (open && day <= horizon) stats.documentsDue++;
    } else if (item.preset === "PAYMENT") {
      if (open && day <= today) stats.expensesToLog++;
    }
  }
  if (nearest) stats.specialDays = { count: stats.specialDays.count, firstLabel: nearest.title, firstDaysLeft: daysBetween(today, nearest.date) };
  return stats;
}
