import type { z } from "zod";
import { newId } from "@/core/ids";
import {
  isPresetOfKind,
  type CalendarSystem,
  type Category,
  type Channel,
  type DataClass,
  type ItemKind,
  type Preset,
  type Priority,
  type SharingScope,
  type SpaceKind,
} from "@/core/model/common";
import { defaultsForPreset, itemSchema, type Item, type ItemSchedule } from "@/core/model/item";
import { checklistItemSchema, type ChecklistItem } from "@/core/model/occurrence";
import { reminderRuleSchema, type ReminderRule } from "@/core/model/reminder-rule";
import { isLocalDate, type LocalDate } from "@/core/time/local-date";
import { datePart, timePart } from "@/core/time/zoned";
import { repeatFromSchedule, repeatToRule, type RepeatPreset } from "./repeat-presets";

export interface ItemFormValues {
  kind: ItemKind;
  preset: Preset;
  category: Category;
  title: string;
  description?: string;
  allDay: boolean;
  date: LocalDate;
  /** All-day spans only: last day (inclusive). */
  endDate?: LocalDate;
  startTime?: string;
  endTime?: string;
  repeat: RepeatPreset;
  memberIds: string[];
  responsibleMemberId?: string;
  priority?: Priority;
  locationText?: string;
  checklist: string[];
  /** EVENT/TASK: attach a reminder rule to this item (never a second REMINDER item). REMINDER always has one. */
  createReminder: boolean;
  /** Minutes before the start. */
  reminderOffsets: number[];
  /** Calendar months before (documents), clamped to month end. */
  reminderOffsetMonths?: number[];
  channels: Channel[];
  showOnCalendar: boolean;
  calendarSystem: CalendarSystem;
  attachments: string[];
  sharingScope: SharingScope;
  /** PAYMENT, integer VND. */
  amount?: number;
  documentType?: string;
  subject?: string;
  teacher?: string;
  room?: string;
  audioAssetId?: string;
  soundKey?: string;
  templateKey?: string;
}

export interface FormToItemContext {
  spaceId: string;
  actorId: string;
  timeZone: string;
  spaceKind?: SpaceKind;
  existing?: Item;
  existingRule?: ReminderRule;
  existingChecklist?: ChecklistItem[];
  now?: Date;
}

export interface FormToItemResult {
  item: Item;
  /** Present for REMINDER items, when "Tạo nhắc nhở" is ticked, or (disabled) when an existing rule was turned off. */
  rule: ReminderRule | undefined;
  checklistItems: ChecklistItem[];
  removedChecklistItemIds: string[];
}

/** Field-level validation failure; `fields` maps form field → stable code (i18n maps codes to text). */
export class ItemFormError extends Error {
  constructor(readonly fields: Record<string, string>) {
    super(`ITEM_FORM_INVALID: ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    this.name = "ItemFormError";
  }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Schema paths → the form field that shows the message.
const FIELD_BY_PATH: Record<string, string> = {
  title: "title",
  note: "description",
  locationText: "locationText",
  memberIds: "memberIds",
  attachments: "attachments",
  amount: "amount",
  preset: "preset",
  sharingScope: "sharingScope",
  documentType: "documentType",
  subject: "subject",
  teacher: "teacher",
  room: "room",
};

function compact<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

function trimmed(s: string | undefined): string | undefined {
  const v = s?.trim();
  return v ? v : undefined;
}

/** Health category is sensitive regardless of preset (e.g. a dentist APPOINTMENT). */
export function dataClassFor(kind: ItemKind, preset: Preset, category: Category, spaceKind: SpaceKind = "FAMILY"): DataClass {
  if (category === "HEALTH") return "SENSITIVE";
  return defaultsForPreset(kind, preset, spaceKind).dataClass;
}

function buildSchedule(v: ItemFormValues, timeZone: string, errors: Record<string, string>): ItemSchedule | null {
  if (!isLocalDate(v.date)) {
    errors.date = "INVALID_DATE";
    return null;
  }
  if (v.allDay) {
    if (v.endDate !== undefined && v.endDate !== v.date) {
      if (!isLocalDate(v.endDate)) errors.endDate = "INVALID_DATE";
      else if (v.endDate < v.date) errors.endDate = "END_BEFORE_START";
      else return { allDay: true, start: v.date, end: v.endDate, timeZone };
      return null;
    }
    return { allDay: true, start: v.date, timeZone };
  }
  if (!v.startTime) errors.startTime = "START_TIME_REQUIRED";
  else if (!TIME.test(v.startTime)) errors.startTime = "INVALID_TIME";
  if (v.endTime && !TIME.test(v.endTime)) errors.endTime = "INVALID_TIME";
  if (errors.startTime || errors.endTime) return null;
  if (v.endTime && v.endTime < v.startTime!) {
    errors.endTime = "END_BEFORE_START";
    return null;
  }
  const s: ItemSchedule = { allDay: false, start: `${v.date}T${v.startTime}`, timeZone };
  if (v.endTime) s.end = `${v.date}T${v.endTime}`;
  return s;
}

function collectIssues(issues: z.core.$ZodIssue[], errors: Record<string, string>, fallback: string): void {
  for (const issue of issues) {
    const head = String(issue.path[0] ?? "");
    const field = head === "schedule" ? (issue.path[1] === "rrule" || issue.path[1] === "lunarRule" ? "repeat" : "date") : (FIELD_BY_PATH[head] ?? fallback);
    errors[field] ??= issue.message;
  }
}

/** Maps the add/edit form to one Item, at most one ReminderRule and its checklist rows. Throws ItemFormError. */
export function formToItem(values: ItemFormValues, ctx: FormToItemContext): FormToItemResult {
  const errors: Record<string, string> = {};
  const title = values.title.trim();
  if (!title) errors.title = "TITLE_REQUIRED";
  if (!isPresetOfKind(values.kind, values.preset)) errors.preset = "PRESET_NOT_IN_KIND";
  const base = buildSchedule(values, ctx.timeZone, errors);
  let repeat: ReturnType<typeof repeatToRule> | null = null;
  if (base) {
    try {
      repeat = repeatToRule(values.repeat, base.start, values.calendarSystem);
    } catch {
      errors.repeat = "RRULE_INVALID";
    }
  }
  if (Object.keys(errors).length > 0 || !base || !repeat) throw new ItemFormError(errors);

  const now = (ctx.now ?? new Date()).toISOString();
  const existing = ctx.existing;
  const schedule: ItemSchedule = compact({ ...base, rrule: repeat.rrule, lunarRule: repeat.lunarRule });
  const dataClass = dataClassFor(values.kind, values.preset, values.category, ctx.spaceKind);

  const item: Item = compact({
    id: existing?.id ?? newId(),
    spaceId: existing?.spaceId ?? ctx.spaceId,
    createdByActorId: existing?.createdByActorId ?? ctx.actorId,
    dataClass,
    sharingScope: values.sharingScope,
    revision: existing?.revision ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deletedAt: existing?.deletedAt ?? null,
    syncState: existing?.syncState ?? "LOCAL",
    kind: values.kind,
    preset: values.preset,
    title,
    schedule,
    memberIds: [...values.memberIds],
    responsibleMemberId: values.responsibleMemberId,
    category: values.category,
    priority: values.priority ?? "MEDIUM",
    note: trimmed(values.description),
    locationText: trimmed(values.locationText),
    attachments: [...values.attachments],
    showOnCalendar: values.showOnCalendar,
    calendarSystem: repeat.calendarSystem,
    templateKey: values.templateKey ?? existing?.templateKey,
    completedAt: existing?.completedAt ?? (values.kind === "TASK" ? null : undefined),
    // Only payments carry an amount; switching the category away must not leave a hidden one behind.
    amount: values.preset === "PAYMENT" ? values.amount : undefined,
    currency: values.preset === "PAYMENT" && values.amount !== undefined ? ("VND" as const) : undefined,
    documentType: trimmed(values.documentType),
    subject: trimmed(values.subject),
    teacher: trimmed(values.teacher),
    room: trimmed(values.room),
    audioAssetId: values.audioAssetId,
    soundKey: values.soundKey,
    sourceReference: existing?.sourceReference,
  });

  const parsed = itemSchema.safeParse(item);
  if (!parsed.success) collectIssues(parsed.error.issues, errors, "form");

  const rule = buildRule(values, ctx, item, now);
  if (rule) {
    const r = reminderRuleSchema.safeParse(rule);
    if (!r.success) collectIssues(r.error.issues, errors, "reminderOffsets");
  }
  if (Object.keys(errors).length > 0) throw new ItemFormError(errors);

  const { checklistItems, removedChecklistItemIds } = buildChecklist(values.checklist, ctx.existingChecklist ?? [], item, now);
  return { item, rule, checklistItems, removedChecklistItemIds };
}

function buildRule(values: ItemFormValues, ctx: FormToItemContext, item: Item, now: string): ReminderRule | undefined {
  const prev = ctx.existingRule;
  const wanted = values.kind === "REMINDER" || values.createReminder;
  // Turning the reminder off keeps the rule (disabled) so the change syncs and pending jobs get cancelled.
  if (!wanted) return prev ? { ...prev, enabled: false, updatedAt: now } : undefined;
  const minutes = [...new Set(values.reminderOffsets)];
  const months = [...new Set(values.reminderOffsetMonths ?? [])];
  const channels = values.channels.length > 0 ? [...new Set(values.channels)] : (["IN_APP"] as Channel[]);
  return compact({
    id: prev?.id ?? newId(),
    spaceId: item.spaceId,
    createdByActorId: prev?.createdByActorId ?? item.createdByActorId,
    dataClass: item.dataClass,
    sharingScope: item.sharingScope,
    revision: prev?.revision ?? null,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
    syncState: prev?.syncState ?? "LOCAL",
    itemId: item.id,
    offsetsMinutes: minutes.length === 0 && months.length === 0 ? [0] : minutes,
    offsetMonths: months.length > 0 ? months : undefined,
    channels,
    priority: values.priority ?? "MEDIUM",
    recipientMemberIds: [...values.memberIds],
    soundKey: values.soundKey,
    audioAssetId: values.audioAssetId,
    enabled: true,
  });
}

function buildChecklist(
  lines: string[],
  existing: ChecklistItem[],
  item: Item,
  now: string,
): { checklistItems: ChecklistItem[]; removedChecklistItemIds: string[] } {
  const texts = lines.map((l) => l.trim()).filter(Boolean);
  const previous = existing.filter((c) => c.deletedAt === null).sort((a, b) => a.position - b.position);
  const checklistItems = texts.map((text, position): ChecklistItem => {
    const prev = previous[position];
    const row: ChecklistItem = {
      id: prev?.id ?? newId(),
      spaceId: item.spaceId,
      createdByActorId: prev?.createdByActorId ?? item.createdByActorId,
      dataClass: item.dataClass,
      sharingScope: item.sharingScope,
      revision: prev?.revision ?? null,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
      syncState: prev?.syncState ?? "LOCAL",
      itemId: item.id,
      text,
      position,
    };
    const check = checklistItemSchema.safeParse(row);
    if (!check.success) throw new ItemFormError({ checklist: check.error.issues[0]?.message ?? "TEXT_INVALID" });
    return row;
  });
  return { checklistItems, removedChecklistItemIds: previous.slice(texts.length).map((c) => c.id) };
}

/** Prefills the edit form from stored records (inverse of formToItem). */
export function itemToForm(item: Item, rule?: ReminderRule, checklist: ChecklistItem[] = []): ItemFormValues {
  const s = item.schedule;
  const start = s.start;
  const end = s.end;
  const ruleOn = !!rule && rule.enabled !== false;
  return compact({
    kind: item.kind,
    preset: item.preset,
    category: item.category,
    title: item.title,
    description: item.note,
    allDay: s.allDay,
    date: datePart(start),
    endDate: s.allDay && end && end !== start ? end : undefined,
    startTime: timePart(start) ?? undefined,
    endTime: !s.allDay && end && datePart(end) === datePart(start) ? (timePart(end) ?? undefined) : undefined,
    repeat: repeatFromSchedule(s),
    memberIds: [...item.memberIds],
    responsibleMemberId: item.responsibleMemberId ?? undefined,
    priority: item.priority,
    locationText: item.locationText,
    checklist: checklist
      .filter((c) => c.deletedAt === null)
      .sort((a, b) => a.position - b.position)
      .map((c) => c.text),
    createReminder: ruleOn,
    reminderOffsets: ruleOn ? [...rule!.offsetsMinutes] : [],
    reminderOffsetMonths: ruleOn && rule!.offsetMonths ? [...rule!.offsetMonths] : undefined,
    channels: rule ? [...rule.channels] : (["IN_APP"] as Channel[]),
    showOnCalendar: item.showOnCalendar,
    calendarSystem: item.calendarSystem,
    attachments: [...item.attachments],
    sharingScope: item.sharingScope,
    amount: item.amount,
    documentType: item.documentType,
    subject: item.subject,
    teacher: item.teacher,
    room: item.room,
    audioAssetId: item.audioAssetId,
    soundKey: item.soundKey,
    templateKey: item.templateKey,
  });
}
