// Shared domain enums (modules.md §3, §4; domain-model.md Scope và data class). Arrays are the single source for
// zod enums and UI pickers; types derive from them so the two never drift.

export const SPACE_KINDS = ["FAMILY", "GROUP"] as const;
export type SpaceKind = (typeof SPACE_KINDS)[number];

export const ITEM_KINDS = ["EVENT", "REMINDER", "TASK"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const SPECIAL_DAY_PRESETS = ["SPECIAL_DAY", "BIRTHDAY", "ANNIVERSARY", "DEATH_ANNIVERSARY", "HOLIDAY"] as const;

export const PRESETS_BY_KIND = {
  EVENT: ["TIMETABLE", "APPOINTMENT", "EVENT", ...SPECIAL_DAY_PRESETS, "OTHER"],
  REMINDER: ["MEDICATION", "DOCUMENT", "PAYMENT", "REMEMBER", "OTHER"],
  TASK: ["PERSONAL", "HOUSEWORK", "GROUP", "SHOPPING"],
} as const;
export type EventPreset = (typeof PRESETS_BY_KIND.EVENT)[number];
export type ReminderPreset = (typeof PRESETS_BY_KIND.REMINDER)[number];
export type TaskPreset = (typeof PRESETS_BY_KIND.TASK)[number];
export type Preset = EventPreset | ReminderPreset | TaskPreset;
export type SpecialDayPreset = (typeof SPECIAL_DAY_PRESETS)[number];

/** Every preset once (OTHER is shared by EVENT and REMINDER). */
export const ALL_PRESETS = [
  "TIMETABLE",
  "APPOINTMENT",
  "EVENT",
  "SPECIAL_DAY",
  "BIRTHDAY",
  "ANNIVERSARY",
  "DEATH_ANNIVERSARY",
  "HOLIDAY",
  "OTHER",
  "MEDICATION",
  "DOCUMENT",
  "PAYMENT",
  "REMEMBER",
  "PERSONAL",
  "HOUSEWORK",
  "GROUP",
  "SHOPPING",
] as const satisfies readonly Preset[];

export function isPresetOfKind(kind: ItemKind, preset: string): preset is Preset {
  return (PRESETS_BY_KIND[kind] as readonly string[]).includes(preset);
}

export function isSpecialDayPreset(preset: string): preset is SpecialDayPreset {
  return (SPECIAL_DAY_PRESETS as readonly string[]).includes(preset);
}

export const CATEGORIES = [
  "STUDY",
  "HOUSEWORK",
  "FAMILY",
  "HEALTH",
  "FINANCE",
  "SHOPPING",
  "DOCUMENT",
  "ACTIVITY",
  "SPORT",
  "SPECIAL",
  "OTHER",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CHANNELS = ["IN_APP", "PUSH", "EMAIL", "SMS"] as const;
export type Channel = (typeof CHANNELS)[number];

export const DATA_CLASSES = ["NORMAL", "PRIVATE", "SENSITIVE"] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

export const FAMILY_SCOPES = ["FAMILY_ALL", "PARENTS_SENIORS", "PARENTS_CHILDREN", "PRIVATE"] as const;
export const GROUP_SCOPES = ["GROUP_MEMBERS", "GROUP_MANAGERS", "PRIVATE"] as const;
export const SHARING_SCOPES = [
  "FAMILY_ALL",
  "PARENTS_SENIORS",
  "PARENTS_CHILDREN",
  "PRIVATE",
  "GROUP_MEMBERS",
  "GROUP_MANAGERS",
] as const;
export type SharingScope = (typeof SHARING_SCOPES)[number];

export function scopesForSpace(kind: SpaceKind): readonly SharingScope[] {
  return kind === "FAMILY" ? FAMILY_SCOPES : GROUP_SCOPES;
}

export const PROFILES = ["PARENT", "SENIOR", "CHILD"] as const;
export type Profile = (typeof PROFILES)[number];

export const RELATIONSHIPS = [
  "FATHER",
  "MOTHER",
  "SON",
  "DAUGHTER",
  "GRANDFATHER",
  "GRANDMOTHER",
  "GUARDIAN",
  "OTHER",
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

const PROFILE_BY_RELATIONSHIP: Record<Relationship, Profile> = {
  FATHER: "PARENT",
  MOTHER: "PARENT",
  SON: "CHILD",
  DAUGHTER: "CHILD",
  GRANDFATHER: "SENIOR",
  GRANDMOTHER: "SENIOR",
  GUARDIAN: "PARENT",
  OTHER: "PARENT",
};

/** Default profile suggested from the relationship; the user can still change it (modules.md §3). */
export function profileForRelationship(relationship: Relationship): Profile {
  return PROFILE_BY_RELATIONSHIP[relationship];
}

export const CALENDAR_SYSTEMS = ["SOLAR", "LUNAR"] as const;
export type CalendarSystem = (typeof CALENDAR_SYSTEMS)[number];

export const SYNC_STATES = ["LOCAL", "PENDING", "SYNCED", "CONFLICT"] as const;
export type SyncState = (typeof SYNC_STATES)[number];

export const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";
