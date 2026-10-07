import {
  canDeleteItem,
  canDeleteRecord,
  canRecord,
  canRecordItem,
  hasLevel,
  isScopeValidForSpace,
  type AccessRecord,
  type ItemClassification,
  type SpaceAccessContext,
} from '../access/evaluate-access';
import type { Capability } from '../access/role-matrix';

/** A row as read from MariaDB (snake_case columns) plus child-table values under `$children`. */
export interface StoredRow {
  [column: string]: unknown;
  $children?: Record<string, unknown[]>;
}

export interface AccessRules {
  canRead(ctx: SpaceAccessContext, row: StoredRow, parent: StoredRow | null): boolean;
  canWrite(ctx: SpaceAccessContext, row: StoredRow, parent: StoredRow | null): boolean;
  canDelete(ctx: SpaceAccessContext, row: StoredRow, parent: StoredRow | null): boolean;
  /** Everything that decides who may see the row; a change bumps spaces.policy_version (TEC-20 §3). */
  fingerprint(row: StoredRow): string;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '');
}

export function childIds(row: StoredRow, key: string): string[] {
  return (row.$children?.[key] ?? []).filter((v): v is string => typeof v === 'string');
}

export function baseAccessRecord(row: StoredRow, memberIds: string[] = [], ownerMemberId?: string | null): AccessRecord {
  return {
    createdByActorId: str(row.created_by_actor_id),
    sharingScope: str(row.sharing_scope),
    dataClass: str(row.data_class),
    memberIds,
    ...(ownerMemberId ? { ownerMemberId } : {}),
  };
}

export function itemAccessRecord(row: StoredRow): AccessRecord & ItemClassification {
  return {
    ...baseAccessRecord(row, childIds(row, 'memberIds'), (row.responsible_member_id as string | null) ?? null),
    preset: str(row.preset),
    category: str(row.category),
  };
}

function fingerprintOf(rec: AccessRecord & Partial<ItemClassification>): string {
  return JSON.stringify([
    rec.sharingScope,
    rec.dataClass,
    [...(rec.memberIds ?? [])].sort(),
    rec.ownerMemberId ?? null,
    rec.preset ?? null,
    rec.category ?? null,
  ]);
}

/** Records governed by one capability; `member` names the column holding the related Member, if any. */
export function capabilityRules(cap: Capability, opts: { memberColumn?: string } = {}): AccessRules {
  const rec = (row: StoredRow) =>
    baseAccessRecord(row, [], opts.memberColumn ? ((row[opts.memberColumn] as string | null) ?? null) : null);
  return {
    canRead: (ctx, row) => canRecord(ctx, rec(row), cap, 'VIEW'),
    canWrite: (ctx, row) => canRecord(ctx, rec(row), cap, 'EDIT'),
    canDelete: (ctx, row) => canDeleteRecord(ctx, rec(row), cap),
    fingerprint: (row) => fingerprintOf(rec(row)),
  };
}

/** User templates: read with calendar.view, written and removed with calendar.create (no calendar.delete). */
export function templateRules(): AccessRules {
  const rules = capabilityRules('calendar.view');
  return { ...rules, canDelete: (ctx, row) => canRecord(ctx, baseAccessRecord(row), 'calendar.view', 'EDIT') };
}

export const itemRules: AccessRules = {
  canRead: (ctx, row) => canRecordItem(ctx, itemAccessRecord(row), 'VIEW'),
  canWrite: (ctx, row) => canRecordItem(ctx, itemAccessRecord(row), 'EDIT'),
  canDelete: (ctx, row) => canDeleteItem(ctx, itemAccessRecord(row)),
  fingerprint: (row) => fingerprintOf(itemAccessRecord(row)),
};

/** Exceptions, occurrence states, checklist, reminder rules: same audience and level as the parent item. */
export function itemChildRules(opts: { participation?: boolean } = {}): AccessRules {
  const parentCan = (ctx: SpaceAccessContext, parent: StoredRow | null, level: 'VIEW' | 'EDIT') =>
    !!parent && canRecordItem(ctx, itemAccessRecord(parent), level);
  const write = (ctx: SpaceAccessContext, row: StoredRow, parent: StoredRow | null) => {
    if (parentCan(ctx, parent, 'EDIT')) return true;
    // Answering for oneself (or a guarded member) only needs to see the item.
    if (!opts.participation || !parentCan(ctx, parent, 'VIEW')) return false;
    const memberId = row.member_id as string;
    return ctx.representedMemberIds.includes(memberId) || ctx.guardianOfMemberIds.includes(memberId);
  };
  return {
    canRead: (ctx, _row, parent) => parentCan(ctx, parent, 'VIEW'),
    canWrite: write,
    canDelete: write,
    fingerprint: () => '',
  };
}

/**
 * Records every member of the Space sees (Member list, roles, Space settings) but only `writeCap` EDIT changes.
 * PRIVATE still wins and a scope from the other Space kind fails closed.
 */
export function sharedReadRules(writeCap: Capability, fingerprint: (row: StoredRow) => string): AccessRules {
  const visible = (ctx: SpaceAccessContext, row: StoredRow) => {
    const scope = str(row.sharing_scope);
    if (!isScopeValidForSpace(scope, ctx.spaceKind)) return false;
    return scope !== 'PRIVATE' || row.created_by_actor_id === ctx.actorId;
  };
  return {
    canRead: visible,
    canWrite: (ctx, row) => visible(ctx, row) && hasLevel(ctx, writeCap, 'EDIT'),
    canDelete: (ctx, row) => visible(ctx, row) && hasLevel(ctx, writeCap, 'EDIT'),
    fingerprint,
  };
}
