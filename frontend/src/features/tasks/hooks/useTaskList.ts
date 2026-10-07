"use client";

import { useMemo } from "react";
import type { Member } from "@/core/model/member";
import { addDays, type LocalDate } from "@/core/time/local-date";
import { useOccurrences } from "@/features/items";
import { useAccess, useActiveSpace, useMembers, useSpaceToday } from "@/features/members";
import { useAppStore } from "@/store/app.store";
import type { TaskFilterContext, TaskView } from "../model/task-filters";
import { taskRows } from "../model/task-rows";

// Done one-off tasks older than this drop off the list; open ones further out than a year are rare enough to wait.
const LOOKBACK_DAYS = 90;
const LOOKAHEAD_DAYS = 365;

export interface TaskList {
  loading: boolean;
  today: LocalDate;
  rows: TaskView[];
  members: Member[];
  ctx: TaskFilterContext;
}

export function useTaskList(): TaskList {
  const today = useSpaceToday();
  const { space } = useActiveSpace();
  const members = useMembers(space?.id);
  const access = useAccess();
  const usingMemberId = useAppStore((s) => s.usingMemberId);
  const window = useMemo(() => ({ from: addDays(today, -LOOKBACK_DAYS), to: addDays(today, LOOKAHEAD_DAYS) }), [today]);
  const occ = useOccurrences(window);

  return useMemo(() => {
    const list = members ?? [];
    const ctx: TaskFilterContext = {
      usingMemberId,
      actorId: access?.actorId,
      childMemberIds: list.filter((m) => m.profile === "CHILD" && m.status === "ACTIVE").map((m) => m.id),
    };
    return { loading: occ.loading || members === undefined, today, rows: taskRows(occ.entries, occ.states, today), members: list, ctx };
  }, [occ, members, today, usingMemberId, access?.actorId]);
}
