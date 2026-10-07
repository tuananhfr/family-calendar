import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import type { SpaceAccessContext } from '../access/evaluate-access';
import { currentPolicyVersion, lockSpace } from './change-log';
import type { OperationResultDto, SyncOperationsResponseDto } from './dto/operation.dto';
import { OperationApplier, OperationRejected } from './operation-applier';
import { MAX_BATCH_OPERATIONS, checkEnvelope, type Operation } from './operation-envelope';
import { parseJsonColumn } from './fields';
import { payloadHash } from './payload-hash';
import { readableWire } from './record-view';
import { RESOURCE_REGISTRY } from './resource-registry';

/** What processed_operations.result keeps; `current` is recomputed on replay because access may have changed. */
type StoredResult =
  | { status: 'APPLIED'; revision: string; recordId: string | null; record: Record<string, unknown> | null }
  | {
      status: 'REJECTED';
      error: { code: ErrorCode; message: string; fields?: Record<string, string> };
      currentId: string | null;
    };

interface ProcessedRow {
  device_id: string;
  space_id: string;
  payload_hash: string;
  result: unknown;
}

// Codes that carry the server's view of the record so the client can show the conflict (sync-protocol.md).
const WITH_CURRENT: ReadonlySet<ErrorCode> = new Set([ErrorCode.REVISION_CONFLICT, ErrorCode.FORBIDDEN]);

/** Errors that make every later operation of the batch fail the same way (session, membership, Space state). */
class BatchAbort extends Error {
  constructor(readonly cause: ApiError) {
    super(cause.message);
  }
}

const ER_DUP_ENTRY = 1062;

function isDuplicateKey(err: unknown): boolean {
  const e = err as { errno?: unknown; driverError?: { errno?: unknown } };
  return (e?.driverError?.errno ?? e?.errno) === ER_DUP_ENTRY;
}

function errorBody(err: ApiError) {
  return { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) };
}

@Injectable()
export class OperationsService {
  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    private readonly applier: OperationApplier,
  ) {}

  async apply(session: SessionContext, spaceId: string, operations: unknown[]): Promise<SyncOperationsResponseDto> {
    if (!isClientId(spaceId)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    if (operations.length > MAX_BATCH_OPERATIONS) throw new ApiError(ErrorCode.PAYLOAD_TOO_LARGE, 413);
    // Fail fast before any envelope work; each operation re-checks under the Space lock.
    await this.access.loadContext(session, spaceId);
    const envelopes = operations.map((raw, i) => checkEnvelope(raw, i));

    const results: OperationResultDto[] = [];
    for (let i = 0; i < envelopes.length; i++) {
      const env = envelopes[i];
      if (!env.ok) {
        results.push({ operation_id: env.operationId, status: 'REJECTED', error: errorBody(env.error) });
        continue;
      }
      try {
        results.push(await withTransaction(this.ds, (em) => this.applyOne(em, session, spaceId, env.op), {
          isolation: 'READ COMMITTED',
        }));
      } catch (err) {
        if (!(err instanceof BatchAbort)) throw err;
        if (results.length === 0) throw err.cause;
        for (const rest of envelopes.slice(i)) {
          results.push({ operation_id: rest.ok ? rest.op.operation_id : rest.operationId, status: 'REJECTED', error: errorBody(err.cause) });
        }
        break;
      }
    }
    return { results, policy_version: await currentPolicyVersion(this.ds.manager, spaceId) };
  }

  private async applyOne(
    em: EntityManager,
    session: SessionContext,
    spaceId: string,
    op: Operation,
  ): Promise<OperationResultDto> {
    const ctx = await this.lockAndAuthorize(em, session, spaceId);
    const hash = payloadHash(op);
    const reused = (): OperationResultDto => ({
      operation_id: op.operation_id,
      status: 'REJECTED',
      error: errorBody(new ApiError(ErrorCode.OPERATION_ID_REUSED, 409)),
    });

    const [prior]: ProcessedRow[] = await em.query(
      'SELECT device_id, space_id, payload_hash, result FROM processed_operations WHERE operation_id = ? FOR UPDATE',
      [op.operation_id],
    );
    if (prior) {
      if (prior.device_id !== session.deviceId || prior.space_id !== spaceId || prior.payload_hash !== hash) {
        return reused();
      }
      const stored = parseJsonColumn(prior.result) as StoredResult | null;
      // A NULL result can only be seen if the first attempt died mid-transaction; its rollback removed the row.
      if (stored) return this.replay(em, ctx, op, stored);
    } else {
      try {
        await em.query(
          `INSERT INTO processed_operations (operation_id, device_id, space_id, payload_hash, result, created_at)
           VALUES (?, ?, ?, ?, NULL, UTC_TIMESTAMP(3))`,
          [op.operation_id, session.deviceId, spaceId, hash],
        );
      } catch (err) {
        // Same id taken in another Space: that transaction holds a different Space lock.
        if (isDuplicateKey(err)) return reused();
        throw err;
      }
    }

    await em.query('SAVEPOINT op');
    let stored: StoredResult;
    try {
      const applied = await this.applier.apply(em, ctx, op);
      stored = {
        status: 'APPLIED',
        revision: applied.revision,
        recordId: (applied.record?.id as string | undefined) ?? null,
        record: applied.record,
      };
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      await em.query('ROLLBACK TO SAVEPOINT op');
      stored = {
        status: 'REJECTED',
        error: errorBody(err),
        currentId: err instanceof OperationRejected ? (err.currentId ?? null) : null,
      };
    }
    await em.query('UPDATE processed_operations SET result = ? WHERE operation_id = ?', [
      JSON.stringify(stored),
      op.operation_id,
    ]);
    return this.toResult(em, ctx, op, stored);
  }

  private async lockAndAuthorize(em: EntityManager, session: SessionContext, spaceId: string): Promise<SpaceAccessContext> {
    try {
      const space = await lockSpace(em, spaceId);
      if (!space) throw new ApiError(ErrorCode.FORBIDDEN, 403);
      const ctx = await this.access.loadContext(session, spaceId, em);
      // Only SHARED Spaces sync; an INITIALIZING one is still being bootstrapped by its creator.
      if (space.sharing_state !== 'SHARED') throw new ApiError(ErrorCode.FORBIDDEN, 403);
      return ctx;
    } catch (err) {
      if (err instanceof ApiError) throw new BatchAbort(err);
      throw err;
    }
  }

  /** A replay may not reveal more than the caller can read today. */
  private async replay(em: EntityManager, ctx: SpaceAccessContext, op: Operation, stored: StoredResult) {
    if (stored.status === 'APPLIED' && stored.recordId) {
      const now = await readableWire(em, ctx, RESOURCE_REGISTRY[op.resource_type], stored.recordId);
      return this.toResult(em, ctx, op, { ...stored, record: now ? stored.record : null });
    }
    return this.toResult(em, ctx, op, stored);
  }

  private async toResult(
    em: EntityManager,
    ctx: SpaceAccessContext,
    op: Operation,
    stored: StoredResult,
  ): Promise<OperationResultDto> {
    if (stored.status === 'APPLIED') {
      return { operation_id: op.operation_id, status: 'APPLIED', revision: stored.revision, record: stored.record };
    }
    const result: OperationResultDto = { operation_id: op.operation_id, status: 'REJECTED', error: stored.error };
    if (WITH_CURRENT.has(stored.error.code)) {
      result.current = stored.currentId
        ? await readableWire(em, ctx, RESOURCE_REGISTRY[op.resource_type], stored.currentId)
        : null;
    }
    return result;
  }
}
