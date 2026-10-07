import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { truncateAll } from '../helpers/db';
import { registerDevice, type RegisteredDevice } from '../helpers/session';
import { itemPayload, op, seedFamily, sendOps, type Family } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';

const MAIL_DIR = process.env.MAIL_DIR ?? 'var/test-mail';

function cookieValue(setCookie: string[] | string | undefined, name: string): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const line = list.find((c) => c.startsWith(`${name}=`));
  if (!line) throw new Error(`cookie ${name} not set`);
  return decodeURIComponent(line.slice(name.length + 1).split(';')[0]);
}

function latestMail(): string {
  const files = readdirSync(MAIL_DIR).filter((f) => f.endsWith('.eml')).sort();
  if (files.length === 0) throw new Error('no mail written');
  return readFileSync(join(MAIL_DIR, files[files.length - 1]), 'utf8');
}

function tokenFrom(mail: string): string {
  // Quoted-printable may wrap long lines with "=\n" and encode "=" as "=3D".
  const flat = mail.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
  const m = /\/xac-thuc\/\?token=([A-Za-z0-9_-]+)/.exec(flat);
  if (!m) throw new Error('no link in mail');
  return m[1];
}

describe('recovery codes and email accounts (int)', () => {
  let t: TestApp;
  let f: Family;
  let spaceId: string;
  const logged: string[] = [];
  let spies: jest.SpyInstance[] = [];

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    rmSync(MAIL_DIR, { recursive: true, force: true });
    mkdirSync(MAIL_DIR, { recursive: true });
    f = await seedFamily(t.app, t.ds, '10.60.0');
    spaceId = f.space.spaceId;
    logged.length = 0;
    spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(' '))),
    );
    spies.push(
      jest.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        logged.push(String(chunk));
        return true;
      }) as unknown as jest.SpyInstance,
    );
  });

  afterEach(() => {
    for (const s of spies) s.mockRestore();
  });

  afterAll(async () => {
    rmSync(MAIL_DIR, { recursive: true, force: true });
    await t.close();
  });

  function newCode(dev: RegisteredDevice) {
    return dev.agent.post(`/api/v1/spaces/${spaceId}/recovery-codes`).set('X-CSRF-Token', dev.csrf).send({});
  }

  function redeem(code: string, deviceId = randomUUID(), ip = '10.61.0.1', actorId?: string) {
    return request(t.app.getHttpServer())
      .post('/api/v1/recovery/redeem')
      .set('X-Forwarded-For', ip)
      .send({ code, device: { ...(actorId ? { actor_id: actorId } : {}), device_id: deviceId, label: 'Máy mới' } });
  }

  it('binds a new device to the actor of a recovery code, once, without opening other PRIVATE data', async () => {
    const ownerSecret = itemPayload(spaceId, f.owner.actorId, { sharingScope: 'PRIVATE', title: 'Bí mật của chủ' });
    const adultSecret = itemPayload(spaceId, f.adult.actorId, { sharingScope: 'PRIVATE', title: 'Ghi chú riêng' });
    await sendOps(f.owner, spaceId, [op({ resource_type: 'item', resource_id: ownerSecret.id, action: 'create', payload: ownerSecret })]);
    await sendOps(f.adult, spaceId, [op({ resource_type: 'item', resource_id: adultSecret.id, action: 'create', payload: adultSecret })]);

    const issued = await newCode(f.adult);
    expect(issued.status).toBe(201);
    const code = issued.body.code as string;
    expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){5}$/);
    // Issuing again rotates: only the newest code works.
    const rotated = (await newCode(f.adult)).body.code as string;
    expect((await redeem(code)).body.error.code).toBe('RECOVERY_INVALID');

    const deviceId = randomUUID();
    const res = await redeem(rotated.toLowerCase().replace(/-/g, ' '), deviceId, '10.61.0.2', f.adult.actorId);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ actor_id: f.adult.actorId, device_id: deviceId, code: expect.any(String) });
    expect(res.body.code).not.toBe(rotated);

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(cookieValue(setCookie, 'fc_csrf')).toBeTruthy();
    const cookieHeader = setCookie.map((c) => c.split(';')[0]).join('; ');
    const snap = await request(t.app.getHttpServer()).get(`/api/v1/spaces/${spaceId}/sync/snapshot`).set('Cookie', cookieHeader);
    expect(snap.status).toBe(200);
    expect(snap.body.access.actorId).toBe(f.adult.actorId);
    const ids = snap.body.records.item.map((r: { id: string }) => r.id);
    expect(ids).toContain(adultSecret.id);
    expect(ids).not.toContain(ownerSecret.id);

    const reuse = await redeem(rotated, randomUUID(), '10.61.0.3');
    expect(reuse.status).toBe(422);
    expect(reuse.body.error.code).toBe('RECOVERY_INVALID');
    const wrongActor = await redeem(res.body.code as string, randomUUID(), '10.61.0.4', f.owner.actorId);
    expect(wrongActor.body.error.code).toBe('RECOVERY_INVALID');

    const audit: unknown[] = await t.ds.query("SELECT * FROM audit_events WHERE action = 'recovery.redeem'");
    expect(audit).toHaveLength(1);
    const stored: unknown[] = await t.ds.query('SELECT * FROM recovery_credentials');
    expect(JSON.stringify(stored)).not.toContain(rotated);
  });

  it('limits redeem attempts per IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await redeem('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF', randomUUID(), '10.62.0.1')).status);
    expect(statuses.slice(0, 5)).toEqual([422, 422, 422, 422, 422]);
    expect(statuses[5]).toBe(429);
  });

  it('answers magic-link requests identically and links the actor with a single-use token', async () => {
    const send = (dev: RegisteredDevice, email: string) =>
      dev.agent.post('/api/v1/auth/magic-link').set('X-CSRF-Token', dev.csrf).send({ email });
    const fresh = await send(f.adult, 'me.lan@example.com');
    await t.ds.query(
      "INSERT INTO accounts (id, email, email_verified_at, created_at) VALUES (?, 'da.co@example.com', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))",
      [randomUUID()],
    );
    const known = await send(f.child, 'da.co@example.com');
    expect(fresh.status).toBe(202);
    expect(known.status).toBe(fresh.status);
    expect(known.body).toEqual(fresh.body);

    const mailFiles = readdirSync(MAIL_DIR).filter((x) => x.endsWith('.eml'));
    expect(mailFiles).toHaveLength(2);
    const mails = mailFiles.map((x) => readFileSync(join(MAIL_DIR, x), 'utf8'));
    const lanMail = mails.find((m) => m.includes('me.lan@example.com'))!;
    const token = tokenFrom(lanMail);
    expect(logged.join('\n')).toContain('magic link written to');
    expect(logged.join('\n')).not.toContain(token);

    const verify = (dev: RegisteredDevice, tok: string) =>
      dev.agent.post('/api/v1/auth/magic-link/verify').set('X-CSRF-Token', dev.csrf).send({ token: tok });
    const ok = await verify(f.adult, token);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ account_id: expect.any(String), email: 'me.lan@example.com', actor_id: f.adult.actorId });
    // UPGRADE: the actor keeps its id and its records.
    const [link]: Array<{ actor_id: string }> = await t.ds.query('SELECT actor_id FROM account_links WHERE account_id = ?', [
      ok.body.account_id,
    ]);
    expect(link.actor_id).toBe(f.adult.actorId);
    expect((await f.adult.agent.get(`/api/v1/spaces/${spaceId}/sync/snapshot`)).body.access.actorId).toBe(f.adult.actorId);

    const again = await verify(f.adult, token);
    expect(again.status).toBe(422);
    const stale = await send(f.owner, 'bo@example.com');
    expect(stale.status).toBe(202);
    const staleToken = tokenFrom(latestMail());
    await t.ds.query("UPDATE magic_link_tokens SET expires_at = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE WHERE email = 'bo@example.com'");
    expect((await verify(f.owner, staleToken)).status).toBe(422);

    const me = await f.adult.agent.get('/api/v1/account');
    expect(me.body).toEqual({ linked: true, email: 'me.lan@example.com', account_id: ok.body.account_id });
    const unlink = await f.adult.agent.post('/api/v1/account/unlink').set('X-CSRF-Token', f.adult.csrf).send({});
    expect(unlink.body).toEqual({ linked: false });
    expect((await f.adult.agent.get('/api/v1/account')).body).toEqual({ linked: false });
    // Unlinking never revokes devices.
    expect((await f.adult.agent.get(`/api/v1/spaces/${spaceId}/sync/snapshot`)).status).toBe(200);
  });

  it('emails invites to an address and lists them for the verified account', async () => {
    const send = await f.owner.agent
      .post('/api/v1/auth/magic-link')
      .set('X-CSRF-Token', f.owner.csrf)
      .send({ email: 'chu.nha@example.com' });
    expect(send.status).toBe(202);
    const guest = await registerDevice(t.app, { ip: '10.63.0.1' });
    await guest.agent.post('/api/v1/auth/magic-link').set('X-CSRF-Token', guest.csrf).send({ email: 'Khach@Example.com' });
    const guestToken = tokenFrom(latestMail());
    expect((await guest.agent.post('/api/v1/auth/magic-link/verify').set('X-CSRF-Token', guest.csrf).send({ token: guestToken })).status).toBe(200);

    const inv = await f.owner.agent
      .post(`/api/v1/spaces/${spaceId}/invites`)
      .set('X-CSRF-Token', f.owner.csrf)
      .send({ max_uses: 1, expires_in_hours: 24, approval_policy: 'APPROVAL_REQUIRED', email: 'khach@example.com' });
    expect(inv.status).toBe(201);
    const mail = latestMail();
    expect(mail).toContain('khach@example.com');
    expect(mail.replace(/=\r?\n/g, '').replace(/=3D/g, '=')).toContain(`/tham-gia/?token=${inv.body.token}`);
    expect(logged.join('\n')).not.toContain(inv.body.token);

    const list = await guest.agent.get('/api/v1/me/invitations');
    expect(list.body.invitations).toEqual([
      { invite_id: inv.body.invite_id, space_name: 'Nhà mình', space_kind: 'FAMILY', inviter_display_name: expect.any(String), expires_at: inv.body.expires_at },
    ]);
    expect((await f.child.agent.get('/api/v1/me/invitations')).body.invitations).toEqual([]);

    const accept = await guest.agent
      .post(`/api/v1/me/invitations/${inv.body.invite_id}/accept`)
      .set('X-CSRF-Token', guest.csrf)
      .send({ display_name: 'Khách' });
    expect(accept.status).toBe(201);
    expect(accept.body).toEqual({ request_id: expect.any(String), status: 'PENDING' });
    expect((await guest.agent.get('/api/v1/me/invitations')).body.invitations).toEqual([]);
    expect((await f.child.agent.post(`/api/v1/me/invitations/${inv.body.invite_id}/accept`).set('X-CSRF-Token', f.child.csrf).send({ display_name: 'X' })).status).toBe(404);

    const inv2 = await f.owner.agent
      .post(`/api/v1/spaces/${spaceId}/invites`)
      .set('X-CSRF-Token', f.owner.csrf)
      .send({ max_uses: 1, expires_in_hours: 24, approval_policy: 'APPROVAL_REQUIRED', email: 'khach@example.com' });
    const decline = await guest.agent.post(`/api/v1/me/invitations/${inv2.body.invite_id}/decline`).set('X-CSRF-Token', guest.csrf).send({});
    expect(decline.status).toBe(200);
    expect(decline.body).toEqual({ status: 'DECLINED' });
    expect((await guest.agent.get('/api/v1/me/invitations')).body.invitations).toEqual([]);
  });
});
