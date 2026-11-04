import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AccessService } from '../../src/modules/access/access.service';
import { withTransaction } from '../../src/database/transaction';
import { FakeClock } from '../helpers/clock';
import { truncateAll } from '../helpers/db';
import { seedFamily, type Family } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';

const NOW = '2026-11-03T03:00:00.000Z';
describe('screen-time API (int)', () => {
  let t: TestApp;
  let f: Family;
  const clock = new FakeClock(NOW);
  const collector = '/api/v1/screen-time/collector';
  const root = () => `/api/v1/spaces/${f.space.spaceId}/screen-time`;
  const member = (id = f.childMemberId) => `${root()}/members/${id}`;
  const anon = () => request(t.app.getHttpServer());
  const summary = () => f.owner.agent.get(`${member()}/summary?from=2026-11-03&to=2026-11-03`);
  const pair = () =>
    f.owner.agent
      .post(`${member()}/pairings`)
      .set('X-CSRF-Token', f.owner.csrf)
      .send({ label: 'Máy của An', consent: true });
  const goal = (limit: number, version = 0) =>
    f.owner.agent
      .put(`${member()}/goal`)
      .set('X-CSRF-Token', f.owner.csrf)
      .send({ limit_minutes: limit, reminders_enabled: true, version });

  beforeAll(async () => {
    t = await createTestApp({ clock });
  });
  beforeEach(async () => {
    await truncateAll(t.ds);
    clock.set(NOW);
    f = await seedFamily(t.app, t.ds, '10.91.0');
  });
  afterAll(() => t.close());

  async function linked() {
    const pairing = await pair();
    expect(pairing.status).toBe(201);
    const link = await anon().post(`${collector}/link`).send({ code: pairing.body.code, consent: true });
    expect(link.status).toBe(201);
    const token = link.body.token as string;
    const active = await anon().put(`${collector}/state`).auth(token, { type: 'bearer' }).send({ state: 'ACTIVE' });
    expect(active.status).toBe(200);
    return { token, device: link.body.device_id as string, code: pairing.body.code as string };
  }

  function batch(overrides: Record<string, unknown> = {}) {
    return {
      batch_id: randomUUID(),
      time_zone: 'Asia/Ho_Chi_Minh',
      algorithm_version: 'android-events-v1',
      days: [
        {
          local_date: '2026-11-03',
          observed_from: NOW,
          captured_at: '2026-11-03T03:30:00.000Z',
          total_seconds: 1800,
          coverage: 'PARTIAL',
          apps: [{ package_name: 'com.example.app', label: 'Ứng dụng', seconds: 1800 }],
        },
      ],
      ...overrides,
    };
  }
  const ingest = (token: string, value = batch()) =>
    anon().post(`${collector}/batches`).auth(token, { type: 'bearer' }).send(value);

  it('keeps missing data distinct from observed zero and does not expose credentials', async () => {
    const { token } = await linked();
    const result = await summary();
    expect(result.status).toBe(200);
    expect(result.body.days[0]).toMatchObject({ total_seconds: null, coverage: 'UNKNOWN' });
    expect(JSON.stringify(result.body)).not.toContain(token);
    expect(JSON.stringify(result.body)).not.toContain('token_hash');
  });

  it('requires consent and consumes pairing codes once, storing only token hashes', async () => {
    const rejected = await f.owner.agent
      .post(`${member()}/pairings`)
      .set('X-CSRF-Token', f.owner.csrf)
      .send({ label: 'Máy', consent: false });
    expect(rejected.status).toBe(422);
    const { token, code } = await linked();
    expect((await anon().post(`${collector}/link`).send({ code, consent: true })).status).toBe(422);
    const rows = await t.ds.query('SELECT token_hash FROM screen_devices');
    expect(rows[0].token_hash).not.toBe(token);
    expect(rows[0].token_hash).toHaveLength(64);
  });

  it('rejects expired and unknown pairing codes', async () => {
    const result = await pair();
    clock.set('2026-11-03T03:11:00Z');
    expect((await anon().post(`${collector}/link`).send({ code: result.body.code, consent: true })).status).toBe(422);
    expect((await anon().post(`${collector}/link`).send({ code: 'FFFFFFFFFFFF', consent: true })).status).toBe(422);
  });

  it('authorizes each member and family, allowing subjects to view but not modify goals', async () => {
    expect((await f.child.agent.get(`${member()}/summary?from=2026-11-03&to=2026-11-03`)).status).toBe(200);
    expect((await f.child.agent.get(`${member(f.adultMemberId)}/summary?from=2026-11-03&to=2026-11-03`)).status).toBe(
      403,
    );
    expect((await f.adult.agent.get(`${member()}/summary?from=2026-11-03&to=2026-11-03`)).status).toBe(403);
    expect(
      (
        await f.child.agent
          .put(`${member()}/goal`)
          .set('X-CSRF-Token', f.child.csrf)
          .send({ limit_minutes: 60, reminders_enabled: true, version: 0 })
      ).status,
    ).toBe(403);
    const other = await seedFamily(t.app, t.ds, '10.92.0');
    expect((await other.owner.agent.get(`${member()}/summary?from=2026-11-03&to=2026-11-03`)).status).toBe(403);
    expect((await anon().get(`${member()}/summary?from=2026-11-03&to=2026-11-03`)).status).toBe(401);
  });

  it('accepts only device tokens on collector routes and cannot use them as web credentials', async () => {
    const { token } = await linked();
    expect((await anon().get(`${collector}/config`)).status).toBe(401);
    expect(
      (await anon().get(`${member()}/summary?from=2026-11-03&to=2026-11-03`).auth(token, { type: 'bearer' })).status,
    ).toBe(401);
  });

  it('ingests once, rejects a reused UUID with different content, and ignores older snapshots', async () => {
    const { token } = await linked();
    clock.set('2026-11-03T04:00:00Z');
    const value = batch();
    expect((await ingest(token, value)).body).toEqual({ accepted: 1, duplicate: false });
    expect((await ingest(token, value)).body).toEqual({ accepted: 0, duplicate: true });
    expect((await ingest(token, { ...value, days: [{ ...value.days[0], total_seconds: 900 }] })).status).toBe(409);
    expect(
      (
        await ingest(
          token,
          batch({
            days: [
              {
                ...value.days[0],
                captured_at: '2026-11-03T03:20:00Z',
                total_seconds: 600,
                apps: [{ package_name: 'com.example.app', label: 'Ứng dụng', seconds: 600 }],
              },
            ],
          }),
        )
      ).body.accepted,
    ).toBe(0);
    expect((await summary()).body.days[0].total_seconds).toBe(1800);
  });

  it('rejects future/negative durations, timezone mismatches and data before consent', async () => {
    const { token } = await linked();
    expect((await ingest(token)).status).toBe(422);
    clock.set('2026-11-03T04:00:00Z');
    expect((await ingest(token, batch({ time_zone: 'UTC' }))).status).toBe(422);
    const value = batch();
    value.days[0].total_seconds = -10;
    expect((await ingest(token, value)).status).toBe(422);
    const early = batch();
    early.days[0].observed_from = '2026-11-03T02:00:00Z';
    expect((await ingest(token, early)).status).toBe(422);
  });

  it('blocks uploads when permission is revoked and after unlinking', async () => {
    const { token, device } = await linked();
    clock.set('2026-11-03T04:00:00Z');
    expect(
      (await anon().put(`${collector}/state`).auth(token, { type: 'bearer' }).send({ state: 'PERMISSION_REVOKED' }))
        .status,
    ).toBe(200);
    expect((await ingest(token)).status).toBe(403);
    const unlink = await f.child.agent.delete(`${member()}/devices/${device}`).set('X-CSRF-Token', f.child.csrf);
    expect(unlink.status).toBe(204);
    expect((await anon().get(`${collector}/config`).auth(token, { type: 'bearer' })).status).toBe(401);
  });

  it('rechecks the grant owner membership on every collector request', async () => {
    const { token } = await linked();
    await t.ds.query("UPDATE memberships SET status = 'REMOVED' WHERE actor_id = ? AND space_id = ?", [
      f.owner.actorId,
      f.space.spaceId,
    ]);
    expect((await anon().get(`${collector}/config`).auth(token, { type: 'bearer' })).status).toBe(403);
  });

  it('supports assigned guardians without granting unrelated adult access', async () => {
    await withTransaction(t.ds, (em) =>
      t.app.get(AccessService).addRepresentation(em, f.space.spaceId, f.adult.actorId, f.childMemberId, 'GUARDIAN'),
    );
    expect((await f.adult.agent.get(`${member()}/summary?from=2026-11-03&to=2026-11-03`)).status).toBe(200);
  });

  it('validates goals and detects concurrent updates', async () => {
    expect((await goal(-10)).status).toBe(422);
    expect((await goal(120)).body.version).toBe(1);
    expect((await goal(180)).status).toBe(409);
    expect((await goal(180, 1)).body.version).toBe(2);
  });

  it('exports only authorized data and deletes usage, goals and all upload credentials', async () => {
    const { token } = await linked();
    clock.set('2026-11-03T04:00:00Z');
    await ingest(token);
    await goal(120);
    expect(
      (await f.child.agent.get(`${member()}/export?from=2026-11-03&to=2026-11-03`)).body.days[0].total_seconds,
    ).toBe(1800);
    expect(
      (await f.child.agent.delete(`${member()}/data`).set('X-CSRF-Token', f.child.csrf).send({ confirm: true })).status,
    ).toBe(204);
    const result = await summary();
    expect(result.body.devices).toEqual([]);
    expect(result.body.goal).toBeNull();
    expect(result.body.days[0].total_seconds).toBeNull();
    expect((await anon().get(`${collector}/config`).auth(token, { type: 'bearer' })).status).toBe(401);
    expect(await t.ds.query("SELECT action FROM audit_events WHERE action = 'screen.data.delete'")).toHaveLength(1);
  });

  it('does not notify on partial data', async () => {
    const { token } = await linked();
    clock.set('2026-11-03T04:00:00Z');
    await goal(10);
    await ingest(token);
    expect(await t.ds.query('SELECT * FROM screen_alerts')).toHaveLength(0);
  });

  it('deduplicates 80/100 percent alerts and hides them after family permissions change', async () => {
    const { token } = await linked();
    await t.ds.query("UPDATE screen_devices SET consent_at = '2026-11-02 17:00:00'");
    await goal(60);
    const send = async (seconds: number, minute: number) => {
      const at = `2026-11-03T04:${String(minute).padStart(2, '0')}:00.000Z`;
      clock.set(at);
      return ingest(
        token,
        batch({
          days: [
            {
              local_date: '2026-11-03',
              observed_from: '2026-11-02T17:00:00Z',
              captured_at: at,
              total_seconds: seconds,
              coverage: 'COMPLETE',
              apps: [{ package_name: 'com.example.app', label: 'Ứng dụng', seconds }],
            },
          ],
        }),
      );
    };
    expect((await send(3000, 0)).status).toBe(200);
    expect((await send(3060, 1)).status).toBe(200);
    expect((await send(3600, 2)).status).toBe(200);
    expect((await send(3660, 3)).status).toBe(200);
    const alerts: Array<{ threshold: number }> = await t.ds.query(
      'SELECT threshold FROM screen_alerts ORDER BY threshold',
    );
    expect(alerts.map((a) => Number(a.threshold))).toEqual([80, 100]);
    expect((await f.owner.agent.get('/api/v1/notifications')).body.notifications).toHaveLength(2);
    await t.ds.query('UPDATE memberships SET role_id = ? WHERE actor_id = ? AND space_id = ?', [
      f.space.roleIds.ADULT,
      f.owner.actorId,
      f.space.spaceId,
    ]);
    const hidden = await f.owner.agent.get('/api/v1/notifications');
    expect(hidden.status).toBe(200);
    expect(hidden.body.notifications).toEqual([]);
    expect(hidden.body.unread_count).toBe(0);
  });
});
