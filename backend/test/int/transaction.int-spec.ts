import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { isRetryableLockError, withTransaction } from '../../src/database/transaction';
import { openTestDataSource, truncateAll } from '../helpers/db';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

async function actorExists(ds: DataSource, id: string): Promise<boolean> {
  const rows: unknown[] = await ds.query('SELECT id FROM actors WHERE id = ?', [id]);
  return rows.length === 1;
}

describe('withTransaction (int)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await openTestDataSource();
  });

  beforeEach(async () => {
    await truncateAll(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('commits on success', async () => {
    const id = randomUUID();
    const result = await withTransaction(ds, async (em) => {
      await em.query('INSERT INTO actors (id, created_at) VALUES (?, UTC_TIMESTAMP(3))', [id]);
      return 'done';
    });
    expect(result).toBe('done');
    expect(await actorExists(ds, id)).toBe(true);
  });

  it('rolls back when fn throws', async () => {
    const id = randomUUID();
    await expect(
      withTransaction(ds, async (em) => {
        await em.query('INSERT INTO actors (id, created_at) VALUES (?, UTC_TIMESTAMP(3))', [id]);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await actorExists(ds, id)).toBe(false);
  });

  it('retries the deadlock victim so both transactions commit', async () => {
    const a = randomUUID();
    const b = randomUUID();
    await ds.query('INSERT INTO actors (id, created_at) VALUES (?, ?), (?, ?)', [
      a,
      new Date('2026-01-01T00:00:00Z'),
      b,
      new Date('2026-01-01T00:00:00Z'),
    ]);
    const t1Locked = deferred();
    const t2Locked = deferred();
    let attempts = 0;
    const lockInOrder = (first: string, second: string, mine: () => void, other: Promise<void>, stamp: Date) =>
      withTransaction(ds, async (em) => {
        attempts++;
        await em.query('SELECT id FROM actors WHERE id = ? FOR UPDATE', [first]);
        mine();
        await other;
        await em.query('SELECT id FROM actors WHERE id = ? FOR UPDATE', [second]);
        await em.query('UPDATE actors SET created_at = ? WHERE id IN (?, ?)', [stamp, first, second]);
      });

    const results = await Promise.allSettled([
      lockInOrder(a, b, t1Locked.resolve, t2Locked.promise, new Date('2026-02-01T00:00:00Z')),
      lockInOrder(b, a, t2Locked.resolve, t1Locked.promise, new Date('2026-03-01T00:00:00Z')),
    ]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    // Exactly one victim was retried once.
    expect(attempts).toBe(3);
  });

  it('does not retry errors other than deadlock / lock wait timeout', async () => {
    const id = randomUUID();
    await ds.query('INSERT INTO actors (id, created_at) VALUES (?, UTC_TIMESTAMP(3))', [id]);
    let attempts = 0;
    const err = await withTransaction(ds, async (em) => {
      attempts++;
      // Duplicate primary key: errno 1062.
      await em.query('INSERT INTO actors (id, created_at) VALUES (?, UTC_TIMESTAMP(3))', [id]);
    }).catch((e: unknown) => e);
    expect(attempts).toBe(1);
    expect(isRetryableLockError(err)).toBe(false);
    expect((err as { driverError?: { errno?: number } }).driverError?.errno).toBe(1062);
  });

  it('classifies lock errors by MariaDB errno', () => {
    expect(isRetryableLockError({ errno: 1213 })).toBe(true);
    expect(isRetryableLockError({ driverError: { errno: 1205 } })).toBe(true);
    expect(isRetryableLockError({ errno: 1062 })).toBe(false);
    expect(isRetryableLockError(new Error('x'))).toBe(false);
    expect(isRetryableLockError(null)).toBe(false);
  });

  it('applies the requested isolation level', async () => {
    const level = await withTransaction(
      ds,
      async (em) => {
        // A locking read forces InnoDB to materialize the transaction so INNODB_TRX lists it.
        await em.query('SELECT COUNT(*) FROM actors FOR UPDATE');
        const [row]: Array<{ iso: string }> = await em.query(
          'SELECT trx_isolation_level AS iso FROM information_schema.INNODB_TRX WHERE trx_mysql_thread_id = CONNECTION_ID()',
        );
        return row.iso;
      },
      { isolation: 'READ COMMITTED' },
    );
    expect(level).toBe('READ COMMITTED');
  });
});
