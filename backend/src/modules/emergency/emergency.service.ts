import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { RateLimitService } from '../../common/http/rate-limit';
import { withTransaction } from '../../database/transaction';
import { hasLevel, type SpaceAccessContext } from '../access/evaluate-access';
import { recordAudit } from '../audit/record-audit';
import { CLOCK, type Clock } from '../jobs/clock';
import { enqueueJob, JOB_PRIORITY } from '../jobs/job-queue';
import type {
  CloseEmergencyDto,
  CreateEmergencyDto,
  EmergencyAcceptedDto,
  EmergencyLocationDto,
  EmergencyRecipientStateDto,
  EmergencyResponseDto,
  EmergencyViewDto,
  LocationAcceptedDto,
} from './dto/emergency.dto';
import type { EmergencyLifecycle } from './entities/emergency-event.entity';
import { EmergencyRecipientsService } from './recipients.service';

export const SOS_ALERT_JOB = 'SOS_ALERT';
/** sos.md / modules.md §18: 10 new SOS per hour per device; retries of an existing id are never counted. */
const SOS_LIMIT = { bucket: 'sos', limit: 10, windowSeconds: 3600 };
const RECENT_CLOSED_MS = 24 * 3600_000;
const ER_DUP_ENTRY = 1062;

export interface EventRow {
  id: string;
  space_id: string;
  created_by_actor_id: string;
  created_by_device_id: string;
  client_triggered_at: Date;
  server_received_at: Date;
  lifecycle: EmergencyLifecycle;
  revision: string;
  closed_at: Date | null;
  reason: string | null;
  recipient_member_ids: unknown;
}

/** Carries Retry-After for the controller; the body stays the standard RATE_LIMITED envelope. */
export class SosRateLimitedError extends ApiError {
  constructor(readonly retryAfterSeconds: number) {
    super(
      ErrorCode.RATE_LIMITED,
      429,
      'Đã gửi quá nhiều SOS trong một giờ. Hãy gọi trực tiếp người thân hoặc số khẩn cấp.',
    );
  }
}

export function snapshotOf(row: Pick<EventRow, 'recipient_member_ids'>): string[] {
  let raw = row.recipient_member_ids;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

function iso(d: Date | null): string | null {
  return d ? new Date(d).toISOString() : null;
}

function isDuplicate(err: unknown): boolean {
  const e = err as { errno?: unknown; driverError?: { errno?: unknown } } | null;
  return (e?.driverError?.errno ?? e?.errno) === ER_DUP_ENTRY;
}

const EVENT_COLUMNS = `id, space_id, created_by_actor_id, created_by_device_id, client_triggered_at, server_received_at,
  lifecycle, revision, closed_at, reason, recipient_member_ids`;

@Injectable()
export class EmergencyService {
  constructor(
    private readonly ds: DataSource,
    private readonly recipients: EmergencyRecipientsService,
    private readonly limiter: RateLimitService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Create-or-reconcile by client id. A terminal state already stored always wins over a late ACTIVE retry, and an
   * event that arrives already closed is stored without alerting anyone (sos.md "Offline và retry").
   */
  async create(
    session: SessionContext,
    spaceId: string,
    dto: CreateEmergencyDto,
  ): Promise<{ created: boolean; body: EmergencyAcceptedDto }> {
    const ctx = await this.recipients.familyContext(session, spaceId);
    if (!hasLevel(ctx, 'sos.trigger', 'EDIT')) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    // Concurrent first sends of one id: the losers hit the duplicate key and come back as reconciles.
    for (let attempt = 0; ; attempt++) {
      try {
        return await withTransaction(this.ds, (em) => this.createOnce(em, ctx, session, spaceId, dto), {
          isolation: 'READ COMMITTED',
        });
      } catch (err) {
        if (attempt < 2 && isDuplicate(err)) continue;
        throw err;
      }
    }
  }

  private async createOnce(
    em: EntityManager,
    ctx: SpaceAccessContext,
    session: SessionContext,
    spaceId: string,
    dto: CreateEmergencyDto,
  ): Promise<{ created: boolean; body: EmergencyAcceptedDto }> {
    const existing = await this.lockEvent(em, dto.id);
    if (existing) {
      if (existing.space_id !== spaceId || existing.created_by_actor_id !== session.actorId) {
        throw new ApiError(ErrorCode.ID_COLLISION, 409);
      }
      if (existing.lifecycle === 'ACTIVE' && dto.lifecycle !== 'ACTIVE') {
        return { created: false, body: await this.applyClose(em, session, existing, dto.lifecycle, dto) };
      }
      return { created: false, body: this.accepted(existing) };
    }

    const now = this.clock.now();
    const closed = dto.lifecycle !== 'ACTIVE';
    const own = new Set(ctx.representedMemberIds);
    const snapshot = (await this.recipients.effective(em, spaceId)).memberIds.filter((m) => !own.has(m));
    await em.query(
      `INSERT INTO emergency_events (id, space_id, created_by_actor_id, created_by_device_id, operation_id,
         client_triggered_at, server_received_at, lifecycle, revision, closed_at, closed_by_actor_id, reason,
         recipient_member_ids, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      [
        dto.id,
        spaceId,
        session.actorId,
        session.deviceId,
        dto.operation_id,
        new Date(dto.client_triggered_at),
        now,
        dto.lifecycle,
        closed ? (dto.closed_at ? new Date(dto.closed_at) : now) : null,
        closed ? session.actorId : null,
        closed ? (dto.reason ?? null) : null,
        JSON.stringify(snapshot),
        now,
      ],
    );
    // Counted only once the id is new: a flaky network retrying the same SOS must never lock the user out.
    const limit = await this.limiter.hit(SOS_LIMIT.bucket, session.deviceId, SOS_LIMIT.limit, SOS_LIMIT.windowSeconds);
    if (!limit.allowed) throw new SosRateLimitedError(limit.retryAfterSeconds);
    if (!closed) {
      await enqueueJob(em, {
        type: SOS_ALERT_JOB,
        dedupeKey: `${SOS_ALERT_JOB}:${dto.id}`,
        runAt: now,
        priority: JOB_PRIORITY.URGENT,
        payload: { spaceId, eventId: dto.id },
      });
    }
    await recordAudit(em, {
      spaceId,
      actorId: session.actorId,
      deviceId: session.deviceId,
      action: closed ? 'sos.trigger_closed' : 'sos.trigger',
      resourceType: 'emergency',
      resourceId: dto.id,
      revision: '1',
    });
    const created = await this.lockEvent(em, dto.id);
    return { created: true, body: this.accepted(created!) };
  }

  async close(
    session: SessionContext,
    spaceId: string,
    eventId: string,
    dto: CloseEmergencyDto,
  ): Promise<EmergencyAcceptedDto> {
    return withTransaction(this.ds, async (em) => {
      await this.recipients.familyContext(session, spaceId, em);
      const ev = await this.lockEvent(em, eventId);
      if (!ev || ev.space_id !== spaceId) throw new ApiError(ErrorCode.NOT_FOUND, 404);
      // Closing for someone else (e.g. a guardian) is not decided yet (sos.md); only the creator closes.
      if (ev.created_by_actor_id !== session.actorId) throw new ApiError(ErrorCode.FORBIDDEN, 403);
      if (ev.lifecycle !== 'ACTIVE') return this.accepted(ev);
      return this.applyClose(em, session, ev, dto.lifecycle, dto);
    });
  }

  async respond(
    session: SessionContext,
    spaceId: string,
    eventId: string,
    dto: EmergencyResponseDto,
  ): Promise<EmergencyRecipientStateDto> {
    return withTransaction(this.ds, async (em) => {
      const ctx = await this.recipients.familyContext(session, spaceId, em);
      const ev = await this.lockEvent(em, eventId);
      if (!ev || ev.space_id !== spaceId) throw new ApiError(ErrorCode.NOT_FOUND, 404);
      const memberId = await this.recipientMemberOf(em, ctx, ev);
      if (!memberId || ev.created_by_actor_id === session.actorId) throw new ApiError(ErrorCode.FORBIDDEN, 403);

      const [prev]: Array<{ operation_id: string; kind: string; updated_at: Date }> = await em.query(
        'SELECT operation_id, kind, updated_at FROM emergency_responses WHERE event_id = ? AND responder_actor_id = ?',
        [eventId, session.actorId],
      );
      if (prev?.operation_id === dto.operation_id) {
        return { member_id: memberId, response: prev.kind as 'ACKNOWLEDGED', responded_at: iso(prev.updated_at) };
      }
      if (ev.lifecycle !== 'ACTIVE') throw new ApiError(ErrorCode.EMERGENCY_CLOSED, 409);
      const now = this.clock.now();
      await em.query(
        `INSERT INTO emergency_responses (event_id, responder_actor_id, responder_member_id, kind, operation_id,
           created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE responder_member_id = VALUES(responder_member_id), kind = VALUES(kind),
           operation_id = VALUES(operation_id), updated_at = VALUES(updated_at)`,
        [eventId, session.actorId, memberId, dto.kind, dto.operation_id, now, now],
      );
      await recordAudit(em, {
        spaceId,
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'sos.respond',
        resourceType: 'emergency',
        resourceId: eventId,
      });
      return { member_id: memberId, response: dto.kind, responded_at: now.toISOString() };
    });
  }

  async addLocation(
    session: SessionContext,
    spaceId: string,
    eventId: string,
    dto: EmergencyLocationDto,
  ): Promise<LocationAcceptedDto> {
    return withTransaction(this.ds, async (em) => {
      await this.recipients.familyContext(session, spaceId, em);
      const ev = await this.lockEvent(em, eventId);
      if (!ev || ev.space_id !== spaceId) throw new ApiError(ErrorCode.NOT_FOUND, 404);
      if (ev.created_by_actor_id !== session.actorId) throw new ApiError(ErrorCode.FORBIDDEN, 403);
      if (ev.lifecycle !== 'ACTIVE') throw new ApiError(ErrorCode.EMERGENCY_CLOSED, 409);
      const now = this.clock.now();
      const result: { insertId?: number | string } = await em.query(
        `INSERT INTO emergency_locations (event_id, actor_id, device_id, latitude, longitude, accuracy_m, captured_at,
           received_at, provenance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          session.actorId,
          session.deviceId,
          dto.lat.toFixed(6),
          dto.lng.toFixed(6),
          dto.accuracy.toFixed(1),
          new Date(dto.captured_at),
          now,
          dto.provenance,
        ],
      );
      return { id: String(result.insertId), received_at: now.toISOString() };
    });
  }

  async get(session: SessionContext, spaceId: string, eventId: string): Promise<EmergencyViewDto> {
    const em = this.ds.manager;
    const ctx = await this.recipients.familyContext(session, spaceId, em);
    const [ev]: EventRow[] = await em.query(`SELECT ${EVENT_COLUMNS} FROM emergency_events WHERE id = ?`, [eventId]);
    if (!ev || ev.space_id !== spaceId) throw new ApiError(ErrorCode.NOT_FOUND, 404);
    const current = await this.currentRecipients(em, ev);
    if (!this.canRead(ctx, ev, current)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    return this.view(em, ev, current);
  }

  async list(session: SessionContext, spaceId: string): Promise<EmergencyViewDto[]> {
    const em = this.ds.manager;
    const ctx = await this.recipients.familyContext(session, spaceId, em);
    const since = new Date(this.clock.now().getTime() - RECENT_CLOSED_MS);
    const rows: EventRow[] = await em.query(
      `SELECT ${EVENT_COLUMNS} FROM emergency_events
        WHERE space_id = ? AND (lifecycle = 'ACTIVE' OR closed_at >= ?)
        ORDER BY server_received_at DESC, id DESC LIMIT 50`,
      [spaceId, since],
    );
    const out: EmergencyViewDto[] = [];
    for (const ev of rows) {
      const current = await this.currentRecipients(em, ev);
      if (this.canRead(ctx, ev, current)) out.push(await this.view(em, ev, current));
    }
    return out;
  }

  /** Snapshot at trigger time ∩ today's list: removing someone from the list also removes their access. */
  async currentRecipients(
    em: EntityManager,
    ev: Pick<EventRow, 'space_id' | 'recipient_member_ids'>,
  ): Promise<string[]> {
    const current = new Set((await this.recipients.effective(em, ev.space_id)).memberIds);
    return snapshotOf(ev).filter((m) => current.has(m));
  }

  private canRead(ctx: SpaceAccessContext, ev: EventRow, current: string[]): boolean {
    return ev.created_by_actor_id === ctx.actorId || ctx.representedMemberIds.some((m) => current.includes(m));
  }

  private async recipientMemberOf(em: EntityManager, ctx: SpaceAccessContext, ev: EventRow): Promise<string | null> {
    const current = await this.currentRecipients(em, ev);
    return ctx.representedMemberIds.find((m) => current.includes(m)) ?? null;
  }

  private async applyClose(
    em: EntityManager,
    session: SessionContext,
    ev: EventRow,
    lifecycle: EmergencyLifecycle,
    dto: { reason?: string; closed_at?: string },
  ): Promise<EmergencyAcceptedDto> {
    const now = this.clock.now();
    const closedAt = dto.closed_at ? new Date(dto.closed_at) : now;
    await em.query(
      `UPDATE emergency_events SET lifecycle = ?, closed_at = ?, closed_by_actor_id = ?, reason = ?,
         revision = revision + 1, updated_at = ? WHERE id = ? AND lifecycle = 'ACTIVE'`,
      [lifecycle, closedAt, session.actorId, dto.reason ?? null, now, ev.id],
    );
    await recordAudit(em, {
      spaceId: ev.space_id,
      actorId: session.actorId,
      deviceId: session.deviceId,
      action: 'sos.close',
      resourceType: 'emergency',
      resourceId: ev.id,
    });
    return this.accepted((await this.lockEvent(em, ev.id))!);
  }

  private async lockEvent(em: EntityManager, id: string): Promise<EventRow | null> {
    const [row]: EventRow[] = await em.query(`SELECT ${EVENT_COLUMNS} FROM emergency_events WHERE id = ? FOR UPDATE`, [
      id,
    ]);
    return row ?? null;
  }

  private accepted(ev: EventRow): EmergencyAcceptedDto {
    return {
      id: ev.id,
      lifecycle: ev.lifecycle,
      client_triggered_at: new Date(ev.client_triggered_at).toISOString(),
      server_received_at: new Date(ev.server_received_at).toISOString(),
      closed_at: iso(ev.closed_at),
      revision: String(ev.revision),
      delivery: 'SERVER_ACCEPTED',
    };
  }

  private async view(em: EntityManager, ev: EventRow, current: string[]): Promise<EmergencyViewDto> {
    const responses: Array<{
      responder_member_id: string | null;
      kind: 'ACKNOWLEDGED' | 'RESPONDING';
      updated_at: Date;
    }> = await em.query(
      'SELECT responder_member_id, kind, updated_at FROM emergency_responses WHERE event_id = ? ORDER BY updated_at',
      [ev.id],
    );
    const byMember = new Map(responses.map((r) => [r.responder_member_id, r]));
    const [self]: Array<{ member_id: string }> = await em.query(
      `SELECT member_id FROM member_representations
        WHERE space_id = ? AND actor_id = ? AND relation = 'SELF' ORDER BY member_id LIMIT 1`,
      [ev.space_id, ev.created_by_actor_id],
    );
    const [{ n }]: Array<{ n: string | number }> = await em.query(
      "SELECT COUNT(*) AS n FROM emergency_deliveries WHERE event_id = ? AND channel = 'PUSH' AND status = 'SUBMITTED'",
      [ev.id],
    );
    const [loc]: Array<{
      latitude: string;
      longitude: string;
      accuracy_m: string;
      captured_at: Date;
      received_at: Date;
      provenance: 'CURRENT' | 'LAST_KNOWN';
    }> = await em.query(
      `SELECT latitude, longitude, accuracy_m, captured_at, received_at, provenance FROM emergency_locations
        WHERE event_id = ? ORDER BY captured_at DESC, id DESC LIMIT 1`,
      [ev.id],
    );
    return {
      ...this.accepted(ev),
      created_by_actor_id: ev.created_by_actor_id,
      created_by_member_id: self?.member_id ?? null,
      reason: ev.reason,
      recipients: current.map((memberId) => {
        const r = byMember.get(memberId);
        return { member_id: memberId, response: r?.kind ?? 'NONE', responded_at: r ? iso(r.updated_at) : null };
      }),
      push_submitted: Number(n),
      last_location: loc
        ? {
            lat: Number(loc.latitude),
            lng: Number(loc.longitude),
            accuracy: Number(loc.accuracy_m),
            captured_at: new Date(loc.captured_at).toISOString(),
            received_at: new Date(loc.received_at).toISOString(),
            provenance: loc.provenance,
          }
        : null,
    };
  }
}
