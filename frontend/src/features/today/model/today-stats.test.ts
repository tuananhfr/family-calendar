import { describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import type { ItemKind, Preset } from "@/core/model/common";
import type { Item } from "@/core/model/item";
import type { OccurrenceState } from "@/core/model/occurrence";
import { occurrenceKey } from "@/core/recurrence/occurrence-key";
import { baseFields } from "@/core/test-support/records";
import type { DayEntry } from "./day-layout";
import { computeTodayStats } from "./today-stats";

const TODAY = "2026-10-06";
const states: OccurrenceState[] = [];

function e(kind: ItemKind, preset: Preset, start: string, title = "x", status?: OccurrenceState["status"]): DayEntry {
  const id = newId();
  const item = {
    ...baseFields({ id }),
    kind,
    preset,
    title,
    schedule: { allDay: start.length === 10, start, timeZone: "Asia/Ho_Chi_Minh" },
    memberIds: [],
    category: "OTHER",
    priority: "MEDIUM",
    attachments: [],
    showOnCalendar: true,
    calendarSystem: "SOLAR",
  } as Item;
  const key = occurrenceKey(id, start);
  if (status) {
    states.push({
      ...baseFields(),
      itemId: id,
      occurrenceKey: key,
      status,
      actedAt: "2026-10-06T01:00:00.000Z",
      actedByActorId: newId(),
    } as OccurrenceState);
  }
  return { item, occurrence: { itemId: id, occurrenceKey: key, start, allDay: start.length === 10, overridden: false } };
}

const occurrences: DayEntry[] = [
  e("TASK", "HOUSEWORK", TODAY, "Dọn nhà"),
  e("TASK", "SHOPPING", "2026-10-06T17:00", "Đi chợ", "DONE"),
  e("TASK", "PERSONAL", TODAY, "Bỏ qua", "SKIPPED"),
  e("TASK", "PERSONAL", "2026-10-07", "Mai"),
  e("EVENT", "TIMETABLE", "2026-10-06T07:00", "Toán"),
  e("EVENT", "APPOINTMENT", "2026-10-06T09:00", "Khám răng"),
  e("EVENT", "BIRTHDAY", TODAY, "Sinh nhật Bà"),
  e("EVENT", "ANNIVERSARY", "2026-10-20", "Kỷ niệm cưới"),
  e("EVENT", "DEATH_ANNIVERSARY", "2026-11-15", "Giỗ ông"),
  e("REMINDER", "MEDICATION", "2026-10-06T07:00", "Thuốc sáng", "DONE"),
  e("REMINDER", "MEDICATION", "2026-10-06T19:00", "Thuốc tối"),
  e("REMINDER", "MEDICATION", "2026-10-07T07:00", "Thuốc mai"),
  e("REMINDER", "DOCUMENT", "2026-10-20", "CCCD"),
  e("REMINDER", "DOCUMENT", "2027-08-31", "Hộ chiếu"),
  e("REMINDER", "DOCUMENT", "2026-10-01", "Bằng lái quá hạn"),
  e("REMINDER", "PAYMENT", "2026-10-06T09:00", "Tiền điện"),
  e("REMINDER", "PAYMENT", "2026-10-05T09:00", "Tiền nước", "DONE"),
  e("REMINDER", "PAYMENT", "2026-10-03T09:00", "Học phí"),
];

describe("computeTodayStats", () => {
  const stats = computeTodayStats({ occurrences, states }, TODAY);

  it("counts today's tasks without skipped ones, and how many are done", () => {
    expect(stats.tasksToday).toBe(2);
    expect(stats.tasksDoneToday).toBe(1);
  });

  it("counts today's timed schedules but not special days", () => {
    expect(stats.schedules).toBe(2);
  });

  it("counts special days in the next 30 days and names the nearest", () => {
    expect(stats.specialDays).toEqual({ count: 2, firstLabel: "Sinh nhật Bà", firstDaysLeft: 0 });
  });

  it("counts all of today's medication occurrences", () => {
    expect(stats.medication).toBe(2);
  });

  it("counts documents due within 30 days plus overdue unfinished ones", () => {
    expect(stats.documentsDue).toBe(2);
  });

  it("counts unpaid payments due today or earlier", () => {
    expect(stats.expensesToLog).toBe(2);
  });

  it("is all zero without data", () => {
    expect(computeTodayStats({ occurrences: [], states: [] }, TODAY)).toEqual({
      tasksToday: 0,
      tasksDoneToday: 0,
      schedules: 0,
      specialDays: { count: 0 },
      medication: 0,
      documentsDue: 0,
      expensesToLog: 0,
    });
  });
});
