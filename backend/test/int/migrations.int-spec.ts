import type { DataSource } from 'typeorm';
import { listTables, openTestDataSource } from '../helpers/db';

const CORE_TABLES = [
  'account_links',
  'accounts',
  'actors',
  'audit_events',
  'devices',
  'jobs',
  'magic_link_tokens',
  'member_representations',
  'members',
  'memberships',
  'rate_limits',
  'recovery_credentials',
  'roles',
  'sessions',
  'spaces',
];

async function revertAll(ds: DataSource): Promise<number> {
  let reverted = 0;
  for (;;) {
    const [{ n }]: Array<{ n: string }> = await ds.query('SELECT COUNT(*) AS n FROM migrations');
    if (Number(n) === 0) return reverted;
    await ds.undoLastMigration({ transaction: 'each' });
    reverted++;
  }
}

describe('migrations (int)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await openTestDataSource();
  });

  afterAll(async () => {
    // Leave the schema fully migrated for the suites that run after this one.
    await ds.runMigrations({ transaction: 'each' });
    await ds.destroy();
  });

  it('creates the core identity, audit and job tables', async () => {
    const tables = await listTables(ds);
    for (const t of CORE_TABLES) expect(tables).toContain(t);
  });

  it('uses InnoDB and utf8mb4_unicode_ci for every table', async () => {
    const rows: Array<{ name: string; engine: string; coll: string }> = await ds.query(
      `SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_COLLATION AS coll
         FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`,
    );
    for (const r of rows) {
      expect({ name: r.name, engine: r.engine }).toEqual({ name: r.name, engine: 'InnoDB' });
      expect({ name: r.name, coll: r.coll }).toEqual({ name: r.name, coll: 'utf8mb4_unicode_ci' });
    }
  });

  it('stores no raw session token column', async () => {
    const cols: Array<{ name: string }> = await ds.query(
      `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions'`,
    );
    const names = cols.map((c) => c.name);
    expect(names).toContain('token_hash');
    expect(names).not.toContain('token');
  });

  it('reverts every migration cleanly and re-runs the chain', async () => {
    const reverted = await revertAll(ds);
    expect(reverted).toBeGreaterThan(0);
    expect(await listTables(ds)).toEqual(['migrations']);

    const applied = await ds.runMigrations({ transaction: 'each' });
    expect(applied.length).toBe(reverted);
    const tables = await listTables(ds);
    for (const t of CORE_TABLES) expect(tables).toContain(t);

    // A second run is a no-op once the chain is applied.
    expect(await ds.runMigrations({ transaction: 'each' })).toEqual([]);
  });
});
