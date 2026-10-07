import { describe, expect, it } from "vitest";
import { withProcessTimeZone } from "../test-support/process-tz";
import { expandOccurrences } from "./expand";
import type { ItemException, Schedule } from "./types";

const VN = "Asia/Ho_Chi_Minh";

describe("expandOccurrences — RRULE in floating mode", () => {
  it("weekly MO,WE over two weeks gives 4 occurrences with stable keys", () => {
    const schedule: Schedule = {
      allDay: false,
      start: "2026-10-05T07:00",
      end: "2026-10-05T08:30",
      timeZone: VN,
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE",
    };
    const occ = expandOccurrences("item-1", schedule, { from: "2026-10-05", to: "2026-10-18" });
    expect(occ.map((o) => o.start)).toEqual([
      "2026-10-05T07:00",
      "2026-10-07T07:00",
      "2026-10-12T07:00",
      "2026-10-14T07:00",
    ]);
    expect(occ.map((o) => o.end)).toEqual([
      "2026-10-05T08:30",
      "2026-10-07T08:30",
      "2026-10-12T08:30",
      "2026-10-14T08:30",
    ]);
    expect(occ[2]).toEqual({
      itemId: "item-1",
      occurrenceKey: "item-1@2026-10-12T07:00",
      start: "2026-10-12T07:00",
      end: "2026-10-12T08:30",
      allDay: false,
      overridden: false,
    });
    expect(expandOccurrences("item-1", schedule, { from: "2026-10-05", to: "2026-10-18" })).toEqual(occ);
  });

  it("monthly on day 31 skips months without a 31st instead of moving the date", () => {
    const schedule: Schedule = { allDay: true, start: "2026-01-31", timeZone: VN, rrule: "FREQ=MONTHLY;BYMONTHDAY=31" };
    const occ = expandOccurrences("bill", schedule, { from: "2026-01-01", to: "2026-12-31" });
    expect(occ.map((o) => o.start)).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
      "2026-07-31",
      "2026-08-31",
      "2026-10-31",
      "2026-12-31",
    ]);
  });

  it("does not return occurrences before DTSTART or after UNTIL/COUNT", () => {
    const counted: Schedule = { allDay: true, start: "2026-10-10", timeZone: VN, rrule: "FREQ=DAILY;COUNT=3" };
    expect(expandOccurrences("c", counted, { from: "2026-10-01", to: "2026-10-31" }).map((o) => o.start)).toEqual([
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
    ]);
    const until: Schedule = { allDay: false, start: "2026-10-10T20:00", timeZone: VN, rrule: "FREQ=DAILY;UNTIL=20261012T235959" };
    expect(expandOccurrences("u", until, { from: "2026-10-01", to: "2026-10-31" }).map((o) => o.start)).toEqual([
      "2026-10-10T20:00",
      "2026-10-11T20:00",
      "2026-10-12T20:00",
    ]);
  });

  it.each(["Asia/Ho_Chi_Minh", "America/Los_Angeles", "Pacific/Kiritimati"])(
    "all-day yearly on 10-20 never shifts a day when the machine zone is %s",
    (tz) => {
      withProcessTimeZone(tz, () => {
        const schedule: Schedule = { allDay: true, start: "2026-10-20", timeZone: VN, rrule: "FREQ=YEARLY" };
        const occ = expandOccurrences("bd", schedule, { from: "2026-01-01", to: "2030-12-31" });
        expect(occ.map((o) => o.start)).toEqual(["2026-10-20", "2027-10-20", "2028-10-20", "2029-10-20", "2030-10-20"]);
        expect(occ.every((o) => o.allDay && o.end === undefined)).toBe(true);
      });
    },
  );

  it.each(["Asia/Ho_Chi_Minh", "America/Los_Angeles", "Pacific/Kiritimati"])(
    "daily 09:00 in America/New_York keeps 09:00 local across the 2026-11-01 DST change (machine zone %s)",
    (tz) => {
      withProcessTimeZone(tz, () => {
        const schedule: Schedule = { allDay: false, start: "2026-10-30T09:00", timeZone: "America/New_York", rrule: "FREQ=DAILY" };
        const occ = expandOccurrences("med", schedule, { from: "2026-10-30", to: "2026-11-03" });
        expect(occ.map((o) => o.start)).toEqual([
          "2026-10-30T09:00",
          "2026-10-31T09:00",
          "2026-11-01T09:00",
          "2026-11-02T09:00",
          "2026-11-03T09:00",
        ]);
      });
    },
  );

  it("returns a single occurrence for a non-recurring item that overlaps the window", () => {
    const multiDay: Schedule = { allDay: true, start: "2026-10-03", end: "2026-10-06", timeZone: VN };
    const occ = expandOccurrences("trip", multiDay, { from: "2026-10-05", to: "2026-10-11" });
    expect(occ).toEqual([
      { itemId: "trip", occurrenceKey: "trip@2026-10-03", start: "2026-10-03", end: "2026-10-06", allDay: true, overridden: false },
    ]);
    expect(expandOccurrences("trip", multiDay, { from: "2026-10-07", to: "2026-10-11" })).toEqual([]);
  });

  it("CANCEL removes exactly one occurrence; OVERRIDE moves Friday to Saturday keeping Friday's key", () => {
    const schedule: Schedule = { allDay: false, start: "2026-10-02T18:00", end: "2026-10-02T19:00", timeZone: VN, rrule: "FREQ=WEEKLY;BYDAY=FR" };
    const exceptions: ItemException[] = [
      { id: "x1", itemId: "club", occurrenceKey: "club@2026-10-09T18:00", kind: "CANCEL" },
      {
        id: "x2",
        itemId: "club",
        occurrenceKey: "club@2026-10-16T18:00",
        kind: "OVERRIDE",
        override: { start: "2026-10-17T09:00", end: "2026-10-17T10:00", title: "Học bù" },
      },
    ];
    const occ = expandOccurrences("club", schedule, { from: "2026-10-01", to: "2026-10-31" }, exceptions);
    expect(occ.map((o) => o.occurrenceKey)).toEqual([
      "club@2026-10-02T18:00",
      "club@2026-10-16T18:00",
      "club@2026-10-23T18:00",
      "club@2026-10-30T18:00",
    ]);
    const moved = occ[1];
    expect(moved).toMatchObject({ start: "2026-10-17T09:00", end: "2026-10-17T10:00", overridden: true, title: "Học bù" });
  });

  it("an override moved into the window from outside appears once; one moved out disappears", () => {
    const schedule: Schedule = { allDay: true, start: "2026-10-02", timeZone: VN, rrule: "FREQ=WEEKLY" };
    const exceptions: ItemException[] = [
      { id: "a", itemId: "w", occurrenceKey: "w@2026-10-09", kind: "OVERRIDE", override: { start: "2026-10-12" } },
      { id: "b", itemId: "w", occurrenceKey: "w@2026-10-16", kind: "OVERRIDE", override: { start: "2026-10-25" } },
    ];
    const occ = expandOccurrences("w", schedule, { from: "2026-10-10", to: "2026-10-20" }, exceptions);
    expect(occ.map((o) => [o.occurrenceKey, o.start])).toEqual([["w@2026-10-09", "2026-10-12"]]);
  });

  it("an override for a key that is not part of the series is ignored", () => {
    const schedule: Schedule = { allDay: true, start: "2026-10-02", timeZone: VN, rrule: "FREQ=WEEKLY" };
    const exceptions: ItemException[] = [
      { id: "a", itemId: "w", occurrenceKey: "w@2026-10-10", kind: "OVERRIDE", override: { start: "2026-10-12" } },
    ];
    const occ = expandOccurrences("w", schedule, { from: "2026-10-10", to: "2026-10-14" }, exceptions);
    expect(occ).toEqual([]);
  });

  it("caps an unbounded rule at maxCount instead of hanging", () => {
    const schedule: Schedule = { allDay: false, start: "2026-01-01T08:00", timeZone: VN, rrule: "FREQ=DAILY" };
    const started = Date.now();
    const occ = expandOccurrences("daily", schedule, { from: "2026-01-01", to: "2035-12-31" });
    expect(occ).toHaveLength(1000);
    expect(expandOccurrences("daily", schedule, { from: "2026-01-01", to: "2035-12-31" }, [], 50)).toHaveLength(50);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("rejects an invalid RRULE with a clear error", () => {
    const schedule: Schedule = { allDay: true, start: "2026-01-01", timeZone: VN, rrule: "FREQ=SOMETIMES" };
    expect(() => expandOccurrences("bad", schedule, { from: "2026-01-01", to: "2026-01-31" })).toThrow();
  });
});
