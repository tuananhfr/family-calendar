import { describe, expect, it } from "vitest";
import type { Item } from "@/core/model/item";
import type { OccurrenceEntry } from "@/features/items";
import { calendarEntries, entriesByDay, shortDateVi, upcomingEvents, weekdayCode } from "./calendar-entries";

function entry(id: string, start: string, end: string | undefined, extra: Partial<Item> = {}, allDay = false): OccurrenceEntry {
  const item = { id, title: id, kind: "EVENT", memberIds: [], showOnCalendar: true, category: "ACTIVITY", ...extra } as unknown as Item;
  return { item, occurrence: { occurrenceKey: `${id}@${start}`, itemId: id, start, end, allDay, originalStart: start } as never };
}

describe("calendar entries", () => {
  it("names weekdays and short dates", () => {
    expect(weekdayCode("2026-10-05")).toBe("MO");
    expect(weekdayCode("2026-10-11")).toBe("SU");
    expect(shortDateVi("2026-10-06")).toBe("6/10/2026");
  });

  it("filters tasks, hidden items and other members but keeps shared items", () => {
    const list = [
      entry("bo", "2026-10-06T07:00", "2026-10-06T08:00", { memberIds: ["m-bo"] }),
      entry("me", "2026-10-06T07:00", "2026-10-06T08:00", { memberIds: ["m-me"] }),
      entry("all", "2026-10-06T09:00", undefined),
      entry("task", "2026-10-06T09:00", undefined, { kind: "TASK" } as Partial<Item>),
      entry("hidden", "2026-10-06T09:00", undefined, { showOnCalendar: false }),
    ];
    expect(calendarEntries(list, "ALL").map((e) => e.item.id)).toEqual(["bo", "me", "all"]);
    expect(calendarEntries(list, ["m-bo"]).map((e) => e.item.id)).toEqual(["bo", "all"]);
  });

  it("puts multi-day events on each day, but not on the day an event ends at midnight", () => {
    const map = entriesByDay(
      [entry("trip", "2026-10-05", "2026-10-07", {}, true), entry("late", "2026-10-06T22:00", "2026-10-07T00:00"), entry("early", "2026-10-06T06:00", "2026-10-06T07:00")],
      "2026-10-05",
      "2026-10-11",
    );
    expect(map.get("2026-10-05")?.map((e) => e.item.id)).toEqual(["trip"]);
    expect(map.get("2026-10-06")?.map((e) => e.item.id)).toEqual(["trip", "early", "late"]);
    expect(map.get("2026-10-07")?.map((e) => e.item.id)).toEqual(["trip"]);
  });

  it("lists upcoming events from now on with a countdown", () => {
    const list = [
      entry("past", "2026-10-06T06:00", "2026-10-06T07:00"),
      entry("later-today", "2026-10-06T19:00", "2026-10-06T20:00"),
      entry("next-week", "2026-10-13T08:00", undefined),
      entry("reminder", "2026-10-07T08:00", undefined, { kind: "REMINDER" } as Partial<Item>),
    ];
    expect(upcomingEvents(list, "2026-10-06", "08:00", 5).map((u) => [u.entry.item.id, u.daysLeft])).toEqual([
      ["later-today", 0],
      ["next-week", 7],
    ]);
  });
});
