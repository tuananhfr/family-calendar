import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { withTransaction } from '../../database/transaction';
import { CLOCK, type Clock } from '../jobs/clock';
import type {
  CreatePushSubscriptionDto,
  PushSubscriptionCreatedDto,
  PushSubscriptionDto,
} from './dto/push-subscription.dto';

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const PRIVATE_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

function invalid(field: string): ApiError {
  return new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { [field]: 'INVALID' });
}

function decoded(value: string): Buffer | null {
  return BASE64URL.test(value) ? Buffer.from(value, 'base64url') : null;
}

/**
 * The worker POSTs to this URL, so it must look like a public push service: anything that could aim it at the
 * server's own network (IP literals, single-label or local names, custom ports, credentials) is refused.
 */
function assertPushEndpoint(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalid('endpoint');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const bad =
    url.protocol !== 'https:' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    isIP(host) !== 0 ||
    !host.includes('.') ||
    PRIVATE_SUFFIXES.some((s) => host.endsWith(s));
  if (bad) throw invalid('endpoint');
}

interface Row {
  id: string;
  device_id: string;
  show_details: number;
  created_at: Date;
}

@Injectable()
export class PushSubscriptionsService {
  constructor(
    private readonly ds: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** One row per browser endpoint: subscribing again from whoever now holds it moves it to that device. */
  async upsert(session: SessionContext, dto: CreatePushSubscriptionDto): Promise<PushSubscriptionCreatedDto> {
    assertPushEndpoint(dto.endpoint);
    const p256dh = decoded(dto.keys.p256dh);
    if (p256dh?.length !== 65 || p256dh[0] !== 0x04) throw invalid('keys.p256dh');
    if (decoded(dto.keys.auth)?.length !== 16) throw invalid('keys.auth');

    const hash = createHash('sha256').update(dto.endpoint).digest('hex');
    const now = this.clock.now();
    return withTransaction(this.ds, async (em) => {
      const [existing]: Array<{ id: string; show_details: number }> = await em.query(
        'SELECT id, show_details FROM push_subscriptions WHERE endpoint_hash = ? FOR UPDATE',
        [hash],
      );
      const showDetails = dto.show_details ?? (existing ? Number(existing.show_details) === 1 : false);
      if (existing) {
        await em.query(
          `UPDATE push_subscriptions SET device_id = ?, actor_id = ?, endpoint = ?, p256dh = ?, auth = ?,
             show_details = ?, updated_at = ? WHERE id = ?`,
          [
            session.deviceId,
            session.actorId,
            dto.endpoint,
            dto.keys.p256dh,
            dto.keys.auth,
            showDetails,
            now,
            existing.id,
          ],
        );
        return { id: existing.id, show_details: showDetails };
      }
      const id = randomUUID();
      await em.query(
        `INSERT INTO push_subscriptions (id, device_id, actor_id, endpoint, endpoint_hash, p256dh, auth, show_details,
           created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          session.deviceId,
          session.actorId,
          dto.endpoint,
          hash,
          dto.keys.p256dh,
          dto.keys.auth,
          showDetails,
          now,
          now,
        ],
      );
      return { id, show_details: showDetails };
    });
  }

  async list(session: SessionContext): Promise<PushSubscriptionDto[]> {
    const rows: Row[] = await this.ds.query(
      `SELECT p.id, p.device_id, p.show_details, p.created_at FROM push_subscriptions p
         JOIN devices d ON d.id = p.device_id AND d.status = 'ACTIVE'
        WHERE p.actor_id = ? ORDER BY p.created_at, p.id`,
      [session.actorId],
    );
    return rows.map((r) => ({
      id: r.id,
      device_id: r.device_id,
      current_device: r.device_id === session.deviceId,
      show_details: Number(r.show_details) === 1,
      created_at: new Date(r.created_at).toISOString(),
    }));
  }

  async remove(session: SessionContext, id: string): Promise<void> {
    const result: { affectedRows?: number } = await this.ds.query(
      'DELETE FROM push_subscriptions WHERE id = ? AND actor_id = ?',
      [id, session.actorId],
    );
    // Someone else's id answers like a missing one.
    if (!result.affectedRows) throw new ApiError(ErrorCode.NOT_FOUND, 404);
  }
}
