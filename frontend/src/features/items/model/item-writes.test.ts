import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/core/db/db";
import type { Item } from "@/core/model/item";
import type { ChecklistItem, ChecklistState, ItemExceptionRecord, Participation } from "@/core/model/occurrence";
import type { ReminderRule } from "@/core/model/reminder-rule";
import { expandOccurrences } from "@/core/recurrence/expand";
import { occurrenceKey } from "@/core/recurrence/occurrence-key";
import { getActive, listActive, listActiveByItem } from "@/core/repo/read";
import { createLocalSpace } from "@/core/repo/write";
import type { ItemFormValues } from "./form-to-item";
import { newFormValues } from "./item-types";
import { createItemFromForm, loadItemForEdit, removeItem, setChecklistChecked, setParticipation, updateItemFromForm, type WriteContext } from "./item-writes";

let wctx: WriteContext;

beforeEach(async () => {
  await db.delete();
  await db.open();
  const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
  wctx = { spaceId, timeZone: "Asia/Ho_Chi_Minh", spaceKind: "FAMILY" };
});

function vitamin(overrides: Partial<ItemFormValues> = {}): ItemFormValues {
  return {
    ...newFormValues("REMINDER", { date: "2026-10-06", nowTime: "06:00" }),
    title: "Uống vitamin",
    startTime: "07:00",
    repeat: { kind: "DAILY" },
    memberIds: ["11111111-1111-4111-8111-111111111111"],
    checklist: ["Vitamin C"],
    ...overrides,
  };
}

const week = { from: "2026-10-06", to: "2026-10-12" };

async function occurrencesOf(itemId: string) {
  const item = (await getActive<Item>("item", itemId))!;
  const exceptions = await listActiveByItem<ItemExceptionRecord>("item_exception", itemId);
  return expandOccurrences(item.id, item.schedule, week, exceptions);
}

describe("createItemFromForm", () => {
  it("stores one item, its rule and checklist rows in the space", async () => {
    const id = await createItemFromForm(vitamin(), wctx);
    expect(await listActive<Item>("item", wctx.spaceId)).toHaveLength(1);
    const rules = await listActiveByItem<ReminderRule>("reminder_rule", id);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ offsetsMinutes: [10], channels: ["IN_APP"] });
    expect((await listActiveByItem<ChecklistItem>("checklist_item", id)).map((c) => c.text)).toEqual(["Vitamin C"]);
  });

  it("an event with 'Tạo nhắc nhở' gets a rule, not a second reminder item", async () => {
    const ev = { ...newFormValues("EVENT", { date: "2026-10-06", nowTime: "07:00" }), title: "Họp phụ huynh", createReminder: true };
    const id = await createItemFromForm(ev, wctx);
    expect(await listActive<Item>("item", wctx.spaceId)).toHaveLength(1);
    expect(await listActiveByItem<ReminderRule>("reminder_rule", id)).toHaveLength(1);
  });
});

describe("updateItemFromForm", () => {
  it("THIS moves one occurrence and leaves the rest of the series alone", async () => {
    const id = await createItemFromForm(vitamin(), wctx);
    const key = occurrenceKey(id, "2026-10-08T07:00");
    const { values } = await loadItemForEdit(id, key);
    expect(values).toMatchObject({ date: "2026-10-08", startTime: "07:00" });
    await updateItemFromForm(id, { ...values, startTime: "09:30" }, "THIS", key, wctx);

    const occs = await occurrencesOf(id);
    expect(occs).toHaveLength(7);
    expect(occs.find((o) => o.occurrenceKey === key)).toMatchObject({ start: "2026-10-08T09:30", overridden: true });
    expect(occs.filter((o) => o.occurrenceKey !== key).every((o) => o.start.endsWith("T07:00"))).toBe(true);
    expect((await getActive<Item>("item", id))!.schedule.start).toBe("2026-10-06T07:00");
  });

  it("THIS twice on the same occurrence keeps one exception", async () => {
    const id = await createItemFromForm(vitamin(), wctx);
    const key = occurrenceKey(id, "2026-10-08T07:00");
    const { values } = await loadItemForEdit(id, key);
    await updateItemFromForm(id, { ...values, startTime: "09:30" }, "THIS", key, wctx);
    await updateItemFromForm(id, { ...values, startTime: "10:00", title: "Uống vitamin D" }, "THIS", key, wctx);
    expect(await listActiveByItem("item_exception", id)).toHaveLength(1);
    expect((await occurrencesOf(id)).find((o) => o.occurrenceKey === key)).toMatchObject({ start: "2026-10-08T10:00", title: "Uống vitamin D" });
  });

  it("FOLLOWING ends the old series the day before and starts a new one with the edit", async () => {
    const id = await createItemFromForm(vitamin(), wctx);
    const key = occurrenceKey(id, "2026-10-09T07:00");
    const { values } = await loadItemForEdit(id, key);
    const tailId = await updateItemFromForm(id, { ...values, startTime: "08:00" }, "FOLLOWING", key, wctx);

    expect(tailId).not.toBe(id);
    const head = await occurrencesOf(id);
    expect(head.map((o) => o.start)).toEqual(["2026-10-06T07:00", "2026-10-07T07:00", "2026-10-08T07:00"]);
    const tail = (await getActive<Item>("item", tailId))!;
    expect(tail.schedule).toMatchObject({ start: "2026-10-09T08:00", rrule: "FREQ=DAILY" });
    expect(await listActiveByItem<ReminderRule>("reminder_rule", tailId)).toHaveLength(1);
    expect((await listActiveByItem<ChecklistItem>("checklist_item", tailId)).map((c) => c.text)).toEqual(["Vitamin C"]);
  });

  it("ALL edited from a later occurrence shifts the series by the same number of days", async () => {
    const id = await createItemFromForm(vitamin({ repeat: { kind: "WEEKLY", byDay: ["TU"] } }), wctx);
    const key = occurrenceKey(id, "2026-10-13T07:00");
    const { values } = await loadItemForEdit(id, key);
    await updateItemFromForm(id, { ...values, date: "2026-10-14", startTime: "06:30", repeat: { kind: "WEEKLY", byDay: ["WE"] } }, "ALL", key, wctx);
    const item = (await getActive<Item>("item", id))!;
    expect(item.schedule).toMatchObject({ start: "2026-10-07T06:30", rrule: "FREQ=WEEKLY;BYDAY=WE" });
  });

  it("a non-recurring item ignores the scope and updates in place", async () => {
    const id = await createItemFromForm(vitamin({ repeat: { kind: "NONE" }, checklist: ["A", "B"] }), wctx);
    const { values } = await loadItemForEdit(id);
    await updateItemFromForm(id, { ...values, title: "Uống sắt", checklist: ["A"] }, "THIS", undefined, wctx);
    expect((await getActive<Item>("item", id))!.title).toBe("Uống sắt");
    expect(await listActiveByItem("item_exception", id)).toHaveLength(0);
    expect((await listActiveByItem<ChecklistItem>("checklist_item", id)).map((c) => c.text)).toEqual(["A"]);
  });
});

describe("removeItem", () => {
  it("THIS cancels only that occurrence", async () => {
    const id = await createItemFromForm(vitamin(), wctx);
    const key = occurrenceKey(id, "2026-10-08T07:00");
    await removeItem(id, "THIS", key);
    const occs = await occurrencesOf(id);
    expect(occs).toHaveLength(6);
    expect(occs.some((o) => o.occurrenceKey === key)).toBe(false);
  });

  it("FOLLOWING keeps the earlier occurrences", async () => {
    const id = await createItemFromForm(vitamin(), wctx);
    await removeItem(id, "FOLLOWING", occurrenceKey(id, "2026-10-09T07:00"));
    expect((await occurrencesOf(id)).map((o) => o.start.slice(0, 10))).toEqual(["2026-10-06", "2026-10-07", "2026-10-08"]);
  });

  it("FOLLOWING from the first occurrence, or ALL, removes the item with its rule and checklist", async () => {
    const a = await createItemFromForm(vitamin(), wctx);
    const b = await createItemFromForm(vitamin(), wctx);
    await removeItem(a, "FOLLOWING", occurrenceKey(a, "2026-10-06T07:00"));
    await removeItem(b, "ALL");
    expect(await listActive<Item>("item", wctx.spaceId)).toHaveLength(0);
    expect(await listActive("reminder_rule", wctx.spaceId)).toHaveLength(0);
    expect(await listActive("checklist_item", wctx.spaceId)).toHaveLength(0);
  });
});

describe("setChecklistChecked", () => {
  it("ticks an item for one occurrence only and updates the same row when unticked", async () => {
    const id = await createItemFromForm(vitamin(), wctx);
    const [row] = await listActiveByItem<ChecklistItem>("checklist_item", id);
    const today = occurrenceKey(id, "2026-10-06T07:00");
    await setChecklistChecked(id, row.id, today, true);
    await setChecklistChecked(id, row.id, today, false);
    await setChecklistChecked(id, row.id, occurrenceKey(id, "2026-10-07T07:00"), true);
    const states = await listActiveByItem<ChecklistState>("checklist_state", id);
    expect(states.map((s) => [s.occurrenceKey.slice(-16), s.checked]).sort()).toEqual([
      ["2026-10-06T07:00", false],
      ["2026-10-07T07:00", true],
    ]);
  });
});

describe("setParticipation", () => {
  it("keeps one answer per member and occurrence", async () => {
    const id = await createItemFromForm(vitamin(), wctx);
    const key = occurrenceKey(id, "2026-10-06T07:00");
    const m = "11111111-1111-4111-8111-111111111111";
    await setParticipation(id, key, m, "MAYBE");
    await setParticipation(id, key, m, "YES");
    const rows = await listActiveByItem<Participation>("participation", id);
    expect(rows.map((r) => r.response)).toEqual(["YES"]);
  });
});
