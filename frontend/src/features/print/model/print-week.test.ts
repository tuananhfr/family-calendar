import { expect, it } from "vitest";
import type { Item } from "@/core/model/item";
import type { Occurrence } from "@/core/recurrence/types";
import { printWeek } from "./print-week";

const item = (over: Partial<Item>): Item =>
  ({ id: "i", title: "Họp", memberIds: [], sharingScope: "FAMILY_ALL", dataClass: "NORMAL", category: "FAMILY", preset: "EVENT", ...over }) as Item;
const occ = (key: string, start: string, end?: string, allDay = false): Occurrence => ({ itemId: "i", occurrenceKey: key, start, end, allDay, overridden: false });

const days = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];

it("groups by day, all-day first, and leaves health items out", () => {
  const map = printWeek(
    [
      { item: item({ title: "Bơi" }), occurrence: occ("a", "2026-10-06T17:00", "2026-10-06T18:00") },
      { item: item({ title: "Nghỉ lễ" }), occurrence: occ("b", "2026-10-06", undefined, true) },
      { item: item({ title: "Amlodipin", preset: "MEDICATION", category: "HEALTH" }), occurrence: occ("c", "2026-10-06T07:00") },
      { item: item({ title: "Du lịch" }), occurrence: occ("d", "2026-10-03", "2026-10-06", true) },
    ],
    days,
  );
  expect(map.get("2026-10-06")!.map((r) => [r.title, r.time, r.endTime])).toEqual([
    ["Nghỉ lễ", null, null],
    ["Bơi", "17:00", "18:00"],
  ]);
  expect(map.get("2026-10-05")!.map((r) => r.title)).toEqual(["Du lịch"]);
  expect([...map.values()].flat().some((r) => r.title === "Amlodipin")).toBe(false);
});
