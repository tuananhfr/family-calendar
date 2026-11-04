import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { newOpaqueToken, sha256Hex } from '../../common/crypto/tokens';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { addDays } from '../../common/time/local-date';
import { todayIn } from '../../common/time/zoned';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import { recordAudit } from '../audit/record-audit';
import { CLOCK, type Clock } from '../jobs/clock';
import type {
  PairScreenDeviceDto,
  SaveScreenGoalDto,
  ScreenAppUsageDto,
  ScreenBatchDto,
  ScreenCollectorStateDto,
  ScreenSummaryQueryDto,
} from './screen-time.dto';
import { screenMemberAccess, validateScreenBatch, validateScreenRange } from './screen-time.rules';

interface DeviceRow {
  id: string;
  space_id: string;
  member_id: string;
  label: string;
  state: string;
  grant_actor_id: string;
  grant_device_id: string;
  token_hash: string | null;
  consent_at: Date | null;
  last_seen_at: Date | null;
  created_at: Date;
}
interface UsageRow {
  device_id: string;
  local_date: string;
  time_zone: string;
  captured_at: Date;
  observed_from: Date;
  total_seconds: number;
  coverage: 'COMPLETE' | 'PARTIAL';
  apps: string | ScreenAppUsageDto[];
}
interface GoalRow {
  limit_minutes: number;
  reminders_enabled: number;
  version: number;
  updated_at: Date;
}

function appsOf(row: UsageRow): ScreenAppUsageDto[] {
  return typeof row.apps === 'string' ? (JSON.parse(row.apps) as ScreenAppUsageDto[]) : row.apps;
}

@Injectable()
export class ScreenTimeService {
  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async authorize(
    session: SessionContext,
    spaceId: string,
    memberId: string,
    manage = false,
    em = this.ds.manager,
  ) {
    const ctx = await this.access.loadContext(session, spaceId, em);
    const permission = screenMemberAccess(ctx, memberId);
    if (!(manage ? permission.manage : permission.view)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    const [member]: Array<{ id: string }> = await em.query(
      "SELECT id FROM members WHERE space_id = ? AND id = ? AND deleted_at IS NULL AND status = 'ACTIVE'",
      [spaceId, memberId],
    );
    if (!member) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    const [space]: Array<{ time_zone: string }> = await em.query('SELECT time_zone FROM spaces WHERE id = ?', [
      spaceId,
    ]);
    return { ...permission, timeZone: space.time_zone };
  }

  async members(session: SessionContext, spaceId: string) {
    const ctx = await this.access.loadContext(session, spaceId);
    if (ctx.spaceKind !== 'FAMILY') throw new ApiError(ErrorCode.FORBIDDEN, 403);
    const rows: Array<{ id: string; display_name: string; profile: string }> = await this.ds.query(
      "SELECT id, display_name, profile FROM members WHERE space_id = ? AND deleted_at IS NULL AND status = 'ACTIVE' ORDER BY created_at",
      [spaceId],
    );
    return {
      members: rows
        .filter((r) => screenMemberAccess(ctx, r.id).view)
        .map((r) => ({
          id: r.id,
          display_name: r.display_name,
          profile: r.profile,
          can_manage: screenMemberAccess(ctx, r.id).manage,
        })),
    };
  }

  async pair(session: SessionContext, spaceId: string, memberId: string, dto: PairScreenDeviceDto) {
    return withTransaction(this.ds, async (em) => {
      const permission = await this.authorize(session, spaceId, memberId, true, em);
      await em.query('SELECT id FROM members WHERE space_id = ? AND id = ? FOR UPDATE', [spaceId, memberId]);
      await em.query(
        `UPDATE screen_devices d JOIN screen_pairings p ON p.device_id = d.id
        SET d.state = 'DISCONNECTED' WHERE d.space_id = ? AND d.member_id = ? AND d.state = 'UNLINKED' AND p.expires_at <= ?`,
        [spaceId, memberId, this.clock.now()],
      );
      const [{ n }]: Array<{ n: number }> = await em.query(
        "SELECT COUNT(*) AS n FROM screen_devices WHERE space_id = ? AND member_id = ? AND state <> 'DISCONNECTED'",
        [spaceId, memberId],
      );
      if (Number(n) >= 5)
        throw new ApiError(
          ErrorCode.VALIDATION_FAILED,
          422,
          'Tối đa 5 thiết bị. Hãy gỡ các thiết bị không còn sử dụng.',
        );
      const now = this.clock.now();
      const id = randomUUID();
      const code = randomBytes(6).toString('hex').toUpperCase();
      const expires = new Date(now.getTime() + 10 * 60_000);
      await em.query(
        `INSERT INTO screen_devices (id, space_id, member_id, grant_actor_id, grant_device_id, label, state, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'UNLINKED', ?)`,
        [id, spaceId, memberId, session.actorId, session.deviceId, dto.label.trim(), now],
      );
      await em.query('INSERT INTO screen_pairings (id, device_id, code_hash, expires_at) VALUES (?, ?, ?, ?)', [
        randomUUID(),
        id,
        sha256Hex(code),
        expires,
      ]);
      await recordAudit(em, {
        spaceId,
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'screen.pair',
        resourceType: 'screen_device',
        resourceId: id,
      });
      return { device_id: id, code, expires_at: expires.toISOString(), time_zone: permission.timeZone };
    });
  }

  private grantSession(device: DeviceRow): SessionContext {
    return { actorId: device.grant_actor_id, deviceId: device.grant_device_id, sessionId: '', accountId: null };
  }

  async redeem(code: string) {
    return withTransaction(this.ds, async (em) => {
      const [pairing]: Array<{ id: string; device_id: string; expires_at: Date; consumed_at: Date | null }> =
        await em.query('SELECT * FROM screen_pairings WHERE code_hash = ? FOR UPDATE', [sha256Hex(code)]);
      const now = this.clock.now();
      if (!pairing || pairing.consumed_at || new Date(pairing.expires_at) <= now) {
        throw new ApiError(ErrorCode.INVITE_INVALID, 422, 'Mã liên kết không đúng, đã hết hạn hoặc đã được sử dụng.');
      }
      const [device]: DeviceRow[] = await em.query('SELECT * FROM screen_devices WHERE id = ? FOR UPDATE', [
        pairing.device_id,
      ]);
      if (!device || device.state !== 'UNLINKED') throw new ApiError(ErrorCode.INVITE_INVALID, 422);
      const permission = await this.authorize(this.grantSession(device), device.space_id, device.member_id, true, em);
      const token = newOpaqueToken();
      await em.query(
        "UPDATE screen_devices SET token_hash = ?, state = 'PENDING_PERMISSION', consent_at = ?, last_seen_at = ? WHERE id = ?",
        [sha256Hex(token), now, now, device.id],
      );
      await em.query('UPDATE screen_pairings SET consumed_at = ? WHERE id = ?', [now, pairing.id]);
      await recordAudit(em, {
        spaceId: device.space_id,
        actorId: device.grant_actor_id,
        deviceId: device.grant_device_id,
        action: 'screen.consent.grant',
        resourceType: 'screen_device',
        resourceId: device.id,
      });
      return {
        device_id: device.id,
        token,
        time_zone: permission.timeZone,
        consent_at: now.toISOString(),
        state: 'PENDING_PERMISSION',
      };
    });
  }

  private async collector(token: string, em: EntityManager, lock = false) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(ErrorCode.AUTH_REQUIRED, 401);
    const [device]: DeviceRow[] = await em.query(
      `SELECT * FROM screen_devices WHERE token_hash = ?${lock ? ' FOR UPDATE' : ''}`,
      [sha256Hex(token)],
    );
    if (!device || device.state === 'DISCONNECTED' || !device.consent_at)
      throw new ApiError(ErrorCode.DEVICE_REVOKED, 401);
    const permission = await this.authorize(this.grantSession(device), device.space_id, device.member_id, true, em);
    return { device, timeZone: permission.timeZone };
  }

  async config(token: string) {
    const { device, timeZone } = await this.collector(token, this.ds.manager);
    const [goal]: GoalRow[] = await this.ds.query('SELECT * FROM screen_goals WHERE space_id = ? AND member_id = ?', [
      device.space_id,
      device.member_id,
    ]);
    return {
      device_id: device.id,
      time_zone: timeZone,
      consent_at: new Date(device.consent_at!).toISOString(),
      state: device.state,
      goal: goal ? { limit_minutes: Number(goal.limit_minutes), reminders_enabled: !!goal.reminders_enabled } : null,
    };
  }

  async state(token: string, dto: ScreenCollectorStateDto) {
    return withTransaction(this.ds, async (em) => {
      const { device } = await this.collector(token, em, true);
      await em.query('UPDATE screen_devices SET state = ?, last_seen_at = ? WHERE id = ?', [
        dto.state,
        this.clock.now(),
        device.id,
      ]);
      if (device.state !== dto.state)
        await recordAudit(em, {
          spaceId: device.space_id,
          actorId: device.grant_actor_id,
          deviceId: device.grant_device_id,
          action: `screen.state.${dto.state.toLowerCase()}`,
          resourceType: 'screen_device',
          resourceId: device.id,
        });
      return { state: dto.state };
    });
  }

  async ingest(token: string, batch: ScreenBatchDto) {
    return withTransaction(this.ds, async (em) => {
      const { device, timeZone } = await this.collector(token, em, true);
      if (device.state !== 'ACTIVE') throw new ApiError(ErrorCode.FORBIDDEN, 403, 'Thiết bị chưa có quyền thu thập.');
      const now = this.clock.now();
      validateScreenBatch(batch, timeZone, now, new Date(device.consent_at!));
      const hash = sha256Hex(JSON.stringify(batch));
      const [receipt]: Array<{ payload_hash: string }> = await em.query(
        'SELECT payload_hash FROM screen_batches WHERE device_id = ? AND batch_id = ?',
        [device.id, batch.batch_id],
      );
      if (receipt) {
        if (receipt.payload_hash !== hash) throw new ApiError(ErrorCode.OPERATION_ID_REUSED, 409);
        return { accepted: 0, duplicate: true };
      }
      let accepted = 0;
      for (const day of batch.days) {
        const [previous]: Array<{ captured_at: Date }> = await em.query(
          'SELECT captured_at FROM screen_daily_usage WHERE device_id = ? AND local_date = ?',
          [device.id, day.local_date],
        );
        if (previous && new Date(previous.captured_at).getTime() >= Date.parse(day.captured_at)) continue;
        await em.query(
          `INSERT INTO screen_daily_usage (space_id, member_id, device_id, local_date, time_zone, captured_at,
             observed_from, total_seconds, coverage, apps, algorithm_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE time_zone = VALUES(time_zone), captured_at = VALUES(captured_at),
             observed_from = VALUES(observed_from), total_seconds = VALUES(total_seconds), coverage = VALUES(coverage),
             apps = VALUES(apps), algorithm_version = VALUES(algorithm_version)`,
          [
            device.space_id,
            device.member_id,
            device.id,
            day.local_date,
            timeZone,
            new Date(day.captured_at),
            new Date(day.observed_from),
            day.total_seconds,
            day.coverage,
            JSON.stringify(day.apps),
            batch.algorithm_version,
          ],
        );
        accepted++;
      }
      await em.query('INSERT INTO screen_batches (device_id, batch_id, payload_hash, created_at) VALUES (?, ?, ?, ?)', [
        device.id,
        batch.batch_id,
        hash,
        now,
      ]);
      await em.query('UPDATE screen_devices SET last_seen_at = ? WHERE id = ?', [now, device.id]);
      await this.remind(em, device, timeZone, now);
      // Bound usage and replay receipts to 90 days; no indefinite app history.
      await em.query('DELETE FROM screen_daily_usage WHERE device_id = ? AND local_date < ?', [
        device.id,
        addDays(todayIn(timeZone, now), -90),
      ]);
      await em.query('DELETE FROM screen_batches WHERE device_id = ? AND created_at < ?', [
        device.id,
        new Date(now.getTime() - 90 * 86400_000),
      ]);
      return { accepted, duplicate: false };
    });
  }

  private async remind(em: EntityManager, device: DeviceRow, timeZone: string, now: Date) {
    const [goal]: GoalRow[] = await em.query(
      'SELECT * FROM screen_goals WHERE space_id = ? AND member_id = ? FOR UPDATE',
      [device.space_id, device.member_id],
    );
    if (!goal?.reminders_enabled) return;
    const today = todayIn(timeZone, now);
    const rows: Array<{ total_seconds: number; coverage: string; captured_at: Date; state: string }> = await em.query(
      `SELECT u.total_seconds, u.coverage, u.captured_at, d.state FROM screen_devices d
       LEFT JOIN screen_daily_usage u ON u.device_id = d.id AND u.local_date = ?
       WHERE d.space_id = ? AND d.member_id = ? AND d.state <> 'DISCONNECTED'`,
      [today, device.space_id, device.member_id],
    );
    if (
      !rows.length ||
      rows.some(
        (r) =>
          r.state !== 'ACTIVE' ||
          r.coverage !== 'COMPLETE' ||
          !r.captured_at ||
          now.getTime() - new Date(r.captured_at).getTime() > 3600_000,
      )
    )
      return;
    const seconds = rows.reduce((sum, r) => sum + Number(r.total_seconds), 0);
    // Record only the highest threshold reached in this batch; at most once per threshold/day.
    const threshold =
      seconds >= Number(goal.limit_minutes) * 60 ? 100 : seconds >= Number(goal.limit_minutes) * 48 ? 80 : 0;
    if (!threshold) return;
    const [existing]: Array<{ threshold: number }> = await em.query(
      'SELECT threshold FROM screen_alerts WHERE space_id = ? AND member_id = ? AND local_date = ? AND threshold >= ?',
      [device.space_id, device.member_id, today, threshold],
    );
    if (existing) return;
    await em.query(
      'INSERT INTO screen_alerts (space_id, member_id, local_date, threshold, created_at) VALUES (?, ?, ?, ?, ?)',
      [device.space_id, device.member_id, today, threshold, now],
    );
    await em.query(
      `INSERT INTO notifications (id, actor_id, space_id, type, resource_ref, title_safe, created_at)
      VALUES (?, ?, ?, 'SYSTEM', ?, ?, ?)`,
      [
        randomUUID(),
        device.grant_actor_id,
        device.space_id,
        JSON.stringify({ type: 'screen_time', id: device.member_id }),
        `Thời gian màn hình đã đạt ${threshold}% mục tiêu hôm nay.`,
        now,
      ],
    );
  }

  async summary(session: SessionContext, spaceId: string, memberId: string, range: ScreenSummaryQueryDto) {
    validateScreenRange(range);
    const permission = await this.authorize(session, spaceId, memberId);
    const devices: DeviceRow[] = await this.ds.query(
      'SELECT * FROM screen_devices WHERE space_id = ? AND member_id = ? ORDER BY created_at',
      [spaceId, memberId],
    );
    const rows: UsageRow[] = await this.ds.query(
      'SELECT * FROM screen_daily_usage WHERE space_id = ? AND member_id = ? AND local_date BETWEEN ? AND ? ORDER BY local_date',
      [spaceId, memberId, range.from, range.to],
    );
    const [goal]: GoalRow[] = await this.ds.query('SELECT * FROM screen_goals WHERE space_id = ? AND member_id = ?', [
      spaceId,
      memberId,
    ]);
    const now = this.clock.now();
    const days = [];
    for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
      const data = rows.filter((r) => r.local_date === date);
      const apps = new Map<string, ScreenAppUsageDto>();
      for (const row of data)
        for (const app of appsOf(row)) {
          const previous = apps.get(app.package_name);
          apps.set(app.package_name, { ...app, seconds: (previous?.seconds ?? 0) + Number(app.seconds) });
        }
      const expected = devices.filter(
        (d) => d.state !== 'DISCONNECTED' && todayIn(permission.timeZone, new Date(d.created_at)) <= date,
      );
      days.push({
        date,
        total_seconds: data.length ? data.reduce((sum, row) => sum + Number(row.total_seconds), 0) : null,
        coverage: !data.length
          ? 'UNKNOWN'
          : data.some((r) => r.coverage === 'PARTIAL' || r.time_zone !== permission.timeZone) ||
              expected.some((d) => !data.some((r) => r.device_id === d.id))
            ? 'PARTIAL'
            : 'COMPLETE',
        updated_at: data.length
          ? new Date(Math.max(...data.map((r) => new Date(r.captured_at).getTime()))).toISOString()
          : null,
        apps: [...apps.values()].sort((a, b) => b.seconds - a.seconds),
        device_count: data.length,
      });
    }
    return {
      member_id: memberId,
      time_zone: permission.timeZone,
      can_manage: permission.manage,
      source: 'ANDROID_USAGE_EVENTS',
      algorithm_version: 'android-events-v1',
      goal: goal
        ? {
            limit_minutes: Number(goal.limit_minutes),
            reminders_enabled: !!goal.reminders_enabled,
            version: Number(goal.version),
            updated_at: new Date(goal.updated_at).toISOString(),
          }
        : null,
      devices: devices.map((d) => ({
        id: d.id,
        label: d.label,
        state:
          d.state === 'ACTIVE' && (!d.last_seen_at || now.getTime() - new Date(d.last_seen_at).getTime() > 3600_000)
            ? 'STALE'
            : d.state,
        last_seen_at: d.last_seen_at ? new Date(d.last_seen_at).toISOString() : null,
        consent_at: d.consent_at ? new Date(d.consent_at).toISOString() : null,
      })),
      days,
    };
  }

  async saveGoal(session: SessionContext, spaceId: string, memberId: string, dto: SaveScreenGoalDto) {
    return withTransaction(this.ds, async (em) => {
      await this.authorize(session, spaceId, memberId, true, em);
      // Serialize initial creation as well as updates, including version=0 races.
      await em.query('SELECT id FROM members WHERE space_id = ? AND id = ? FOR UPDATE', [spaceId, memberId]);
      const [current]: GoalRow[] = await em.query('SELECT * FROM screen_goals WHERE space_id = ? AND member_id = ?', [
        spaceId,
        memberId,
      ]);
      if (Number(current?.version ?? 0) !== dto.version) throw new ApiError(ErrorCode.REVISION_CONFLICT, 409);
      const version = dto.version + 1;
      await em.query(
        `INSERT INTO screen_goals (space_id, member_id, limit_minutes, reminders_enabled, version, updated_at)
        VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE limit_minutes = VALUES(limit_minutes),
        reminders_enabled = VALUES(reminders_enabled), version = VALUES(version), updated_at = VALUES(updated_at)`,
        [spaceId, memberId, dto.limit_minutes, dto.reminders_enabled, version, this.clock.now()],
      );
      await recordAudit(em, {
        spaceId,
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'screen.goal.update',
        resourceType: 'member',
        resourceId: memberId,
        revision: String(version),
      });
      return { version };
    });
  }

  async disconnect(session: SessionContext, spaceId: string, memberId: string, deviceId: string) {
    return withTransaction(this.ds, async (em) => {
      // The subject may always withdraw their own sharing, even without management rights.
      await this.authorize(session, spaceId, memberId, false, em);
      const [device]: DeviceRow[] = await em.query(
        'SELECT * FROM screen_devices WHERE space_id = ? AND member_id = ? AND id = ? FOR UPDATE',
        [spaceId, memberId, deviceId],
      );
      if (!device) throw new ApiError(ErrorCode.NOT_FOUND, 404);
      await em.query("UPDATE screen_devices SET state = 'DISCONNECTED', token_hash = NULL WHERE id = ?", [deviceId]);
      await em.query('DELETE FROM screen_pairings WHERE device_id = ?', [deviceId]);
      await recordAudit(em, {
        spaceId,
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'screen.consent.revoke',
        resourceType: 'screen_device',
        resourceId: deviceId,
      });
    });
  }

  async collectorDisconnect(token: string) {
    const { device } = await this.collector(token, this.ds.manager);
    return this.disconnect(this.grantSession(device), device.space_id, device.member_id, device.id);
  }

  async deleteData(session: SessionContext, spaceId: string, memberId: string) {
    return withTransaction(this.ds, async (em) => {
      await this.authorize(session, spaceId, memberId, false, em);
      // Lock devices first, in ingest order: uploads cannot recreate deleted data afterwards.
      await em.query('SELECT id FROM screen_devices WHERE space_id = ? AND member_id = ? ORDER BY id FOR UPDATE', [
        spaceId,
        memberId,
      ]);
      await em.query('DELETE FROM screen_devices WHERE space_id = ? AND member_id = ?', [spaceId, memberId]);
      await em.query('DELETE FROM screen_goals WHERE space_id = ? AND member_id = ?', [spaceId, memberId]);
      await em.query('DELETE FROM screen_alerts WHERE space_id = ? AND member_id = ?', [spaceId, memberId]);
      await em.query(
        "DELETE FROM notifications WHERE space_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(resource_ref, '$.type')) = 'screen_time' AND JSON_UNQUOTE(JSON_EXTRACT(resource_ref, '$.id')) = ?",
        [spaceId, memberId],
      );
      await recordAudit(em, {
        spaceId,
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'screen.data.delete',
        resourceType: 'member',
        resourceId: memberId,
      });
    });
  }
}
