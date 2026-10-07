// Server copy of frontend/src/core/model/common.ts enums (ARC-02); the registry validators check against these.

export const ITEM_KINDS = ['EVENT', 'REMINDER', 'TASK'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const SPECIAL_DAY_PRESETS = ['SPECIAL_DAY', 'BIRTHDAY', 'ANNIVERSARY', 'DEATH_ANNIVERSARY', 'HOLIDAY'] as const;

export const PRESETS_BY_KIND: Record<ItemKind, readonly string[]> = {
  EVENT: ['TIMETABLE', 'APPOINTMENT', 'EVENT', ...SPECIAL_DAY_PRESETS, 'OTHER'],
  REMINDER: ['MEDICATION', 'DOCUMENT', 'PAYMENT', 'REMEMBER', 'OTHER'],
  TASK: ['PERSONAL', 'HOUSEWORK', 'GROUP', 'SHOPPING'],
};

export const ALL_PRESETS = [...new Set(Object.values(PRESETS_BY_KIND).flat())] as readonly string[];

export function isPresetOfKind(kind: string, preset: string): boolean {
  return (PRESETS_BY_KIND[kind as ItemKind] ?? []).includes(preset);
}

export const CATEGORIES = [
  'STUDY',
  'HOUSEWORK',
  'FAMILY',
  'HEALTH',
  'FINANCE',
  'SHOPPING',
  'DOCUMENT',
  'ACTIVITY',
  'SPORT',
  'SPECIAL',
  'OTHER',
] as const;

export const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export const CHANNELS = ['IN_APP', 'PUSH', 'EMAIL', 'SMS'] as const;
export const PROFILES = ['PARENT', 'SENIOR', 'CHILD'] as const;
export const RELATIONSHIPS = [
  'FATHER',
  'MOTHER',
  'SON',
  'DAUGHTER',
  'GRANDFATHER',
  'GRANDMOTHER',
  'GUARDIAN',
  'OTHER',
] as const;

export const EXPENSE_CATEGORIES = [
  'FOOD',
  'EDUCATION',
  'LIVING',
  'HEALTH',
  'ENTERTAINMENT',
  'TRANSPORT',
  'HOUSING',
  'BILLS',
  'SHOPPING',
  'OTHER',
] as const;
export const INCOME_CATEGORIES = ['SALARY', 'BONUS', 'BUSINESS', 'OTHER'] as const;
export const FINANCE_CATEGORIES = [...EXPENSE_CATEGORIES, 'SALARY', 'BONUS', 'BUSINESS', 'TRANSFER'] as const;

export function categoriesForTxnType(type: string): readonly string[] {
  if (type === 'INCOME') return INCOME_CATEGORIES;
  if (type === 'EXPENSE') return EXPENSE_CATEGORIES;
  return ['TRANSFER'];
}

export const FILE_KINDS = ['IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO', 'OTHER'] as const;
const MB = 1024 * 1024;
export const MAX_FILE_BYTES: Record<(typeof FILE_KINDS)[number], number> = {
  IMAGE: 25 * MB,
  DOCUMENT: 25 * MB,
  VIDEO: 200 * MB,
  AUDIO: 25 * MB,
  OTHER: 25 * MB,
};

export const SYSTEM_FOLDER_KEYS = ['PHOTOS', 'DOCUMENTS', 'STUDY', 'HEALTH', 'VIDEOS', 'OTHER'] as const;
export const AUTOMATION_RULES = ['PAYMENT_DUE_REMINDER', 'WEEKLY_SUMMARY', 'EXAM_REVIEW_TASK'] as const;
export const OCCURRENCE_KEY_MAX = 100;
