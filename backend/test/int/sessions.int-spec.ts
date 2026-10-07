import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { sha256Hex } from '../../src/common/crypto/tokens';
import { truncateAll } from '../helpers/db';
import { addDeviceForActor, cookieValue, registerDevice } from '../helpers/session';
import { createTestApp, type TestApp } from '../helpers/test-app';

describe('devices and sessions (int)', () => {
  let t: TestApp;
  let ipCounter = 0;
  // Each test uses its own client IP so the per-IP registration limit only bites in the rate-limit test.
  const nextIp = () => `10.0.0.${++ipCounter}`;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
  });

  afterAll(async () => {
    await t.close();
  });

  const server = () => t.app.getHttpServer();

  it('rejects an invalid registration body with field errors', async () => {
    const res = await request(server())
      .post('/api/v1/devices')
      .set('X-Forwarded-For', nextIp())
      .send({ actorId: 'not-a-uuid', deviceId: randomUUID() });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.fields.actorId).toEqual(expect.any(String));
  });

  it('registers a device with an HttpOnly Lax session cookie and stores only its hash', async () => {
    const actorId = randomUUID();
    const deviceId = randomUUID();
    const res = await request(server())
      .post('/api/v1/devices')
      .set('X-Forwarded-For', nextIp())
      .send({ actorId, deviceId, label: 'Điện thoại của Mẹ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ actorId, deviceId });

    const cookies: string[] = res.headers['set-cookie'] as unknown as string[];
    const sid = cookies.find((c) => c.startsWith('fc_sid='))!;
    expect(sid).toMatch(/; HttpOnly/);
    expect(sid).toMatch(/; SameSite=Lax/);
    expect(sid).toMatch(/; Path=\//);
    const csrfCookie = cookies.find((c) => c.startsWith('fc_csrf='))!;
    expect(csrfCookie).not.toMatch(/HttpOnly/);

    const token = cookieValue(cookies, 'fc_sid');
    expect(JSON.stringify(res.body)).not.toContain(token);
    const rows: Array<{ token_hash: string; actor_id: string; device_id: string }> = await t.ds.query(
      'SELECT token_hash, actor_id, device_id FROM sessions',
    );
    expect(rows).toEqual([{ token_hash: sha256Hex(token), actor_id: actorId, device_id: deviceId }]);
  });

  it('GET /session returns the context and csrf token; without a cookie it is AUTH_REQUIRED', async () => {
    const d = await registerDevice(t.app, { ip: nextIp() });
    const res = await d.agent.get('/api/v1/session');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ actorId: d.actorId, deviceId: d.deviceId, accountId: null, csrfToken: d.csrf });
    expect(res.headers['cache-control']).toBe('no-store');

    const anon = await request(server()).get('/api/v1/session');
    expect(anon.status).toBe(401);
    expect(anon.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('write routes require a matching X-CSRF-Token', async () => {
    const d = await registerDevice(t.app, { ip: nextIp() });
    const missing = await d.agent.post('/api/v1/session/logout');
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe('CSRF_INVALID');

    const wrong = await d.agent.post('/api/v1/session/logout').set('X-CSRF-Token', 'x'.repeat(43));
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe('CSRF_INVALID');

    const ok = await d.agent.post('/api/v1/session/logout').set('X-CSRF-Token', d.csrf);
    expect(ok.status).toBe(204);
    const after = await d.agent.get('/api/v1/session');
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects write requests from a foreign Origin even with a valid CSRF token', async () => {
    const d = await registerDevice(t.app, { ip: nextIp() });
    const res = await d.agent
      .post('/api/v1/session/logout')
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', d.csrf);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');

    const reg = await request(server())
      .post('/api/v1/devices')
      .set('Origin', 'https://evil.example')
      .set('X-Forwarded-For', nextIp())
      .send({ actorId: randomUUID(), deviceId: randomUUID() });
    expect(reg.status).toBe(403);

    const allowed = await d.agent
      .post('/api/v1/session/logout')
      .set('Origin', 'http://localhost:3006')
      .set('X-CSRF-Token', d.csrf);
    expect(allowed.status).toBe(204);
  });

  it('does not let another device claim an existing actor or device id', async () => {
    const d = await registerDevice(t.app, { ip: nextIp() });
    const sameActor = await request(server())
      .post('/api/v1/devices')
      .set('X-Forwarded-For', nextIp())
      .send({ actorId: d.actorId, deviceId: randomUUID() });
    expect(sameActor.status).toBe(409);
    expect(sameActor.body.error.code).toBe('ID_COLLISION');

    const sameDevice = await request(server())
      .post('/api/v1/devices')
      .set('X-Forwarded-For', nextIp())
      .send({ actorId: randomUUID(), deviceId: d.deviceId });
    expect(sameDevice.status).toBe(409);
    expect(sameDevice.body.error.code).toBe('ID_COLLISION');

    const [{ n }]: Array<{ n: string }> = await t.ds.query('SELECT COUNT(*) AS n FROM sessions');
    expect(Number(n)).toBe(1);
  });

  it('revoking device B from device A blocks B but keeps A working', async () => {
    const a = await registerDevice(t.app, { ip: nextIp() });
    const b = await addDeviceForActor(t.app, a.actorId);
    expect((await b.agent.get('/api/v1/session')).status).toBe(200);

    const list = await a.agent.get('/api/v1/devices');
    expect(list.status).toBe(200);
    const ids = (list.body.devices as Array<{ id: string; current: boolean }>).map((x) => [x.id, x.current]);
    expect(ids).toEqual(
      expect.arrayContaining([
        [a.deviceId, true],
        [b.deviceId, false],
      ]),
    );

    const revoke = await a.agent.post(`/api/v1/devices/${b.deviceId}/revoke`).set('X-CSRF-Token', a.csrf);
    expect(revoke.status).toBe(200);
    expect(revoke.body.status).toBe('REVOKED');

    const blocked = await b.agent.get('/api/v1/session');
    expect(blocked.status).toBe(401);
    expect(blocked.body.error.code).toBe('DEVICE_REVOKED');
    expect((await a.agent.get('/api/v1/session')).status).toBe(200);

    const audit: Array<{ action: string; resource_id: string }> = await t.ds.query(
      'SELECT action, resource_id FROM audit_events',
    );
    expect(audit).toEqual([{ action: 'device.revoke', resource_id: b.deviceId }]);
  });

  it('cannot revoke a device of another actor', async () => {
    const a = await registerDevice(t.app, { ip: nextIp() });
    const other = await registerDevice(t.app, { ip: nextIp() });
    const res = await a.agent.post(`/api/v1/devices/${other.deviceId}/revoke`).set('X-CSRF-Token', a.csrf);
    expect(res.status).toBe(404);
    expect((await other.agent.get('/api/v1/session')).status).toBe(200);
  });

  it('an expired session is SESSION_EXPIRED', async () => {
    const d = await registerDevice(t.app, { ip: nextIp() });
    await t.ds.query('UPDATE sessions SET expires_at = ?', [new Date(Date.now() - 60_000)]);
    const res = await d.agent.get('/api/v1/session');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('limits device registration to 20 per hour per IP', async () => {
    const ip = '203.0.113.7';
    for (let i = 0; i < 20; i++) {
      const ok = await request(server())
        .post('/api/v1/devices')
        .set('X-Forwarded-For', ip)
        .send({ actorId: randomUUID(), deviceId: randomUUID() });
      expect(ok.status).toBe(201);
    }
    const limited = await request(server())
      .post('/api/v1/devices')
      .set('X-Forwarded-For', ip)
      .send({ actorId: randomUUID(), deviceId: randomUUID() });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);

    const otherIp = await request(server())
      .post('/api/v1/devices')
      .set('X-Forwarded-For', '203.0.113.8')
      .send({ actorId: randomUUID(), deviceId: randomUUID() });
    expect(otherIp.status).toBe(201);

    const stored: Array<{ rate_key: string }> = await t.ds.query('SELECT rate_key FROM rate_limits');
    expect(JSON.stringify(stored)).not.toContain('203.0.113');
  });
});
