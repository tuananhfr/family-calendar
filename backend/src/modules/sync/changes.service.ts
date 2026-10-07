import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import type { AppConfig } from '../../config/configuration';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import type { SpaceAccessContext } from '../access/evaluate-access';
import type { ChangeDto, ChangesResponseDto } from './dto/pull.dto';
import { loadParents, parentOf } from './record-view';
import { RESOURCE_REGISTRY } from './resource-registry';
import type { ResourceType } from './resource-types';

export const MAX_CHANGES_LIMIT = 500;

interface SpaceHead {
  sharing_state: string;
  change_seq: string;
  policy_version: string;
}

interface ChangeRow {
  seq: string;
  resource_type: ResourceType;
  resource_id: string;
  revision: string;
  op: 'UPSERT' | 'DELETE';
}

/** Reads the Space head inside the caller's transaction; non-members and unshared Spaces look the same. */
export async function readSyncHead(
  em: EntityManager,
  access: AccessService,
  session: SessionContext,
  spaceId: string,
): Promise<{ ctx: SpaceAccessContext; head: SpaceHead }> {
  if (!isClientId(spaceId)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
  const ctx = await access.loadContext(session, spaceId, em);
  const [head]: SpaceHead[] = await em.query(
    'SELECT sharing_state, change_seq, policy_version FROM spaces WHERE id = ?',
    [spaceId],
  );
  if (!head || head.sharing_state !== 'SHARED') throw new ApiError(ErrorCode.FORBIDDEN, 403);
  return { ctx, head: { ...head, change_seq: String(head.change_seq), policy_version: String(head.policy_version) } };
}

function parseCursor(raw: unknown): bigint {
  if (raw === undefined || raw === '') return 0n;
  if (typeof raw !== 'string' || !/^\d{1,19}$/.test(raw)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { cursor: 'INVALID' });
  }
  return BigInt(raw);
}

function parseLimit(raw: unknown): number {
  if (raw === undefined || raw === '') return MAX_CHANGES_LIMIT;
  const n = typeof raw === 'string' && /^\d{1,4}$/.test(raw) ? Number(raw) : NaN;
  if (!(n >= 1 && n <= MAX_CHANGES_LIMIT)) {
    throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { limit: 'INVALID' });
  }
  return n;
}

@Injectable()
export class ChangesService {
  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async changes(session: SessionContext, spaceId: string, rawCursor: unknown, rawLimit: unknown): Promise<ChangesResponseDto> {
    const cursor = parseCursor(rawCursor);
    const limit = parseLimit(rawLimit);
    // One consistent read: the head bounds the page, so a write committing mid-request is left for the next pull.
    return withTransaction(
      this.ds,
      async (em) => {
        const { ctx, head } = await readSyncHead(em, this.access, session, spaceId);
        const headSeq = BigInt(head.change_seq);
        if (cursor > headSeq) throw new ApiError(ErrorCode.RESYNC_REQUIRED, 409);
        if (cursor < headSeq) await this.assertWithinHorizon(em, spaceId, cursor);

        const rows: ChangeRow[] = await em.query(
          `SELECT seq, resource_type, resource_id, revision, op FROM sync_changes
            WHERE space_id = ? AND seq > ? AND seq <= ? ORDER BY seq LIMIT ?`,
          [spaceId, cursor.toString(), head.change_seq, limit],
        );
        const nextCursor = rows.length > 0 ? String(rows[rows.length - 1].seq) : cursor.toString();
        return {
          changes: await this.visibleChanges(em, ctx, rows),
          next_cursor: nextCursor,
          has_more: BigInt(nextCursor) < headSeq,
          policy_version: head.policy_version,
        };
      },
      { isolation: 'REPEATABLE READ' },
    );
  }

  /**
   * The change at the cursor (or the first one, for cursor 0) must still exist and be younger than the offline
   * horizon; otherwise deletes the client never saw may already be gone (sync-protocol.md "Tombstone").
   */
  private async assertWithinHorizon(em: EntityManager, spaceId: string, cursor: bigint): Promise<void> {
    const anchor = cursor > 0n ? cursor : 1n;
    const [row]: Array<{ created_at: Date }> = await em.query(
      'SELECT created_at FROM sync_changes WHERE space_id = ? AND seq = ?',
      [spaceId, anchor.toString()],
    );
    const horizonMs = this.config.get('sync.tombstoneDays', { infer: true }) * 24 * 60 * 60 * 1000;
    if (!row || row.created_at.getTime() < Date.now() - horizonMs) {
      throw new ApiError(ErrorCode.RESYNC_REQUIRED, 409);
    }
  }

  /** Latest entry per record, filtered by what the caller may read now; hidden entries vanish without a trace. */
  private async visibleChanges(em: EntityManager, ctx: SpaceAccessContext, rows: ChangeRow[]): Promise<ChangeDto[]> {
    const latest = new Map<string, ChangeRow>();
    for (const row of rows) {
      const key = `${row.resource_type}:${row.resource_id}`;
      latest.delete(key);
      latest.set(key, row);
    }
    const byType = new Map<ResourceType, ChangeRow[]>();
    for (const row of latest.values()) {
      byType.set(row.resource_type, [...(byType.get(row.resource_type) ?? []), row]);
    }

    const out: ChangeDto[] = [];
    for (const [type, entries] of byType) {
      const def = RESOURCE_REGISTRY[type];
      const stored = await def.find(em, ctx.spaceId, entries.map((e) => e.resource_id));
      const parents = await loadParents(em, ctx.spaceId, def, stored);
      const byId = new Map(stored.map((r) => [r.id as string, r]));
      for (const entry of entries) {
        const row = byId.get(entry.resource_id);
        if (!row) continue;
        const parent = parentOf(def, row, parents);
        if (!def.access.canRead(ctx, row, parent)) continue;
        const base = { seq: String(entry.seq), resource_type: type, resource_id: entry.resource_id };
        if (entry.op === 'DELETE') {
          out.push({ ...base, op: 'DELETE', revision: String(entry.revision) });
          continue;
        }
        // A later DELETE (of the row or its item) is still ahead in the feed and will remove it.
        if (row.deleted_at || (def.parentItemColumn && (!parent || parent.deleted_at))) continue;
        out.push({ ...base, op: 'UPSERT', revision: String(row.revision), record: def.toWire(row, ctx) });
      }
    }
    return out.sort((a, b) => (BigInt(a.seq) < BigInt(b.seq) ? -1 : 1));
  }
}
