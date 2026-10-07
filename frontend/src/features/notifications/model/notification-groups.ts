import type { NotificationRow } from "@/core/db/db";
import { addDays, type LocalDate } from "@/core/time/local-date";
import { datePart, instantToZoned } from "@/core/time/zoned";

export type NotificationGroupKey = "today" | "yesterday" | "earlier";
export interface NotificationGroup {
  key: NotificationGroupKey;
  rows: NotificationRow[];
}

/** Rows newest first, split by the Space's calendar day (not the device's), empty groups dropped. */
export function groupNotifications(rows: NotificationRow[], today: LocalDate, timeZone: string): NotificationGroup[] {
  const yesterday = addDays(today, -1);
  const groups: Record<NotificationGroupKey, NotificationRow[]> = { today: [], yesterday: [], earlier: [] };
  const sorted = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const row of sorted) {
    const day = datePart(instantToZoned(new Date(row.createdAt), timeZone));
    groups[day >= today ? "today" : day === yesterday ? "yesterday" : "earlier"].push(row);
  }
  return (["today", "yesterday", "earlier"] as const).filter((k) => groups[k].length > 0).map((key) => ({ key, rows: groups[key] }));
}

/** REMINDER_DUE rows point at one occurrence; other types have nothing to open yet. */
export function occurrenceOf(row: NotificationRow): string | null {
  return row.resourceRef?.type === "occurrence" ? row.resourceRef.id : null;
}
