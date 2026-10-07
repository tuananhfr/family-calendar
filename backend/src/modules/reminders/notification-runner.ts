import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import { CLOCK, type Clock } from '../jobs/clock';
import { selectDueForLease } from '../jobs/lease-query';
import { retryDelayMs } from '../jobs/worker-loop';
import { RESOURCE_REGISTRY } from '../sync/resource-registry';
import {
  NOTIFICATION_DISPATCHER,
  type DispatchJob,
  type DispatchResult,
  type NotificationChannel,
  type NotificationDispatcher,
} from './dispatch';
import type { NotificationJobStatus } from './entities/notification-job.entity';
import { lateDecision } from './late-policy';
import { canReadItem, readerContext } from './reminder-targets';
import { snoozeOffset } from './scheduler.service';

interface LeasedRow {
  id: string;
  space_id: string;
  item_id: string;
  occurrence_key: string;
  rule_id: string;
  rule_revision: string;
  target_device_id: string | null;
  target_actor_id: string | null;
  target_member_id: string | null;
  channel: NotificationChannel;
  trigger_offset: string;
  scheduled_at: Date;
  attempts: number;
}

const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 5;

const RESULT_STATUS: Record<Exclude<DispatchResult, 'RETRY'>, NotificationJobStatus> = {
  SUBMITTED: 'PUSH_SUBMITTED',
  UNSUPPORTED: 'UNSUPPORTED',
  GONE: 'CANCELED',
};

/**
 * Leases due notification jobs and re-checks each one against current data right before dispatch (reminders.md
 * "Worker kiểm lại ngay trước dispatch"): a job built from an older state is canceled, never sent from cache.
 */
@Injectable()
export class NotificationRunner {
  private readonly logger = new Logger(NotificationRunner.name);

  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(NOTIFICATION_DISPATCHER) private readonly dispatcher: NotificationDispatcher,
  ) {}

  /** Handles up to `limit` due jobs; returns how many it leased. */
  async runDue(owner: string, limit = 50): Promise<number> {
    const jobs = await this.lease(owner, limit);
    for (const job of jobs) await this.process(owner, job);
    return jobs.length;
  }

  private lease(owner: string, limit: number): Promise<LeasedRow[]> {
    return withTransaction(
      this.ds,
      async (em) => {
        const now = this.clock.now();
        const rows = await selectDueForLease<LeasedRow>(em, {
          table: 'notification_jobs',
          columns: `id, space_id, item_id, occurrence_key, rule_id, rule_revision, target_device_id, target_actor_id,
            target_member_id, channel, trigger_offset, scheduled_at, attempts`,
          timeColumn: 'next_attempt_at',
          now,
          limit,
        });
        if (rows.length === 0) return [];
        await em.query(
          `UPDATE notification_jobs SET status = 'LEASED', lease_owner = ?, lease_until = ?, attempts = attempts + 1,
             updated_at = ? WHERE id IN (?)`,
          [owner, new Date(now.getTime() + LEASE_MS), now, rows.map((r) => r.id)],
        );
        return rows.map((r) => ({ ...r, attempts: Number(r.attempts) + 1 }));
      },
      { isolation: 'READ COMMITTED' },
    );
  }

  private async process(owner: string, job: LeasedRow): Promise<void> {
    let verdict: 'CANCEL' | 'EXPIRE' | 'SEND';
    try {
      verdict = await withTransaction(this.ds, (em) => this.check(em, job));
    } catch {
      this.logger.warn('notification job check failed');
      await this.finish(owner, job, 'RETRY');
      return;
    }
    if (verdict === 'CANCEL') return this.settle(owner, job.id, 'CANCELED', 'STALE');
    if (verdict === 'EXPIRE') return this.settle(owner, job.id, 'EXPIRED', 'LATE');

    let result: DispatchResult;
    try {
      result = await this.dispatcher.dispatch(this.toDispatch(job));
    } catch {
      result = 'RETRY';
    }
    await this.finish(owner, job, result);
  }

  private async check(em: EntityManager, job: LeasedRow): Promise<'CANCEL' | 'EXPIRE' | 'SEND'> {
    const [item] = await RESOURCE_REGISTRY.item.find(em, job.space_id, [job.item_id]);
    if (!item || item.deleted_at) return 'CANCEL';
    const [rule]: Array<{ revision: string; enabled: number; deleted_at: Date | null }> = await em.query(
      'SELECT revision, enabled, deleted_at FROM reminder_rules WHERE space_id = ? AND id = ?',
      [job.space_id, job.rule_id],
    );
    if (!rule || rule.deleted_at || Number(rule.enabled) !== 1 || String(rule.revision) !== String(job.rule_revision)) {
      return 'CANCEL';
    }
    const [state]: Array<{ status: string; snooze_until: Date | null }> = await em.query(
      `SELECT status, snooze_until FROM occurrence_states
        WHERE space_id = ? AND item_id = ? AND occurrence_key = ? AND deleted_at IS NULL`,
      [job.space_id, job.item_id, job.occurrence_key],
    );
    const isSnoozeTrigger = job.trigger_offset.startsWith('snooze@');
    if (state) {
      const currentSnooze = state.status === 'SNOOZED' && state.snooze_until ? snoozeOffset(state.snooze_until) : null;
      if (!isSnoozeTrigger || currentSnooze !== job.trigger_offset) return 'CANCEL';
    } else if (isSnoozeTrigger) {
      return 'CANCEL';
    }
    const [cancel]: unknown[] = await em.query(
      `SELECT 1 FROM item_exceptions
        WHERE space_id = ? AND item_id = ? AND occurrence_key = ? AND kind = 'CANCEL' AND deleted_at IS NULL`,
      [job.space_id, job.item_id, job.occurrence_key],
    );
    if (cancel) return 'CANCEL';
    if (!(await this.targetStillReads(em, job, item))) return 'CANCEL';
    return lateDecision(String(item.preset), job.scheduled_at, this.clock.now()) === 'EXPIRE' ? 'EXPIRE' : 'SEND';
  }

  /** Revoked devices, removed members and lost read access all stop delivery. */
  private async targetStillReads(
    em: EntityManager,
    job: LeasedRow,
    item: Awaited<ReturnType<typeof RESOURCE_REGISTRY.item.find>>[number],
  ): Promise<boolean> {
    if (job.target_device_id) {
      const [d]: Array<{ actor_id: string }> = await em.query(
        "SELECT actor_id FROM devices WHERE id = ? AND status = 'ACTIVE'",
        [job.target_device_id],
      );
      const ctx = d && (await readerContext(em, this.access, job.space_id, d.actor_id, job.target_device_id));
      return !!ctx && canReadItem(ctx, item);
    }
    const actorIds: string[] = job.target_actor_id
      ? [job.target_actor_id]
      : (
          await em.query<Array<{ actor_id: string }>>(
            'SELECT DISTINCT actor_id FROM member_representations WHERE space_id = ? AND member_id = ?',
            [job.space_id, job.target_member_id],
          )
        ).map((r) => r.actor_id);
    for (const actorId of actorIds) {
      const devices: Array<{ id: string }> = await em.query(
        "SELECT id FROM devices WHERE actor_id = ? AND status = 'ACTIVE' ORDER BY created_at, id LIMIT 1",
        [actorId],
      );
      if (!devices[0]) continue;
      const ctx = await readerContext(em, this.access, job.space_id, actorId, devices[0].id);
      if (ctx && canReadItem(ctx, item)) return true;
    }
    return false;
  }

  private async finish(owner: string, job: LeasedRow, result: DispatchResult): Promise<void> {
    if (result !== 'RETRY') {
      return this.settle(owner, job.id, RESULT_STATUS[result], result === 'GONE' ? 'GONE' : null);
    }
    if (job.attempts >= MAX_ATTEMPTS) return this.settle(owner, job.id, 'FAILED', 'RETRY_EXHAUSTED');
    const now = this.clock.now();
    await this.ds.query(
      `UPDATE notification_jobs SET status = 'RETRY_WAIT', next_attempt_at = ?, lease_owner = NULL, lease_until = NULL,
         last_error_code = 'RETRY', updated_at = ? WHERE id = ? AND status = 'LEASED' AND lease_owner = ?`,
      [new Date(now.getTime() + retryDelayMs(job.attempts)), now, job.id, owner],
    );
  }

  private async settle(owner: string, id: string, status: NotificationJobStatus, code: string | null): Promise<void> {
    await this.ds.query(
      `UPDATE notification_jobs SET status = ?, last_error_code = ?, lease_owner = NULL, lease_until = NULL, updated_at = ?
        WHERE id = ? AND status = 'LEASED' AND lease_owner = ?`,
      [status, code, this.clock.now(), id, owner],
    );
  }

  private toDispatch(job: LeasedRow): DispatchJob {
    return {
      id: job.id,
      spaceId: job.space_id,
      itemId: job.item_id,
      occurrenceKey: job.occurrence_key,
      channel: job.channel,
      targetDeviceId: job.target_device_id,
      targetActorId: job.target_actor_id,
      targetMemberId: job.target_member_id,
      scheduledAt: job.scheduled_at,
    };
  }
}
