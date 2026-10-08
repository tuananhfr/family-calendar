import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { sha256Hex } from '../../common/crypto/tokens';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import type { SpaceAccessContext } from '../access/evaluate-access';
import { recordAudit } from '../audit/record-audit';
import { enqueueJob } from '../jobs/job-queue';
import { appendChange, lockSpace, type LockedSpace } from '../sync/change-log';
import { FieldErrors, INVALID, isPlainObject, oneOf, text, timeZone } from '../sync/fields';
import { canonicalJson } from '../sync/payload-hash';
import { loadParents, parentOf } from '../sync/record-view';
import { RESOURCE_REGISTRY } from '../sync/resource-registry';
import type { ResourceType } from '../sync/resource-types';
import { parseSettings } from '../sync/resources/space-settings.definition';
import type {
  ActivateSpaceDto,
  ActivateSpaceResponseDto,
  BootstrapChunkDto,
  BootstrapChunkResponseDto,
  BootstrapSpaceResponseDto,
} from './dto/bootstrap.dto';

/**
 * Insert order inside a chunk: referenced records first, because same-Space foreign keys and reference checks run
 * per record. Across chunks the client must send parents before children in the same order.
 */
export const BOOTSTRAP_ORDER: readonly ResourceType[] = [
  'member',
  'role',
  'folder',
  'file',
  'item',
  'item_exception',
  'occurrence_state',
  'checklist_item',
  'checklist_state',
  'participation',
  'reminder_rule',
  'finance_account',
  'finance_txn',
  'finance_budget',
  'finance_saving',
  'finance_loan',
  'finance_goal',
  'health_profile',
  'health_metric',
  'health_note',
  'automation',
  'template',
];

const OWNER_ROLE: Record<'FAMILY' | 'GROUP', string> = { FAMILY: 'OWNER', GROUP: 'ORGANIZER' };
const ER_DUP_ENTRY = 1062;

interface ChunkRecord {
  index: number;
  type: ResourceType;
  id: string;
  payload: unknown;
}

function isDuplicateKey(err: unknown): boolean {
  const e = err as { errno?: unknown; driverError?: { errno?: unknown } };
  return (e?.driverError?.errno ?? e?.errno) === ER_DUP_ENTRY;
}

/** Errors point at the record by position only, never echoing its content (sync-protocol.md "Bật chia sẻ"). */
function located(err: ApiError, chunkId: string, index: number): ApiError {
  const fields: Record<string, string> = { chunk_id: chunkId, index: String(index) };
  for (const [path, code] of Object.entries(err.fields ?? {})) fields[`records.${index}.${path}`] = code;
  return new ApiError(err.code, err.status, undefined, fields);
}

@Injectable()
export class BootstrapService {
  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
  ) {}

  async start(session: SessionContext, raw: Record<string, unknown>): Promise<BootstrapSpaceResponseDto> {
    if (raw.kind === "FAMILY" && !session.accountId) throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { email: "VERIFICATION_REQUIRED" });
    const e = new FieldErrors();
    for (const key of Object.keys(raw)) {
      if (!['id', 'kind', 'name', 'time_zone', 'settings'].includes(key)) e.add(`space.${key}`, 'UNKNOWN_FIELD');
    }
    const id = isClientId(raw.id) ? raw.id : e.add('space.id', 'INVALID_ID');
    const kind = oneOf(['FAMILY', 'GROUP'] as const).parse(raw.kind, 'space.kind', e);
    const name = text(100).parse(raw.name, 'space.name', e);
    const tz = timeZone.parse(raw.time_zone, 'space.time_zone', e);
    const settingsErrors = new FieldErrors();
    const settings = parseSettings(raw.settings, settingsErrors);
    for (const [path, code] of Object.entries(settingsErrors.map)) e.add(`space.${path}`, code);
    if (!e.empty || id === INVALID || kind === INVALID || settings === INVALID) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, e.map);
    }

    try {
      return await withTransaction(this.ds, (em) => this.create(em, session, id, kind, name as string, tz as string, settings));
    } catch (err) {
      // A concurrent first request inserted the same id; answer as a retry would.
      if (!isDuplicateKey(err)) throw err;
      return withTransaction(this.ds, (em) => this.create(em, session, id, kind, name as string, tz as string, settings));
    }
  }

  private async create(
    em: EntityManager,
    session: SessionContext,
    id: string,
    kind: 'FAMILY' | 'GROUP',
    name: string,
    tz: string,
    settings: Record<string, unknown>,
  ): Promise<BootstrapSpaceResponseDto> {
    const existing = await lockSpace(em, id);
    if (existing) {
      const [row]: Array<{ created_by_actor_id: string }> = await em.query(
        'SELECT created_by_actor_id FROM spaces WHERE id = ?',
        [id],
      );
      if (row.created_by_actor_id !== session.actorId) throw new ApiError(ErrorCode.ID_COLLISION, 409);
      return { space_id: id, state: existing.sharing_state };
    }
    await em.query(
      `INSERT INTO spaces (id, kind, name, time_zone, sharing_state, settings, change_seq, policy_version,
         created_by_actor_id, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'INITIALIZING', ?, 0, 1, ?, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [id, kind, name, tz, JSON.stringify(settings), session.actorId],
    );
    const roleIds = await this.access.seedDefaultRoles(em, id, kind, session.actorId);
    await this.access.addMembership(em, id, session.actorId, roleIds[OWNER_ROLE[kind]]);
    await recordAudit(em, {
      spaceId: id,
      actorId: session.actorId,
      deviceId: session.deviceId,
      action: 'space.bootstrap',
      resourceType: 'space_settings',
      resourceId: id,
    });
    return { space_id: id, state: 'INITIALIZING' };
  }

  async chunk(session: SessionContext, spaceId: string, dto: BootstrapChunkDto): Promise<BootstrapChunkResponseDto> {
    const records = dto.records.map((r, index) => this.envelope(r, index, dto.chunk_id));
    const hash = sha256Hex(canonicalJson(dto.records));
    return withTransaction(
      this.ds,
      async (em) => {
        const { ctx } = await this.creatorContext(em, session, spaceId);
        const [prior]: Array<{ space_id: string; payload_hash: string; accepted: number }> = await em.query(
          'SELECT space_id, payload_hash, accepted FROM bootstrap_chunks WHERE chunk_id = ? FOR UPDATE',
          [dto.chunk_id],
        );
        if (prior) {
          if (prior.space_id !== spaceId || prior.payload_hash !== hash) {
            throw new ApiError(ErrorCode.OPERATION_ID_REUSED, 409);
          }
          return { accepted: Number(prior.accepted) };
        }

        const ordered = [...records].sort(
          (a, b) => BOOTSTRAP_ORDER.indexOf(a.type) - BOOTSTRAP_ORDER.indexOf(b.type) || a.index - b.index,
        );
        for (const record of ordered) {
          try {
            await this.insert(em, ctx, record);
          } catch (err) {
            if (err instanceof ApiError) throw located(err, dto.chunk_id, record.index);
            throw err;
          }
        }
        await em.query(
          `INSERT INTO bootstrap_chunks (chunk_id, space_id, payload_hash, accepted, created_at)
           VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))`,
          [dto.chunk_id, spaceId, hash, records.length],
        );
        return { accepted: records.length };
      },
      { isolation: 'READ COMMITTED' },
    );
  }

  private envelope(raw: unknown, index: number, chunkId: string): ChunkRecord {
    const fail = (field: string, code: string) =>
      new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, {
        chunk_id: chunkId,
        index: String(index),
        [`records.${index}.${field}`]: code,
      });
    if (!isPlainObject(raw)) throw fail('record', 'INVALID');
    const type = raw.resource_type as ResourceType;
    if (!BOOTSTRAP_ORDER.includes(type)) throw fail('resource_type', 'UNKNOWN_RESOURCE_TYPE');
    if (!isClientId(raw.resource_id)) throw fail('resource_id', 'INVALID_ID');
    return { index, type, id: raw.resource_id, payload: raw.payload };
  }

  private async insert(em: EntityManager, ctx: SpaceAccessContext, record: ChunkRecord): Promise<void> {
    const def = RESOURCE_REGISTRY[record.type];
    // Ids are global: a record id already used anywhere, even in another Space, is never overwritten.
    if (await def.lock(em, record.id)) throw new ApiError(ErrorCode.ID_COLLISION, 409);
    const draft = await def.parse(record.payload, {
      em,
      spaceId: ctx.spaceId,
      spaceKind: ctx.spaceKind,
      actorId: ctx.actorId,
      action: 'create',
      resourceId: record.id,
      existing: null,
    });
    const meta = { spaceId: ctx.spaceId, revision: '1', now: new Date() };
    const row = def.materialize({ ...draft, id: record.id }, null, meta);
    const parent = parentOf(def, row, await loadParents(em, ctx.spaceId, def, [row]));
    if (!def.access.canWrite(ctx, row, parent)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    await def.insert(em, { ...draft, id: record.id }, meta);
    await appendChange(em, ctx.spaceId, def.type, record.id, '1', 'UPSERT', meta.now);
  }

  async activate(session: SessionContext, spaceId: string, dto: ActivateSpaceDto): Promise<ActivateSpaceResponseDto> {
    const expected = this.expectedCounts(dto.expected_counts);
    return withTransaction(
      this.ds,
      async (em) => {
        const { ctx, space } = await this.creatorContext(em, session, spaceId, true);
        if (space.sharing_state === 'SHARED') return { state: 'SHARED', watermark: String(space.change_seq) };

        const e = new FieldErrors();
        for (const type of BOOTSTRAP_ORDER) {
          const actual = await this.uploadedCount(em, spaceId, type);
          if (actual !== (expected[type] ?? 0)) e.add(`expected_counts.${type}`, 'COUNT_MISMATCH');
        }
        if (dto.self_member_id) {
          const [m] = await RESOURCE_REGISTRY.member.find(em, spaceId, [dto.self_member_id]);
          if (!m || m.deleted_at) e.add('self_member_id', 'NOT_IN_SPACE');
        }
        if (!e.empty) {
          throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'Dữ liệu tải lên chưa đủ, vui lòng thử lại.', e.map);
        }

        if (dto.self_member_id) await this.access.addRepresentation(em, spaceId, ctx.actorId, dto.self_member_id, 'SELF');
        await em.query(
          "UPDATE spaces SET sharing_state = 'SHARED', updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
          [spaceId],
        );
        // Reminders of uploaded items start only once the Space is live.
        const items: Array<{ id: string }> = await em.query(
          'SELECT id FROM items WHERE space_id = ? AND deleted_at IS NULL',
          [spaceId],
        );
        const now = new Date();
        for (const item of items) {
          await enqueueJob(em, {
            type: 'RESCHEDULE_REMINDERS',
            runAt: now,
            payload: { spaceId, itemId: item.id },
            dedupeKey: `reschedule:${item.id}`,
          });
        }
        await recordAudit(em, {
          spaceId,
          actorId: ctx.actorId,
          deviceId: ctx.deviceId,
          action: 'space.activate',
          resourceType: 'space_settings',
          resourceId: spaceId,
        });
        return { state: 'SHARED', watermark: String(space.change_seq) };
      },
      { isolation: 'READ COMMITTED' },
    );
  }

  private expectedCounts(raw: Record<string, unknown>): Partial<Record<ResourceType, number>> {
    const e = new FieldErrors();
    const out: Partial<Record<ResourceType, number>> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!BOOTSTRAP_ORDER.includes(key as ResourceType)) e.add(`expected_counts.${key}`, 'UNKNOWN_RESOURCE_TYPE');
      else if (!Number.isInteger(value) || (value as number) < 0) e.add(`expected_counts.${key}`, 'INVALID');
      else out[key as ResourceType] = value as number;
    }
    if (!e.empty) throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, e.map);
    return out;
  }

  /** Live records the client uploaded; the built-in roles seeded by the server are not part of its count. */
  private async uploadedCount(em: EntityManager, spaceId: string, type: ResourceType): Promise<number> {
    if (type !== 'role') return RESOURCE_REGISTRY[type].countLive(em, spaceId);
    const [row]: Array<{ n: string | number }> = await em.query(
      'SELECT COUNT(*) AS n FROM roles WHERE space_id = ? AND deleted_at IS NULL AND is_system = 0',
      [spaceId],
    );
    return Number(row.n);
  }

  /** Only the creator touches a Space before activation; everyone else sees it as missing (403). */
  private async creatorContext(
    em: EntityManager,
    session: SessionContext,
    spaceId: string,
    allowShared = false,
  ): Promise<{ ctx: SpaceAccessContext; space: LockedSpace }> {
    if (!isClientId(spaceId)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    const space = await lockSpace(em, spaceId);
    if (!space) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    const ctx = await this.access.loadContext(session, spaceId, em);
    const [row]: Array<{ created_by_actor_id: string }> = await em.query(
      'SELECT created_by_actor_id FROM spaces WHERE id = ?',
      [spaceId],
    );
    if (row.created_by_actor_id !== session.actorId) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    if (space.sharing_state !== 'INITIALIZING' && !allowShared) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    return { ctx, space };
  }
}
