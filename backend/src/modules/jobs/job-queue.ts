import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { withTransaction } from '../../database/transaction';
import { CLOCK, type Clock } from './clock';
import { selectDueForLease } from './lease-query';

/** Lower leases first. SOS alerts must never queue behind reminder or AI work. */
export const JOB_PRIORITY = { URGENT: 0, NORMAL: 100 } as const;

export interface JobInput {
  type: string;
  runAt: Date;
  payload: object;
  priority?: number;
  /** Same key = same pending job: a newer enqueue replaces the payload and run time instead of adding a row. */
  dedupeKey?: string;
}

export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  runAt: Date;
}

/**
 * Enqueues inside the caller's transaction, so a rolled-back write never leaves a job behind (sync-protocol.md
 * "Xử lý backend" step 7). A job that is currently leased is reset to SCHEDULED and loses its lease owner: the
 * running worker's completion then no longer matches and the newer request is not lost.
 */
export async function enqueueJob(em: EntityManager, job: JobInput): Promise<void> {
  await em.query(
    `INSERT INTO jobs (type, dedupe_key, payload, run_at, priority, status, attempts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'SCHEDULED', 0, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE type = VALUES(type), payload = VALUES(payload), run_at = VALUES(run_at),
       priority = VALUES(priority), status = 'SCHEDULED', attempts = 0, lease_owner = NULL, lease_until = NULL, last_error_code = NULL,
       updated_at = UTC_TIMESTAMP(3)`,
    [job.type, job.dedupeKey ?? null, JSON.stringify(job.payload), job.runAt, job.priority ?? JOB_PRIORITY.NORMAL],
  );
}

function parsePayload(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      return parsePayload(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

/** TEC-12: durable queue in MariaDB; leases use FOR UPDATE SKIP LOCKED so workers never share a live job. */
@Injectable()
export class JobQueue {
  constructor(
    private readonly ds: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  enqueue(em: EntityManager, job: JobInput): Promise<void> {
    return enqueueJob(em, job);
  }

  /** Makes sure the job will run: a pending or running one is left alone, a finished or failed one is revived. */
  async ensure(job: JobInput & { dedupeKey: string }): Promise<void> {
    await this.ds.query(
      `INSERT INTO jobs (type, dedupe_key, payload, run_at, priority, status, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'SCHEDULED', 0, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE
         run_at = IF(status IN ('DONE', 'FAILED', 'CANCELED'), VALUES(run_at), run_at),
         attempts = IF(status IN ('DONE', 'FAILED', 'CANCELED'), 0, attempts),
         status = IF(status IN ('DONE', 'FAILED', 'CANCELED'), 'SCHEDULED', status)`,
      [job.type, job.dedupeKey, JSON.stringify(job.payload), job.runAt, job.priority ?? JOB_PRIORITY.NORMAL],
    );
  }

  /** Due jobs plus jobs whose lease ran out (their worker died); each lease counts as an attempt. */
  leaseBatch(owner: string, limit: number, leaseMs: number): Promise<Job[]> {
    return withTransaction(
      this.ds,
      async (em) => {
        const now = this.clock.now();
        const rows = await selectDueForLease<{
          id: string;
          type: string;
          payload: unknown;
          attempts: number;
          run_at: Date;
        }>(em, {
          table: 'jobs',
          columns: 'id, type, payload, attempts, run_at',
          timeColumn: 'run_at',
          orderPrefix: 'priority',
          now,
          limit,
        });
        if (rows.length === 0) return [];
        await em.query(
          `UPDATE jobs SET status = 'LEASED', lease_owner = ?, lease_until = ?, attempts = attempts + 1, updated_at = ?
          WHERE id IN (?)`,
          [owner, new Date(now.getTime() + leaseMs), now, rows.map((r) => r.id)],
        );
        return rows.map((r) => ({
          id: String(r.id),
          type: r.type,
          payload: parsePayload(r.payload),
          attempts: Number(r.attempts) + 1,
          runAt: r.run_at,
        }));
      },
      { isolation: 'READ COMMITTED' },
    );
  }

  /** No-op unless `owner` still holds the lease: a re-enqueued or re-leased job belongs to someone else now. */
  async complete(id: string, owner: string): Promise<void> {
    await this.ds.query(
      `UPDATE jobs SET status = 'DONE', lease_owner = NULL, lease_until = NULL, updated_at = ?
        WHERE id = ? AND status = 'LEASED' AND lease_owner = ?`,
      [this.clock.now(), id, owner],
    );
  }

  /** `retryAt` null gives up (FAILED); otherwise the job waits until then. */
  async fail(id: string, owner: string, code: string, retryAt: Date | null): Promise<void> {
    await this.ds.query(
      `UPDATE jobs SET status = ?, run_at = COALESCE(?, run_at), last_error_code = ?, lease_owner = NULL,
         lease_until = NULL, updated_at = ?
        WHERE id = ? AND status = 'LEASED' AND lease_owner = ?`,
      [retryAt ? 'RETRY_WAIT' : 'FAILED', retryAt, code.slice(0, 64), this.clock.now(), id, owner],
    );
  }
}
