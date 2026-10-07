import { describe, expect, it } from "vitest";
import { repeatFromSchedule, repeatToRule, type RepeatPreset } from "./repeat-presets";

const TZ = "Asia/Ho_Chi_Minh";

describe("repeatToRule", () => {
  it("NONE has no rule", () => {
    expect(repeatToRule({ kind: "NONE" }, "2026-10-06")).toEqual({ calendarSystem: "SOLAR" });
  });

  it("DAILY", () => {
    expect(repeatToRule({ kind: "DAILY" }, "2026-10-06").rrule).toBe("FREQ=DAILY");
  });

  it("WEEKDAYS → Monday to Friday", () => {
    expect(repeatToRule({ kind: "WEEKDAYS" }, "2026-10-06").rrule).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
  });

  it("WEEKLY defaults to the weekday of the start date", () => {
    expect(repeatToRule({ kind: "WEEKLY" }, "2026-10-06").rrule).toBe("FREQ=WEEKLY;BYDAY=TU");
  });

  it("WEEKLY keeps chosen days in Monday-first order", () => {
    expect(repeatToRule({ kind: "WEEKLY", byDay: ["FR", "MO", "WE"] }, "2026-10-06").rrule).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });

  it("WEEKLY rejects unknown day codes", () => {
    expect(() => repeatToRule({ kind: "WEEKLY", byDay: ["XX"] }, "2026-10-06")).toThrow(RangeError);
  });

  it("MONTHLY and YEARLY pin the start day", () => {
    expect(repeatToRule({ kind: "MONTHLY" }, "2026-10-31").rrule).toBe("FREQ=MONTHLY;BYMONTHDAY=31");
    expect(repeatToRule({ kind: "YEARLY" }, "2026-10-20").rrule).toBe("FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=20");
  });

  it("LUNAR_YEARLY from 2026-10-06 → 26/8 lunar", () => {
    expect(repeatToRule({ kind: "LUNAR_YEARLY" }, "2026-10-06")).toEqual({
      calendarSystem: "LUNAR",
      lunarRule: { freq: "YEARLY", day: 26, month: 8, includeLeap: false },
    });
  });

  it("LUNAR_MONTHLY keeps only the lunar day", () => {
    expect(repeatToRule({ kind: "LUNAR_MONTHLY" }, "2026-10-06")).toEqual({
      calendarSystem: "LUNAR",
      lunarRule: { freq: "MONTHLY", day: 26, includeLeap: false },
    });
  });

  it("CUSTOM passes a valid RRULE body through and rejects an invalid one", () => {
    expect(repeatToRule({ kind: "CUSTOM", rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA" }, "2026-10-06").rrule).toBe(
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA",
    );
    expect(() => repeatToRule({ kind: "CUSTOM", rrule: "NOPE" }, "2026-10-06")).toThrow(RangeError);
    expect(() => repeatToRule({ kind: "CUSTOM" }, "2026-10-06")).toThrow(RangeError);
  });
});

describe("repeatFromSchedule", () => {
  const cases: Array<[RepeatPreset, string]> = [
    [{ kind: "NONE" }, "2026-10-06"],
    [{ kind: "DAILY" }, "2026-10-06"],
    [{ kind: "WEEKDAYS" }, "2026-10-06"],
    [{ kind: "WEEKLY", byDay: ["MO", "WE"] }, "2026-10-05"],
    [{ kind: "MONTHLY" }, "2026-10-31"],
    [{ kind: "YEARLY" }, "2026-10-20"],
    [{ kind: "LUNAR_YEARLY" }, "2026-10-06"],
    [{ kind: "LUNAR_MONTHLY" }, "2026-10-06"],
  ];

  it.each(cases)("round-trips %o", (repeat, date) => {
    const rule = repeatToRule(repeat, date);
    const back = repeatFromSchedule({ allDay: true, start: date, timeZone: TZ, rrule: rule.rrule, lunarRule: rule.lunarRule });
    expect(back).toEqual(repeat);
  });

  it("unknown RRULE shapes come back as CUSTOM", () => {
    expect(repeatFromSchedule({ allDay: true, start: "2026-10-06", timeZone: TZ, rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA" })).toEqual({
      kind: "CUSTOM",
      rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA",
    });
  });
});
