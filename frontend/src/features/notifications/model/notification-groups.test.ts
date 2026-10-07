import { describe, expect, it } from "vitest";
import type { NotificationRow } from "@/core/db/db";
import { groupNotifications, occurrenceOf } from "./notification-groups";

const row = (id: string, createdAt: string, extra: Partial<NotificationRow> = {}): NotificationRow => ({
  id,
  spaceId: "s1",
  type: "REMINDER_DUE",
  titleSafe: id,
  createdAt,
  readAt: null,
  ...extra,
});

describe("groupNotifications", () => {
  it("splits by the Space's day, newest first", () => {
    const rows = [
      row("old", "2026-10-01T03:00:00.000Z"),
      // 16:30Z is 23:30 on the 5th in Hanoi.
      row("late-yesterday", "2026-10-05T16:30:00.000Z"),
      // 17:30Z on the 5th is 00:30 on the 6th in Hanoi.
      row("just-after-midnight", "2026-10-05T17:30:00.000Z"),
      row("morning", "2026-10-06T01:00:00.000Z"),
    ];
    const groups = groupNotifications(rows, "2026-10-06", "Asia/Ho_Chi_Minh");
    expect(groups.map((g) => [g.key, g.rows.map((r) => r.id)])).toEqual([
      ["today", ["morning", "just-after-midnight"]],
      ["yesterday", ["late-yesterday"]],
      ["earlier", ["old"]],
    ]);
  });

  it("drops empty groups", () => {
    expect(groupNotifications([], "2026-10-06", "Asia/Ho_Chi_Minh")).toEqual([]);
  });
});

describe("occurrenceOf", () => {
  it("returns the key only for occurrence references", () => {
    expect(occurrenceOf(row("a", "2026-10-06T01:00:00.000Z", { resourceRef: { type: "occurrence", id: "i1@2026-10-06T07:00" } }))).toBe("i1@2026-10-06T07:00");
    expect(occurrenceOf(row("b", "2026-10-06T01:00:00.000Z", { resourceRef: { type: "item", id: "i1" } }))).toBeNull();
    expect(occurrenceOf(row("c", "2026-10-06T01:00:00.000Z"))).toBeNull();
  });
});
