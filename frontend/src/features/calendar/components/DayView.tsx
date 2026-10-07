"use client";

import type { OccurrenceState } from "@/core/model/occurrence";
import type { LocalDate } from "@/core/time/local-date";
import type { OccurrenceEntry } from "@/features/items";
import { WeekGrid } from "./WeekGrid";

/** One wide time column; per-member columns stay on Today, the calendar day view is about time. */
export function DayView({ date, byDay, today, states }: { date: LocalDate; byDay: Map<LocalDate, OccurrenceEntry[]>; today: LocalDate; states: Map<string, OccurrenceState> }) {
  return <WeekGrid days={[date]} byDay={byDay} today={today} states={states} />;
}
