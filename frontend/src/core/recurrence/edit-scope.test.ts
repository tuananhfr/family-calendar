import { describe, expect, it } from "vitest";
import { expandOccurrences } from "./expand";
import { makeCancelException, makeOverrideException, splitSeriesAt } from "./edit-scope";
import type { Schedule } from "./types";

const VN = "Asia/Ho_Chi_Minh";
const WINDOW = { from: "2026-10-01", to: "2026-12-31" };

describe("splitSeriesAt", () => {
  it("splitting a weekly series at the 3rd occurrence leaves 2 in head and starts tail on the 3rd", () => {
    const schedule: Schedule = {
      allDay: false,
      start: "2026-10-05T07:00",
      end: "2026-10-05T08:00",
      timeZone: VN,
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261231T235959",
    };
    const before = expandOccurrences("tkb", schedule, WINDOW);
    const third = before[2].start;
    expect(third).toBe("2026-10-12T07:00");

    const { head, tail } = splitSeriesAt(schedule, third);
    const headOcc = expandOccurrences("tkb", head, WINDOW);
    expect(headOcc.map((o) => o.occurrenceKey)).toEqual(before.slice(0, 2).map((o) => o.occurrenceKey));
    expect(head.rrule).toBe("FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261011T235959");

    expect(tail.start).toBe("2026-10-12T07:00");
    expect(tail.end).toBe("2026-10-12T08:00");
    const tailOcc = expandOccurrences("tkb-2", tail, WINDOW);
    expect(tailOcc.map((o) => o.start)).toEqual(before.slice(2).map((o) => o.start));
  });

  it("splits a COUNT-bounded series so head + tail keep the same total", () => {
    const schedule: Schedule = { allDay: true, start: "2026-10-01", timeZone: VN, rrule: "FREQ=DAILY;COUNT=10" };
    const { head, tail } = splitSeriesAt(schedule, "2026-10-04");
    expect(head.rrule).toBe("FREQ=DAILY;UNTIL=20261003");
    expect(tail.rrule).toBe("FREQ=DAILY;COUNT=7");
    expect(expandOccurrences("a", head, WINDOW)).toHaveLength(3);
    expect(expandOccurrences("b", tail, WINDOW).map((o) => o.start)[0]).toBe("2026-10-04");
    expect(expandOccurrences("b", tail, WINDOW)).toHaveLength(7);
  });

  it("splits a lunar rule with an until on the head", () => {
    const schedule: Schedule = {
      allDay: true,
      start: "2026-01-01",
      timeZone: VN,
      lunarRule: { freq: "MONTHLY", day: 15, includeLeap: false },
    };
    const occ = expandOccurrences("ram", schedule, { from: "2026-01-01", to: "2026-12-31" });
    const { head, tail } = splitSeriesAt(schedule, occ[3].start);
    expect(expandOccurrences("ram", head, { from: "2026-01-01", to: "2026-12-31" })).toEqual(occ.slice(0, 3));
    expect(tail.start).toBe(occ[3].start);
    expect(tail.lunarRule?.until).toBeUndefined();
    expect(expandOccurrences("ram-2", tail, { from: "2026-01-01", to: "2026-12-31" }).map((o) => o.start)).toEqual(
      occ.slice(3).map((o) => o.start),
    );
  });

  it("refuses to split a non-recurring schedule", () => {
    expect(() => splitSeriesAt({ allDay: true, start: "2026-10-01", timeZone: VN }, "2026-10-01")).toThrow();
  });
});

describe("exception helpers", () => {
  it("builds cancel and override exceptions bound to the original occurrence key", () => {
    const cancel = makeCancelException("item", "2026-10-09T18:00");
    expect(cancel).toMatchObject({ itemId: "item", occurrenceKey: "item@2026-10-09T18:00", kind: "CANCEL" });
    expect(cancel.id).toMatch(/^[0-9a-f-]{36}$/);
    const override = makeOverrideException("item", "2026-10-16T18:00", { start: "2026-10-17T09:00" });
    expect(override).toMatchObject({ occurrenceKey: "item@2026-10-16T18:00", kind: "OVERRIDE", override: { start: "2026-10-17T09:00" } });
  });
});
