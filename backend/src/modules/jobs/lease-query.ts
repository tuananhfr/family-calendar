import type { EntityManager } from 'typeorm';

/**
 * Due rows of a queue table, locked with SKIP LOCKED. One query per status walks the (status, time) index in order:
 * a single OR query needs a filesort, InnoDB then locks every candidate row and a second worker finds them all
 * locked. Run it under READ COMMITTED so rows examined but not taken are released.
 */
export async function selectDueForLease<T>(
  em: EntityManager,
  opts: {
    table: 'jobs' | 'notification_jobs';
    columns: string;
    timeColumn: 'run_at' | 'next_attempt_at';
    /** Leading index column to order by before time (e.g. jobs.priority); must lead the status index too. */
    orderPrefix?: 'priority';
    now: Date;
    limit: number;
  },
): Promise<T[]> {
  const passes: Array<{ where: string; params: unknown[] }> = [
    { where: `status = 'SCHEDULED' AND ${opts.timeColumn} <= ?`, params: [opts.now] },
    { where: `status = 'RETRY_WAIT' AND ${opts.timeColumn} <= ?`, params: [opts.now] },
    // A lease that ran out means its worker died; the job is due again.
    { where: `status = 'LEASED' AND lease_until < ?`, params: [opts.now] },
  ];
  const order = [opts.orderPrefix, opts.timeColumn, 'id'].filter(Boolean).join(', ');
  const out: T[] = [];
  for (const pass of passes) {
    const remaining = opts.limit - out.length;
    if (remaining <= 0) break;
    const rows: T[] = await em.query(
      `SELECT ${opts.columns} FROM ${opts.table} WHERE ${pass.where}
        ORDER BY ${order} LIMIT ? FOR UPDATE SKIP LOCKED`,
      [...pass.params, remaining],
    );
    out.push(...rows);
  }
  return out;
}
