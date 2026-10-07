import { describe, expect, it } from "vitest";
import { itemSchema, type Item } from "@/core/model/item";
import { makeItem, makeMember } from "@/core/test-support/items";
import { copyWeek, rowsToItems } from "./copy-week";
import type { ImportRow } from "./parse-import";

const actorId = "7d1f2c3a-1111-4a2b-8c3d-000000000001";
const bin = makeMember("Bin");
const lesson = (start: string, rrule?: string, overrides: Partial<Item> = {}) =>
  makeItem({
    kind: "EVENT",
    preset: "TIMETABLE",
    category: "STUDY",
    title: "Toán",
    subject: "Toán",
    memberIds: [bin.id],
    schedule: { allDay: false, start, end: `${start.slice(0, 11)}${String(Number(start.slice(11, 13)) + 1).padStart(2, "0")}:00`, timeZone: "Asia/Ho_Chi_Minh", ...(rrule ? { rrule } : {}) },
    ...overrides,
  });

// Week of Mon 05/10/2026 → week of Mon 12/10/2026.
const FROM = "2026-10-05";
const TO = "2026-10-12";

describe("copyWeek", () => {
  it("copies one-off lessons of the source week to the same weekday and time", () => {
    const tue = lesson("2026-10-06T07:00");
    const out = copyWeek([tue], FROM, TO, { actorId, now: new Date("2026-10-07T00:00:00.000Z") });
    expect(out).toHaveLength(1);
    expect(out[0].id).not.toBe(tue.id);
    expect(out[0].schedule).toEqual({ ...tue.schedule, start: "2026-10-13T07:00", end: "2026-10-13T08:00" });
    expect(out[0]).toMatchObject({ title: "Toán", subject: "Toán", memberIds: [bin.id], createdByActorId: actorId, revision: null, syncState: "LOCAL", deletedAt: null });
    expect(itemSchema.safeParse(out[0]).success).toBe(true);
  });

  it("does not touch the originals and never reuses an id", () => {
    const items = [lesson("2026-10-06T07:00"), lesson("2026-10-07T09:00"), lesson("2026-10-08T14:00")];
    const before = structuredClone(items);
    const out = copyWeek(items, FROM, TO, { actorId });
    expect(items).toEqual(before);
    const ids = new Set([...items, ...out].map((i) => i.id));
    expect(ids.size).toBe(6);
  });

  it("a weekly lesson becomes a weekly copy starting in the target week, unless it already repeats there", () => {
    const ended = lesson("2026-09-07T07:00", "FREQ=WEEKLY;BYDAY=MO;UNTIL=20261011T235959");
    const ongoing = lesson("2026-09-08T07:00", "FREQ=WEEKLY;BYDAY=TU");
    const out = copyWeek([ended, ongoing], FROM, TO, { actorId });
    expect(out).toHaveLength(1);
    expect(out[0].schedule).toMatchObject({ start: "2026-10-12T07:00", rrule: "FREQ=WEEKLY;BYDAY=MO" });
  });

  it("copying twice does not duplicate a one-off lesson already in the target week", () => {
    const tue = lesson("2026-10-06T07:00");
    const first = copyWeek([tue], FROM, TO, { actorId });
    expect(copyWeek([tue, ...first], FROM, TO, { actorId })).toEqual([]);
    // A different lesson at the same time is still copied.
    const other = lesson("2026-10-06T07:00", undefined, { title: "Văn", subject: "Văn" });
    expect(copyWeek([tue, other, ...first], FROM, TO, { actorId }).map((i) => i.title)).toEqual(["Văn"]);
  });

  it("skips other presets, other weeks and deleted items", () => {
    const party = makeItem({ title: "Sinh nhật", start: "2026-10-06T18:00" });
    const lastWeek = lesson("2026-09-29T07:00");
    const deleted = lesson("2026-10-06T07:00", undefined, { deletedAt: "2026-10-06T10:00:00.000Z" });
    expect(copyWeek([party, lastWeek, deleted], FROM, TO, { actorId })).toEqual([]);
  });

  it("refuses dates that are not week starts", () => {
    expect(() => copyWeek([], "2026-10-06", TO, { actorId })).toThrow(RangeError);
  });
});

describe("rowsToItems", () => {
  const row = (o: Partial<ImportRow> = {}): ImportRow => ({ line: 2, weekday: 1, start: "07:00", end: "07:45", subject: "Toán", memberName: "Bin", memberId: bin.id, category: "STUDY", ...o });

  it("turns rows into weekly timetable items starting on the row's weekday of the first week", () => {
    const items = rowsToItems([row(), row({ weekday: 7, subject: "Piano", category: "ACTIVITY", start: "09:00", end: "10:00" })], {
      spaceId: "7d1f2c3a-1111-4a2b-8c3d-000000000002",
      actorId,
      timeZone: "Asia/Ho_Chi_Minh",
      weekStart: FROM,
    });
    expect(items.map((i) => [i.title, i.category, i.schedule.start, i.schedule.end, i.schedule.rrule])).toEqual([
      ["Toán", "STUDY", "2026-10-05T07:00", "2026-10-05T07:45", "FREQ=WEEKLY;BYDAY=MO"],
      ["Piano", "ACTIVITY", "2026-10-11T09:00", "2026-10-11T10:00", "FREQ=WEEKLY;BYDAY=SU"],
    ]);
    for (const i of items) {
      expect(itemSchema.safeParse(i).success).toBe(true);
      expect(i).toMatchObject({ kind: "EVENT", preset: "TIMETABLE", memberIds: [bin.id], subject: i.title, showOnCalendar: true, sharingScope: "FAMILY_ALL" });
    }
  });

  it("an end date adds UNTIL", () => {
    const [item] = rowsToItems([row()], { spaceId: "7d1f2c3a-1111-4a2b-8c3d-000000000002", actorId, timeZone: "Asia/Ho_Chi_Minh", weekStart: FROM, until: "2027-05-31" });
    expect(item.schedule.rrule).toBe("FREQ=WEEKLY;BYDAY=MO;UNTIL=20270531T235959");
  });
});
