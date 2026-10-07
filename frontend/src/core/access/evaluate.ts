import { scopesForSpace, type Category, type ItemKind, type Preset, type Profile, type SharingScope, type SpaceKind } from "../model/common";
import type { BaseRecord } from "../sync/resource-types";
import {
  DEFAULT_ROLE_MATRIX,
  DEFAULT_ROLE_RESTRICTIONS,
  GROUP_ROLE_MATRIX,
  GROUP_ROLE_RESTRICTIONS,
  levelAtLeast,
  type Capability,
  type DefaultRoleKey,
  type GroupRoleKey,
  type Level,
  type RoleRestrictions,
} from "./capabilities";

export interface AccessContext {
  actorId: string;
  roleMatrix: Record<Capability, Level>;
  representedMemberIds: string[];
  representedProfiles: Profile[];
  spaceKind: "FAMILY" | "GROUP";
  /** Members this actor is guardian of (§2.2 footnote ²: may view their health records). */
  guardedMemberIds?: string[];
  /** Footnotes ¹/² of the actor's role; omit for an unrestricted matrix. */
  restrictions?: RoleRestrictions;
  /** Audience of GROUP_MANAGERS; defaults to having EDIT on `members`. */
  isManager?: boolean;
}

export type AccessRecord = BaseRecord & { memberIds?: string[]; memberId?: string };

type ItemLike = Pick<{ kind: ItemKind; preset: Preset; category: Category }, "kind" | "preset" | "category">;

/** Builds a context from a built-in role (FAMILY or GROUP matrix by `spaceKind`). */
export function accessContextFor(
  role: DefaultRoleKey | GroupRoleKey,
  input: Omit<AccessContext, "roleMatrix" | "restrictions">,
): AccessContext {
  if (input.spaceKind === "GROUP") {
    if (!(role in GROUP_ROLE_MATRIX)) throw new RangeError(`Role ${role} does not exist in a GROUP space`);
    const key = role as GroupRoleKey;
    return { ...input, roleMatrix: GROUP_ROLE_MATRIX[key], restrictions: GROUP_ROLE_RESTRICTIONS[key] };
  }
  if (!(role in DEFAULT_ROLE_MATRIX)) throw new RangeError(`Role ${role} does not exist in a FAMILY space`);
  const key = role as DefaultRoleKey;
  return { ...input, roleMatrix: DEFAULT_ROLE_MATRIX[key], restrictions: DEFAULT_ROLE_RESTRICTIONS[key] };
}

export function isScopeValidForSpace(scope: SharingScope, kind: SpaceKind): boolean {
  return scopesForSpace(kind).includes(scope);
}

/** Capabilities that grant access to an item, most specific first (§2.3 step 2). */
export function itemCapabilities(item: ItemLike): Capability[] {
  if (item.category === "HEALTH" || item.preset === "MEDICATION") return ["health"];
  if (item.preset === "TIMETABLE") return ["timetable"];
  // §2.3: finance items are reachable through `finance` OR the calendar capabilities.
  if (item.category === "FINANCE" || item.preset === "PAYMENT") return ["finance", "calendar.view"];
  return ["calendar.view"];
}

export function capabilityForItem(item: ItemLike): Capability {
  return itemCapabilities(item)[0];
}

function related(rec: AccessRecord): string[] {
  return rec.memberId ? [...(rec.memberIds ?? []), rec.memberId] : (rec.memberIds ?? []);
}

function representsAny(ctx: AccessContext, ids: string[]): boolean {
  return ids.some((id) => ctx.representedMemberIds.includes(id));
}

function guardsAny(ctx: AccessContext, ids: string[]): boolean {
  return !!ctx.guardedMemberIds && ids.some((id) => ctx.guardedMemberIds!.includes(id));
}

function inAudience(ctx: AccessContext, rec: AccessRecord): boolean {
  // A scope from the other Space kind is invalid data; fail closed for everyone.
  if (!isScopeValidForSpace(rec.sharingScope, ctx.spaceKind)) return false;
  const isCreator = rec.createdByActorId === ctx.actorId;
  if (rec.sharingScope === "PRIVATE") return isCreator;
  if (isCreator) return true;
  const profiles = ctx.representedProfiles;
  switch (rec.sharingScope) {
    case "FAMILY_ALL":
    case "GROUP_MEMBERS":
      return true;
    case "PARENTS_SENIORS":
      return profiles.includes("PARENT") || profiles.includes("SENIOR");
    case "PARENTS_CHILDREN":
      return profiles.includes("PARENT") || profiles.includes("CHILD");
    case "GROUP_MANAGERS":
      return ctx.isManager ?? ctx.roleMatrix.members === "EDIT";
  }
}

function hasCapability(ctx: AccessContext, rec: AccessRecord, cap: Capability, needed: Level): boolean {
  const ids = related(rec);
  if (cap === "health") {
    // Footnote ²: own health records are always visible/editable; guarded members' are viewable.
    if (representsAny(ctx, ids)) return true;
    if (needed === "VIEW" && guardsAny(ctx, ids)) return true;
  }
  if (!levelAtLeast(ctx.roleMatrix[cap], needed)) return false;
  switch (ctx.restrictions?.[cap]) {
    case "OWN_OR_ASSIGNED":
      return rec.createdByActorId === ctx.actorId || representsAny(ctx, ids);
    case "RELATED_MEMBERS":
      return representsAny(ctx, ids) || guardsAny(ctx, ids);
    default:
      return true;
  }
}

function sensitiveAllowed(ctx: AccessContext, rec: AccessRecord, needed: Level): boolean {
  if (rec.dataClass !== "SENSITIVE" || rec.createdByActorId === ctx.actorId) return true;
  return hasCapability(ctx, rec, "health", needed);
}

function evaluate(ctx: AccessContext, rec: AccessRecord, cap: Capability, needed: Level): boolean {
  return inAudience(ctx, rec) && hasCapability(ctx, rec, cap, needed) && sensitiveAllowed(ctx, rec, needed);
}

/** Read check: role level ≥ VIEW, PRIVATE creator-only, scope audience, SENSITIVE rule (§2.3). */
export function canRead(ctx: AccessContext, rec: AccessRecord, cap: Capability): boolean {
  return evaluate(ctx, rec, cap, "VIEW");
}

/** Write check; for calendar data pass `calendar.view` (or `calendar.create`) — writes need calendar.create. */
export function canWrite(ctx: AccessContext, rec: AccessRecord, cap: Capability): boolean {
  return evaluate(ctx, rec, cap === "calendar.view" ? "calendar.create" : cap, "EDIT");
}

/** Delete check; any calendar capability maps to calendar.delete. */
export function canDelete(ctx: AccessContext, rec: AccessRecord, cap: Capability): boolean {
  return evaluate(ctx, rec, cap.startsWith("calendar.") ? "calendar.delete" : cap, "EDIT");
}

// Child resources (exceptions, occurrence states, checklist, reminder rules) follow their parent item.
export function canReadItem(ctx: AccessContext, item: AccessRecord & ItemLike): boolean {
  return itemCapabilities(item).some((cap) => canRead(ctx, item, cap));
}

export function canWriteItem(ctx: AccessContext, item: AccessRecord & ItemLike): boolean {
  return itemCapabilities(item).some((cap) => canWrite(ctx, item, cap));
}

export function canDeleteItem(ctx: AccessContext, item: AccessRecord & ItemLike): boolean {
  return itemCapabilities(item).some((cap) => canDelete(ctx, item, cap));
}

/** Pure capability check without a record (menu items, buttons). */
export function hasLevel(ctx: AccessContext, cap: Capability, needed: Level = "VIEW"): boolean {
  return levelAtLeast(ctx.roleMatrix[cap], needed);
}
