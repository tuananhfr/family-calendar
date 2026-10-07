import { createConnection } from 'mysql2/promise';
import type { DataSource } from 'typeorm';
import { configuration } from '../../src/config/configuration';
import { createDataSource } from '../../src/database/data-source';

export function testDbConfig() {
  return configuration().db;
}

export async function ensureTestDatabase(): Promise<void> {
  const db = testDbConfig();
  if (!db.database.endsWith('_test')) throw new Error(`Refusing to touch non-test database ${db.database}`);
  const conn = await createConnection({ host: db.host, port: db.port, user: db.user, password: db.password });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await conn.end();
  }
}

export async function listTables(ds: DataSource): Promise<string[]> {
  const rows: Array<{ name: string }> = await ds.query(
    'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
  );
  return rows.map((r) => r.name).sort();
}

export async function dropAllTables(ds: DataSource): Promise<void> {
  const tables = await listTables(ds);
  await ds.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const t of tables) await ds.query(`DROP TABLE IF EXISTS \`${t}\``);
  } finally {
    await ds.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

/** Empties every table except the migration log; use between tests that need a blank slate. */
export async function truncateAll(ds: DataSource): Promise<void> {
  const tables = (await listTables(ds)).filter((t) => t !== 'migrations');
  await ds.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const t of tables) await ds.query(`TRUNCATE TABLE \`${t}\``);
  } finally {
    await ds.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}

/** A standalone DataSource on the test DB (outside the Nest app), caller must destroy it. */
export async function openTestDataSource(): Promise<DataSource> {
  const ds = createDataSource(testDbConfig());
  await ds.initialize();
  return ds;
}

export async function resetAndMigrate(): Promise<void> {
  await ensureTestDatabase();
  const ds = await openTestDataSource();
  try {
    await dropAllTables(ds);
    await ds.runMigrations({ transaction: 'each' });
  } finally {
    await ds.destroy();
  }
}
