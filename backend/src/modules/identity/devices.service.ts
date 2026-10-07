import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { withTransaction } from '../../database/transaction';
import { recordAudit } from '../audit/record-audit';
import type { DeviceDto } from './dto/device.dto';
import type { RegisterDeviceDto } from './dto/register-device.dto';
import { SessionsService, type IssuedSession } from './sessions.service';

interface DeviceRow {
  id: string;
  actor_id: string;
  label: string | null;
  status: 'ACTIVE' | 'REVOKED';
  created_at: Date;
  revoked_at: Date | null;
  last_seen_at?: Date | null;
}

const ER_DUP_ENTRY = 1062;

function isDuplicateKey(err: unknown): boolean {
  const e = err as { errno?: unknown; driverError?: { errno?: unknown } } | null;
  return (e?.driverError?.errno ?? e?.errno) === ER_DUP_ENTRY;
}

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

function toDto(row: DeviceRow, currentDeviceId: string): DeviceDto {
  return {
    id: row.id,
    label: row.label,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    revokedAt: iso(row.revoked_at),
    lastSeenAt: iso(row.last_seen_at),
    current: row.id === currentDeviceId,
  };
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly ds: DataSource,
    private readonly sessions: SessionsService,
  ) {}

  /**
   * A new actor id registers freely. An existing actor id only accepts a request that already holds
   * that actor's session; guessing a UUID must never hand over someone else's identity.
   */
  async register(
    dto: RegisterDeviceDto,
    current: SessionContext | undefined,
    userAgent?: string,
  ): Promise<IssuedSession> {
    const collision = () => new ApiError(ErrorCode.ID_COLLISION, 409);
    try {
      return await withTransaction(this.ds, async (em) => {
        const actors: unknown[] = await em.query('SELECT id FROM actors WHERE id = ? FOR UPDATE', [dto.actorId]);
        const devices: DeviceRow[] = await em.query(
          'SELECT id, actor_id, label, status, created_at, revoked_at FROM devices WHERE id = ? FOR UPDATE',
          [dto.deviceId],
        );
        const device = devices[0];
        const meta = { label: dto.label ?? null, userAgent: userAgent ?? null };

        if (actors.length === 0) {
          if (device) throw collision();
          await em.query('INSERT INTO actors (id, created_at) VALUES (?, ?)', [dto.actorId, new Date()]);
          await this.sessions.insertDevice(em, dto.actorId, dto.deviceId, meta);
          return this.sessions.issueSession(em, dto.actorId, dto.deviceId);
        }

        if (!current || current.actorId !== dto.actorId) throw collision();
        if (!device) {
          await this.sessions.insertDevice(em, dto.actorId, dto.deviceId, meta);
          return this.sessions.issueSession(em, dto.actorId, dto.deviceId);
        }
        if (device.actor_id !== dto.actorId) throw collision();
        if (device.status === 'REVOKED') throw new ApiError(ErrorCode.DEVICE_REVOKED, 401);
        // Same device registering again: rotate to a fresh session so the old token stops working.
        if (current.deviceId === dto.deviceId) {
          await em.query('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [
            new Date(),
            current.sessionId,
          ]);
        }
        return this.sessions.issueSession(em, dto.actorId, dto.deviceId);
      });
    } catch (err) {
      if (isDuplicateKey(err)) throw collision();
      throw err;
    }
  }

  async list(session: SessionContext): Promise<DeviceDto[]> {
    const rows: DeviceRow[] = await this.ds.query(
      `SELECT d.id, d.actor_id, d.label, d.status, d.created_at, d.revoked_at, MAX(s.last_seen_at) AS last_seen_at
         FROM devices d LEFT JOIN sessions s ON s.device_id = d.id
        WHERE d.actor_id = ?
        GROUP BY d.id, d.actor_id, d.label, d.status, d.created_at, d.revoked_at
        ORDER BY d.created_at, d.id`,
      [session.actorId],
    );
    return rows.map((r) => toDto(r, session.deviceId));
  }

  /** Revokes a device of the caller's own actor and every session it holds. Idempotent. */
  async revoke(session: SessionContext, deviceId: string): Promise<DeviceDto> {
    return withTransaction(this.ds, async (em) => {
      const rows: DeviceRow[] = await em.query(
        'SELECT id, actor_id, label, status, created_at, revoked_at FROM devices WHERE id = ? AND actor_id = ? FOR UPDATE',
        [deviceId, session.actorId],
      );
      const device = rows[0];
      // Another actor's device answers like a missing one, so ids cannot be probed.
      if (!device) throw new ApiError(ErrorCode.NOT_FOUND, 404);
      if (device.status === 'REVOKED') return toDto(device, session.deviceId);

      const now = new Date();
      await em.query("UPDATE devices SET status = 'REVOKED', revoked_at = ? WHERE id = ?", [now, deviceId]);
      await em.query('UPDATE sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL', [now, deviceId]);
      // A revoked device must stop getting pushes even if its browser keeps the subscription.
      await em.query('DELETE FROM push_subscriptions WHERE device_id = ?', [deviceId]);
      await recordAudit(em, {
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'device.revoke',
        resourceType: 'device',
        resourceId: deviceId,
      });
      return toDto({ ...device, status: 'REVOKED', revoked_at: now }, session.deviceId);
    });
  }
}
