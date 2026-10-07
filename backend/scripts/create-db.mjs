// Creates the dev and test databases on the configured MariaDB server if missing.
import { existsSync } from 'node:fs';
import { createConnection } from 'mysql2/promise';

if (existsSync('.env')) process.loadEnvFile('.env');

const host = process.env.DB_HOST ?? '127.0.0.1';
const port = Number(process.env.DB_PORT ?? '3307');
const user = process.env.DB_USER ?? 'root';
const password = process.env.DB_PASSWORD ?? '';
const devDb = process.env.DB_NAME ?? 'family_calendar';
const databases = [...new Set([devDb, 'family_calendar', 'family_calendar_test'])];

const conn = await createConnection({ host, port, user, password });
try {
  const [[{ version }]] = await conn.query('SELECT VERSION() AS version');
  if (!String(version).includes('MariaDB')) {
    throw new Error(`Expected MariaDB at ${host}:${port}, found ${version}`);
  }
  for (const db of databases) {
    if (!/^[A-Za-z0-9_]+$/.test(db)) throw new Error(`Unsafe database name: ${db}`);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`database ready: ${db}`);
  }
} finally {
  await conn.end();
}
