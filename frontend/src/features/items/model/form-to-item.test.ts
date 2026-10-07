import { describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import { itemSchema } from "@/core/model/item";
import { checklistItemSchema } from "@/core/model/occurrence";
import { reminderRuleSchema } from "@/core/model/reminder-rule";
import { ItemFormError, formToItem, itemToForm, type ItemFormValues } from "./form-to-item";

const spaceId = newId();
const actorId = newId();
const bo = newId();
const me = newId();
const ctx = { spaceId, actorId, timeZone: "Asia/Ho_Chi_Minh" };

function values(overrides: Partial<ItemFormValues> = {}): ItemFormValues {
  return {
    kind: "EVENT",
    preset: "APPOINTMENT",
    category: "FAMILY",
    title: "Họp phụ huynh",
    allDay: false,
    date: "2026-10-08",
    startTime: "08:00",
    endTime: "09:00",
    repeat: { kind: "NONE" },
    memberIds: [me],
    checklist: [],
    createReminder: false,
    reminderOffsets: [],
    channels: ["IN_APP"],
    showOnCalendar: true,
    calendarSystem: "SOLAR",
    attachments: [],
    sharingScope: "FAMILY_ALL",
    ...overrides,
  };
}

function fieldsOf(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (e) {
    if (e instanceof ItemFormError) return e.fields;
    throw e;
  }
  throw new Error("expected ItemFormError");
}

describe("formToItem", () => {
  it("builds a valid timed event with no reminder rule", () => {
    const { item, rule, checklistItems } = formToItem(values(), ctx);
    expect(itemSchema.safeParse(item).success).toBe(true);
    expect(item.schedule).toEqual({ allDay: false, start: "2026-10-08T08:00", end: "2026-10-08T09:00", timeZone: "Asia/Ho_Chi_Minh" });
    expect(item).toMatchObject({ spaceId, createdByActorId: actorId, dataClass: "NORMAL", syncState: "LOCAL", revision: null });
    expect(rule).toBeUndefined();
    expect(checklistItems).toEqual([]);
  });

  it("medication reminder → SENSITIVE, PRIVATE, rule with the chosen channels", () => {
    const { item, rule } = formToItem(
      values({
        kind: "REMINDER",
        preset: "MEDICATION",
        category: "HEALTH",
        title: "Uống vitamin",
        endTime: undefined,
        startTime: "07:00",
        repeat: { kind: "DAILY" },
        memberIds: [bo],
        reminderOffsets: [0, 10],
        channels: ["IN_APP", "PUSH"],
        sharingScope: "PRIVATE",
      }),
      ctx,
    );
    expect(item.dataClass).toBe("SENSITIVE");
    expect(item.sharingScope).toBe("PRIVATE");
    expect(item.schedule.rrule).toBe("FREQ=DAILY");
    expect(reminderRuleSchema.safeParse(rule).success).toBe(true);
    expect(rule).toMatchObject({
      itemId: item.id,
      channels: ["IN_APP", "PUSH"],
      offsetsMinutes: [0, 10],
      recipientMemberIds: [bo],
      dataClass: "SENSITIVE",
      sharingScope: "PRIVATE",
    });
  });

  it("'Tạo nhắc nhở cho sự kiện này' gives one item plus one rule, never a second REMINDER item", () => {
    const result = formToItem(values({ createReminder: true, reminderOffsets: [30] }), ctx);
    expect(result.item.kind).toBe("EVENT");
    expect(result.rule?.itemId).toBe(result.item.id);
    expect(Object.keys(result).sort()).toEqual(["checklistItems", "item", "removedChecklistItemIds", "rule"]);
  });

  it("a REMINDER always gets a rule, defaulting to 'at start' in the app", () => {
    const { rule } = formToItem(values({ kind: "REMINDER", preset: "REMEMBER", category: "OTHER", endTime: undefined, channels: [] }), ctx);
    expect(rule).toMatchObject({ offsetsMinutes: [0], channels: ["IN_APP"] });
  });

  it("all-day keeps the plain date (no time, no instant)", () => {
    const { item } = formToItem(values({ allDay: true, date: "2026-10-20", startTime: undefined, endTime: undefined }), ctx);
    expect(item.schedule).toEqual({ allDay: true, start: "2026-10-20", timeZone: "Asia/Ho_Chi_Minh" });
  });

  it("end time before start time → error on endTime", () => {
    expect(fieldsOf(() => formToItem(values({ startTime: "09:00", endTime: "08:00" }), ctx))).toEqual({ endTime: "END_BEFORE_START" });
  });

  it("a timed item needs a start time; blank titles are rejected", () => {
    expect(fieldsOf(() => formToItem(values({ startTime: undefined }), ctx))).toMatchObject({ startTime: "START_TIME_REQUIRED" });
    expect(fieldsOf(() => formToItem(values({ title: "   " }), ctx))).toMatchObject({ title: "TITLE_REQUIRED" });
  });

  it("lunar yearly repeat sets calendarSystem LUNAR and a lunar rule", () => {
    const { item } = formToItem(
      values({
        preset: "DEATH_ANNIVERSARY",
        category: "SPECIAL",
        allDay: true,
        startTime: undefined,
        endTime: undefined,
        date: "2026-04-26",
        repeat: { kind: "LUNAR_YEARLY" },
      }),
      ctx,
    );
    expect(item.calendarSystem).toBe("LUNAR");
    expect(item.schedule.lunarRule).toEqual({ freq: "YEARLY", day: 10, month: 3, includeLeap: false });
    expect(itemSchema.safeParse(item).success).toBe(true);
  });

  it("calendarSystem LUNAR with a YEARLY repeat is treated as lunar yearly", () => {
    const { item } = formToItem(
      values({
        preset: "BIRTHDAY",
        category: "SPECIAL",
        allDay: true,
        startTime: undefined,
        endTime: undefined,
        repeat: { kind: "YEARLY" },
        calendarSystem: "LUNAR",
      }),
      ctx,
    );
    expect(item.schedule.lunarRule?.freq).toBe("YEARLY");
    expect(item.schedule.rrule).toBeUndefined();
  });

  it("keeps id, creator, createdAt and revision when editing, and reuses the existing rule id", () => {
    const first = formToItem(values({ createReminder: true, reminderOffsets: [15] }), ctx);
    const existing = { ...first.item, revision: "7", createdAt: "2026-01-01T00:00:00.000Z" };
    const second = formToItem(values({ title: "Họp phụ huynh lớp 4A", createReminder: true, reminderOffsets: [60] }), {
      ...ctx,
      actorId: newId(),
      existing,
      existingRule: first.rule,
    });
    expect(second.item).toMatchObject({ id: first.item.id, createdByActorId: actorId, createdAt: "2026-01-01T00:00:00.000Z", revision: "7" });
    expect(second.rule?.id).toBe(first.rule?.id);
    expect(second.rule?.offsetsMinutes).toEqual([60]);
  });

  it("turning the reminder off on edit disables the existing rule instead of dropping it", () => {
    const first = formToItem(values({ createReminder: true, reminderOffsets: [15] }), ctx);
    const second = formToItem(values({ createReminder: false }), { ...ctx, existing: first.item, existingRule: first.rule });
    expect(second.rule).toMatchObject({ id: first.rule?.id, enabled: false });
  });

  it("turns checklist lines into checklist items and reuses ids by position when editing", () => {
    const first = formToItem(values({ checklist: ["Sổ liên lạc", "  ", "Bút"] }), ctx);
    expect(first.checklistItems.map((c) => [c.text, c.position])).toEqual([
      ["Sổ liên lạc", 0],
      ["Bút", 1],
    ]);
    for (const c of first.checklistItems) expect(checklistItemSchema.safeParse(c).success).toBe(true);
    const second = formToItem(values({ checklist: ["Sổ liên lạc mới"] }), {
      ...ctx,
      existing: first.item,
      existingChecklist: first.checklistItems,
    });
    expect(second.checklistItems[0].id).toBe(first.checklistItems[0].id);
    expect(second.removedChecklistItemIds).toEqual([first.checklistItems[1].id]);
  });

  it("carries the payment amount", () => {
    const { item } = formToItem(
      values({ kind: "REMINDER", preset: "PAYMENT", category: "FINANCE", endTime: undefined, amount: 2_000_000, sharingScope: "PRIVATE" }),
      ctx,
    );
    expect(item).toMatchObject({ amount: 2_000_000, currency: "VND", dataClass: "PRIVATE" });
  });

  it("itemToForm round-trips through formToItem", () => {
    const v = values({ repeat: { kind: "WEEKLY", byDay: ["MO", "WE"] }, date: "2026-10-05", createReminder: true, reminderOffsets: [10], checklist: ["Sổ"] });
    const { item, rule, checklistItems } = formToItem(v, ctx);
    const back = itemToForm(item, rule, checklistItems);
    const again = formToItem(back, { ...ctx, existing: item, existingRule: rule, existingChecklist: checklistItems });
    expect(again.item).toEqual({ ...item, updatedAt: again.item.updatedAt });
    expect(again.rule).toEqual({ ...rule, updatedAt: again.rule?.updatedAt });
  });
});
