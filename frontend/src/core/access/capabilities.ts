// Client copy of the role matrix (modules.md §2.2). Frontend only hides/shows; the backend decides.
export const CAPABILITIES = [
  "calendar.view",
  "calendar.create",
  "calendar.delete",
  "members",
  "groups",
  "finance",
  "health",
  "timetable",
  "storage",
  "settings",
  "backup",
  "permissions",
  "ai",
  "sos.trigger",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const LEVELS = ["NONE", "VIEW", "EDIT"] as const;
export type Level = (typeof LEVELS)[number];

export const DEFAULT_ROLE_KEYS = ["OWNER", "ADULT", "MEMBER", "SENIOR", "GUARDIAN", "GUEST"] as const;
export type DefaultRoleKey = (typeof DEFAULT_ROLE_KEYS)[number];

export const GROUP_ROLE_KEYS = ["ORGANIZER", "PARTICIPANT", "GUEST"] as const;
export type GroupRoleKey = (typeof GROUP_ROLE_KEYS)[number];

/**
 * Footnotes of §2.2 that a plain level cannot express:
 * OWN_OR_ASSIGNED (¹) — EDIT only on records the actor created or that involve a member they represent;
 * RELATED_MEMBERS (²) — the level only applies to records of represented or guarded members.
 */
export type CapabilityRestriction = "OWN_OR_ASSIGNED" | "RELATED_MEMBERS";
export type RoleRestrictions = Partial<Record<Capability, CapabilityRestriction>>;

type Matrix = Record<Capability, Level>;

function matrix(levels: Partial<Matrix>): Matrix {
  const out = {} as Matrix;
  for (const c of CAPABILITIES) out[c] = levels[c] ?? "NONE";
  return out;
}

export const DEFAULT_ROLE_MATRIX: Record<DefaultRoleKey, Matrix> = {
  OWNER: matrix({
    "calendar.view": "EDIT",
    "calendar.create": "EDIT",
    "calendar.delete": "EDIT",
    members: "EDIT",
    groups: "EDIT",
    finance: "EDIT",
    health: "EDIT",
    timetable: "EDIT",
    storage: "EDIT",
    settings: "EDIT",
    backup: "EDIT",
    permissions: "EDIT",
    ai: "EDIT",
    "sos.trigger": "EDIT",
  }),
  ADULT: matrix({
    "calendar.view": "EDIT",
    "calendar.create": "EDIT",
    "calendar.delete": "EDIT",
    members: "EDIT",
    groups: "EDIT",
    finance: "EDIT",
    health: "EDIT",
    timetable: "EDIT",
    storage: "EDIT",
    settings: "VIEW",
    backup: "EDIT",
    ai: "EDIT",
    "sos.trigger": "EDIT",
  }),
  MEMBER: matrix({
    "calendar.view": "VIEW",
    "calendar.create": "EDIT",
    timetable: "VIEW",
    storage: "VIEW",
    "sos.trigger": "EDIT",
  }),
  SENIOR: matrix({
    "calendar.view": "VIEW",
    "calendar.create": "EDIT",
    members: "VIEW",
    timetable: "VIEW",
    storage: "VIEW",
    "sos.trigger": "EDIT",
  }),
  GUARDIAN: matrix({
    "calendar.view": "VIEW",
    members: "VIEW",
    health: "VIEW",
    timetable: "VIEW",
    "sos.trigger": "EDIT",
  }),
  GUEST: matrix({ "calendar.view": "VIEW" }),
};

export const DEFAULT_ROLE_RESTRICTIONS: Record<DefaultRoleKey, RoleRestrictions> = {
  OWNER: {},
  ADULT: {},
  MEMBER: { "calendar.create": "OWN_OR_ASSIGNED" },
  SENIOR: { "calendar.create": "OWN_OR_ASSIGNED" },
  GUARDIAN: { health: "RELATED_MEMBERS" },
  GUEST: {},
};

// The spec names GROUP roles but gives no matrix; these levels are a proposal pending owner review.
export const GROUP_ROLE_MATRIX: Record<GroupRoleKey, Matrix> = {
  ORGANIZER: matrix({
    "calendar.view": "EDIT",
    "calendar.create": "EDIT",
    "calendar.delete": "EDIT",
    members: "EDIT",
    groups: "EDIT",
    storage: "EDIT",
    settings: "EDIT",
    backup: "EDIT",
    permissions: "EDIT",
    ai: "EDIT",
  }),
  PARTICIPANT: matrix({ "calendar.view": "VIEW", "calendar.create": "EDIT", storage: "VIEW" }),
  GUEST: matrix({ "calendar.view": "VIEW" }),
};

export const GROUP_ROLE_RESTRICTIONS: Record<GroupRoleKey, RoleRestrictions> = {
  ORGANIZER: {},
  PARTICIPANT: { "calendar.create": "OWN_OR_ASSIGNED" },
  GUEST: {},
};

const RANK: Record<Level, number> = { NONE: 0, VIEW: 1, EDIT: 2 };

export function levelAtLeast(level: Level | undefined, needed: Level): boolean {
  return RANK[level ?? "NONE"] >= RANK[needed];
}
