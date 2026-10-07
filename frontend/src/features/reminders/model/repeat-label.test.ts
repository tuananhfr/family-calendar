import { describe, expect, it } from "vitest";
import type { Schedule } from "@/core/recurrence/types";
import { repeatLabel } from "./repeat-label";

const base = { allDay: false, start: "2026-10-05T07:00", timeZone: "Asia/Ho_Chi_Minh" };
const s = (extra: Partial<Schedule>): Schedule => ({ ...base, ...extra });

describe("repeatLabel", () => {
  it.each([
    [s({ rrule: "FREQ=DAILY" }), "Hằng ngày"],
    [s({ rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" }), "Hằng ngày (T2–T6)"],
    [s({ rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR" }), "Thứ 2,4,6"],
    [s({ rrule: "FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=5" }), "Hằng năm"],
    [s({}), "Chỉ một lần"],
    [s({ lunarRule: { freq: "YEARLY", day: 10, month: 3, includeLeap: false } }), "Hằng năm (âm lịch)"],
  ])("plan case %#", (schedule, label) => {
    expect(repeatLabel(schedule)).toBe(label);
  });

  it.each([
    [s({ rrule: "FREQ=WEEKLY;BYDAY=SA,SU" }), "Thứ 7, Chủ nhật"],
    [s({ rrule: "FREQ=WEEKLY;BYDAY=SU" }), "Chủ nhật hằng tuần"],
    [s({ rrule: "FREQ=WEEKLY;BYDAY=TU" }), "Thứ 3 hằng tuần"],
    [s({ rrule: "FREQ=MONTHLY;BYMONTHDAY=15" }), "Hằng tháng (ngày 15)"],
    [s({ lunarRule: { freq: "MONTHLY", day: 15, includeLeap: false } }), "Hằng tháng (âm lịch, ngày 15)"],
    [s({ rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA" }), "Tùy chỉnh"],
    [s({ rrule: "FREQ=DAILY;UNTIL=20261231T235959" }), "Hằng ngày"],
  ])("more shapes %#", (schedule, label) => {
    expect(repeatLabel(schedule)).toBe(label);
  });
});
