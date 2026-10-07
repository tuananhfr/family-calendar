// Server copy of frontend/src/core/access/evaluate.ts (ARC-02): same rules, but here they are enforced.
import { levelAtLeast, type Capability, type Level, type RoleRestrictions } from './role-matrix';

export type SpaceKind = 'FAMILY' | 'GROUP';
export type Profile = 'PARENT' | 'SENIOR' | 'CHILD';

export const FAMILY_SCOPES = ['FAMILY_ALL', 'PARENTS_SENIORS', 'PARENTS_CHILDREN', 'PRIVATE'] as const;
export const GROUP_SCOPES = ['GROUP_MEMBERS', 'GROUP_MANAGERS', 'PRIVATE'] as const;

export interface SpaceAccessContext {
  actorId: string;
  deviceId: string;
  spaceId: string;
  spaceKind: SpaceKind;
  roleKey: string;
  matrix: Record<Capability, Level>;
  /** Footnotes ¹/² of the role (§2.2); empty for an unrestricted role. */
  restrictions: RoleRestrictions;
  representedMemberIds: string[];
  representedProfiles: Profile[];
  guardianOfMemberIds: string[];
  policyVersion: string;
}

export interface AccessRecord {
  createdByActorId: string;
  sharingScope: string;
  dataClass: string;
  memberIds?: string[];
  ownerMemberId?: string;
}

export interface ItemClassification {
  preset: string;
  category: string;
}

export function isScopeValidForSpace(scope: string, kind: SpaceKind): boolean {
  return (kind === 'FAMILY' ? (FAMILY_SCOPES as readonly string[]) : (GROUP_SCOPES as readonly string[])).includes(
    scope,
  );
}

/** Capabilities that grant access to an item, most specific first (§2.3 step 2). */
export function itemCapabilities(item: ItemClassification): Capability[] {
  if (item.category === 'HEALTH' || item.preset === 'MEDICATION') return ['health'];
  if (item.preset === 'TIMETABLE') return ['timetable'];
  // §2.3: finance items are reachable through `finance` OR the calendar capabilities.
  if (item.category === 'FINANCE' || item.preset === 'PAYMENT') return ['finance', 'calendar.view'];
  return ['calendar.view'];
}

function related(rec: AccessRecord): string[] {
  return rec.ownerMemberId ? [...(rec.memberIds ?? []), rec.ownerMemberId] : (rec.memberIds ?? []);
}

function representsAny(ctx: SpaceAccessContext, ids: string[]): boolean {
  return ids.some((id) => ctx.representedMemberIds.includes(id));
}

function guardsAny(ctx: SpaceAccessContext, ids: string[]): boolean {
  return ids.some((id) => ctx.guardianOfMemberIds.includes(id));
}

function inAudience(ctx: SpaceAccessContext, rec: AccessRecord): boolean {
  // A scope from the other Space kind (or an unknown one) is invalid data; fail closed for everyone.
  if (!isScopeValidForSpace(rec.sharingScope, ctx.spaceKind)) return false;
  const isCreator = rec.createdByActorId === ctx.actorId;
  if (rec.sharingScope === 'PRIVATE') return isCreator;
  if (isCreator) return true;
  const profiles = ctx.representedProfiles;
  switch (rec.sharingScope) {
    case 'FAMILY_ALL':
    case 'GROUP_MEMBERS':
      return true;
    case 'PARENTS_SENIORS':
      return profiles.includes('PARENT') || profiles.includes('SENIOR');
    case 'PARENTS_CHILDREN':
      return profiles.includes('PARENT') || profiles.includes('CHILD');
    case 'GROUP_MANAGERS':
      return ctx.matrix.members === 'EDIT';
    default:
      return false;
  }
}

function hasCapability(ctx: SpaceAccessContext, rec: AccessRecord, cap: Capability, needed: Level): boolean {
  const ids = related(rec);
  if (cap === 'health') {
    // Footnote ²: own health records are always visible/editable; guarded members' are viewable.
    if (representsAny(ctx, ids)) return true;
    if (needed === 'VIEW' && guardsAny(ctx, ids)) return true;
  }
  if (!levelAtLeast(ctx.matrix[cap], needed)) return false;
  switch (ctx.restrictions[cap]) {
    case 'OWN_OR_ASSIGNED':
      return rec.createdByActorId === ctx.actorId || representsAny(ctx, ids);
    case 'RELATED_MEMBERS':
      return representsAny(ctx, ids) || guardsAny(ctx, ids);
    default:
      return true;
  }
}

function sensitiveAllowed(ctx: SpaceAccessContext, rec: AccessRecord, needed: Level): boolean {
  if (rec.dataClass !== 'SENSITIVE' || rec.createdByActorId === ctx.actorId) return true;
  return hasCapability(ctx, rec, 'health', needed);
}

function evaluate(ctx: SpaceAccessContext, rec: AccessRecord, cap: Capability, needed: Level): boolean {
  return inAudience(ctx, rec) && hasCapability(ctx, rec, cap, needed) && sensitiveAllowed(ctx, rec, needed);
}

/**
 * Read (VIEW) or create/update (EDIT) check, in the order of §2.3: scope audience (PRIVATE wins), role level
 * with its footnote restriction, then the SENSITIVE rule. EDIT on `calendar.view` means `calendar.create`.
 */
export function canRecord(
  ctx: SpaceAccessContext,
  rec: AccessRecord,
  cap: Capability,
  level: 'VIEW' | 'EDIT',
): boolean {
  const effective = level === 'EDIT' && cap === 'calendar.view' ? 'calendar.create' : cap;
  return evaluate(ctx, rec, effective, level);
}

/** Delete check; every calendar capability maps to `calendar.delete`. */
export function canDeleteRecord(ctx: SpaceAccessContext, rec: AccessRecord, cap: Capability): boolean {
  return evaluate(ctx, rec, cap.startsWith('calendar.') ? 'calendar.delete' : cap, 'EDIT');
}

// Child resources (exceptions, occurrence states, checklist, reminder rules) follow their parent item.
export function canRecordItem(
  ctx: SpaceAccessContext,
  item: AccessRecord & ItemClassification,
  level: 'VIEW' | 'EDIT',
): boolean {
  return itemCapabilities(item).some((cap) => canRecord(ctx, item, cap, level));
}

export function canDeleteItem(ctx: SpaceAccessContext, item: AccessRecord & ItemClassification): boolean {
  return itemCapabilities(item).some((cap) => canDeleteRecord(ctx, item, cap));
}

/** Capability check without a record (endpoints that are not tied to one resource). */
export function hasLevel(ctx: SpaceAccessContext, cap: Capability, needed: Level = 'VIEW'): boolean {
  return levelAtLeast(ctx.matrix[cap], needed);
}
