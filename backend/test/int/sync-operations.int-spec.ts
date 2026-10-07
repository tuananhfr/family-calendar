import { randomUUID } from 'node:crypto';
import { AccessService } from '../../src/modules/access/access.service';
import { truncateAll } from '../helpers/db';
import { registerDevice } from '../helpers/session';
import { createSharedSpace, insertMember } from '../helpers/spaces';
import { base, itemPayload, op, seedFamily, sendOps, type Family } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';

interface Result {
  operation_id: string;
  status: 'APPLIED' | 'REJECTED';
  revision?: string;
  record?: Record<string, unknown> | null;
  error?: { code: string; message: string; fields?: Record<string, string> };
  current?: Record<string, unknown> | null;
}

describe('sync operations (int)', () => {
  let t: TestApp;
  let f: Family;
  let spaceId: string;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    f = await seedFamily(t.app, t.ds);
    spaceId = f.space.spaceId;
  });

  afterAll(async () => {
    await t.close();
  });

  async function apply(dev = f.owner, operations: unknown[]): Promise<Result[]> {
    const res = await sendOps(dev, spaceId, operations);
    expect(res.status).toBe(200);
    expect(typeof res.body.policy_version).toBe('string');
    return res.body.results as Result[];
  }

  async function count(sql: string, params: unknown[] = []): Promise<number> {
    const [row]: Array<{ n: string | number }> = await t.ds.query(sql, params);
    return Number(row.n);
  }

  it('applies a valid item create with revision 1, a change entry, a seq bump and a content-free audit row', async () => {
    const payload = itemPayload(spaceId, f.owner.actorId, { title: 'Sinh nhật Bà Nội 🎂', memberIds: [f.childMemberId] });
    const [r] = await apply(f.owner, [op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload })]);
    expect(r.status).toBe('APPLIED');
    expect(r.revision).toBe('1');
    expect(r.record).toMatchObject({
      id: payload.id,
      spaceId,
      createdByActorId: f.owner.actorId,
      revision: '1',
      title: 'Sinh nhật Bà Nội 🎂',
      memberIds: [f.childMemberId],
      schedule: { allDay: false, start: '2026-10-10T08:00', end: '2026-10-10T09:00', timeZone: 'Asia/Ho_Chi_Minh' },
      deletedAt: null,
    });
    expect(r.record).not.toHaveProperty('syncState');

    expect(await count('SELECT COUNT(*) n FROM sync_changes WHERE space_id = ?', [spaceId])).toBe(1);
    const [space]: Array<{ change_seq: string }> = await t.ds.query('SELECT change_seq FROM spaces WHERE id = ?', [
      spaceId,
    ]);
    expect(space.change_seq).toBe('1');
    const audit: unknown[] = await t.ds.query(
      "SELECT * FROM audit_events WHERE space_id = ? AND action = 'item.create'",
      [spaceId],
    );
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain('Sinh nhật');
    const jobs: Array<{ type: string }> = await t.ds.query('SELECT type FROM jobs');
    expect(jobs.map((j) => j.type)).toEqual(['RESCHEDULE_REMINDERS']);
  });

  it('returns the same result for a resent operation without writing again', async () => {
    const payload = itemPayload(spaceId, f.owner.actorId);
    const o = op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload });
    const [first] = await apply(f.owner, [o]);
    const [second] = await apply(f.owner, [o]);
    expect(second).toEqual(first);
    expect(await count('SELECT COUNT(*) n FROM items')).toBe(1);
    expect(await count('SELECT COUNT(*) n FROM sync_changes')).toBe(1);
  });

  it('serializes 5 concurrent requests carrying the same operation id', async () => {
    const payload = itemPayload(spaceId, f.owner.actorId);
    const o = op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload });
    const responses = await Promise.all(Array.from({ length: 5 }, () => sendOps(f.owner, spaceId, [o])));
    for (const res of responses) expect(res.status).toBe(200);
    const results = responses.map((r) => r.body.results[0] as Result);
    for (const r of results) expect(r).toEqual(results[0]);
    expect(results[0].status).toBe('APPLIED');
    expect(await count('SELECT COUNT(*) n FROM items')).toBe(1);
    expect(await count('SELECT COUNT(*) n FROM sync_changes')).toBe(1);
  });

  it('rejects a reused operation id with a different payload', async () => {
    const payload = itemPayload(spaceId, f.owner.actorId);
    const o = op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload });
    await apply(f.owner, [o]);
    const [r] = await apply(f.owner, [{ ...o, payload: { ...payload, title: 'Khác' } }]);
    expect(r.status).toBe('REJECTED');
    expect(r.error?.code).toBe('OPERATION_ID_REUSED');
    expect(await count("SELECT COUNT(*) n FROM items WHERE title = 'Khác'")).toBe(0);
  });

  it('rejects an operation id first used by another device', async () => {
    const payload = itemPayload(spaceId, f.owner.actorId);
    const o = op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload });
    await apply(f.owner, [o]);
    const [r] = await apply(f.adult, [o]);
    expect(r.error?.code).toBe('OPERATION_ID_REUSED');
    expect(r).not.toHaveProperty('record');
  });

  it('turns the second of two updates from the same base revision into REVISION_CONFLICT with current', async () => {
    const payload = itemPayload(spaceId, f.owner.actorId);
    await apply(f.owner, [op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload })]);
    const [a] = await apply(f.owner, [
      op({ resource_type: 'item', resource_id: payload.id, action: 'update', base_revision: '1', payload: { ...payload, title: 'A' } }),
    ]);
    const [b] = await apply(f.adult, [
      op({ resource_type: 'item', resource_id: payload.id, action: 'update', base_revision: '1', payload: { ...payload, title: 'B' } }),
    ]);
    expect(a).toMatchObject({ status: 'APPLIED', revision: '2' });
    expect(b.status).toBe('REJECTED');
    expect(b.error?.code).toBe('REVISION_CONFLICT');
    expect(b.current).toMatchObject({ id: payload.id, revision: '2', title: 'A' });
  });

  it('answers RESOURCE_DELETED for an update after delete and ID_COLLISION for a create over an existing id', async () => {
    const payload = itemPayload(spaceId, f.owner.actorId);
    await apply(f.owner, [op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload })]);
    const [collision] = await apply(f.owner, [
      op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload: { ...payload, title: 'Đè' } }),
    ]);
    expect(collision.error?.code).toBe('ID_COLLISION');
    const [del] = await apply(f.owner, [
      op({ resource_type: 'item', resource_id: payload.id, action: 'delete', base_revision: '1' }),
    ]);
    expect(del).toMatchObject({ status: 'APPLIED', revision: '2', record: null });
    const [upd] = await apply(f.owner, [
      op({ resource_type: 'item', resource_id: payload.id, action: 'update', base_revision: '2', payload }),
    ]);
    expect(upd.error?.code).toBe('RESOURCE_DELETED');
    const rows: Array<{ title: string; deleted_at: Date | null }> = await t.ds.query(
      'SELECT title, deleted_at FROM items WHERE id = ?',
      [payload.id],
    );
    expect(rows[0].title).toBe('Họp phụ huynh');
    expect(rows[0].deleted_at).not.toBeNull();
    expect(await count('SELECT COUNT(*) n FROM tombstones WHERE resource_id = ?', [payload.id])).toBe(1);
  });

  it('rejects an id that already exists in another Space as ID_COLLISION', async () => {
    const access = t.app.get(AccessService);
    const other = await createSharedSpace(t.ds, access, {
      sessionId: randomUUID(),
      actorId: f.adult.actorId,
      deviceId: f.adult.deviceId,
      accountId: null,
    });
    const payload = itemPayload(other.spaceId, f.adult.actorId);
    const res = await sendOps(f.adult, other.spaceId, [
      op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload }),
    ]);
    expect(res.body.results[0].status).toBe('APPLIED');
    const [r] = await apply(f.owner, [
      op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload: { ...payload, spaceId } }),
    ]);
    expect(r.error?.code).toBe('ID_COLLISION');
    expect(JSON.stringify(r)).not.toContain('Họp phụ huynh');
  });

  it('enforces capabilities and PRIVATE without leaking content in current', async () => {
    const txn = {
      ...base(spaceId, f.child.actorId, randomUUID(), { dataClass: 'PRIVATE' }),
      type: 'EXPENSE',
      amount: 150000,
      category: 'FOOD',
      date: '2026-10-07',
    };
    const [forbidden] = await apply(f.child, [
      op({ resource_type: 'finance_txn', resource_id: txn.id, action: 'create', payload: txn }),
    ]);
    expect(forbidden.error?.code).toBe('FORBIDDEN');
    expect(await count('SELECT COUNT(*) n FROM finance_transactions')).toBe(0);

    const secret = itemPayload(spaceId, f.adult.actorId, { sharingScope: 'PRIVATE', title: 'Quà bí mật' });
    await apply(f.adult, [op({ resource_type: 'item', resource_id: secret.id, action: 'create', payload: secret })]);
    const [ownerEdit] = await apply(f.owner, [
      op({ resource_type: 'item', resource_id: secret.id, action: 'update', base_revision: '1', payload: { ...secret, title: 'X' } }),
    ]);
    expect(ownerEdit.error?.code).toBe('FORBIDDEN');
    expect(ownerEdit.current ?? null).toBeNull();
    expect(JSON.stringify(ownerEdit)).not.toContain('Quà bí mật');
    const [stale] = await apply(f.owner, [
      op({ resource_type: 'item', resource_id: secret.id, action: 'update', base_revision: '9', payload: { ...secret, title: 'X' } }),
    ]);
    expect(['FORBIDDEN', 'REVISION_CONFLICT']).toContain(stale.error?.code);
    expect(JSON.stringify(stale)).not.toContain('Quà bí mật');
  });

  it('stores money as an exact string and returns it as a string', async () => {
    const txn = {
      ...base(spaceId, f.owner.actorId, randomUUID(), { dataClass: 'PRIVATE' }),
      type: 'EXPENSE',
      amount: 999999999999999,
      category: 'FOOD',
      date: '2026-10-07',
    };
    const [r] = await apply(f.owner, [op({ resource_type: 'finance_txn', resource_id: txn.id, action: 'create', payload: txn })]);
    expect(r.status).toBe('APPLIED');
    expect(r.record).toMatchObject({ amount: '999999999999999', date: '2026-10-07', category: 'FOOD' });
  });

  it('rejects member references from another Space with VALIDATION_FAILED on member_ids', async () => {
    const access = t.app.get(AccessService);
    const other = await createSharedSpace(t.ds, access, {
      sessionId: randomUUID(),
      actorId: f.adult.actorId,
      deviceId: f.adult.deviceId,
      accountId: null,
    });
    const foreignMember = await insertMember(t.ds, other.spaceId, f.adult.actorId, 'CHILD');
    const payload = itemPayload(spaceId, f.owner.actorId, { memberIds: [foreignMember] });
    const [r] = await apply(f.owner, [op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload })]);
    expect(r.error?.code).toBe('VALIDATION_FAILED');
    expect(r.error?.fields?.memberIds).toBeDefined();
    expect(await count('SELECT COUNT(*) n FROM items')).toBe(0);
  });

  it('reports field errors for an invalid payload', async () => {
    const payload = itemPayload(spaceId, f.owner.actorId, { title: '', priority: 'URGENT', extra: 1 });
    const [r] = await apply(f.owner, [op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload })]);
    expect(r.error?.code).toBe('VALIDATION_FAILED');
    expect(r.error?.fields).toMatchObject({ title: 'REQUIRED', priority: 'INVALID', extra: 'UNKNOWN_FIELD' });

    // Cross-field rules run once every field parses on its own.
    const mismatch = itemPayload(spaceId, f.owner.actorId, { preset: 'MEDICATION' });
    const [m] = await apply(f.owner, [op({ resource_type: 'item', resource_id: mismatch.id, action: 'create', payload: mismatch })]);
    expect(m.error?.fields).toEqual({ preset: 'PRESET_NOT_IN_KIND' });
  });

  it('answers 413 for 51 operations and keeps per-operation results in a mixed batch', async () => {
    const many = Array.from({ length: 51 }, () => {
      const p = itemPayload(spaceId, f.owner.actorId);
      return op({ resource_type: 'item', resource_id: p.id, action: 'create', payload: p });
    });
    const tooMany = await sendOps(f.owner, spaceId, many);
    expect(tooMany.status).toBe(413);
    expect(tooMany.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(await count('SELECT COUNT(*) n FROM items')).toBe(0);

    const good1 = itemPayload(spaceId, f.owner.actorId);
    const bad = itemPayload(spaceId, f.owner.actorId, { title: '' });
    const good2 = itemPayload(spaceId, f.owner.actorId);
    const results = await apply(f.owner, [
      op({ resource_type: 'item', resource_id: good1.id, action: 'create', payload: good1 }),
      op({ resource_type: 'item', resource_id: bad.id, action: 'create', payload: bad }),
      op({ resource_type: 'item', resource_id: good2.id, action: 'create', payload: good2 }),
    ]);
    expect(results.map((r) => r.status)).toEqual(['APPLIED', 'REJECTED', 'APPLIED']);
    expect(await count('SELECT COUNT(*) n FROM items')).toBe(2);
  });

  it('refuses the whole batch with 401 DEVICE_REVOKED once the device is revoked', async () => {
    await t.ds.query("UPDATE devices SET status = 'REVOKED', revoked_at = UTC_TIMESTAMP(3) WHERE id = ?", [
      f.owner.deviceId,
    ]);
    const payload = itemPayload(spaceId, f.owner.actorId);
    const res = await sendOps(f.owner, spaceId, [op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload })]);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('DEVICE_REVOKED');
    expect(await count('SELECT COUNT(*) n FROM items')).toBe(0);
  });

  it('upserts an occurrence state by occurrence key with its own revision', async () => {
    const task = itemPayload(spaceId, f.owner.actorId, { kind: 'TASK', preset: 'HOUSEWORK', category: 'HOUSEWORK', memberIds: [f.childMemberId] });
    await apply(f.owner, [op({ resource_type: 'item', resource_id: task.id, action: 'create', payload: task })]);
    const occurrenceKey = `${task.id}@2026-10-10T08:00`;
    const state = (id: string, status: string) => ({
      ...base(spaceId, f.child.actorId, id),
      itemId: task.id,
      occurrenceKey,
      status,
      actedAt: new Date().toISOString(),
      actedByActorId: f.child.actorId,
    });
    const firstId = randomUUID();
    const [done] = await apply(f.child, [
      op({ resource_type: 'occurrence_state', resource_id: firstId, action: 'occurrence_action', payload: state(firstId, 'DONE') }),
    ]);
    expect(done).toMatchObject({ status: 'APPLIED', revision: '1' });
    expect(done.record).toMatchObject({ id: firstId, status: 'DONE', occurrenceKey, actedByActorId: f.child.actorId });

    // A second device marking the same occurrence converges on the existing row instead of a duplicate.
    const secondId = randomUUID();
    const [again] = await apply(f.owner, [
      op({ resource_type: 'occurrence_state', resource_id: secondId, action: 'occurrence_action', payload: state(secondId, 'DONE') }),
    ]);
    expect(again.status).toBe('APPLIED');
    expect(again.record).toMatchObject({ id: firstId, status: 'DONE' });
    const [skip] = await apply(f.owner, [
      op({ resource_type: 'occurrence_state', resource_id: firstId, action: 'occurrence_action', base_revision: '1', payload: state(firstId, 'SKIPPED') }),
    ]);
    expect(skip).toMatchObject({ status: 'APPLIED', revision: '2' });
    const thirdId = randomUUID();
    const [conflict] = await apply(f.child, [
      op({ resource_type: 'occurrence_state', resource_id: thirdId, action: 'occurrence_action', payload: state(thirdId, 'DONE') }),
    ]);
    expect(conflict.error?.code).toBe('REVISION_CONFLICT');
    expect(conflict.current).toMatchObject({ id: firstId, status: 'SKIPPED' });
    expect(await count('SELECT COUNT(*) n FROM occurrence_states')).toBe(1);
    const [item]: Array<{ revision: string }> = await t.ds.query('SELECT revision FROM items WHERE id = ?', [task.id]);
    expect(item.revision).toBe('1');
  });

  it('bumps policy_version when a record changes audience and when a role changes', async () => {
    const payload = itemPayload(spaceId, f.owner.actorId);
    const res0 = await sendOps(f.owner, spaceId, [op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload })]);
    const v0 = res0.body.policy_version as string;
    const res1 = await sendOps(f.owner, spaceId, [
      op({ resource_type: 'item', resource_id: payload.id, action: 'update', base_revision: '1', payload: { ...payload, sharingScope: 'PARENTS_SENIORS' } }),
    ]);
    expect(Number(res1.body.policy_version)).toBe(Number(v0) + 1);

    const roles: Array<{ id: string }> = await t.ds.query("SELECT id FROM roles WHERE space_id = ? AND role_key = 'GUEST'", [spaceId]);
    const snap: Array<Record<string, unknown>> = await t.ds.query('SELECT * FROM roles WHERE id = ?', [roles[0].id]);
    const guest = {
      ...base(spaceId, f.owner.actorId, roles[0].id),
      key: 'GUEST',
      name: 'Khách mời',
      matrix: { ...(typeof snap[0].matrix === 'string' ? JSON.parse(snap[0].matrix) : snap[0].matrix), timetable: 'VIEW' },
      system: true,
    };
    const res2 = await sendOps(f.owner, spaceId, [
      op({ resource_type: 'role', resource_id: guest.id, action: 'update', base_revision: '1', payload: guest }),
    ]);
    expect(res2.body.results[0].status).toBe('APPLIED');
    expect(Number(res2.body.policy_version)).toBe(Number(v0) + 2);
  });

  it('lets a MEMBER create own records but not edit a parent item outside OWN_OR_ASSIGNED', async () => {
    const own = itemPayload(spaceId, f.child.actorId, { kind: 'TASK', preset: 'PERSONAL', category: 'OTHER' });
    const [r1] = await apply(f.child, [op({ resource_type: 'item', resource_id: own.id, action: 'create', payload: own })]);
    expect(r1.status).toBe('APPLIED');
    const parents = itemPayload(spaceId, f.owner.actorId);
    await apply(f.owner, [op({ resource_type: 'item', resource_id: parents.id, action: 'create', payload: parents })]);
    const [r2] = await apply(f.child, [
      op({ resource_type: 'item', resource_id: parents.id, action: 'update', base_revision: '1', payload: { ...parents, title: 'Sửa' } }),
    ]);
    expect(r2.error?.code).toBe('FORBIDDEN');
    expect(r2.current).toMatchObject({ id: parents.id, title: 'Họp phụ huynh' });
    const [r3] = await apply(f.child, [op({ resource_type: 'item', resource_id: own.id, action: 'delete', base_revision: '1' })]);
    expect(r3.error?.code).toBe('FORBIDDEN');
  });

  it('updates space settings and rejects unknown resource types and actions per operation', async () => {
    const [space]: Array<Record<string, unknown>> = await t.ds.query('SELECT * FROM spaces WHERE id = ?', [spaceId]);
    const payload = {
      ...base(spaceId, f.owner.actorId, spaceId),
      kind: 'FAMILY',
      name: 'Nhà Nguyễn',
      timeZone: 'Asia/Ho_Chi_Minh',
      sharingState: 'SHARED',
      settings: {
        weekStartsOn: 1,
        dateFormat: 'dd/MM/yyyy',
        showIllustrations: true,
        showQuickReminders: true,
        showUpcomingBirthdays: true,
        weatherEnabled: false,
      },
    };
    const results = await apply(f.owner, [
      op({ resource_type: 'space_settings', resource_id: spaceId, action: 'update', base_revision: String(space.revision), payload }),
      op({ resource_type: 'nope', resource_id: randomUUID(), action: 'create', payload: {} }),
      op({ resource_type: 'space_settings', resource_id: spaceId, action: 'delete', base_revision: '2' }),
    ]);
    expect(results[0]).toMatchObject({ status: 'APPLIED', revision: '2' });
    expect(results[0].record).toMatchObject({ id: spaceId, name: 'Nhà Nguyễn', sharingState: 'SHARED' });
    expect(results[1].error?.code).toBe('VALIDATION_FAILED');
    expect(results[2].error?.code).toBe('VALIDATION_FAILED');
    const [adultTry] = await apply(f.adult, [
      op({ resource_type: 'space_settings', resource_id: spaceId, action: 'update', base_revision: '2', payload: { ...payload, name: 'X' } }),
    ]);
    expect(adultTry.error?.code).toBe('FORBIDDEN');
  });

  it('answers 403 for a Space the caller is not a member of', async () => {
    const stranger = await registerDevice(t.app, { ip: '10.9.9.9' });
    const payload = itemPayload(spaceId, stranger.actorId);
    const res = await sendOps(stranger, spaceId, [op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload })]);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
