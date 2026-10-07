import { describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import type { Item } from "@/core/model/item";
import type { Member } from "@/core/model/member";
import { occurrenceKey } from "@/core/recurrence/occurrence-key";
import type { Occurrence } from "@/core/recurrence/types";
import { baseFields } from "@/core/test-support/records";
import { allDayOf, columnsFor, layoutDay, type DayEntry } from "./day-layout";

const OPTS = { startHour: 6, endHour: 21, pxPerHour: 60 };

function entry(start: string, end: string | undefined, memberIds: string[] = [], title = "Sự kiện"): DayEntry {
  const id = newId();
  const allDay = start.length === 10;
  const item = {
    ...baseFields({ id }),
    kind: "EVENT",
    preset: "EVENT",
    title,
    schedule: { allDay, start, end, timeZone: "Asia/Ho_Chi_Minh" },
    memberIds,
    category: "FAMILY",
    priority: "MEDIUM",
    attachments: [],
    showOnCalendar: true,
    calendarSystem: "SOLAR",
  } as Item;
  const occurrence: Occurrence = { itemId: id, occurrenceKey: occurrenceKey(id, start), start, allDay, overridden: false };
  if (end) occurrence.end = end;
  return { occurrence, item };
}

function member(name: string): Member {
  return {
    ...baseFields(),
    displayName: name,
    relationship: "OTHER",
    profile: "PARENT",
    interests: [],
    status: "ACTIVE",
  } as Member;
}

describe("layoutDay", () => {
  it("places 06:30–07:00 proportionally from the grid start", () => {
    const [b] = layoutDay([entry("2026-10-06T06:30", "2026-10-06T07:00")], OPTS);
    expect(b).toMatchObject({ top: 30, height: 30, lane: 0, lanes: 1 });
  });

  it("puts two overlapping events in two lanes that don't overlap", () => {
    const blocks = layoutDay([entry("2026-10-06T08:00", "2026-10-06T09:30"), entry("2026-10-06T09:00", "2026-10-06T10:00")], OPTS);
    expect(blocks.map((b) => [b.lane, b.lanes])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });

  it("reuses a lane once the earlier event has ended and keeps separate clusters independent", () => {
    const blocks = layoutDay(
      [
        entry("2026-10-06T08:00", "2026-10-06T09:00"),
        entry("2026-10-06T08:30", "2026-10-06T10:00"),
        entry("2026-10-06T09:00", "2026-10-06T09:30"),
        entry("2026-10-06T14:00", "2026-10-06T15:00"),
      ],
      OPTS,
    );
    expect(blocks.map((b) => [b.lane, b.lanes])).toEqual([
      [0, 2],
      [1, 2],
      [0, 2],
      [0, 1],
    ]);
  });

  it("keeps all-day events out of the hour grid", () => {
    const all = [entry("2026-10-06", undefined), entry("2026-10-06T08:00", "2026-10-06T09:00")];
    expect(layoutDay(all, OPTS)).toHaveLength(1);
    expect(allDayOf(all)).toHaveLength(1);
  });

  it("gives events without an end a minimum height and clips to the visible hours", () => {
    const [noEnd, early] = layoutDay([entry("2026-10-06T07:00", undefined), entry("2026-10-06T05:00", "2026-10-06T06:30")], OPTS);
    expect(noEnd).toMatchObject({ top: 60, height: 30 });
    expect(early).toMatchObject({ top: 0, height: 30 });
    expect(layoutDay([entry("2026-10-06T22:00", "2026-10-06T23:00")], OPTS)).toEqual([]);
  });

  it("clips an overnight event to the requested day", () => {
    const [b] = layoutDay([entry("2026-10-05T20:00", "2026-10-06T07:00")], { ...OPTS, date: "2026-10-06" });
    expect(b).toMatchObject({ top: 0, height: 60 });
  });
});

describe("columnsFor", () => {
  const bo = member("Bố");
  const me = member("Mẹ");
  const an = member("Bé An");

  it("spans an event of two adjacent members over both columns (Ăn trưa cùng gia đình)", () => {
    const lunch = entry("2026-10-06T11:30", "2026-10-06T12:30", [bo.id, me.id], "Ăn trưa cùng gia đình");
    const cols = columnsFor([bo, me, an], [lunch], "ALL", OPTS);
    expect(cols.map((c) => (c.member === "SHARED" ? "SHARED" : c.member.displayName))).toEqual(["Bố", "Mẹ", "Bé An"]);
    expect(cols[0].blocks).toHaveLength(1);
    expect(cols[0].blocks[0].span).toBe(2);
    expect(cols[1].blocks).toHaveLength(0);
    expect(cols[2].blocks).toHaveLength(0);
  });

  it("does not span when another event in a covered column overlaps; each column gets its own block", () => {
    const lunch = entry("2026-10-06T11:30", "2026-10-06T12:30", [bo.id, me.id]);
    const call = entry("2026-10-06T12:00", "2026-10-06T12:15", [me.id]);
    const cols = columnsFor([bo, me], [lunch, call], "ALL", OPTS);
    expect(cols[0].blocks.map((b) => b.span)).toEqual([1]);
    expect(cols[1].blocks.map((b) => [b.span, b.lanes])).toEqual([
      [1, 2],
      [1, 2],
    ]);
  });

  it("splits non-adjacent members into separate blocks", () => {
    const e = entry("2026-10-06T08:00", "2026-10-06T09:00", [bo.id, an.id]);
    const cols = columnsFor([bo, me, an], [e], "ALL", OPTS);
    expect(cols.map((c) => c.blocks.length)).toEqual([1, 0, 1]);
  });

  it("adds a shared column for events without members, only when showing everyone", () => {
    const e = entry("2026-10-06T08:00", "2026-10-06T09:00", []);
    expect(columnsFor([bo], [e], "ALL", OPTS).map((c) => c.member === "SHARED")).toEqual([false, true]);
    expect(columnsFor([bo], [e], [bo.id], OPTS).map((c) => c.member === "SHARED")).toEqual([false]);
  });

  it("member filter hides other people's columns and events", () => {
    const e = entry("2026-10-06T08:00", "2026-10-06T09:00", [an.id]);
    const cols = columnsFor([bo, me, an], [e], [bo.id, me.id], OPTS);
    expect(cols).toHaveLength(2);
    expect(cols.flatMap((c) => c.blocks)).toEqual([]);
  });

  it("drops archived members", () => {
    const old = { ...me, status: "ARCHIVED" } as Member;
    expect(columnsFor([bo, old], [], "ALL", OPTS)).toHaveLength(1);
  });
});
