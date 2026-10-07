"use client";

import { useMemo } from "react";
import type { Member } from "@/core/model/member";
import type { OccurrenceState } from "@/core/model/occurrence";
import type { LocalDate } from "@/core/time/local-date";
import type { Item } from "@/core/model/item";
import { entriesByDay, weekRange, type WeekRange } from "@/features/calendar";
import { occurrenceStatesByKey, useOccurrences, type OccurrenceEntry } from "@/features/items";
import { useActiveSpace, useMembers } from "@/features/members";
import { timetableEntries, type TimetableTab } from "../model/timetable-filter";

export interface TimetableData {
  loading: boolean;
  week: WeekRange;
  /** Every lesson of the week, before the tab filter (copy and report need them all). */
  lessons: OccurrenceEntry[];
  items: Item[];
  byDay: Map<LocalDate, OccurrenceEntry[]>;
  states: Map<string, OccurrenceState>;
  members: Member[];
  /** Member shown on "Theo thành viên": the picked one, else the first child, else the first member. */
  memberId?: string;
}

export function useTimetable(date: LocalDate, tab: TimetableTab, pickedMemberId: string | undefined): TimetableData {
  const { space } = useActiveSpace();
  const members = useMembers(space?.id);
  const week = useMemo(() => weekRange(date, space?.settings.weekStartsOn ?? 1), [date, space?.settings.weekStartsOn]);
  const window = useMemo(() => ({ from: week.from, to: week.to }), [week]);
  const occ = useOccurrences(window);
  return useMemo(() => {
    const active = (members ?? []).filter((m) => m.status === "ACTIVE");
    // Children's timetables are what families look at first.
    const memberId = pickedMemberId ?? active.find((m) => m.profile === "CHILD")?.id ?? active[0]?.id;
    const lessons = timetableEntries(occ.entries, "WEEK");
    const shown = timetableEntries(lessons, tab, memberId);
    return {
      loading: occ.loading || members === undefined,
      week,
      lessons,
      items: occ.items,
      byDay: entriesByDay(shown, week.from, week.to),
      states: occurrenceStatesByKey(occ.states),
      members: active,
      memberId,
    };
  }, [occ, members, week, tab, pickedMemberId]);
}
