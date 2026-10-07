import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { addDays } from '../../common/time/local-date';
import { addMonthsClamped } from '../../common/time/month-offset';
import { datePart, todayIn, zonedToInstant } from '../../common/time/zoned';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import { expandOccurrences } from '../calendar/recurrence/expand';
import type { ItemException, LunarRule, Schedule } from '../calendar/recurrence/types';
import { CLOCK, type Clock } from '../jobs/clock';
import type { StoredRow } from '../sync/resource-definition';
import { RESOURCE_REGISTRY } from '../sync/resource-registry';
import type { NotificationChannel } from './dispatch';
import { resolveTargets, type ReminderTarget } from './reminder-targets';

/** How far ahead jobs exist; the horizon scan keeps extending it (reminders.md: never unbounded). */
export const HORIZON_DAYS = 7;
/** All-day items carry no time; they remind at this local hour, never at midnight UTC (reminders.md). */
export const ALL_DAY_FIRE_TIME = '08:00';

interface RuleRow {
  id: string;
  revision: string;
  offsets_minutes: unknown;
  offset_months: unknown;
  channels: unknown;
}

interface Trigger {
  rule: RuleRow;
  occurrenceKey: string;
  offset: string;
  at: Date;
}

function jsonValue<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

export function scheduleOf(item: StoredRow): Schedule {
  const schedule: Schedule = {
    allDay: Number(item.all_day) === 1,
    start: item.start_local as string,
    timeZone: item.time_zone as string,
  };
  if (item.end_local) schedule.end = item.end_local as string;
  if (item.rrule) schedule.rrule = item.rrule as string;
  const lunar = jsonValue<LunarRule | null>(item.lunar_rule, null);
  if (lunar) schedule.lunarRule = lunar;
  return schedule;
}

/** Shared with the dispatch-time check, which must agree on what "the snooze trigger" is. */
export function snoozeOffset(until: Date): string {
  return `snooze@${until.toISOString()}`;
}

@Injectable()
export class ReminderScheduler {
  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Brings the item's future jobs in line with what is committed now: cancels pending jobs that no longer match
   * (old rule revision, DONE/SKIPPED/SNOOZED occurrence, removed target) and inserts missing ones. Idempotent.
   * Past-due jobs are left to the worker, which re-checks everything before sending.
   */
  rescheduleItem(spaceId: string, itemId: string): Promise<void> {
    return withTransaction(
      this.ds,
      async (em) => {
        const now = this.clock.now();
        const desired = await this.desiredJobs(em, spaceId, itemId, now);
        const pending: Array<{ id: string; k: string }> = await em.query(
          `SELECT id, CONCAT_WS('|', rule_id, rule_revision, occurrence_key, target_key, channel, trigger_offset) AS k
             FROM notification_jobs
            WHERE space_id = ? AND item_id = ? AND status IN ('SCHEDULED', 'RETRY_WAIT') AND scheduled_at >= ?
            FOR UPDATE`,
          [spaceId, itemId, now],
        );
        const stale = pending.filter((p) => !desired.has(p.k)).map((p) => p.id);
        if (stale.length) {
          await em.query("UPDATE notification_jobs SET status = 'CANCELED', updated_at = ? WHERE id IN (?)", [
            now,
            stale,
          ]);
        }
        for (const job of desired.values()) await this.insert(em, spaceId, itemId, job, now);
      },
      { isolation: 'READ COMMITTED' },
    );
  }

  /** Re-runs every item that has an enabled rule in a shared Space, which moves the horizon forward. */
  async rescheduleAll(): Promise<number> {
    const rows: Array<{ space_id: string; item_id: string }> = await this.ds.query(
      `SELECT DISTINCT r.space_id, r.item_id FROM reminder_rules r
         JOIN spaces s ON s.id = r.space_id AND s.sharing_state = 'SHARED'
        WHERE r.deleted_at IS NULL AND r.enabled = 1`,
    );
    for (const r of rows) await this.rescheduleItem(r.space_id, r.item_id);
    return rows.length;
  }

  private async desiredJobs(
    em: EntityManager,
    spaceId: string,
    itemId: string,
    now: Date,
  ): Promise<Map<string, { trigger: Trigger; target: ReminderTarget }>> {
    const out = new Map<string, { trigger: Trigger; target: ReminderTarget }>();
    const [space]: Array<{ sharing_state: string; time_zone: string }> = await em.query(
      'SELECT sharing_state, time_zone FROM spaces WHERE id = ?',
      [spaceId],
    );
    const [item] = await RESOURCE_REGISTRY.item.find(em, spaceId, [itemId]);
    if (space?.sharing_state !== 'SHARED' || !item || item.deleted_at) return out;

    const rules: RuleRow[] = await em.query(
      `SELECT id, revision, offsets_minutes, offset_months, channels FROM reminder_rules
        WHERE space_id = ? AND item_id = ? AND deleted_at IS NULL AND enabled = 1 ORDER BY created_at, id`,
      [spaceId, itemId],
    );
    if (rules.length === 0) return out;
    const recipients: Array<{ reminder_rule_id: string; member_id: string }> = await em.query(
      'SELECT reminder_rule_id, member_id FROM reminder_recipients WHERE reminder_rule_id IN (?) ORDER BY member_id',
      [rules.map((r) => r.id)],
    );
    const exceptions: Array<{
      id: string;
      occurrence_key: string;
      kind: 'CANCEL' | 'OVERRIDE';
      override_data: unknown;
    }> = await em.query(
      `SELECT id, occurrence_key, kind, override_data FROM item_exceptions
          WHERE space_id = ? AND item_id = ? AND deleted_at IS NULL`,
      [spaceId, itemId],
    );
    const states: Array<{ occurrence_key: string; status: string; snooze_until: Date | null }> = await em.query(
      `SELECT occurrence_key, status, snooze_until FROM occurrence_states
        WHERE space_id = ? AND item_id = ? AND deleted_at IS NULL`,
      [spaceId, itemId],
    );
    const stateByKey = new Map(states.map((s) => [s.occurrence_key, s]));

    const schedule = scheduleOf(item);
    const tz = schedule.timeZone || space.time_zone;
    const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);
    const inHorizon = (at: Date) => at.getTime() >= now.getTime() && at.getTime() <= horizonEnd.getTime();
    const itemExceptions: ItemException[] = exceptions.map((e) => ({
      id: e.id,
      itemId,
      occurrenceKey: e.occurrence_key,
      kind: e.kind,
      ...(e.kind === 'OVERRIDE' ? { override: jsonValue(e.override_data, {}) } : {}),
    }));

    const triggers: Trigger[] = [];
    for (const rule of rules) {
      const minutes = jsonValue<number[]>(rule.offsets_minutes, []);
      const months = jsonValue<number[]>(rule.offset_months, []);
      const leadDays = Math.ceil(Math.max(0, ...minutes) / 1440) + Math.max(0, ...months) * 31 + 1;
      const window = { from: addDays(todayIn(tz, now), -1), to: addDays(todayIn(tz, horizonEnd), leadDays) };
      for (const occ of expandOccurrences(itemId, { ...schedule, timeZone: tz }, window, itemExceptions)) {
        if (stateByKey.has(occ.occurrenceKey)) continue;
        const local = occ.allDay ? `${occ.start}T${ALL_DAY_FIRE_TIME}` : occ.start;
        const startMs = zonedToInstant(local, tz).getTime();
        for (const m of minutes) {
          triggers.push({
            rule,
            occurrenceKey: occ.occurrenceKey,
            offset: String(m),
            at: new Date(startMs - m * 60_000),
          });
        }
        for (const m of months) {
          const day = addMonthsClamped(datePart(occ.start), -m);
          triggers.push({
            rule,
            occurrenceKey: occ.occurrenceKey,
            offset: `${m}M`,
            at: zonedToInstant(`${day}${local.slice(10)}`, tz),
          });
        }
      }
    }
    // A snooze fires once per occurrence, through the item's first rule (same choice as the frontend scanner).
    for (const s of states) {
      if (s.status !== 'SNOOZED' || !s.snooze_until) continue;
      triggers.push({
        rule: rules[0],
        occurrenceKey: s.occurrence_key,
        offset: snoozeOffset(s.snooze_until),
        at: s.snooze_until,
      });
    }

    const targetsByRule = new Map<string, ReminderTarget[]>();
    for (const t of triggers) {
      if (!inHorizon(t.at)) continue;
      let targets = targetsByRule.get(t.rule.id);
      if (!targets) {
        const memberIds = recipients.filter((r) => r.reminder_rule_id === t.rule.id).map((r) => r.member_id);
        const channels = jsonValue<NotificationChannel[]>(t.rule.channels, []);
        targets = await resolveTargets(em, this.access, spaceId, item, memberIds, channels);
        targetsByRule.set(t.rule.id, targets);
      }
      for (const target of targets) {
        const key = [t.rule.id, String(t.rule.revision), t.occurrenceKey, target.key, target.channel, t.offset].join(
          '|',
        );
        out.set(key, { trigger: t, target });
      }
    }
    return out;
  }

  /** A job canceled earlier comes back when it is wanted again (e.g. DONE undone); finished ones never re-run. */
  private async insert(
    em: EntityManager,
    spaceId: string,
    itemId: string,
    job: { trigger: Trigger; target: ReminderTarget },
    now: Date,
  ): Promise<void> {
    const { trigger: t, target } = job;
    await em.query(
      `INSERT INTO notification_jobs (id, space_id, item_id, occurrence_key, rule_id, rule_revision, target_key,
         target_device_id, target_actor_id, target_member_id, channel, trigger_offset, scheduled_at, next_attempt_at,
         status, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', 0, ?, ?)
       ON DUPLICATE KEY UPDATE
         next_attempt_at = IF(status = 'CANCELED', VALUES(next_attempt_at), next_attempt_at),
         updated_at = IF(status = 'CANCELED', VALUES(updated_at), updated_at),
         status = IF(status = 'CANCELED', 'SCHEDULED', status)`,
      [
        randomUUID(),
        spaceId,
        itemId,
        t.occurrenceKey,
        t.rule.id,
        String(t.rule.revision),
        target.key,
        target.deviceId,
        target.actorId,
        target.memberId,
        target.channel,
        t.offset,
        t.at,
        t.at,
        now,
        now,
      ],
    );
  }
}
