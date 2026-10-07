"use client";

import { useMemo } from "react";
import type { Member } from "@/core/model/member";
import { addDays, type LocalDate } from "@/core/time/local-date";
import { useOccurrences } from "@/features/items";
import { useActiveSpace, useMembers, useSpaceToday } from "@/features/members";
import { firstOpenPerItem, toUpcomingEntries, type UpcomingEntry } from "../model/group-upcoming";

// Overdue tasks older than the task list's window are dropped there too; documents are often renewed a year or more ahead.
const LOOKBACK_DAYS = 90;
export const UPCOMING_LOOKAHEAD_DAYS = 730;

export function useUpcomingList(): { loading: boolean; today: LocalDate; rows: UpcomingEntry[]; members: Member[] } {
  const today = useSpaceToday();
  const { space } = useActiveSpace();
  const members = useMembers(space?.id);
  const window = useMemo(() => ({ from: addDays(today, -LOOKBACK_DAYS), to: addDays(today, UPCOMING_LOOKAHEAD_DAYS) }), [today]);
  const occ = useOccurrences(window);
  return useMemo(
    () => ({
      loading: occ.loading || members === undefined,
      today,
      rows: firstOpenPerItem(toUpcomingEntries(occ.entries, occ.states), today),
      members: members ?? [],
    }),
    [occ, members, today],
  );
}
