import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { AccessService } from '../access/access.service';
import type { SpaceAccessContext } from '../access/evaluate-access';
import { recordAudit } from '../audit/record-audit';
import { enqueueJob } from '../jobs/job-queue';
import { appendChange } from './change-log';
import type { Operation } from './operation-envelope';
import { loadParents, parentOf, readableWire } from './record-view';
import { validationError, type Draft, type ResourceDefinition, type StoredRow } from './resource-definition';
import { RESOURCE_REGISTRY } from './resource-registry';
import type { ResourceType } from './resource-types';

/** A per-operation rejection; `currentId` names the row whose readable state goes back as `current`. */
export class OperationRejected extends ApiError {
  constructor(
    code: ErrorCode,
    status: number,
    readonly currentId?: string,
    fields?: Record<string, string>,
  ) {
    super(code, status, undefined, fields);
  }
}

export interface AppliedOperation {
  revision: string;
  record: Record<string, unknown> | null;
}

// Changing any of these reschedules the reminders of the affected item (Task 45 consumes the job).
const REMINDER_TYPES: ReadonlySet<ResourceType> = new Set(['item', 'reminder_rule', 'occurrence_state', 'item_exception']);

function nextRevision(row: StoredRow): string {
  return (BigInt(String(row.revision)) + 1n).toString();
}

@Injectable()
export class OperationApplier {
  constructor(private readonly access: AccessService) {}

  /** Applies one operation; the caller holds the Space lock and owns the transaction. */
  async apply(em: EntityManager, ctx: SpaceAccessContext, op: Operation): Promise<AppliedOperation> {
    const def = RESOURCE_REGISTRY[op.resource_type];
    if (!def.actions.includes(op.action)) throw validationError({ action: 'ACTION_NOT_ALLOWED' });
    const locked = await def.lock(em, op.resource_id);
    const foreign = locked !== null && locked.space_id !== ctx.spaceId;
    const existing = foreign ? null : locked;

    switch (op.action) {
      case 'create':
        if (existing?.deleted_at) throw new OperationRejected(ErrorCode.RESOURCE_DELETED, 409);
        // Never overwrite on create, whoever owns the id (sync-protocol.md "Xử lý backend").
        if (locked) throw new OperationRejected(ErrorCode.ID_COLLISION, 409);
        return this.create(em, ctx, def, op, op.resource_id);
      case 'occurrence_action':
        if (foreign) throw new OperationRejected(ErrorCode.ID_COLLISION, 409);
        return this.occurrenceAction(em, ctx, def, op, existing);
      default:
        // Ids from another Space look exactly like unknown ids.
        if (!existing) throw new OperationRejected(ErrorCode.NOT_FOUND, 404);
        if (existing.deleted_at) throw new OperationRejected(ErrorCode.RESOURCE_DELETED, 409);
        return op.action === 'update'
          ? this.update(em, ctx, def, op, existing)
          : this.remove(em, ctx, def, op, existing);
    }
  }

  private parse(em: EntityManager, ctx: SpaceAccessContext, def: ResourceDefinition, op: Operation, existing: StoredRow | null) {
    return def.parse(op.payload, {
      em,
      spaceId: ctx.spaceId,
      spaceKind: ctx.spaceKind,
      actorId: ctx.actorId,
      action: op.action,
      resourceId: existing ? (existing.id as string) : op.resource_id,
      existing,
    });
  }

  private async parentFor(em: EntityManager, ctx: SpaceAccessContext, def: ResourceDefinition, row: StoredRow) {
    return parentOf(def, row, await loadParents(em, ctx.spaceId, def, [row]));
  }

  private async create(
    em: EntityManager,
    ctx: SpaceAccessContext,
    def: ResourceDefinition,
    op: Operation,
    id: string,
    preParsed?: Draft,
  ): Promise<AppliedOperation> {
    const draft = preParsed ?? (await this.parse(em, ctx, def, op, null));
    const meta = { spaceId: ctx.spaceId, revision: '1', now: new Date() };
    const row = def.materialize({ ...draft, id }, null, meta);
    if (!def.access.canWrite(ctx, row, await this.parentFor(em, ctx, def, row))) {
      throw new OperationRejected(ErrorCode.FORBIDDEN, 403);
    }
    await def.insert(em, { ...draft, id }, meta);
    return this.finish(em, ctx, def, op, row, null, 'UPSERT', meta.now);
  }

  private async update(
    em: EntityManager,
    ctx: SpaceAccessContext,
    def: ResourceDefinition,
    op: Operation,
    existing: StoredRow,
  ): Promise<AppliedOperation> {
    const id = existing.id as string;
    if (!def.access.canWrite(ctx, existing, await this.parentFor(em, ctx, def, existing))) {
      throw new OperationRejected(ErrorCode.FORBIDDEN, 403, id);
    }
    if (op.base_revision !== String(existing.revision)) throw new OperationRejected(ErrorCode.REVISION_CONFLICT, 409, id);
    const draft = await this.parse(em, ctx, def, op, existing);
    return this.write(em, ctx, def, op, draft, existing);
  }

  /** Writes a validated draft over `existing` (also reviving a deleted occurrence row). */
  private async write(
    em: EntityManager,
    ctx: SpaceAccessContext,
    def: ResourceDefinition,
    op: Operation,
    draft: Draft,
    existing: StoredRow,
  ): Promise<AppliedOperation> {
    const meta = { spaceId: ctx.spaceId, revision: nextRevision(existing), now: new Date() };
    const row = def.materialize(draft, existing, meta);
    // Checked on the new state too: an edit may not move a record out of the editor's own reach.
    if (!def.access.canWrite(ctx, row, await this.parentFor(em, ctx, def, row))) {
      throw new OperationRejected(ErrorCode.FORBIDDEN, 403, existing.id as string);
    }
    await def.update(em, draft, meta);
    return this.finish(em, ctx, def, op, row, existing, 'UPSERT', meta.now);
  }

  private async remove(
    em: EntityManager,
    ctx: SpaceAccessContext,
    def: ResourceDefinition,
    op: Operation,
    existing: StoredRow,
  ): Promise<AppliedOperation> {
    const id = existing.id as string;
    if (!def.access.canDelete(ctx, existing, await this.parentFor(em, ctx, def, existing))) {
      throw new OperationRejected(ErrorCode.FORBIDDEN, 403, id);
    }
    if (op.base_revision !== String(existing.revision)) throw new OperationRejected(ErrorCode.REVISION_CONFLICT, 409, id);
    const blockers = await def.deleteBlockers?.(em, existing);
    if (blockers) throw validationError(blockers);
    const meta = { spaceId: ctx.spaceId, revision: nextRevision(existing), now: new Date() };
    await def.softDelete(em, existing, meta);
    const row = { ...existing, revision: meta.revision, deleted_at: meta.now };
    return this.finish(em, ctx, def, op, row, existing, 'DELETE', meta.now);
  }

  /**
   * Upsert by natural key (one row per occurrence). With a base revision it is a guarded update; without one,
   * repeating what the row already says is a no-op and asking for something different is a conflict, so two
   * devices never silently overwrite each other's DONE/SKIPPED (sync-protocol.md "Xung đột").
   */
  private async occurrenceAction(
    em: EntityManager,
    ctx: SpaceAccessContext,
    def: ResourceDefinition,
    op: Operation,
    byId: StoredRow | null,
  ): Promise<AppliedOperation> {
    const draft = await this.parse(em, ctx, def, op, null);
    const target = await def.lockByNaturalKey!(em, ctx.spaceId, draft);
    if (byId && byId.id !== target?.id) throw validationError({ occurrenceKey: 'IMMUTABLE' });
    if (!target) return this.create(em, ctx, def, op, op.resource_id, draft);

    const targetId = target.id as string;
    if (!def.access.canWrite(ctx, target, await this.parentFor(em, ctx, def, target))) {
      throw new OperationRejected(ErrorCode.FORBIDDEN, 403, targetId);
    }
    if (op.base_revision !== null) {
      if (op.base_revision !== String(target.revision)) throw new OperationRejected(ErrorCode.REVISION_CONFLICT, 409, targetId);
    } else if (!target.deleted_at) {
      if (!def.sameOutcome?.(target, draft)) throw new OperationRejected(ErrorCode.REVISION_CONFLICT, 409, targetId);
      return { revision: String(target.revision), record: await readableWire(em, ctx, def, targetId) };
    }
    const onTarget: Draft = { ...draft, id: targetId, createdByActorId: target.created_by_actor_id as string };
    return this.write(em, ctx, def, op, onTarget, target);
  }

  private async finish(
    em: EntityManager,
    ctx: SpaceAccessContext,
    def: ResourceDefinition,
    op: Operation,
    row: StoredRow,
    before: StoredRow | null,
    changeOp: 'UPSERT' | 'DELETE',
    now: Date,
  ): Promise<AppliedOperation> {
    const id = row.id as string;
    const revision = String(row.revision);
    await appendChange(em, ctx.spaceId, def.type, id, revision, changeOp, now);
    await recordAudit(em, {
      spaceId: ctx.spaceId,
      actorId: ctx.actorId,
      deviceId: ctx.deviceId,
      action: `${def.type}.${op.action}`,
      resourceType: def.type,
      resourceId: id,
      revision,
    });
    const audienceChanged =
      changeOp === 'DELETE' ? !!def.policyOnDelete : !!before && def.access.fingerprint(before) !== def.access.fingerprint(row);
    if (audienceChanged) await this.access.bumpPolicyVersion(em, ctx.spaceId);
    if (REMINDER_TYPES.has(def.type)) {
      const itemId = def.type === 'item' ? id : (row.item_id as string);
      await enqueueJob(em, {
        type: 'RESCHEDULE_REMINDERS',
        runAt: now,
        payload: { spaceId: ctx.spaceId, itemId },
        dedupeKey: `reschedule:${itemId}`,
      });
    }
    const record = changeOp === 'DELETE' ? null : await readableWire(em, ctx, def, id);
    return { revision, record };
  }
}
