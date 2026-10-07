import { isSpecialDayPreset, type Category, type Preset, type SpaceKind, type SpecialDayPreset } from "@/core/model/common";
import { defaultsForPreset } from "@/core/model/item";
import type { LocalDate } from "@/core/time/local-date";
import { formToItem, ItemFormError, type ItemFormValues } from "./form-to-item";

/** The four choices of "Thêm mới"; SPECIAL is an EVENT preset in the data model (ui-ux.md Modal note). */
export const ITEM_TYPES = ["EVENT", "TASK", "REMINDER", "SPECIAL"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** Category row of the Add New modal (IMG-B). */
export const QUICK_CATEGORIES = ["STUDY", "HEALTH", "FINANCE", "SHOPPING", "DOCUMENT", "OTHER"] as const satisfies readonly Category[];

export function itemTypeOf(v: Pick<ItemFormValues, "kind" | "preset">): ItemType {
  if (v.kind === "EVENT" && isSpecialDayPreset(v.preset)) return "SPECIAL";
  return v.kind;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Next full hour, one hour long; capped at 22:00–23:00 so the slot never crosses midnight. */
export function nextSlot(nowTime: string): { startTime: string; endTime: string } {
  const hour = Math.min(Number(nowTime.slice(0, 2)) + 1, 22);
  return { startTime: `${pad(hour)}:00`, endTime: `${pad(hour + 1)}:00` };
}

function scopeFor(kind: ItemFormValues["kind"], preset: Preset, category: Category, spaceKind: SpaceKind) {
  // Health is sensitive whatever the preset, so it starts private like medication (domain-model.md).
  if (category === "HEALTH") return "PRIVATE" as const;
  return defaultsForPreset(kind, preset, spaceKind).sharingScope;
}

export interface NewFormContext {
  date: LocalDate;
  /** Wall clock "HH:mm" in the Space time zone. */
  nowTime: string;
  spaceKind?: SpaceKind;
  memberIds?: string[];
}

export function newFormValues(type: ItemType, ctx: NewFormContext): ItemFormValues {
  const spaceKind = ctx.spaceKind ?? "FAMILY";
  const slot = nextSlot(ctx.nowTime);
  const common = {
    title: "",
    date: ctx.date,
    memberIds: [...(ctx.memberIds ?? [])],
    checklist: [],
    channels: ["IN_APP" as const],
    showOnCalendar: true,
    calendarSystem: "SOLAR" as const,
    attachments: [],
    priority: "MEDIUM" as const,
    repeat: { kind: "NONE" as const },
  };
  const make = (v: Omit<ItemFormValues, keyof typeof common | "sharingScope">): ItemFormValues => ({
    ...common,
    ...v,
    sharingScope: scopeFor(v.kind, v.preset, v.category, spaceKind),
  });
  switch (type) {
    case "EVENT":
      return make({ kind: "EVENT", preset: "EVENT", category: "FAMILY", allDay: false, ...slot, createReminder: false, reminderOffsets: [30] });
    case "TASK":
      return make({ kind: "TASK", preset: "PERSONAL", category: "OTHER", allDay: true, createReminder: false, reminderOffsets: [0] });
    case "REMINDER":
      return make({ kind: "REMINDER", preset: "REMEMBER", category: "OTHER", allDay: false, startTime: slot.startTime, createReminder: true, reminderOffsets: [10] });
    case "SPECIAL":
      return {
        ...make({ kind: "EVENT", preset: "SPECIAL_DAY", category: "SPECIAL", allDay: true, createReminder: true, reminderOffsets: [1440] }),
        repeat: { kind: "YEARLY" },
      };
  }
}

function presetFor(type: ItemType, category: Category, current: Preset): Preset {
  switch (type) {
    case "REMINDER":
      return category === "HEALTH" ? "MEDICATION" : category === "FINANCE" ? "PAYMENT" : category === "DOCUMENT" ? "DOCUMENT" : "REMEMBER";
    case "TASK":
      return category === "SHOPPING" ? "SHOPPING" : category === "HOUSEWORK" ? "HOUSEWORK" : "PERSONAL";
    case "EVENT":
      if (category === "HEALTH") return "APPOINTMENT";
      return current === "APPOINTMENT" || current === "TIMETABLE" ? current : "EVENT";
    case "SPECIAL":
      return current;
  }
}

/** Category row click: the preset follows so medication/payment/document reminders get their privacy defaults. */
export function changeCategory(v: ItemFormValues, category: Category, spaceKind: SpaceKind = "FAMILY"): ItemFormValues {
  const preset = presetFor(itemTypeOf(v), category, v.preset);
  return { ...v, category, preset, sharingScope: scopeFor(v.kind, preset, category, spaceKind) };
}

/** Type switch keeps what the user typed (title, note, date, people, place, checklist). */
export function changeType(v: ItemFormValues, type: ItemType, spaceKind: SpaceKind = "FAMILY"): ItemFormValues {
  const from = itemTypeOf(v);
  if (from === type) return v;
  const fresh = newFormValues(type, { date: v.date, nowTime: "07:00", spaceKind });
  const timed = !fresh.allDay;
  const next: ItemFormValues = {
    ...fresh,
    title: v.title,
    description: v.description,
    memberIds: [...v.memberIds],
    locationText: v.locationText,
    checklist: [...v.checklist],
    priority: v.priority,
    startTime: timed ? (v.startTime ?? fresh.startTime) : undefined,
    endTime: timed && fresh.endTime !== undefined ? (v.endTime ?? fresh.endTime) : undefined,
  };
  if (from === "SPECIAL" || type === "SPECIAL") return next;
  return changeCategory(next, v.category, spaceKind);
}

/** Rules the data schema can't express but the form asks for (IMG-B: "Ai cần nhắc?*", "Kênh nhắc*"). */
export function formUiErrors(v: ItemFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (v.kind === "REMINDER" && v.memberIds.length === 0) errors.memberIds = "MEMBERS_REQUIRED";
  if ((v.kind === "REMINDER" || v.createReminder) && v.channels.length === 0) errors.channels = "CHANNELS_REQUIRED";
  return errors;
}

// Placeholder ids for a dry run: validation needs syntactically valid ids, never real ones.
const DRY_ID = "00000000-0000-4000-8000-000000000000";

/** Every problem in the form at once (schema + form-only rules), as field → error code. */
export function validateItemForm(v: ItemFormValues, timeZone: string, spaceKind: SpaceKind = "FAMILY"): Record<string, string> {
  const errors = formUiErrors(v);
  try {
    formToItem(v, { spaceId: DRY_ID, actorId: DRY_ID, timeZone, spaceKind });
  } catch (e) {
    if (!(e instanceof ItemFormError)) throw e;
    return { ...e.fields, ...errors };
  }
  return errors;
}

/** "Loại ngày" of a special day; a giỗ is kept by the lunar calendar in Vietnamese families, so it switches to LUNAR. */
export function changeSpecialKind(v: ItemFormValues, preset: SpecialDayPreset): ItemFormValues {
  return { ...v, preset, calendarSystem: preset === "DEATH_ANNIVERSARY" ? "LUNAR" : v.calendarSystem };
}
