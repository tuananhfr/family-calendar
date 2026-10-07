import { randomUUID } from 'node:crypto';
import { AccessService } from '../../src/modules/access/access.service';
import { withTransaction } from '../../src/database/transaction';
import { truncateAll } from '../helpers/db';
import { registerDevice, type RegisteredDevice } from '../helpers/session';
import { base, itemPayload, op, sendOps } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';

const SETTINGS = {
  weekStartsOn: 1,
  dateFormat: 'dd/MM/yyyy',
  showIllustrations: true,
  showQuickReminders: true,
  showUpcomingBirthdays: true,
  weatherEnabled: false,
};

describe('space bootstrap (int)', () => {
  let t: TestApp;
  let owner: RegisteredDevice;
  let other: RegisteredDevice;
  let spaceId: string;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    owner = await registerDevice(t.app, { ip: '10.40.0.1' });
    other = await registerDevice(t.app, { ip: '10.40.0.2' });
    spaceId = randomUUID();
  });

  afterAll(async () => {
    await t.close();
  });

  function start(dev = owner, id = spaceId, kind = 'FAMILY') {
    return dev.agent
      .post('/api/v1/spaces/bootstrap')
      .set('X-CSRF-Token', dev.csrf)
      .send({ space: { id, kind, name: 'Nhà Nguyễn', time_zone: 'Asia/Ho_Chi_Minh', settings: SETTINGS } });
  }

  function chunk(records: unknown[], chunkId = randomUUID(), dev = owner, id = spaceId) {
    return dev.agent
      .post(`/api/v1/spaces/${id}/bootstrap/chunks`)
      .set('X-CSRF-Token', dev.csrf)
      .send({ chunk_id: chunkId, records });
  }

  function activate(body: Record<string, unknown>, dev = owner) {
    return dev.agent.post(`/api/v1/spaces/${spaceId}/bootstrap/activate`).set('X-CSRF-Token', dev.csrf).send(body);
  }

  const rec = (resource_type: string, payload: { id: string; [key: string]: unknown }) => ({ resource_type, resource_id: payload.id, payload });

  function member(displayName: string, profile = 'PARENT') {
    return {
      ...base(spaceId, owner.actorId),
      displayName,
      relationship: profile === 'CHILD' ? 'SON' : 'FATHER',
      profile,
      interests: [],
      status: 'ACTIVE',
    };
  }

  async function count(table: string): Promise<number> {
    const [row]: Array<{ n: string | number }> = await t.ds.query(`SELECT COUNT(*) n FROM ${table} WHERE space_id = ?`, [spaceId]);
    return Number(row.n);
  }

  async function state(): Promise<string> {
    const [row]: Array<{ sharing_state: string }> = await t.ds.query('SELECT sharing_state FROM spaces WHERE id = ?', [spaceId]);
    return row.sharing_state;
  }

  it('creates a Space in stages, keeps the local id and activates it', async () => {
    const res = await start();
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ space_id: spaceId, state: 'INITIALIZING' });

    const dad = member('Bố');
    const son = member('Bé Bin', 'CHILD');
    const item = itemPayload(spaceId, owner.actorId, { memberIds: [son.id] });
    const rule = {
      ...base(spaceId, owner.actorId),
      itemId: item.id,
      offsetsMinutes: [30],
      channels: ['IN_APP'],
      priority: 'MEDIUM',
      recipientMemberIds: [son.id],
    };
    // Children ahead of their parents within one chunk are reordered by type.
    const c1 = await chunk([rec('member', son), rec('member', dad)]);
    expect(c1.status).toBe(200);
    expect(c1.body).toEqual({ accepted: 2 });
    expect((await chunk([rec('reminder_rule', rule), rec('item', item)])).body).toEqual({ accepted: 2 });
    const note = { ...base(spaceId, owner.actorId, randomUUID(), { dataClass: 'SENSITIVE' }), memberId: son.id, date: '2026-10-01', title: 'Tiêm phòng', body: '' };
    expect((await chunk([rec('health_note', note)])).body).toEqual({ accepted: 1 });

    const counts = { member: 2, item: 1, reminder_rule: 1, health_note: 1 };
    const done = await activate({ expected_counts: counts, self_member_id: dad.id });
    expect(done.status).toBe(200);
    expect(done.body).toEqual({ state: 'SHARED', watermark: '5' });
    expect(await state()).toBe('SHARED');

    const snap = await owner.agent.get(`/api/v1/spaces/${spaceId}/sync/snapshot`);
    expect(snap.status).toBe(200);
    expect(snap.body.records.member).toHaveLength(2);
    expect(snap.body.records.item).toEqual([expect.objectContaining({ id: item.id, memberIds: [son.id] })]);
    expect(snap.body.records.reminder_rule).toHaveLength(1);
    expect(snap.body.records.health_note).toHaveLength(1);
    expect(snap.body.space).toMatchObject({ id: spaceId, name: 'Nhà Nguyễn', sharingState: 'SHARED' });
    expect(snap.body.access).toMatchObject({ roleKey: 'OWNER', representedMemberIds: [dad.id] });
    expect(snap.body.records.member.find((m: { id: string }) => m.id === dad.id)).toMatchObject({ linkedActorId: owner.actorId });

    const list = await owner.agent.get('/api/v1/spaces');
    expect(list.body.spaces).toEqual([
      expect.objectContaining({ id: spaceId, kind: 'FAMILY', name: 'Nhà Nguyễn', sharingState: 'SHARED', roleKey: 'OWNER' }),
    ]);
    expect((await owner.agent.get(`/api/v1/spaces/${spaceId}`)).body).toMatchObject({ id: spaceId, roleKey: 'OWNER' });

    // Activation is retry-safe; a finished Space takes no more chunks.
    expect((await activate({ expected_counts: counts })).body).toEqual({ state: 'SHARED', watermark: '5' });
    expect((await chunk([rec('member', member('Muộn'))])).status).toBe(403);
  });

  it('treats a resent chunk and a resent bootstrap as retries', async () => {
    await start();
    expect((await start()).status).toBe(201);
    const chunkId = randomUUID();
    const records = [rec('member', member('Mẹ'))];
    expect((await chunk(records, chunkId)).body).toEqual({ accepted: 1 });
    expect((await chunk(records, chunkId)).body).toEqual({ accepted: 1 });
    expect(await count('members')).toBe(1);
    const changed = await chunk([rec('member', member('Khác'))], chunkId);
    expect(changed.status).toBe(409);
    expect(changed.body.error.code).toBe('OPERATION_ID_REUSED');

    const taken = await start(other);
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('ID_COLLISION');
  });

  it('reports ID_COLLISION by position only and keeps nothing from the chunk', async () => {
    const foreignSpace = randomUUID();
    await start(other, foreignSpace);
    const theirs = { ...member('Ông'), spaceId: foreignSpace, createdByActorId: other.actorId };
    expect((await chunk([rec('member', theirs)], randomUUID(), other, foreignSpace)).body).toEqual({ accepted: 1 });

    await start();
    const chunkId = randomUUID();
    const res = await chunk([rec('member', member('Bà')), rec('member', { ...theirs, spaceId })], chunkId);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'ID_COLLISION', fields: { chunk_id: chunkId, index: '1' } });
    expect(res.text).not.toContain('Ông');
    expect(await count('members')).toBe(0);
  });

  it('locates invalid records and refuses activation on a count mismatch', async () => {
    await start();
    const bad = itemPayload(spaceId, owner.actorId, { title: '' });
    const chunkId = randomUUID();
    const invalid = await chunk([rec('member', member('Bố')), rec('item', bad)], chunkId);
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.fields).toMatchObject({ chunk_id: chunkId, index: '1', 'records.1.title': 'REQUIRED' });
    expect(await count('members')).toBe(0);

    const orphan = itemPayload(spaceId, owner.actorId, { memberIds: [randomUUID()] });
    const missingRef = await chunk([rec('item', orphan)]);
    expect(missingRef.status).toBe(422);
    expect(missingRef.body.error.fields).toMatchObject({ index: '0', 'records.0.memberIds': 'NOT_IN_SPACE' });

    expect((await chunk([rec('member', member('Bố'))])).status).toBe(200);
    const short = await activate({ expected_counts: { member: 2 } });
    expect(short.status).toBe(422);
    expect(short.body.error.fields).toMatchObject({ 'expected_counts.member': 'COUNT_MISMATCH' });
    expect(await state()).toBe('INITIALIZING');
    const unknown = await activate({ expected_counts: { member: 1, nope: 0 } });
    expect(unknown.status).toBe(422);
  });

  it('hides an INITIALIZING Space from everyone but its creator', async () => {
    await start();
    const access = t.app.get(AccessService);
    const roles: Array<{ id: string }> = await t.ds.query("SELECT id FROM roles WHERE space_id = ? AND role_key = 'ADULT'", [spaceId]);
    await withTransaction(t.ds, (em) => access.addMembership(em, spaceId, other.actorId, roles[0].id));

    expect((await other.agent.get(`/api/v1/spaces/${spaceId}/sync/snapshot`)).status).toBe(403);
    expect((await other.agent.get(`/api/v1/spaces/${spaceId}`)).status).toBe(403);
    expect((await other.agent.get('/api/v1/spaces')).body.spaces).toEqual([]);
    expect((await chunk([rec('member', member('X'))], randomUUID(), other)).status).toBe(403);
    expect((await activate({ expected_counts: {} }, other)).status).toBe(403);
    const p = itemPayload(spaceId, other.actorId);
    expect((await sendOps(other, spaceId, [op({ resource_type: 'item', resource_id: p.id, action: 'create', payload: p })])).status).toBe(403);

    expect((await owner.agent.get('/api/v1/spaces')).body.spaces).toEqual([
      expect.objectContaining({ id: spaceId, sharingState: 'INITIALIZING' }),
    ]);
  });

  it('validates the bootstrap request and seeds GROUP roles', async () => {
    const bad = await owner.agent
      .post('/api/v1/spaces/bootstrap')
      .set('X-CSRF-Token', owner.csrf)
      .send({ space: { id: 'x', kind: 'CLUB', name: '', time_zone: 'Mars/Base', settings: {} } });
    expect(bad.status).toBe(422);
    expect(Object.keys(bad.body.error.fields)).toEqual(expect.arrayContaining(['space.id', 'space.kind', 'space.name', 'space.time_zone']));

    expect((await start(owner, spaceId, 'GROUP')).status).toBe(201);
    const roles: Array<{ role_key: string }> = await t.ds.query('SELECT role_key FROM roles WHERE space_id = ? ORDER BY role_key', [spaceId]);
    expect(roles.map((r) => r.role_key)).toEqual(['GUEST', 'ORGANIZER', 'PARTICIPANT']);
    expect((await activate({ expected_counts: {} })).body.state).toBe('SHARED');
  });
});
