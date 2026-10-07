import { AccessService } from '../../src/modules/access/access.service';
import { withTransaction } from '../../src/database/transaction';
import { truncateAll } from '../helpers/db';
import { registerDevice, type RegisteredDevice } from '../helpers/session';
import { base, itemPayload, op, seedFamily, sendOps, type Family } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';

interface Change {
  seq: string;
  resource_type: string;
  resource_id: string;
  op: 'UPSERT' | 'DELETE';
  revision: string;
  record?: Record<string, unknown>;
}

interface ChangesBody {
  changes: Change[];
  next_cursor: string;
  has_more: boolean;
  policy_version: string;
}

describe('sync pull (int)', () => {
  let t: TestApp;
  let f: Family;
  let spaceId: string;

  beforeAll(async () => {
    // Lowered so the SNAPSHOT_TOO_LARGE case stays fast; the other cases stay well below it.
    process.env.SYNC_SNAPSHOT_MAX_RECORDS = '50';
    t = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    f = await seedFamily(t.app, t.ds, '10.30.0');
    spaceId = f.space.spaceId;
  });

  afterAll(async () => {
    delete process.env.SYNC_SNAPSHOT_MAX_RECORDS;
    await t.close();
  });

  async function createItem(dev: RegisteredDevice, overrides: Record<string, unknown> = {}) {
    const payload = itemPayload(spaceId, dev.actorId, overrides);
    const res = await sendOps(dev, spaceId, [op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload })]);
    expect(res.body.results[0].status).toBe('APPLIED');
    return payload;
  }

  function pull(dev: RegisteredDevice, cursor = '0', limit?: number) {
    const q = limit === undefined ? `cursor=${cursor}` : `cursor=${cursor}&limit=${limit}`;
    return dev.agent.get(`/api/v1/spaces/${spaceId}/sync/changes?${q}`);
  }

  async function pullAll(dev: RegisteredDevice, cursor: string): Promise<Change[]> {
    const all: Change[] = [];
    for (;;) {
      const res = await pull(dev, cursor, 7);
      expect(res.status).toBe(200);
      const body = res.body as ChangesBody;
      all.push(...body.changes);
      cursor = body.next_cursor;
      if (!body.has_more) return all;
    }
  }

  function snapshot(dev: RegisteredDevice) {
    return dev.agent.get(`/api/v1/spaces/${spaceId}/sync/snapshot`);
  }

  it('shows a NORMAL item to another member and pages with next_cursor/has_more', async () => {
    const a = await createItem(f.owner, { title: 'Họp phụ huynh' });
    const b = await createItem(f.owner, { title: 'Đi chợ' });
    const first = await pull(f.adult, '0', 1);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ next_cursor: '1', has_more: true });
    expect(first.body.changes).toEqual([
      expect.objectContaining({ seq: '1', resource_type: 'item', resource_id: a.id, op: 'UPSERT', revision: '1' }),
    ]);
    expect(first.body.changes[0].record).toMatchObject({ id: a.id, title: 'Họp phụ huynh' });
    const second = await pull(f.adult, first.body.next_cursor);
    expect(second.body).toMatchObject({ next_cursor: '2', has_more: false });
    expect(second.body.changes.map((c: Change) => c.resource_id)).toEqual([b.id]);
    expect(typeof second.body.policy_version).toBe('string');
  });

  it('advances the cursor past a PRIVATE item without revealing its id or title', async () => {
    const secret = await createItem(f.adult, { sharingScope: 'PRIVATE', title: 'Quà bí mật' });
    const open = await createItem(f.adult, { title: 'Ăn tối' });
    const res = await pull(f.owner, '0');
    expect(res.status).toBe(200);
    expect(res.body.next_cursor).toBe('2');
    expect(res.body.changes.map((c: Change) => c.resource_id)).toEqual([open.id]);
    expect(res.text).not.toContain(secret.id);
    expect(res.text).not.toContain('Quà bí mật');
    const own = await pull(f.adult, '0');
    expect(own.body.changes.map((c: Change) => c.resource_id)).toEqual([secret.id, open.id]);
  });

  it('builds a permission-filtered snapshot', async () => {
    const secret = await createItem(f.adult, { sharingScope: 'PRIVATE', title: 'Quà bí mật' });
    const shared = await createItem(f.owner);
    const txn = { ...base(spaceId, f.owner.actorId), type: 'EXPENSE', amount: 50000, category: 'FOOD', date: '2026-10-07' };
    const res = await sendOps(f.owner, spaceId, [op({ resource_type: 'finance_txn', resource_id: txn.id, action: 'create', payload: txn })]);
    expect(res.body.results[0].status).toBe('APPLIED');

    const child = await snapshot(f.child);
    expect(child.status).toBe(200);
    expect(child.body.watermark).toBe('3');
    expect(child.body.records.item.map((r: { id: string }) => r.id)).toEqual([shared.id]);
    expect(child.body.records.finance_txn).toEqual([]);
    expect(child.text).not.toContain('Quà bí mật');
    expect(child.body.space).toMatchObject({ id: spaceId, kind: 'FAMILY' });
    expect(child.body.records.role.length).toBeGreaterThan(0);
    expect(child.body.records.member.map((m: { id: string }) => m.id)).toEqual(
      expect.arrayContaining([f.childMemberId, f.adultMemberId]),
    );
    expect(child.body.access).toMatchObject({
      actorId: f.child.actorId,
      roleKey: 'MEMBER',
      representedMemberIds: [f.childMemberId],
    });
    expect(child.body.memberships).toHaveLength(3);

    const owner = await snapshot(f.owner);
    expect(owner.body.records.finance_txn).toEqual([expect.objectContaining({ id: txn.id, amount: '50000' })]);
    expect(owner.body.records.item.map((r: { id: string }) => r.id)).toEqual([shared.id]);
    const adult = await snapshot(f.adult);
    expect(adult.body.records.item.map((r: { id: string }) => r.id).sort()).toEqual([secret.id, shared.id].sort());
  });

  it('emits DELETE and collapses repeated changes of one record within a page', async () => {
    const item = await createItem(f.owner);
    const afterCreate = (await pull(f.adult, '0')).body.next_cursor as string;
    await sendOps(f.owner, spaceId, [
      op({ resource_type: 'item', resource_id: item.id, action: 'update', base_revision: '1', payload: { ...item, title: 'Đổi' } }),
    ]);
    await sendOps(f.owner, spaceId, [op({ resource_type: 'item', resource_id: item.id, action: 'delete', base_revision: '2' })]);
    const res = await pull(f.adult, afterCreate);
    expect(res.body.changes).toEqual([
      { seq: '3', resource_type: 'item', resource_id: item.id, op: 'DELETE', revision: '3' },
    ]);
    const fromStart = await pull(f.adult, '0');
    expect(fromStart.body.changes.map((c: Change) => c.op)).toEqual(['DELETE']);
  });

  it('reports a new policy_version after the caller role changes', async () => {
    await createItem(f.owner);
    const before = (await pull(f.adult, '0')).body.policy_version as string;
    const access = t.app.get(AccessService);
    await withTransaction(t.ds, (em) => access.assignRole(em, spaceId, f.adult.actorId, f.space.roleIds.GUEST));
    const after = await pull(f.adult, '0');
    expect(after.body.policy_version).not.toBe(before);
    const snap = await snapshot(f.adult);
    expect(snap.body.policy_version).toBe(after.body.policy_version);
    expect(snap.body.access.roleKey).toBe('GUEST');
  });

  it('loses and duplicates nothing when writes race a snapshot', async () => {
    const payloads = Array.from({ length: 20 }, () => itemPayload(spaceId, f.owner.actorId));
    const writes = payloads.map((p, i) =>
      new Promise((resolve) => setTimeout(resolve, i * 3)).then(() =>
        sendOps(f.owner, spaceId, [op({ resource_type: 'item', resource_id: p.id, action: 'create', payload: p })]),
      ),
    );
    const snapRes = await new Promise((resolve) => setTimeout(resolve, 25)).then(() => snapshot(f.adult));
    await Promise.all(writes);
    expect(snapRes.status).toBe(200);
    const fromSnapshot: string[] = snapRes.body.records.item.map((r: { id: string }) => r.id);
    const fromChanges = (await pullAll(f.adult, snapRes.body.watermark as string)).map((c) => c.resource_id);
    const union = [...fromSnapshot, ...fromChanges];
    expect(new Set(union).size).toBe(union.length);
    expect(union.sort()).toEqual(payloads.map((p) => p.id).sort());
  });

  it('answers RESYNC_REQUIRED for a cursor beyond the head or older than the tombstone horizon', async () => {
    await createItem(f.owner);
    await createItem(f.owner);
    const ahead = await pull(f.adult, '99');
    expect(ahead.status).toBe(409);
    expect(ahead.body.error.code).toBe('RESYNC_REQUIRED');
    expect((await pull(f.adult, '1')).status).toBe(200);
    await t.ds.query('UPDATE sync_changes SET created_at = UTC_TIMESTAMP(3) - INTERVAL 91 DAY WHERE space_id = ? AND seq = 1', [
      spaceId,
    ]);
    const stale = await pull(f.adult, '1');
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('RESYNC_REQUIRED');
    // A cursor at the head has nothing left to miss.
    expect((await pull(f.adult, '2')).status).toBe(200);
    const bad = await pull(f.adult, 'abc');
    expect(bad.status).toBe(422);
  });

  it('refuses snapshots above the record cap and strangers', async () => {
    for (let batch = 0; batch < 2; batch++) {
      const ops = Array.from({ length: 25 }, () => {
        const p = itemPayload(spaceId, f.owner.actorId);
        return op({ resource_type: 'item', resource_id: p.id, action: 'create', payload: p });
      });
      expect((await sendOps(f.owner, spaceId, ops)).status).toBe(200);
    }
    const res = await snapshot(f.owner);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('SNAPSHOT_TOO_LARGE');

    const stranger = await registerDevice(t.app, { ip: '10.31.0.1' });
    expect((await snapshot(stranger)).status).toBe(403);
    expect((await pull(stranger, '0')).status).toBe(403);
  });
});
