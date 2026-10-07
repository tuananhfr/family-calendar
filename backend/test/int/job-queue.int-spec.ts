import { withTransaction } from '../../src/database/transaction';
import { JobQueue } from '../../src/modules/jobs/job-queue';
import { FakeClock } from '../helpers/clock';
import { truncateAll } from '../helpers/db';
import { createTestApp, type TestApp } from '../helpers/test-app';

describe('durable job queue (int)', () => {
  const clock = new FakeClock('2026-10-07T00:00:00.000Z');
  let t: TestApp;
  let queue: JobQueue;

  beforeAll(async () => {
    t = await createTestApp({ clock });
    queue = t.app.get(JobQueue);
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    clock.set('2026-10-07T00:00:00.000Z');
  });

  afterAll(() => t.close());

  async function enqueueMany(n: number): Promise<void> {
    await withTransaction(t.ds, async (em) => {
      for (let i = 0; i < n; i++) {
        await queue.enqueue(em, { type: 'TEST', runAt: new Date('2026-10-06T23:59:00Z'), payload: { i } });
      }
    });
  }

  it('never hands the same job to two workers leasing at the same time', async () => {
    await enqueueMany(100);
    const seen = new Map<string, string>();
    for (let round = 0; round < 10 && seen.size < 100; round++) {
      const [a, b] = await Promise.all([
        queue.leaseBatch('worker-a', 30, 60_000),
        queue.leaseBatch('worker-b', 30, 60_000),
      ]);
      for (const [owner, jobs] of [
        ['worker-a', a],
        ['worker-b', b],
      ] as const) {
        for (const job of jobs) {
          expect(seen.has(job.id)).toBe(false);
          seen.set(job.id, owner);
        }
      }
    }
    expect(seen.size).toBe(100);
    expect(new Set(seen.values())).toEqual(new Set(['worker-a', 'worker-b']));
    const [{ n }]: Array<{ n: string }> = await t.ds.query("SELECT COUNT(*) AS n FROM jobs WHERE status = 'LEASED'");
    expect(Number(n)).toBe(100);
  });

  it('re-leases a job whose worker died and ignores the dead worker completing late', async () => {
    await enqueueMany(1);
    const [job] = await queue.leaseBatch('dies', 10, 30_000);
    expect(job).toBeDefined();
    expect(await queue.leaseBatch('other', 10, 30_000)).toEqual([]);

    clock.advance(30_001);
    const [again] = await queue.leaseBatch('other', 10, 30_000);
    expect(again.id).toBe(job.id);
    expect(again.attempts).toBe(2);

    await queue.complete(job.id, 'dies');
    const [row]: Array<{ status: string }> = await t.ds.query('SELECT status FROM jobs WHERE id = ?', [job.id]);
    expect(row.status).toBe('LEASED');
    await queue.complete(job.id, 'other');
    const [done]: Array<{ status: string }> = await t.ds.query('SELECT status FROM jobs WHERE id = ?', [job.id]);
    expect(done.status).toBe('DONE');
  });

  it('retries a failed job after its retry time and gives up when told to', async () => {
    await enqueueMany(1);
    const [job] = await queue.leaseBatch('w', 10, 30_000);
    await queue.fail(job.id, 'w', 'BOOM', new Date('2026-10-07T00:05:00Z'));
    expect(await queue.leaseBatch('w', 10, 30_000)).toEqual([]);
    clock.set('2026-10-07T00:05:00Z');
    const [retry] = await queue.leaseBatch('w', 10, 30_000);
    expect(retry.id).toBe(job.id);
    await queue.fail(job.id, 'w', 'BOOM', null);
    const [row]: Array<{ status: string; last_error_code: string }> = await t.ds.query(
      'SELECT status, last_error_code FROM jobs WHERE id = ?',
      [job.id],
    );
    expect(row).toEqual({ status: 'FAILED', last_error_code: 'BOOM' });
  });
});
