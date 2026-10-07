import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { FinanceTransactionEntity } from '../../src/modules/finance/entities/finance-transaction.entity';
import { HealthNoteEntity } from '../../src/modules/health-records/entities/health-note.entity';
import { AccessService } from '../../src/modules/access/access.service';
import { listTables, truncateAll } from '../helpers/db';
import { withProcessTimeZoneAsync } from '../helpers/process-tz';
import { createSharedSpace, insertActorWithDevice, insertMember } from '../helpers/spaces';
import { createTestApp, type TestApp } from '../helpers/test-app';

/** Registry tables of modules.md §1 (spaces/members/roles come from the access migration). */
const RESOURCE_TABLES = [
  'items',
  'item_exceptions',
  'occurrence_states',
  'checklist_items',
  'checklist_states',
  'participations',
  'reminder_rules',
  'finance_accounts',
  'finance_transactions',
  'finance_budgets',
  'finance_savings',
  'finance_loans',
  'finance_goals',
  'health_profiles',
  'health_metrics',
  'health_notes',
  'folders',
  'files',
  'automations',
  'templates',
];

const SUPPORT_TABLES = [
  'item_members',
  'reminder_recipients',
  'finance_loan_payments',
  'finance_goal_contributions',
  'tombstones',
  'processed_operations',
  'sync_changes',
];

const COMMON_COLUMNS = [
  'id',
  'space_id',
  'created_by_actor_id',
  'data_class',
  'sharing_scope',
  'revision',
  'created_at',
  'updated_at',
  'deleted_at',
];

function errnoOf(err: unknown): unknown {
  const e = err as { errno?: unknown; driverError?: { errno?: unknown } };
  return e.driverError?.errno ?? e.errno;
}

async function errnoOfQuery(ds: DataSource, sql: string, params: unknown[]): Promise<unknown> {
  try {
    await ds.query(sql, params);
  } catch (err) {
    return errnoOf(err);
  }
  return null;
}

const COMMON_INSERT = `id, space_id, created_by_actor_id, data_class, sharing_scope, revision, created_at, updated_at`;

describe('resource schema (int)', () => {
  let t: TestApp;
  let access: AccessService;
  let actorId: string;
  let spaceA: string;
  let spaceB: string;
  let memberA: string;
  let memberB: string;

  beforeAll(async () => {
    t = await createTestApp();
    access = t.app.get(AccessService);
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    const owner = await insertActorWithDevice(t.ds);
    actorId = owner.actorId;
    spaceA = (await createSharedSpace(t.ds, access, owner)).spaceId;
    spaceB = (await createSharedSpace(t.ds, access, owner)).spaceId;
    memberA = await insertMember(t.ds, spaceA, actorId, 'PARENT');
    memberB = await insertMember(t.ds, spaceB, actorId, 'CHILD');
  });

  afterAll(async () => {
    await t.close();
  });

  async function insertItem(spaceId: string): Promise<string> {
    const id = randomUUID();
    const now = new Date();
    await t.ds.query(
      `INSERT INTO items (${COMMON_INSERT}, kind, preset, title, all_day, start_local, time_zone, category, priority,
         attachments, show_on_calendar, calendar_system)
       VALUES (?, ?, ?, 'NORMAL', 'FAMILY_ALL', 1, ?, ?, 'EVENT', 'EVENT', 'Họp lớp', 0, '2026-10-07T19:00',
         'Asia/Ho_Chi_Minh', 'FAMILY', 'MEDIUM', '[]', 1, 'SOLAR')`,
      [id, spaceId, actorId, now, now],
    );
    return id;
  }

  it('creates every registry and support table', async () => {
    const tables = await listTables(t.ds);
    for (const name of [...RESOURCE_TABLES, ...SUPPORT_TABLES]) expect(tables).toContain(name);
  });

  it('gives every registry table the common columns, UNIQUE (space_id, id) and the sync indexes', async () => {
    for (const table of RESOURCE_TABLES) {
      const cols: Array<{ name: string }> = await t.ds.query(
        `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table],
      );
      const names = cols.map((c) => c.name);
      for (const c of COMMON_COLUMNS) expect({ table, has: names.includes(c), c }).toEqual({ table, has: true, c });

      const idx: Array<{ name: string; cols: string; nonUnique: string | number }> = await t.ds.query(
        `SELECT INDEX_NAME AS name, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols, MAX(NON_UNIQUE) AS nonUnique
           FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          GROUP BY INDEX_NAME`,
        [table],
      );
      const byCols = (cols: string) => idx.find((i) => i.cols === cols);
      expect({ table, unique: Number(byCols('space_id,id')?.nonUnique) }).toEqual({ table, unique: 0 });
      expect({ table, idx: !!byCols('space_id,updated_at') }).toEqual({ table, idx: true });
      expect({ table, idx: !!byCols('space_id,deleted_at') }).toEqual({ table, idx: true });
    }
  });

  it('rejects an item_members row that points at a Member of another Space (errno 1452)', async () => {
    const itemId = await insertItem(spaceA);
    expect(
      await errnoOfQuery(t.ds, 'INSERT INTO item_members (space_id, item_id, member_id) VALUES (?, ?, ?)', [
        spaceA,
        itemId,
        memberB,
      ]),
    ).toBe(1452);
    // Claiming the other Space for the row does not help either: the item is not there.
    expect(
      await errnoOfQuery(t.ds, 'INSERT INTO item_members (space_id, item_id, member_id) VALUES (?, ?, ?)', [
        spaceB,
        itemId,
        memberB,
      ]),
    ).toBe(1452);
    await t.ds.query('INSERT INTO item_members (space_id, item_id, member_id) VALUES (?, ?, ?)', [
      spaceA,
      itemId,
      memberA,
    ]);
  });

  it('rejects same-Space references across Spaces for finance, health and storage rows', async () => {
    const now = new Date();
    expect(
      await errnoOfQuery(
        t.ds,
        `INSERT INTO health_notes (${COMMON_INSERT}, member_id, date, title, body)
         VALUES (?, ?, ?, 'SENSITIVE', 'PRIVATE', 1, ?, ?, ?, '2026-10-07', 'Khám', '')`,
        [randomUUID(), spaceA, actorId, now, now, memberB],
      ),
    ).toBe(1452);
    expect(
      await errnoOfQuery(
        t.ds,
        `INSERT INTO finance_transactions (${COMMON_INSERT}, type, amount, category, date, member_id)
         VALUES (?, ?, ?, 'PRIVATE', 'PRIVATE', 1, ?, ?, 'EXPENSE', 1000, 'FOOD', '2026-10-07', ?)`,
        [randomUUID(), spaceA, actorId, now, now, memberB],
      ),
    ).toBe(1452);
    const folderB = randomUUID();
    await t.ds.query(
      `INSERT INTO folders (${COMMON_INSERT}, name) VALUES (?, ?, ?, 'NORMAL', 'FAMILY_ALL', 1, ?, ?, 'Ảnh')`,
      [folderB, spaceB, actorId, now, now],
    );
    expect(
      await errnoOfQuery(
        t.ds,
        `INSERT INTO files (${COMMON_INSERT}, folder_id, name, mime, size, sha256, kind, blob_state)
         VALUES (?, ?, ?, 'NORMAL', 'FAMILY_ALL', 1, ?, ?, ?, 'a.jpg', 'image/jpeg', 10, ?, 'IMAGE', 'LOCAL_ONLY')`,
        [randomUUID(), spaceA, actorId, now, now, folderB, 'b'.repeat(64)],
      ),
    ).toBe(1452);
  });

  it('round-trips the largest DECIMAL(15,0) amount as an exact string', async () => {
    const id = randomUUID();
    const now = new Date();
    await t.ds.query(
      `INSERT INTO finance_transactions (${COMMON_INSERT}, type, amount, category, date)
       VALUES (?, ?, ?, 'PRIVATE', 'PRIVATE', 1, ?, ?, 'INCOME', ?, 'SALARY', '2026-10-07')`,
      [id, spaceA, actorId, now, now, '999999999999999'],
    );
    const viaEntity = await t.ds.getRepository(FinanceTransactionEntity).findOneByOrFail({ id });
    expect(viaEntity.amount).toBe('999999999999999');
    const [raw]: Array<{ amount: unknown }> = await t.ds.query('SELECT amount FROM finance_transactions WHERE id = ?', [
      id,
    ]);
    expect(raw.amount).toBe('999999999999999');
    expect(
      await errnoOfQuery(t.ds, 'UPDATE finance_transactions SET amount = ? WHERE id = ?', ['1000000000000000', id]),
    ).toBe(1264);
  });

  it('reads a DATE back as the same string under a negative-offset process time zone', async () => {
    const id = randomUUID();
    await withProcessTimeZoneAsync('America/Los_Angeles', async () => {
      const now = new Date();
      await t.ds.getRepository(HealthNoteEntity).insert({
        id,
        spaceId: spaceA,
        createdByActorId: actorId,
        dataClass: 'SENSITIVE',
        sharingScope: 'PRIVATE',
        revision: '1',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        memberId: memberA,
        date: '2026-02-28',
        title: 'Tái khám',
        body: '',
      });
      const viaEntity = await t.ds.getRepository(HealthNoteEntity).findOneByOrFail({ id });
      expect(viaEntity.date).toBe('2026-02-28');
      const [raw]: Array<{ date: unknown }> = await t.ds.query('SELECT date FROM health_notes WHERE id = ?', [id]);
      expect(raw.date).toBe('2026-02-28');
    });
  });

  it('allows one sync_changes seq per Space and one processed operation per id', async () => {
    const now = new Date();
    const insertChange = (spaceId: string, seq: number) =>
      t.ds.query(
        `INSERT INTO sync_changes (space_id, seq, resource_type, resource_id, revision, op, created_at)
         VALUES (?, ?, 'item', ?, 1, 'UPSERT', ?)`,
        [spaceId, seq, randomUUID(), now],
      );
    await insertChange(spaceA, 1);
    await insertChange(spaceB, 1);
    expect(await insertChange(spaceA, 1).then(() => null, errnoOf)).toBe(1062);

    const [device]: Array<{ id: string }> = await t.ds.query('SELECT id FROM devices LIMIT 1');
    const opId = randomUUID();
    const insertOp = () =>
      t.ds.query(
        `INSERT INTO processed_operations (operation_id, device_id, space_id, payload_hash, result, created_at)
         VALUES (?, ?, ?, ?, NULL, ?)`,
        [opId, device.id, spaceA, 'c'.repeat(64), now],
      );
    await insertOp();
    expect(await insertOp().then(() => null, errnoOf)).toBe(1062);
  });
});
