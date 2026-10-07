"use client";

import { useEffect, useMemo } from "react";
import { useOccurrences } from "@/features/items";
import { useSpaceToday } from "@/features/members";
import { useShellStore } from "./shell-store";

/** Keeps the "Việc cần làm" badge (IMG-A ⑤) at the number of open tasks due today, on every screen. */
export function TasksTodayBadge() {
  const today = useSpaceToday();
  const window = useMemo(() => ({ from: today, to: today }), [today]);
  const { entries } = useOccurrences(window);
  const setStatus = useShellStore((s) => s.setStatus);
  const open = entries.filter((e) => e.item.kind === "TASK" && e.state?.status !== "DONE" && e.state?.status !== "SKIPPED").length;
  useEffect(() => setStatus({ tasksToday: open }), [open, setStatus]);
  return null;
}
