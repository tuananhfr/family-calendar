import { z } from "zod";
import { parseRrule } from "../recurrence/expand";
import { toFloating } from "../recurrence/floating";
import { validateLunarRule } from "../recurrence/lunar-rule";
import { isLocalDate } from "../time/local-date";
import { isLocalDateTime } from "../time/zoned";
import {
  baseRecordShape,
  idSchema,
  localDateSchema,
  moneySchema,
  optionalText,
  requiredText,
  timeZoneSchema,
  uniqueArray,
} from "./base";
import {
  ALL_PRESETS,
  CALENDAR_SYSTEMS,
  CATEGORIES,
  ITEM_KINDS,
  PRIORITIES,
  isPresetOfKind,
  isSpecialDayPreset,
  scopesForSpace,
  type Category,
  type DataClass,
  type ItemKind,
  type Preset,
  type SharingScope,
  type SpaceKind,
} from "./common";

export const lunarRuleSchema = z
  .object({
    freq: z.enum(["YEARLY", "MONTHLY"]),
    day: z.int(),
    month: z.int().optional(),
    includeLeap: z.boolean(),
    until: localDateSchema.optional(),
  })
  .superRefine((rule, ctx) => {
    try {
      validateLunarRule(rule);
    } catch {
      ctx.addIssue({ code: "custom", message: "LUNAR_RULE_INVALID" });
    }
  });

export const scheduleSchema = z
  .object({
    allDay: z.boolean(),
    start: z.string(),
    end: z.string().optional(),
    timeZone: timeZoneSchema,
    rrule: z.string().max(500, { error: "RRULE_TOO_LONG" }).optional(),
    lunarRule: lunarRuleSchema.optional(),
  })
  .superRefine((s, ctx) => {
    const ok = s.allDay ? isLocalDate : isLocalDateTime;
    if (!ok(s.start) || (s.end !== undefined && !ok(s.end))) {
      ctx.addIssue({ code: "custom", message: "SCHEDULE_SHAPE", path: ["start"] });
      return;
    }
    if (s.end !== undefined && s.end < s.start) ctx.addIssue({ code: "custom", message: "END_BEFORE_START", path: ["end"] });
    if (s.rrule) {
      try {
        parseRrule(s.rrule, toFloating(s.start));
      } catch {
        ctx.addIssue({ code: "custom", message: "RRULE_INVALID", path: ["rrule"] });
      }
    }
  });

export const itemSchema = z
  .object({
    ...baseRecordShape,
    kind: z.enum(ITEM_KINDS),
    preset: z.enum(ALL_PRESETS),
    title: requiredText(200, "TITLE"),
    schedule: scheduleSchema,
    memberIds: uniqueArray(idSchema, 50, "MEMBERS"),
    responsibleMemberId: idSchema.nullable().optional(),
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    note: optionalText(2000, "NOTE"),
    locationText: optionalText(200, "LOCATION"),
    /** File ids in Kho lưu trữ. */
    attachments: uniqueArray(idSchema, 20, "ATTACHMENTS"),
    showOnCalendar: z.boolean(),
    calendarSystem: z.enum(CALENDAR_SYSTEMS),
    templateKey: z.string().max(100).optional(),
    /** Completion of a non-recurring TASK; recurring items use occurrence_state. */
    completedAt: z.string().nullable().optional(),
    /** PAYMENT: integer VND. */
    amount: moneySchema.optional(),
    currency: z.literal("VND").optional(),
    /** DOCUMENT: kind of paper (CCCD, hộ chiếu…), free text. */
    documentType: optionalText(100, "DOCUMENT_TYPE"),
    /** TIMETABLE fields. */
    subject: optionalText(100, "SUBJECT"),
    teacher: optionalText(100, "TEACHER"),
    room: optionalText(50, "ROOM"),
    audioAssetId: idSchema.optional(),
    soundKey: z.string().max(50).optional(),
    sourceReference: z.string().max(200).optional(),
  })
  .superRefine((item, ctx) => {
    if (!isPresetOfKind(item.kind, item.preset)) {
      ctx.addIssue({ code: "custom", message: "PRESET_NOT_IN_KIND", path: ["preset"] });
    }
    if (item.calendarSystem === "LUNAR" && !item.schedule.lunarRule) {
      ctx.addIssue({ code: "custom", message: "LUNAR_RULE_REQUIRED", path: ["schedule", "lunarRule"] });
    }
    if (item.calendarSystem === "SOLAR" && item.schedule.lunarRule) {
      ctx.addIssue({ code: "custom", message: "LUNAR_RULE_NOT_ALLOWED", path: ["schedule", "lunarRule"] });
    }
  });

export type Item = z.infer<typeof itemSchema>;
export type ItemSchedule = z.infer<typeof scheduleSchema>;

/** itemSchema plus the check that `sharingScope` belongs to the Space kind (FAMILY_* vs GROUP_*). */
export function itemSchemaForSpace(kind: SpaceKind) {
  return itemSchema.refine((item) => scopesForSpace(kind).includes(item.sharingScope), {
    error: "SCOPE_NOT_IN_SPACE",
    path: ["sharingScope"],
  });
}

interface PresetDefaults {
  category: Category;
  dataClass: DataClass;
  sharingScope: SharingScope;
}

const NORMAL_FAMILY = { dataClass: "NORMAL", sharingScope: "FAMILY_ALL" } as const;

// Conservative defaults from domain-model.md "Scope và data class"; the user can widen them in the form.
function familyDefaults(preset: Preset): PresetDefaults {
  if (preset === "MEDICATION") return { category: "HEALTH", dataClass: "SENSITIVE", sharingScope: "PRIVATE" };
  if (preset === "PAYMENT") return { category: "FINANCE", dataClass: "PRIVATE", sharingScope: "PRIVATE" };
  if (preset === "DOCUMENT") return { category: "DOCUMENT", dataClass: "PRIVATE", sharingScope: "PRIVATE" };
  if (preset === "TIMETABLE") return { category: "STUDY", ...NORMAL_FAMILY };
  if (isSpecialDayPreset(preset)) return { category: "SPECIAL", ...NORMAL_FAMILY };
  if (preset === "HOUSEWORK") return { category: "HOUSEWORK", ...NORMAL_FAMILY };
  if (preset === "SHOPPING") return { category: "SHOPPING", ...NORMAL_FAMILY };
  if (preset === "APPOINTMENT" || preset === "EVENT") return { category: "FAMILY", ...NORMAL_FAMILY };
  return { category: "OTHER", ...NORMAL_FAMILY };
}

/** Default category / data class / audience for a new item of this preset. */
export function defaultsForPreset(kind: ItemKind, preset: Preset, spaceKind: SpaceKind = "FAMILY"): PresetDefaults {
  if (!isPresetOfKind(kind, preset)) throw new RangeError(`Preset ${preset} does not belong to ${kind}`);
  const d = familyDefaults(preset);
  if (spaceKind === "GROUP" && d.sharingScope !== "PRIVATE") return { ...d, sharingScope: "GROUP_MEMBERS" };
  return d;
}
