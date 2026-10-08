// Direct access to the E2E database for resetting state between specs. Talks to MariaDB only; never imports
// backend code (the e2e package stays independent).
import { createConnection, type Connection } from "mysql2/promise";

export const E2E_DB = {
  host: process.env.E2E_DB_HOST ?? "127.0.0.1",
  port: Number(process.env.E2E_DB_PORT ?? 3307),
  user: process.env.E2E_DB_USER ?? "root",
  password: process.env.E2E_DB_PASSWORD ?? "",
  database: process.env.E2E_DB_NAME ?? "family_calendar_test",
} as const;

const KEEP_TABLES = new Set(["migrations"]);

// Guard rails: a reset truncates every table, so refuse anything that could be a real database.
function assertSafeTarget(): void {
  if (E2E_DB.port === 3306) throw new Error("Refusing to touch port 3306 (MySQL); E2E uses MariaDB on 3307");
  if (!/^[A-Za-z0-9_]+_test$/.test(E2E_DB.database)) {
    throw new Error(`Refusing to reset ${E2E_DB.database}: E2E database names must end with _test`);
  }
}

export async function withTestDb<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
  assertSafeTarget();
  const conn = await createConnection({ ...E2E_DB, multipleStatements: false });
  try {
    const [rows] = await conn.query("SELECT VERSION() AS version");
    const version = String((rows as Array<{ version: string }>)[0]?.version ?? "");
    if (!version.includes("MariaDB")) throw new Error(`Expected MariaDB, found ${version}`);
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

/** Empties every application table (schema and migration history stay). */
export async function resetTestDb(): Promise<void> {
  await withTestDb(async (conn) => {
    const [rows] = await conn.query(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
      [E2E_DB.database],
    );
    const tables = (rows as Array<{ name: string }>).map((r) => r.name).filter((n) => !KEEP_TABLES.has(n));
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    try {
      for (const table of tables) await conn.query(`TRUNCATE TABLE \`${table.replace(/`/g, "``")}\``);
    } finally {
      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    }
  });
}

export async function countRows(table: string): Promise<number> {
  if (!/^[A-Za-z0-9_]+$/.test(table)) throw new Error(`Unsafe table name: ${table}`);
  return withTestDb(async (conn) => {
    const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
    return Number((rows as Array<{ n: number | string }>)[0].n);
  });
}
