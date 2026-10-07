import { describe, expect, it } from "vitest";
import type { Item } from "@/core/model/item";
import { makeItem, makeMember, occurrenceOf } from "@/core/test-support/items";
import { weeklyHoursByMember } from "./timetable-report";

const bin = makeMember("Bin");
const na = makeMember("Na");
const lesson = (start: string, end: string, memberIds: string[], category: Item["category"] = "STUDY") =>
  makeItem({ kind: "EVENT", preset: "TIMETABLE", category, title: "Môn", memberIds, start, end });

describe("weeklyHoursByMember", () => {
  it("adds study and activity hours of the week per member", () => {
    const items = [
      lesson("2026-10-05T07:00", "2026-10-05T08:30", [bin.id]),
      lesson("2026-10-06T07:00", "2026-10-06T07:45", [bin.id]),
      lesson("2026-10-07T17:00", "2026-10-07T18:00", [bin.id, na.id], "ACTIVITY"),
      lesson("2026-10-12T07:00", "2026-10-12T08:00", [bin.id]),
    ];
    const occs = items.map((i) => occurrenceOf(i, i.schedule.start, i.schedule.end));
    expect(weeklyHoursByMember(occs, items, "2026-10-05")).toEqual([
      { memberId: bin.id, study: 2.25, activity: 1 },
      { memberId: na.id, study: 0, activity: 1 },
    ]);
  });

  it("ignores non-timetable items, all-day entries and deleted items", () => {
    const party = makeItem({ title: "Sinh nhật", start: "2026-10-06T18:00", end: "2026-10-06T20:00", memberIds: [bin.id] });
    const allDay = makeItem({ kind: "EVENT", preset: "TIMETABLE", category: "STUDY", start: "2026-10-06", memberIds: [bin.id] });
    const gone = { ...lesson("2026-10-06T07:00", "2026-10-06T08:00", [bin.id]), deletedAt: "2026-10-06T09:00:00.000Z" };
    const items = [party, allDay, gone];
    expect(weeklyHoursByMember(items.map((i) => occurrenceOf(i, i.schedule.start, i.schedule.end)), items, "2026-10-05")).toEqual([]);
  });
});
