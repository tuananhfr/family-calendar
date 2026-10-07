// Server copy of frontend/src/core/access/capabilities.ts (ARC-02); the backend copy is the one that decides.

export const CAPABILITIES = [
  'calendar.view',
  'calendar.create',
  'calendar.delete',
  'members',
  'groups',
  'finance',
  'health',
  'timetable',
  'storage',
  'settings',
  'backup',
  'permissions',
  'ai',
  'sos.trigger',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const LEVELS = ['NONE', 'VIEW', 'EDIT'] as const;
export type Level = (typeof LEVELS)[number];

export const FAMILY_ROLE_KEYS = ['OWNER', 'ADULT', 'MEMBER', 'SENIOR', 'GUARDIAN', 'GUEST'] as const;
export const GROUP_ROLE_KEYS = ['ORGANIZER', 'PARTICIPANT', 'GUEST'] as const;
export type RoleKey = (typeof FAMILY_ROLE_KEYS)[number] | (typeof GROUP_ROLE_KEYS)[number];

/**
 * Footnotes of §2.2 that a plain level cannot express:
 * OWN_OR_ASSIGNED (¹) — EDIT only on records the actor created or that involve a member they represent;
 * RELATED_MEMBERS (²) — the level only applies to records of represented or guarded members.
 */
export const RESTRICTIONS = ['OWN_OR_ASSIGNED', 'RELATED_MEMBERS'] as const;
export type CapabilityRestriction = (typeof RESTRICTIONS)[number];
export type RoleRestrictions = Partial<Record<Capability, CapabilityRestriction>>;

export type Matrix = Record<Capability, Level>;

function matrix(levels: Partial<Matrix>): Matrix {
  const out = {} as Matrix;
  for (const c of CAPABILITIES) out[c] = levels[c] ?? 'NONE';
  return out;
}

const ALL_EDIT = matrix(Object.fromEntries(CAPABILITIES.map((c) => [c, 'EDIT'])));

export const DEFAULT_ROLE_MATRIX: Record<RoleKey, Matrix> = {
  OWNER: ALL_EDIT,
  ADULT: matrix({ ...ALL_EDIT, settings: 'VIEW', permissions: 'NONE' }),
  MEMBER: matrix({
    'calendar.view': 'VIEW',
    'calendar.create': 'EDIT',
    timetable: 'VIEW',
    storage: 'VIEW',
    'sos.trigger': 'EDIT',
  }),
  SENIOR: matrix({
    'calendar.view': 'VIEW',
    'calendar.create': 'EDIT',
    members: 'VIEW',
    timetable: 'VIEW',
    storage: 'VIEW',
    'sos.trigger': 'EDIT',
  }),
  GUARDIAN: matrix({
    'calendar.view': 'VIEW',
    members: 'VIEW',
    health: 'VIEW',
    timetable: 'VIEW',
    'sos.trigger': 'EDIT',
  }),
  GUEST: matrix({ 'calendar.view': 'VIEW' }),
  // The spec names GROUP roles but gives no matrix; same proposal as the frontend, pending owner review.
  ORGANIZER: matrix({
    'calendar.view': 'EDIT',
    'calendar.create': 'EDIT',
    'calendar.delete': 'EDIT',
    members: 'EDIT',
    groups: 'EDIT',
    storage: 'EDIT',
    settings: 'EDIT',
    backup: 'EDIT',
    permissions: 'EDIT',
    ai: 'EDIT',
  }),
  PARTICIPANT: matrix({ 'calendar.view': 'VIEW', 'calendar.create': 'EDIT', storage: 'VIEW' }),
};

export const DEFAULT_ROLE_RESTRICTIONS: Record<RoleKey, RoleRestrictions> = {
  OWNER: {},
  ADULT: {},
  MEMBER: { 'calendar.create': 'OWN_OR_ASSIGNED' },
  SENIOR: { 'calendar.create': 'OWN_OR_ASSIGNED' },
  GUARDIAN: { health: 'RELATED_MEMBERS' },
  GUEST: {},
  ORGANIZER: {},
  PARTICIPANT: { 'calendar.create': 'OWN_OR_ASSIGNED' },
};

/** UI labels of §2.1, stored as the role name so custom roles and built-ins render the same way. */
export const DEFAULT_ROLE_NAMES: Record<'FAMILY' | 'GROUP', Partial<Record<RoleKey, string>>> = {
  FAMILY: {
    OWNER: 'Chủ gia đình',
    ADULT: 'Thành viên lớn',
    MEMBER: 'Thành viên',
    SENIOR: 'Ông/Bà',
    GUARDIAN: 'Người giám hộ',
    GUEST: 'Khách',
  },
  GROUP: { ORGANIZER: 'Người tổ chức', PARTICIPANT: 'Thành viên', GUEST: 'Khách' },
};

export function roleKeysFor(kind: 'FAMILY' | 'GROUP'): readonly RoleKey[] {
  return kind === 'FAMILY' ? FAMILY_ROLE_KEYS : GROUP_ROLE_KEYS;
}

const RANK: Record<Level, number> = { NONE: 0, VIEW: 1, EDIT: 2 };

export function levelAtLeast(level: Level | undefined, needed: Level): boolean {
  return RANK[level ?? 'NONE'] >= RANK[needed];
}

function asObject(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      return asObject(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** Reads a stored matrix; anything missing or malformed becomes NONE so bad data never widens access. */
export function normalizeMatrix(raw: unknown): Matrix {
  const src = asObject(raw);
  const out = {} as Matrix;
  for (const c of CAPABILITIES) {
    const v = src[c];
    out[c] = (LEVELS as readonly unknown[]).includes(v) ? (v as Level) : 'NONE';
  }
  return out;
}

export function normalizeRestrictions(raw: unknown): RoleRestrictions {
  const src = asObject(raw);
  const out: RoleRestrictions = {};
  for (const c of CAPABILITIES) {
    const v = src[c];
    if ((RESTRICTIONS as readonly unknown[]).includes(v)) out[c] = v as CapabilityRestriction;
  }
  return out;
}
