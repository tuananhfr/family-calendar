import { describe, expect, it } from "vitest";
import { lunarToSolar } from "@/core/lunar/lunar";
import { makeItem } from "@/core/test-support/items";
import { countdownLabel, daysUntil, documentReminderDates, specialDayCountdown } from "./countdown";

describe("daysUntil / countdownLabel", () => {
  it("counts calendar days", () => {
    expect(daysUntil("2026-10-20", "2026-10-06")).toBe(14);
    expect(daysUntil("2026-10-06", "2026-10-06")).toBe(0);
    expect(daysUntil("2027-01-01", "2026-12-31")).toBe(1);
  });

  it("labels", () => {
    expect(countdownLabel(0)).toBe("Hôm nay");
    expect(countdownLabel(1)).toBe("Ngày mai");
    expect(countdownLabel(14)).toBe("Còn 14 ngày");
  });
});

describe("documentReminderDates", () => {
  it("6M/3M are calendar months clamped to month end, days are plain days", () => {
    expect(documentReminderDates("2027-08-31", ["6M", "3M", "30D"])).toEqual(["2027-02-28", "2027-05-31", "2027-08-01"]);
  });

  it("supports 7D, 1D and custom day counts", () => {
    expect(documentReminderDates("2027-03-01", ["7D", "1D", { days: 45 }])).toEqual(["2027-02-22", "2027-02-28", "2027-01-15"]);
  });

  it("rejects a negative custom offset", () => {
    expect(() => documentReminderDates("2027-03-01", [{ days: -1 }])).toThrow(RangeError);
  });
});

describe("specialDayCountdown", () => {
  const today = "2026-10-06";

  it("lunar death anniversary 10/3 counts down to its solar date in 2027", () => {
    const gio = makeItem({
      kind: "EVENT",
      preset: "DEATH_ANNIVERSARY",
      category: "SPECIAL",
      calendarSystem: "LUNAR",
      title: "Giỗ ông",
      schedule: { allDay: true, start: "2026-04-26", timeZone: "Asia/Ho_Chi_Minh", lunarRule: { freq: "YEARLY", day: 10, month: 3, includeLeap: false } },
    });
    const expected = lunarToSolar({ day: 10, month: 3, year: 2027, leap: false })!;
    expect(specialDayCountdown(gio, today)).toEqual({
      date: expected,
      daysLeft: daysUntil(expected, today),
      label: `Còn ${daysUntil(expected, today)} ngày`,
      lunarNote: "(âm 10/3)",
    });
  });

  it("a 29/02 birthday shows 28/02 in a non-leap year", () => {
    const bd = makeItem({
      kind: "EVENT",
      preset: "BIRTHDAY",
      category: "SPECIAL",
      title: "Sinh nhật Minh",
      schedule: { allDay: true, start: "2016-02-29", timeZone: "Asia/Ho_Chi_Minh", rrule: "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29" },
    });
    expect(specialDayCountdown(bd, today)?.date).toBe("2027-02-28");
    expect(specialDayCountdown(bd, "2027-03-01")?.date).toBe("2028-02-29");
  });

  it("a yearly day that is today counts as 0", () => {
    const bd = makeItem({
      kind: "EVENT",
      preset: "BIRTHDAY",
      category: "SPECIAL",
      schedule: { allDay: true, start: "2000-10-06", timeZone: "Asia/Ho_Chi_Minh", rrule: "FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=6" },
    });
    expect(specialDayCountdown(bd, today)).toMatchObject({ date: "2026-10-06", daysLeft: 0, label: "Hôm nay" });
  });

  it("a one-off special day in the past has no countdown", () => {
    const once = makeItem({ kind: "EVENT", preset: "SPECIAL_DAY", category: "SPECIAL", start: "2026-01-01" });
    expect(specialDayCountdown(once, today)).toBeNull();
    const future = makeItem({ kind: "EVENT", preset: "SPECIAL_DAY", category: "SPECIAL", start: "2026-10-07" });
    expect(specialDayCountdown(future, today)).toMatchObject({ daysLeft: 1, label: "Ngày mai" });
  });

  it("a series that has not started yet counts to its first date", () => {
    const later = makeItem({
      kind: "EVENT",
      preset: "ANNIVERSARY",
      category: "SPECIAL",
      schedule: { allDay: true, start: "2027-05-01", timeZone: "Asia/Ho_Chi_Minh", rrule: "FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=1" },
    });
    expect(specialDayCountdown(later, today)?.date).toBe("2027-05-01");
  });
});
