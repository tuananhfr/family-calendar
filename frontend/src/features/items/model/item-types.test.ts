import { describe, expect, it } from "vitest";
import { formToItem } from "./form-to-item";
import { changeCategory, changeSpecialKind, changeType, formUiErrors, itemTypeOf, newFormValues, nextSlot, validateItemForm } from "./item-types";

const ctx = { date: "2026-10-06", nowTime: "07:20" };
const ids = { spaceId: "22222222-2222-4222-8222-222222222222", actorId: "33333333-3333-4333-8333-333333333333", timeZone: "Asia/Ho_Chi_Minh" };
const member = "11111111-1111-4111-8111-111111111111";

describe("nextSlot", () => {
  it("starts at the next full hour and lasts one hour", () => {
    expect(nextSlot("07:20")).toEqual({ startTime: "08:00", endTime: "09:00" });
    expect(nextSlot("08:00")).toEqual({ startTime: "09:00", endTime: "10:00" });
  });
  it("never runs past the end of the day", () => {
    expect(nextSlot("22:40")).toEqual({ startTime: "22:00", endTime: "23:00" });
    expect(nextSlot("23:59")).toEqual({ startTime: "22:00", endTime: "23:00" });
  });
});

describe("newFormValues", () => {
  it("gives each type a valid starting point that formToItem accepts once titled", () => {
    for (const type of ["EVENT", "TASK", "REMINDER", "SPECIAL"] as const) {
      const v = { ...newFormValues(type, ctx), title: "Thử", memberIds: [member] };
      expect(itemTypeOf(v)).toBe(type);
      expect(() => formToItem(v, ids)).not.toThrow();
    }
  });
  it("special days are all-day, yearly and remind a day before", () => {
    const v = newFormValues("SPECIAL", ctx);
    expect(v).toMatchObject({ kind: "EVENT", preset: "SPECIAL_DAY", category: "SPECIAL", allDay: true, repeat: { kind: "YEARLY" }, createReminder: true, reminderOffsets: [1440] });
  });
  it("reminders always carry a rule and show on the family calendar", () => {
    const v = newFormValues("REMINDER", ctx);
    expect(v).toMatchObject({ kind: "REMINDER", createReminder: true, reminderOffsets: [10], channels: ["IN_APP"], showOnCalendar: true, startTime: "08:00" });
    expect(v.endTime).toBeUndefined();
  });
  it("tasks are due on a day, not at a time", () => {
    const v = newFormValues("TASK", ctx);
    expect(v).toMatchObject({ kind: "TASK", preset: "PERSONAL", allDay: true });
    expect(v.startTime).toBeUndefined();
  });
});

describe("changeCategory", () => {
  it("a health reminder becomes a private, sensitive medication reminder", () => {
    const v = changeCategory(newFormValues("REMINDER", ctx), "HEALTH");
    expect(v).toMatchObject({ preset: "MEDICATION", category: "HEALTH", sharingScope: "PRIVATE" });
    const { item } = formToItem({ ...v, title: "Uống thuốc", memberIds: [member] }, ids);
    expect(item.dataClass).toBe("SENSITIVE");
  });
  it("maps finance and documents to their reminder presets and back to plain reminders", () => {
    const base = newFormValues("REMINDER", ctx);
    expect(changeCategory(base, "FINANCE").preset).toBe("PAYMENT");
    expect(changeCategory(base, "DOCUMENT").preset).toBe("DOCUMENT");
    expect(changeCategory(changeCategory(base, "HEALTH"), "STUDY")).toMatchObject({ preset: "REMEMBER", sharingScope: "FAMILY_ALL" });
  });
  it("shopping tasks use the shopping preset", () => {
    expect(changeCategory(newFormValues("TASK", ctx), "SHOPPING").preset).toBe("SHOPPING");
  });
  it("a health event is a private appointment", () => {
    expect(changeCategory(newFormValues("EVENT", ctx), "HEALTH")).toMatchObject({ preset: "APPOINTMENT", sharingScope: "PRIVATE" });
  });
});

describe("changeType", () => {
  it("keeps what the user typed when switching type", () => {
    const ev = { ...newFormValues("EVENT", ctx), title: "Họp phụ huynh", description: "Lớp 5A", memberIds: ["m2"], date: "2026-10-09" };
    const r = changeType(ev, "REMINDER");
    expect(r).toMatchObject({ kind: "REMINDER", title: "Họp phụ huynh", description: "Lớp 5A", memberIds: ["m2"], date: "2026-10-09", startTime: "08:00" });
  });
  it("keeps a chosen category except when moving into or out of special days", () => {
    const study = changeCategory(newFormValues("EVENT", ctx), "STUDY");
    expect(changeType(study, "TASK").category).toBe("STUDY");
    expect(changeType(study, "SPECIAL").category).toBe("SPECIAL");
    expect(changeType(newFormValues("SPECIAL", ctx), "EVENT").category).toBe("FAMILY");
  });
});

describe("formUiErrors", () => {
  it("a reminder needs at least one person and one channel", () => {
    expect(formUiErrors({ ...newFormValues("REMINDER", ctx), memberIds: [], channels: [] })).toEqual({ memberIds: "MEMBERS_REQUIRED", channels: "CHANNELS_REQUIRED" });
  });
  it("an event without a reminder needs neither", () => {
    expect(formUiErrors({ ...newFormValues("EVENT", ctx), channels: [] })).toEqual({});
  });
});

describe("validateItemForm", () => {
  it("reports schema and form-only problems together so every bad field is marked at once", () => {
    const v = { ...newFormValues("REMINDER", ctx), title: "  ", memberIds: [], startTime: "25:00" };
    expect(validateItemForm(v, "Asia/Ho_Chi_Minh")).toEqual({ title: "TITLE_REQUIRED", startTime: "INVALID_TIME", memberIds: "MEMBERS_REQUIRED" });
  });
  it("end before start is an endTime error", () => {
    const v = { ...newFormValues("EVENT", ctx), title: "Họp", startTime: "09:00", endTime: "08:00" };
    expect(validateItemForm(v, "Asia/Ho_Chi_Minh")).toEqual({ endTime: "END_BEFORE_START" });
  });
  it("a valid form has no errors", () => {
    expect(validateItemForm({ ...newFormValues("EVENT", ctx), title: "Họp" }, "Asia/Ho_Chi_Minh")).toEqual({});
  });
});

describe("changeSpecialKind", () => {
  it("a giỗ switches to the lunar calendar, a birthday keeps what was chosen", () => {
    const base = newFormValues("SPECIAL", ctx);
    expect(changeSpecialKind(base, "DEATH_ANNIVERSARY")).toMatchObject({ preset: "DEATH_ANNIVERSARY", calendarSystem: "LUNAR" });
    expect(changeSpecialKind(base, "BIRTHDAY")).toMatchObject({ preset: "BIRTHDAY", calendarSystem: "SOLAR" });
    expect(itemTypeOf(changeSpecialKind(base, "HOLIDAY"))).toBe("SPECIAL");
  });
});
