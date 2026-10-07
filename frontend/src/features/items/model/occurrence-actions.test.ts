import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import { newId } from "@/core/ids";
import type { Item } from "@/core/model/item";
import type { OccurrenceState } from "@/core/model/occurrence";
import { occurrenceKey } from "@/core/recurrence/occurrence-key";
import { getActive, listActiveByItem } from "@/core/repo/read";
import { createLocalSpace, saveResource } from "@/core/repo/write";
import { formToItem, type ItemFormValues } from "./form-to-item";
import { applyOccurrenceAction, occurrenceStatesByKey } from "./occurrence-actions";

let spaceId: string;
let actorId: string;

beforeEach(async () => {
  await db.delete();
  await db.open();
  spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
  actorId = (await getLocalIdentity()).actorId;
});

async function saveItem(overrides: Partial<ItemFormValues> = {}): Promise<Item> {
  const { item } = formToItem(
    {
      kind: "REMINDER",
      preset: "MEDICATION",
      category: "HEALTH",
      title: "Uống vitamin",
      allDay: false,
      date: "2026-10-06",
      startTime: "07:00",
      repeat: { kind: "DAILY" },
      memberIds: [],
      checklist: [],
      createReminder: true,
      reminderOffsets: [0],
      channels: ["IN_APP"],
      showOnCalendar: true,
      calendarSystem: "SOLAR",
      attachments: [],
      sharingScope: "PRIVATE",
      ...overrides,
    },
    { spaceId, actorId, timeZone: "Asia/Ho_Chi_Minh" },
  );
  return saveResource("item", item, "create");
}

function states(itemId: string): Promise<OccurrenceState[]> {
  return listActiveByItem<OccurrenceState>("occurrence_state", itemId);
}

describe("applyOccurrenceAction", () => {
  it("DONE today does not touch tomorrow", async () => {
    const item = await saveItem();
    const today = occurrenceKey(item.id, "2026-10-06T07:00");
    const tomorrow = occurrenceKey(item.id, "2026-10-07T07:00");
    await applyOccurrenceAction(item.id, today, "DONE");
    const byKey = occurrenceStatesByKey(await states(item.id));
    expect(byKey.get(today)?.status).toBe("DONE");
    expect(byKey.get(tomorrow)).toBeUndefined();
  });

  it("SNOOZE 10 minutes stores snoozeUntil and leaves the RRULE alone", async () => {
    const item = await saveItem();
    const key = occurrenceKey(item.id, "2026-10-06T07:00");
    await applyOccurrenceAction(item.id, key, "SNOOZE", 10, { now: new Date("2026-10-06T00:00:30.000Z") });
    const [state] = await states(item.id);
    expect(state).toMatchObject({ status: "SNOOZED", snoozeUntil: "2026-10-06T00:10:30.000Z", actedByActorId: actorId });
    expect((await getActive<Item>("item", item.id))?.schedule.rrule).toBe("FREQ=DAILY");
  });

  it("a second action on the same occurrence updates the one state instead of adding another", async () => {
    const item = await saveItem();
    const key = occurrenceKey(item.id, "2026-10-06T07:00");
    await applyOccurrenceAction(item.id, key, "SNOOZE", 10);
    await applyOccurrenceAction(item.id, key, "DONE");
    const all = await states(item.id);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ status: "DONE", snoozeUntil: null });
  });

  it("SKIP records SKIPPED and UNDO removes the state", async () => {
    const item = await saveItem();
    const key = occurrenceKey(item.id, "2026-10-06T07:00");
    await applyOccurrenceAction(item.id, key, "SKIP");
    expect((await states(item.id))[0].status).toBe("SKIPPED");
    await applyOccurrenceAction(item.id, key, "UNDO");
    expect(await states(item.id)).toEqual([]);
  });

  it("the state copies the item's privacy so PRIVATE/SENSITIVE stays creator-only", async () => {
    const item = await saveItem();
    await applyOccurrenceAction(item.id, occurrenceKey(item.id, "2026-10-06T07:00"), "DONE");
    expect((await states(item.id))[0]).toMatchObject({ dataClass: "SENSITIVE", sharingScope: "PRIVATE", spaceId });
  });

  it("DONE on a one-off TASK also sets completedAt; UNDO clears it", async () => {
    const task = await saveItem({
      kind: "TASK",
      preset: "HOUSEWORK",
      category: "HOUSEWORK",
      title: "Dọn nhà",
      repeat: { kind: "NONE" },
      allDay: true,
      startTime: undefined,
      createReminder: false,
      sharingScope: "FAMILY_ALL",
    });
    const key = occurrenceKey(task.id, "2026-10-06");
    await applyOccurrenceAction(task.id, key, "DONE");
    expect((await getActive<Item>("item", task.id))?.completedAt).toEqual(expect.any(String));
    await applyOccurrenceAction(task.id, key, "UNDO");
    expect((await getActive<Item>("item", task.id))?.completedAt).toBeNull();
  });

  it("rejects a key of another item and an unknown item", async () => {
    const item = await saveItem();
    await expect(applyOccurrenceAction(item.id, occurrenceKey(newId(), "2026-10-06T07:00"), "DONE")).rejects.toThrow(RangeError);
    const ghost = newId();
    await expect(applyOccurrenceAction(ghost, occurrenceKey(ghost, "2026-10-06"), "DONE")).rejects.toThrow("NOT_FOUND");
  });

  it("queues a priority outbox op in a shared space", async () => {
    const item = await saveItem();
    await db.spaces.update(spaceId, { sharingState: "SHARED" });
    await applyOccurrenceAction(item.id, occurrenceKey(item.id, "2026-10-06T07:00"), "DONE");
    const ops = await db.outbox.toArray();
    expect(ops.map((o) => [o.resourceType, o.action, o.priority])).toEqual([["occurrence_state", "occurrence_action", 1]]);
  });
});
