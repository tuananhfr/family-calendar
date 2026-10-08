import { randomUUID } from 'node:crypto';
import { AccessService } from '../../src/modules/access/access.service';
import { withTransaction } from '../../src/database/transaction';
import { truncateAll } from '../helpers/db';
import { registerDevice, type RegisteredDevice } from '../helpers/session';
import { createSharedSpace, insertMember } from '../helpers/spaces';
import { seedFamily, type Family } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';

describe('invites and join requests (int)', () => {
  let t: TestApp;
  let f: Family;
  let spaceId: string;
  let ipSeq = 0;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    f = await seedFamily(t.app, t.ds, '10.50.0');
    spaceId = f.space.spaceId;
  });

  afterAll(async () => {
    await t.close();
  });

  const newDevice = () => registerDevice(t.app, { ip: `10.51.${Math.floor(ipSeq / 200)}.${(ipSeq++ % 200) + 1}`, label: 'Điện thoại của Lan' });

  function createInvite(dev: RegisteredDevice, body: Record<string, unknown> = {}, id = spaceId) {
    return dev.agent
      .post(`/api/v1/spaces/${id}/invites`)
      .set('X-CSRF-Token', dev.csrf)
      .send({ max_uses: 1, expires_in_hours: 24, approval_policy: 'APPROVAL_REQUIRED', ...body });
  }

  function requestJoin(dev: RegisteredDevice, token: string, body: Record<string, unknown> = {}) {
    return dev.agent
      .post(`/api/v1/invites/${token}/join-requests`)
      .set('X-CSRF-Token', dev.csrf)
      .send({ display_name: 'Cô Lan', ...body });
  }

  function approve(dev: RegisteredDevice, rid: string, body: Record<string, unknown> = {}, id = spaceId) {
    return dev.agent
      .post(`/api/v1/spaces/${id}/join-requests/${rid}/approve`)
      .set('X-CSRF-Token', dev.csrf)
      .send({ role_key: 'ADULT', new_member: { display_name: 'Cô Lan', relationship: 'OTHER', profile: 'PARENT' }, ...body });
  }

  it('previews only four fields and keeps the requester out until approval (SHR-001)', async () => {
    const inv = await createInvite(f.owner, { max_uses: 2 });
    expect(inv.status).toBe(201);
    expect(inv.body).toEqual({
      invite_id: expect.any(String),
      token: expect.any(String),
      url: `/tham-gia/#token=${inv.body.token}`,
      expires_at: expect.any(String),
    });
    const anon = await t.app.getHttpServer();
    const request = (await import('supertest')).default;
    const preview = await request(anon).get(`/api/v1/invites/${inv.body.token}/preview`);
    expect(preview.status).toBe(200);
    expect(preview.body).toEqual({
      space_name: 'Nhà mình',
      space_kind: 'FAMILY',
      inviter_display_name: expect.any(String),
      expires_at: inv.body.expires_at,
    });
    expect((await request(anon).get('/api/v1/invites/khong-ton-tai/preview')).body.error.code).toBe('INVITE_INVALID');

    const lan = await newDevice();
    const jr = await requestJoin(lan, inv.body.token);
    expect(jr.status).toBe(201);
    expect(jr.body).toEqual({ request_id: expect.any(String), status: 'PENDING' });
    // Asking again is idempotent.
    expect((await requestJoin(lan, inv.body.token)).body.request_id).toBe(jr.body.request_id);

    expect((await lan.agent.get(`/api/v1/spaces/${spaceId}/sync/snapshot`)).status).toBe(403);
    expect((await lan.agent.get(`/api/v1/spaces/${spaceId}/sync/changes?cursor=0`)).status).toBe(403);
    expect((await lan.agent.get(`/api/v1/join-requests/${jr.body.request_id}`)).body).toEqual({ status: 'PENDING' });
    expect((await f.adult.agent.get(`/api/v1/join-requests/${jr.body.request_id}`)).status).toBe(404);

    const pending = await f.owner.agent.get(`/api/v1/spaces/${spaceId}/join-requests`);
    expect(pending.body.requests).toEqual([
      expect.objectContaining({ request_id: jr.body.request_id, display_name: 'Cô Lan', device_label: 'Điện thoại của Lan', status: 'PENDING' }),
    ]);

    const [{ policy_version: before }]: Array<{ policy_version: string }> = await t.ds.query(
      'SELECT policy_version FROM spaces WHERE id = ?',
      [spaceId],
    );
    const ok = await approve(f.owner, jr.body.request_id);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ request_id: jr.body.request_id, status: 'APPROVED', member_id: expect.any(String) });
    expect((await approve(f.owner, jr.body.request_id)).body).toEqual(ok.body);
    const [{ policy_version: after }]: Array<{ policy_version: string }> = await t.ds.query(
      'SELECT policy_version FROM spaces WHERE id = ?',
      [spaceId],
    );
    expect(Number(after)).toBeGreaterThan(Number(before));

    expect((await lan.agent.get(`/api/v1/join-requests/${jr.body.request_id}`)).body).toEqual({ status: 'APPROVED', space_id: spaceId });
    const snap = await lan.agent.get(`/api/v1/spaces/${spaceId}/sync/snapshot`);
    expect(snap.status).toBe(200);
    expect(snap.body.access).toMatchObject({ roleKey: 'ADULT', representedMemberIds: [ok.body.member_id] });
    expect(snap.body.records.member.find((m: { id: string }) => m.id === ok.body.member_id)).toMatchObject({
      displayName: 'Cô Lan',
      linkedActorId: lan.actorId,
    });
  });

  it('lets exactly one of two concurrent approvals use a single-use invite', async () => {
    const inv = await createInvite(f.owner);
    const a = await newDevice();
    const b = await newDevice();
    const ra = (await requestJoin(a, inv.body.token)).body.request_id as string;
    const rb = (await requestJoin(b, inv.body.token)).body.request_id as string;
    const [x, y] = await Promise.all([approve(f.owner, ra), approve(f.adult, rb)]);
    const statuses = [x.status, y.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = x.status === 409 ? x : y;
    expect(loser.body.error.code).toBe('INVITE_INVALID');
    const [{ n }]: Array<{ n: string }> = await t.ds.query(
      'SELECT COUNT(*) n FROM memberships WHERE space_id = ? AND actor_id IN (?, ?)',
      [spaceId, a.actorId, b.actorId],
    );
    expect(Number(n)).toBe(1);
  });

  it('rechecks expiry at approval, blocks pending requests on revoke and needs members EDIT', async () => {
    const inv = await createInvite(f.owner, { max_uses: 5 });
    const lan = await newDevice();
    const rid = (await requestJoin(lan, inv.body.token)).body.request_id as string;

    const byChild = await approve(f.child, rid);
    expect(byChild.status).toBe(403);
    expect(byChild.body.error.code).toBe('FORBIDDEN');
    expect((await createInvite(f.child)).status).toBe(403);

    await t.ds.query('UPDATE invites SET expires_at = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE WHERE id = ?', [inv.body.invite_id]);
    const late = await approve(f.owner, rid);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('INVITE_INVALID');
    expect((await lan.agent.get(`/api/v1/join-requests/${rid}`)).body).toEqual({ status: 'EXPIRED' });

    const inv2 = await createInvite(f.owner, { max_uses: 5 });
    const other = await newDevice();
    const rid2 = (await requestJoin(other, inv2.body.token)).body.request_id as string;
    const revoked = await f.owner.agent
      .post(`/api/v1/spaces/${spaceId}/invites/${inv2.body.invite_id}/revoke`)
      .set('X-CSRF-Token', f.owner.csrf)
      .send({});
    expect(revoked.status).toBe(200);
    expect(revoked.body).toMatchObject({ invite_id: inv2.body.invite_id, status: 'REVOKED' });
    expect((await other.agent.get(`/api/v1/join-requests/${rid2}`)).body).toEqual({ status: 'REJECTED' });
    expect((await approve(f.owner, rid2)).status).toBe(409);
    expect((await requestJoin(await newDevice(), inv2.body.token)).body.error.code).toBe('INVITE_INVALID');

    const list = await f.owner.agent.get(`/api/v1/spaces/${spaceId}/invites`);
    expect(list.body.invites.map((i: { status: string }) => i.status).sort()).toEqual(['EXPIRED', 'REVOKED']);
    expect(JSON.stringify(list.body)).not.toContain(inv.body.token);
  });

  it('never stores or logs the token', async () => {
    const lines: string[] = [];
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation((...args: unknown[]) => void lines.push(args.map(String).join(' '))),
    );
    const write = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      lines.push(String(chunk));
      return true;
    });
    try {
      const inv = await createInvite(f.owner, { max_uses: 3 });
      const lan = await newDevice();
      const rid = (await requestJoin(lan, inv.body.token)).body.request_id as string;
      await approve(f.owner, rid);
      const token = inv.body.token as string;
      const audit: unknown[] = await t.ds.query('SELECT * FROM audit_events');
      expect(audit.length).toBeGreaterThan(0);
      expect(JSON.stringify(audit)).not.toContain(token);
      const stored: unknown[] = await t.ds.query('SELECT * FROM invites');
      expect(JSON.stringify(stored)).not.toContain(token);
      expect(lines.join('\n')).not.toContain(token);
    } finally {
      for (const s of spies) s.mockRestore();
      write.mockRestore();
    }
  });

  it('needs a guardian confirmation before a child joins a Group', async () => {
    const access = t.app.get(AccessService);
    const organizer = await newDevice();
    const group = await createSharedSpace(
      t.ds,
      access,
      { sessionId: randomUUID(), actorId: organizer.actorId, deviceId: organizer.deviceId, accountId: null },
      'GROUP',
    );
    // In the Family, the adult is the guardian of the child's member.
    await withTransaction(t.ds, (em) => access.addRepresentation(em, spaceId, f.adult.actorId, f.childMemberId, 'GUARDIAN'));

    const inv = await createInvite(organizer, { max_uses: 5 }, group.spaceId);
    expect(inv.status).toBe(201);
    const jr = await requestJoin(f.child, inv.body.token, { display_name: 'Bé An', proposed_profile: 'CHILD' });
    expect(jr.body.status).toBe('PENDING_GUARDIAN');

    const early = await approve(organizer, jr.body.request_id, { role_key: 'PARTICIPANT', new_member: undefined, member_id: undefined }, group.spaceId);
    expect(early.status).toBe(409);

    const inbox = await f.adult.agent.get('/api/v1/me/guardian-requests');
    expect(inbox.body.requests).toEqual([
      expect.objectContaining({ request_id: jr.body.request_id, display_name: 'Bé An', space_kind: 'GROUP' }),
    ]);
    expect((await f.owner.agent.get('/api/v1/me/guardian-requests')).body.requests).toEqual([]);

    const notGuardian = await f.owner.agent
      .post(`/api/v1/join-requests/${jr.body.request_id}/guardian-confirm`)
      .set('X-CSRF-Token', f.owner.csrf)
      .send({});
    expect(notGuardian.status).toBe(403);
    const confirm = await f.adult.agent
      .post(`/api/v1/join-requests/${jr.body.request_id}/guardian-confirm`)
      .set('X-CSRF-Token', f.adult.csrf)
      .send({});
    expect(confirm.status).toBe(200);
    expect(confirm.body).toEqual({ request_id: jr.body.request_id, status: 'PENDING' });

    const ok = await approve(
      organizer,
      jr.body.request_id,
      { role_key: 'PARTICIPANT', new_member: { display_name: 'Bé An', relationship: 'OTHER', profile: 'CHILD' } },
      group.spaceId,
    );
    expect(ok.status).toBe(200);
    expect((await f.child.agent.get(`/api/v1/spaces/${group.spaceId}/sync/snapshot`)).status).toBe(200);
  });

  it('validates approval input and links an existing member', async () => {
    const memberId = await insertMember(t.ds, spaceId, f.owner.actorId, 'SENIOR', 'Bà Nội');
    const inv = await createInvite(f.owner, { max_uses: 5, proposed_role: 'SENIOR' });
    expect(inv.status).toBe(201);
    const grandma = await newDevice();
    const rid = (await requestJoin(grandma, inv.body.token, { display_name: 'Bà', member_id: memberId })).body.request_id as string;

    const badRole = await approve(f.owner, rid, { role_key: 'NOPE', new_member: undefined, member_id: memberId });
    expect(badRole.status).toBe(422);
    expect(badRole.body.error.fields).toMatchObject({ role_key: 'NOT_IN_SPACE' });
    const both = await approve(f.owner, rid, { role_key: 'SENIOR', member_id: memberId });
    expect(both.status).toBe(422);
    const ownerGrant = await approve(f.adult, rid, { role_key: 'OWNER', new_member: undefined, member_id: memberId });
    expect(ownerGrant.status).toBe(403);
    const taken = await approve(f.owner, rid, { role_key: 'SENIOR', new_member: undefined, member_id: f.childMemberId });
    expect(taken.status).toBe(422);
    expect(taken.body.error.fields).toMatchObject({ member_id: 'ALREADY_LINKED' });

    const ok = await approve(f.owner, rid, { role_key: 'SENIOR', new_member: undefined, member_id: memberId });
    expect(ok.body).toEqual({ request_id: rid, status: 'APPROVED', member_id: memberId });

    const rejectMe = (await requestJoin(await newDevice(), inv.body.token)).body.request_id as string;
    const rej = await f.owner.agent
      .post(`/api/v1/spaces/${spaceId}/join-requests/${rejectMe}/reject`)
      .set('X-CSRF-Token', f.owner.csrf)
      .send({});
    expect(rej.body).toEqual({ request_id: rejectMe, status: 'REJECTED' });

    const already = await requestJoin(f.adult, inv.body.token);
    expect(already.status).toBe(422);
    expect(already.body.error.fields).toMatchObject({ token: 'ALREADY_MEMBER' });
  });
});
