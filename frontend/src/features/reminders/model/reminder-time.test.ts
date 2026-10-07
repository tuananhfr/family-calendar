import { describe, expect, it } from "vitest";
import type { Schedule } from "@/core/recurrence/types";
import { reminderTimeLabel } from "./reminder-time";

const base = { timeZone: "Asia/Ho_Chi_Minh" };

describe("reminderTimeLabel", () => {
  it.each<[string, Schedule, string]>([
    ["daily", { ...base, allDay: false, start: "2026-10-06T07:00", rrule: "FREQ=DAILY" }, "07:00"],
    ["weekdays", { ...base, allDay: false, start: "2026-10-06T07:00", rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" }, "07:00"],
    ["yearly all-day", { ...base, allDay: true, start: "2026-10-20", rrule: "FREQ=YEARLY" }, "Cả ngày 20/10"],
    ["monthly", { ...base, allDay: false, start: "2026-10-05T09:00", rrule: "FREQ=MONTHLY" }, "09:00 ngày 5"],
    ["once", { ...base, allDay: false, start: "2026-10-19T09:00" }, "09:00 19/10/2026"],
    ["lunar yearly", { ...base, allDay: true, start: "2027-04-16", lunarRule: { freq: "YEARLY", day: 10, month: 3, includeLeap: false } }, "Cả ngày âm 10/3"],
  ])("%s", (_name, schedule, expected) => {
    expect(reminderTimeLabel(schedule)).toBe(expected);
  });
});
