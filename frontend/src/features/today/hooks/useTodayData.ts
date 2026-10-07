"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_TIME_ZONE } from "@/core/model/common";
import type { Member } from "@/core/model/member";
import type { ReminderRule } from "@/core/model/reminder-rule";
import { listActive } from "@/core/repo/read";
import { addDays, type LocalDate } from "@/core/time/local-date";
import { datePart } from "@/core/time/zoned";
import { useOccurrences, type OccurrenceEntry } from "@/features/items";
import { useActiveSpace, useMembers } from "@/features/members";
import { reminderTabOf, toReminderViews, type ReminderView } from "@/features/reminders";
import { specialDayList, type SpecialDayRow } from "@/features/special-days";
import { toTaskViews, type TaskView } from "@/features/tasks";
import { groupUpcoming, toUpcomingEntries, type UpcomingEntry } from "@/features/upcoming";
import { computeTodayStats, TODAY_LOOKAHEAD_DAYS, type TodayStats } from "../model/today-stats";
import { todayHeader, type TodayHeader } from "../model/greeting";

/** Documents/payments already overdue stay on the counters, so the window reaches back as far as it looks ahead. */
const LOOKBACK_DAYS = TODAY_LOOKAHEAD_DAYS;
const RAIL_LIMIT = 4;

export interface TodayData {
  loading: boolean;
  timeZone: string;
  header: TodayHeader;
  members: Member[];
  entries: OccurrenceEntry[];
  stats: TodayStats;
  tasksToday: TaskView[];
  specialDays: SpecialDayRow[];
  health: ReminderView[];
  dueSoon: UpcomingEntry[];
}

/** Occurrences touching `date` (multi-day events included), for the day board and agenda. */
export function entriesOn(entries: OccurrenceEntry[], date: LocalDate): OccurrenceEntry[] {
  return entries.filter(({ occurrence }) => {
    const from = datePart(occurrence.start);
    const to = occurrence.end ? datePart(occurrence.end) : from;
    return from <= date && date <= to;
  });
}

function byTime(a: TaskView, b: TaskView): number {
  const x = a.occurrence.allDay ? "" : a.occurrence.start;
  const y = b.occurrence.allDay ? "" : b.occurrence.start;
  return x < y ? -1 : x > y ? 1 : a.item.title.localeCompare(b.item.title, "vi");
}

/** Everything the Today screen reads, computed in the Space time zone (Review Focus #3). */
export function useTodayData(now: Date): TodayData {
  const { space } = useActiveSpace();
  const timeZone = space?.timeZone ?? DEFAULT_TIME_ZONE;
  const header = useMemo(() => todayHeader(timeZone, now), [timeZone, now]);
  const today = header.today;
  const window = useMemo(() => ({ from: addDays(today, -LOOKBACK_DAYS), to: addDays(today, TODAY_LOOKAHEAD_DAYS) }), [today]);
  const occ = useOccurrences(window);
  const members = useMembers(space?.id);
  const spaceId = space?.id;
  const rules = useLiveQuery(async () => (spaceId ? listActive<ReminderRule>("reminder_rule", spaceId) : []), [spaceId]);

  return useMemo(() => {
    const entries = occ.entries;
    const stats = computeTodayStats({ occurrences: entries, states: occ.states }, today);
    const tasksToday = toTaskViews(
      entries.filter((e) => e.item.kind === "TASK" && datePart(e.occurrence.start) === today),
      occ.states,
    ).sort(byTime);
    const specialDays = specialDayList(occ.items, today).upcoming.slice(0, RAIL_LIMIT);
    // One row per item: a medication with two reminder rules is still one line with one switch state.
    const seen = new Set<string>();
    const health = toReminderViews(
      occ.items.filter((i) => reminderTabOf(i) === "HEALTH"),
      rules ?? [],
    ).filter((v) => (seen.has(v.item.id) ? false : (seen.add(v.item.id), true)));
    const groups = groupUpcoming(toUpcomingEntries(entries, occ.states), today);
    const dueSoon = [...groups.overdue, ...groups.next7].filter((e) => e.item.kind !== "TASK" || e.due !== today).slice(0, RAIL_LIMIT);
    return {
      loading: occ.loading || members === undefined || rules === undefined,
      timeZone,
      header,
      members: members ?? [],
      entries,
      stats,
      tasksToday,
      specialDays,
      health: health.slice(0, RAIL_LIMIT),
      dueSoon,
    };
  }, [occ, members, rules, today, timeZone, header]);
}
