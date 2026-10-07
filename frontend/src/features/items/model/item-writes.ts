import { db } from "@/core/db/db";
import { RepoError } from "@/core/db/errors";
import { getLocalIdentity } from "@/core/db/local-identity";
import { newId } from "@/core/ids";
import type { SpaceKind } from "@/core/model/common";
import type { Item } from "@/core/model/item";
import type { ChecklistItem, ChecklistState, ItemExceptionRecord, Participation, ParticipationResponse } from "@/core/model/occurrence";
import type { ReminderRule } from "@/core/model/reminder-rule";
import type { EditScope } from "@/core/recurrence/edit-scope";
import type { BaseRecord } from "@/core/sync/resource-types";
import { splitSeriesAt } from "@/core/recurrence/edit-scope";
import { shiftWall, wallDurationMinutes } from "@/core/recurrence/floating";
import { occurrenceKey, parseOccurrenceKey } from "@/core/recurrence/occurrence-key";
import { getActive, listActiveByItem } from "@/core/repo/read";
import { deleteResource, saveResource } from "@/core/repo/write";
import { addDays, daysBetween } from "@/core/time/local-date";
import { datePart, timePart } from "@/core/time/zoned";
import { formToItem, itemToForm, type FormToItemResult, type ItemFormValues } from "./form-to-item";

export interface WriteContext {
  spaceId: string;
  timeZone: string;
  spaceKind: SpaceKind;
}

interface ItemParts {
  item: Item;
  rule: ReminderRule | undefined;
  checklist: ChecklistItem[];
  exceptions: ItemExceptionRecord[];
}

// Every table an item write can touch, so the item, its rule and checklist land in one transaction.
const itemTables = () => [db.items, db.reminderRules, db.checklistItems, db.itemExceptions, db.spaces, db.outbox];

export function isRecurring(item: Pick<Item, "schedule">): boolean {
  return !!(item.schedule.rrule || item.schedule.lunarRule);
}

async function loadParts(itemId: string): Promise<ItemParts> {
  const item = await getActive<Item>("item", itemId);
  if (!item) throw new RepoError("NOT_FOUND", itemId);
  const rules = await listActiveByItem<ReminderRule>("reminder_rule", itemId);
  const rule = rules.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  const checklist = (await listActiveByItem<ChecklistItem>("checklist_item", itemId)).sort((a, b) => a.position - b.position);
  const exceptions = await listActiveByItem<ItemExceptionRecord>("item_exception", itemId);
  return { item, rule, checklist, exceptions };
}

async function persist(res: FormToItemResult, isNew: boolean, prev?: Pick<ItemParts, "rule" | "checklist">): Promise<void> {
  await saveResource("item", res.item, isNew ? "create" : "update");
  if (res.rule) await saveResource("reminder_rule", res.rule, prev?.rule && prev.rule.id === res.rule.id ? "update" : "create");
  const known = new Set(prev?.checklist.map((c) => c.id));
  for (const c of res.checklistItems) await saveResource("checklist_item", c, known.has(c.id) ? "update" : "create");
  for (const id of res.removedChecklistItemIds) await deleteResource("checklist_item", id);
}

/** Creates the item (+ rule + checklist) from the add form; returns the new item id. Throws ItemFormError. */
export async function createItemFromForm(values: ItemFormValues, ctx: WriteContext): Promise<string> {
  const { actorId } = await getLocalIdentity();
  const res = formToItem(values, { spaceId: ctx.spaceId, actorId, timeZone: ctx.timeZone, spaceKind: ctx.spaceKind });
  await db.transaction("rw", itemTables(), () => persist(res, true));
  return res.item.id;
}

/** Saves ready-made new items (timetable import, week copy) in one transaction: all of them or none. */
export async function saveNewItems(items: Item[]): Promise<void> {
  await db.transaction("rw", itemTables(), async () => {
    for (const item of items) await saveResource("item", item, "create");
  });
}

/** Where one occurrence currently sits, with its override (moved time, own title) applied. */
export function occurrenceAt(item: Item, exceptions: Pick<ItemExceptionRecord, "occurrenceKey" | "kind" | "override">[], originalStart: string) {
  const s = item.schedule;
  const duration = s.end !== undefined ? wallDurationMinutes(s.start, s.end) : null;
  let allDay = s.allDay;
  let start = originalStart;
  let end = duration === null ? undefined : shiftWall(originalStart, duration, allDay);
  let title = item.title;
  const key = occurrenceKey(item.id, originalStart);
  const o = exceptions.find((e) => e.occurrenceKey === key && e.kind === "OVERRIDE")?.override;
  if (o) {
    allDay = o.allDay ?? allDay;
    start = o.start ?? (allDay === s.allDay ? start : datePart(start));
    end = o.end ?? (duration !== null && allDay === s.allDay ? shiftWall(start, duration, allDay) : undefined);
    title = o.title ?? title;
  }
  const cancelled = exceptions.some((e) => e.occurrenceKey === key && e.kind === "CANCEL");
  return { key, allDay, start, end, title, cancelled };
}

export interface ItemForEdit {
  values: ItemFormValues;
  item: Item;
  recurring: boolean;
}

/** Prefills the edit form; opened from an occurrence of a series, date/time/title are that occurrence's. */
export async function loadItemForEdit(itemId: string, key?: string): Promise<ItemForEdit> {
  const parts = await loadParts(itemId);
  const recurring = isRecurring(parts.item);
  const values = itemToForm(parts.item, parts.rule, parts.checklist);
  const parsed = key ? parseOccurrenceKey(key) : null;
  if (!recurring || !parsed || parsed.itemId !== itemId) return { values, item: parts.item, recurring };
  const occ = occurrenceAt(parts.item, parts.exceptions, parsed.originalStart);
  return {
    item: parts.item,
    recurring,
    values: {
      ...values,
      title: occ.title,
      allDay: occ.allDay,
      date: datePart(occ.start),
      startTime: occ.allDay ? undefined : (timePart(occ.start) ?? undefined),
      endTime: !occ.allDay && occ.end && datePart(occ.end) === datePart(occ.start) ? (timePart(occ.end) ?? undefined) : undefined,
    },
  };
}

async function saveException(parts: ItemParts, key: string, actorId: string, patch: Pick<ItemExceptionRecord, "kind" | "override">): Promise<void> {
  const prev = parts.exceptions.find((e) => e.occurrenceKey === key);
  const now = new Date().toISOString();
  const rec: ItemExceptionRecord = {
    id: prev?.id ?? newId(),
    spaceId: parts.item.spaceId,
    createdByActorId: prev?.createdByActorId ?? actorId,
    // An exception reveals as much as the item it changes.
    dataClass: parts.item.dataClass,
    sharingScope: parts.item.sharingScope,
    revision: prev?.revision ?? null,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
    syncState: prev?.syncState ?? "LOCAL",
    itemId: parts.item.id,
    occurrenceKey: key,
    ...patch,
  };
  if (rec.override === undefined) delete rec.override;
  await saveResource("item_exception", rec, prev ? "update" : "create");
}

/**
 * Applies the edit form with "Chỉ lần này" / "Từ lần này trở đi" / "Cả chuỗi". Returns the id that now holds the
 * edited occurrence (a new item for FOLLOWING). Non-recurring items ignore the scope.
 */
export async function updateItemFromForm(itemId: string, values: ItemFormValues, scope: EditScope, key: string | undefined, ctx: WriteContext): Promise<string> {
  const { actorId } = await getLocalIdentity();
  const parts = await loadParts(itemId);
  const { item } = parts;
  const parsed = key ? parseOccurrenceKey(key) : null;
  const base = { spaceId: item.spaceId, actorId, timeZone: ctx.timeZone, spaceKind: ctx.spaceKind };
  const fromFirst = !!parsed && parsed.originalStart <= item.schedule.start;

  if (!isRecurring(item) || !parsed || scope === "ALL" || (scope === "FOLLOWING" && fromFirst)) {
    let v = values;
    // The form shows the occurrence's date; moving it by N days moves the whole series by N days.
    if (isRecurring(item) && parsed) v = { ...values, date: addDays(datePart(item.schedule.start), daysBetween(datePart(parsed.originalStart), values.date)) };
    const res = formToItem(v, { ...base, existing: item, existingRule: parts.rule, existingChecklist: parts.checklist });
    await db.transaction("rw", itemTables(), () => persist(res, false, parts));
    return item.id;
  }

  if (scope === "THIS") {
    // Run the full form mapping only to validate times and get the schedule shape; nothing else is per-occurrence.
    const check = formToItem({ ...values, repeat: { kind: "NONE" } }, { ...base, existing: item });
    const s = check.item.schedule;
    const title = values.title.trim();
    const override: NonNullable<ItemExceptionRecord["override"]> = { start: s.start, allDay: s.allDay };
    if (s.end !== undefined) override.end = s.end;
    if (title !== item.title) override.title = title;
    await db.transaction("rw", itemTables(), () => saveException(parts, key!, actorId, { kind: "OVERRIDE", override }));
    return item.id;
  }

  const { head } = splitSeriesAt(item.schedule, parsed.originalStart);
  const tail = formToItem(values, base);
  await db.transaction("rw", itemTables(), async () => {
    await saveResource("item", { ...item, schedule: head }, "update");
    await persist(tail, true);
  });
  return tail.item.id;
}

/** Deletes with the same three scopes; the whole item goes with its rule and checklist. */
export async function removeItem(itemId: string, scope: EditScope, key?: string): Promise<void> {
  const { actorId } = await getLocalIdentity();
  const parts = await loadParts(itemId);
  const { item } = parts;
  const parsed = key ? parseOccurrenceKey(key) : null;
  const whole = !isRecurring(item) || !parsed || scope === "ALL" || (scope === "FOLLOWING" && parsed.originalStart <= item.schedule.start);

  await db.transaction("rw", itemTables(), async () => {
    if (whole) {
      if (parts.rule) await deleteResource("reminder_rule", parts.rule.id);
      for (const c of parts.checklist) await deleteResource("checklist_item", c.id);
      await deleteResource("item", item.id);
    } else if (scope === "THIS") {
      await saveException(parts, key!, actorId, { kind: "CANCEL", override: undefined });
    } else {
      await saveResource("item", { ...item, schedule: splitSeriesAt(item.schedule, parsed!.originalStart).head }, "update");
    }
  });
}

/** Base fields of a per-occurrence child row: same space and audience as its item, updated in place. */
function childBase(item: Item, prev: BaseRecord | undefined, actorId: string) {
  const now = new Date().toISOString();
  return {
    id: prev?.id ?? newId(),
    spaceId: item.spaceId,
    createdByActorId: prev?.createdByActorId ?? actorId,
    dataClass: item.dataClass,
    sharingScope: item.sharingScope,
    revision: prev?.revision ?? null,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
    syncState: prev?.syncState ?? ("LOCAL" as const),
    itemId: item.id,
  };
}

/** Ticks a checklist line for one occurrence (ticking today never ticks next week). */
export async function setChecklistChecked(itemId: string, checklistItemId: string, key: string, checked: boolean): Promise<void> {
  const { actorId } = await getLocalIdentity();
  await db.transaction("rw", [db.items, db.checklistStates, db.spaces, db.outbox], async () => {
    const item = await getActive<Item>("item", itemId);
    if (!item) throw new RepoError("NOT_FOUND", itemId);
    const prev = (await listActiveByItem<ChecklistState>("checklist_state", itemId)).find((s) => s.checklistItemId === checklistItemId && s.occurrenceKey === key);
    const row: ChecklistState = { ...childBase(item, prev, actorId), checklistItemId, occurrenceKey: key, checked };
    await saveResource("checklist_state", row, prev ? "update" : "create");
  });
}

/** Group RSVP for one occurrence; one answer per member, changed in place. */
export async function setParticipation(itemId: string, key: string, memberId: string, response: ParticipationResponse): Promise<void> {
  const { actorId } = await getLocalIdentity();
  await db.transaction("rw", [db.items, db.participations, db.spaces, db.outbox], async () => {
    const item = await getActive<Item>("item", itemId);
    if (!item) throw new RepoError("NOT_FOUND", itemId);
    const prev = (await listActiveByItem<Participation>("participation", itemId)).find((p) => p.memberId === memberId && p.occurrenceKey === key);
    const row: Participation = { ...childBase(item, prev, actorId), occurrenceKey: key, memberId, response };
    await saveResource("participation", row, prev ? "update" : "create");
  });
}
