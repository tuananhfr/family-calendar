import { randomUUID } from 'node:crypto';
import { AccessService } from '../../src/modules/access/access.service';
import {
  WEB_PUSH_TRANSPORT,
  type WebPushOptions,
  type WebPushSubscription,
  type WebPushTransport,
} from '../../src/modules/delivery/channels/web-push.transport';
import { GENERIC_TITLE } from '../../src/modules/delivery/safe-message';
import { JobQueue } from '../../src/modules/jobs/job-queue';
import { WorkerLoop } from '../../src/modules/jobs/worker-loop';
import { FakeClock } from '../helpers/clock';
import { truncateAll } from '../helpers/db';
import type { RegisteredDevice } from '../helpers/session';
import { createSharedSpace } from '../helpers/spaces';
import { base, itemPayload, op, seedFamily, sendOps, type Family } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';

class FakeWebPush implements WebPushTransport {
  calls: Array<{ endpoint: string; payload: string; options: WebPushOptions }> = [];
  send(sub: WebPushSubscription, payload: string, options: WebPushOptions): Promise<{ statusCode: number }> {
    this.calls.push({ endpoint: sub.endpoint, payload, options });
    return Promise.resolve({ statusCode: 201 });
  }
}

const NOW = '2026-10-07T03:00:00.000Z';

describe('family SOS (int)', () => {
  const clock = new FakeClock(NOW);
  const push = new FakeWebPush();
  let t: TestApp;
  let f: Family;
  let spaceId: string;

  beforeAll(async () => {
    t = await createTestApp({ clock, overrides: [{ token: WEB_PUSH_TRANSPORT, value: push }] });
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    clock.set(NOW);
    push.calls = [];
    f = await seedFamily(t.app, t.ds, '10.82.0');
    spaceId = f.space.spaceId;
  });

  afterAll(() => t.close());

  const url = (sid: string, rest = '') => `/api/v1/spaces/${sid}/emergencies${rest}`;

  function trigger(dev: RegisteredDevice, body: Record<string, unknown> = {}, sid = spaceId) {
    return dev.agent
      .post(url(sid))
      .set('X-CSRF-Token', dev.csrf)
      .send({
        id: randomUUID(),
        client_triggered_at: '2026-10-07T02:59:58.000Z',
        lifecycle: 'ACTIVE',
        operation_id: randomUUID(),
        ...body,
      });
  }

  function post(dev: RegisteredDevice, path: string, body: Record<string, unknown>) {
    return dev.agent.post(path).set('X-CSRF-Token', dev.csrf).send(body);
  }

  async function sosJobs(): Promise<Array<{ status: string }>> {
    return t.ds.query("SELECT status FROM jobs WHERE type = 'SOS_ALERT'");
  }

  async function subscribe(dev: RegisteredDevice) {
    const res = await post(dev, '/api/v1/push-subscriptions', {
      endpoint: `https://push.example.com/send/${randomUUID()}`,
      keys: {
        p256dh: 'BJugQiA4lGi-qfs5T-LidKyWdU5mur5B0xlZODtkkH2m7ovJhHqgGBm3KBGNVWzE_tddSBuLLMGtc6U5liaB6_Y',
        auth: 'BwcHBwcHBwcHBwcHBwcHBw',
      },
      show_details: true,
    });
    expect(res.status).toBe(201);
  }

  it('turns five concurrent sends of one SOS into one event and one alert job (SOS-004)', async () => {
    const id = randomUUID();
    const body = { id, operation_id: randomUUID() };
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => trigger(f.owner, body)));
    for (const r of results) {
      expect([200, 201]).toContain(r.status);
      expect(r.body).toMatchObject({ id, lifecycle: 'ACTIVE', delivery: 'SERVER_ACCEPTED' });
    }
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await t.ds.query('SELECT id FROM emergency_events')).toHaveLength(1);
    expect(await sosJobs()).toHaveLength(1);
  });

  it('keeps both timestamps: when it happened on the phone and when the server got it', async () => {
    const res = await trigger(f.owner, { client_triggered_at: '2026-10-07T01:00:00.000Z' });
    expect(res.status).toBe(201);
    expect(res.body.client_triggered_at).toBe('2026-10-07T01:00:00.000Z');
    expect(res.body.server_received_at).toBe(NOW);
  });

  it('never reopens a closed SOS and never alerts for one that was closed before it reached the server', async () => {
    const id = randomUUID();
    const closed = await trigger(f.owner, {
      id,
      lifecycle: 'CLOSED_SAFE',
      closed_at: '2026-10-07T02:59:59.000Z',
    });
    expect(closed.status).toBe(201);
    expect(closed.body).toMatchObject({ id, lifecycle: 'CLOSED_SAFE', closed_at: '2026-10-07T02:59:59.000Z' });
    expect(await sosJobs()).toEqual([]);

    // The original ACTIVE create, retried late.
    const stale = await trigger(f.owner, { id });
    expect(stale.status).toBe(200);
    expect(stale.body.lifecycle).toBe('CLOSED_SAFE');
    expect(await sosJobs()).toEqual([]);

    const active = await trigger(f.owner);
    expect(active.status).toBe(201);
    const close = await post(f.owner, url(spaceId, `/${active.body.id}/close`), {
      operation_id: randomUUID(),
      lifecycle: 'CLOSED_ENDED',
      reason: 'Bấm nhầm',
    });
    expect(close.status).toBe(200);
    expect(close.body.lifecycle).toBe('CLOSED_ENDED');
    const retried = await trigger(f.owner, { id: active.body.id });
    expect(retried.body.lifecycle).toBe('CLOSED_ENDED');
    const reclose = await post(f.owner, url(spaceId, `/${active.body.id}/close`), {
      operation_id: randomUUID(),
      lifecycle: 'CLOSED_SAFE',
    });
    expect(reclose.body.lifecycle).toBe('CLOSED_ENDED');
    // Someone else may not close it.
    const foreign = await post(f.adult, url(spaceId, `/${(await trigger(f.owner)).body.id}/close`), {
      operation_id: randomUUID(),
      lifecycle: 'CLOSED_SAFE',
    });
    expect(foreign.status).toBe(403);
  });

  it('alerts current recipients first, with a generic push and in-app notice, and stops once closed', async () => {
    await subscribe(f.adult);
    await subscribe(f.child);
    // An older reminder reschedule is due too; the SOS still leases first.
    const med = itemPayload(spaceId, f.owner.actorId, { title: 'Họp' });
    await sendOps(f.owner, spaceId, [
      op({ resource_type: 'item', resource_id: med.id, action: 'create', payload: med }),
    ]);
    await sendOps(f.owner, spaceId, [
      op({
        resource_type: 'reminder_rule',
        resource_id: randomUUID(),
        action: 'create',
        payload: {
          ...base(spaceId, f.owner.actorId),
          itemId: med.id,
          offsetsMinutes: [0],
          channels: ['PUSH'],
          priority: 'HIGH',
          recipientMemberIds: [],
          enabled: true,
        },
      }),
    ]);
    const sos = await trigger(f.owner);
    expect(sos.status).toBe(201);
    await t.ds.query("UPDATE jobs SET run_at = ? WHERE type = 'RESCHEDULE_REMINDERS'", [
      new Date('2026-10-07T00:00:00.000Z'),
    ]);
    await t.ds.query("UPDATE jobs SET run_at = ? WHERE type = 'SOS_ALERT'", [new Date('2026-10-07T02:00:00.000Z')]);
    expect(await t.ds.query("SELECT id FROM jobs WHERE type = 'RESCHEDULE_REMINDERS'")).toHaveLength(1);
    const [first] = await t.app.get(JobQueue).leaseBatch('order-check', 1, 1000);
    expect(first.type).toBe('SOS_ALERT');
    await t.ds.query("UPDATE jobs SET status = 'SCHEDULED', lease_owner = NULL, attempts = 0 WHERE id = ?", [first.id]);

    await t.app.get(WorkerLoop).tick();
    // Default recipients: the other OWNER/ADULT members; the child (MEMBER) is not one.
    expect(push.calls).toHaveLength(1);
    const message = JSON.parse(push.calls[0].payload) as { title: string; body: string; data: Record<string, string> };
    expect(message.title).toBe(GENERIC_TITLE);
    expect(message.data).toMatchObject({ type: 'SOS', spaceId, eventId: sos.body.id });
    expect(push.calls[0].payload).not.toMatch(/lat|lng|latitude|longitude/i);
    expect(push.calls[0].options.urgency).toBe('high');
    const notices: Array<{ actor_id: string; type: string }> = await t.ds.query(
      "SELECT actor_id, type FROM notifications WHERE type = 'SOS'",
    );
    expect(notices).toEqual([{ actor_id: f.adult.actorId, type: 'SOS' }]);
    expect((await sosJobs()).map((j) => j.status)).toEqual(['DONE']);

    // A later retry of the job after "I am safe" sends nothing.
    await post(f.owner, url(spaceId, `/${sos.body.id}/close`), {
      operation_id: randomUUID(),
      lifecycle: 'CLOSED_SAFE',
    });
    await t.ds.query("UPDATE jobs SET status = 'SCHEDULED', run_at = ? WHERE type = 'SOS_ALERT'", [new Date(NOW)]);
    push.calls = [];
    await t.app.get(WorkerLoop).tick();
    expect(push.calls).toEqual([]);
  });

  it('lets only current recipients read, respond to and see the location of an SOS', async () => {
    const sos = await trigger(f.owner);
    const eid = sos.body.id as string;

    const loc = await post(f.owner, url(spaceId, `/${eid}/location`), {
      lat: 21.028511,
      lng: 105.804817,
      accuracy: 25,
      captured_at: '2026-10-07T02:59:50.000Z',
      provenance: 'CURRENT',
    });
    expect(loc.status).toBe(201);
    expect(
      (
        await post(f.adult, url(spaceId, `/${eid}/location`), {
          lat: 1,
          lng: 1,
          accuracy: 5,
          captured_at: NOW,
          provenance: 'CURRENT',
        })
      ).status,
    ).toBe(403);

    const seen = await f.adult.agent.get(url(spaceId, `/${eid}`));
    expect(seen.status).toBe(200);
    expect(seen.body).toMatchObject({
      id: eid,
      lifecycle: 'ACTIVE',
      server_received_at: NOW,
      last_location: {
        lat: 21.028511,
        lng: 105.804817,
        accuracy: 25,
        captured_at: '2026-10-07T02:59:50.000Z',
        received_at: NOW,
        provenance: 'CURRENT',
      },
      recipients: [{ member_id: f.adultMemberId, response: 'NONE', responded_at: null }],
    });
    expect((await f.child.agent.get(url(spaceId, `/${eid}`))).status).toBe(403);
    expect((await f.owner.agent.get(url(spaceId, `/${eid}`))).status).toBe(200);

    const opId = randomUUID();
    const ack = await post(f.adult, url(spaceId, `/${eid}/responses`), { operation_id: opId, kind: 'ACKNOWLEDGED' });
    expect(ack.status).toBe(200);
    const again = await post(f.adult, url(spaceId, `/${eid}/responses`), { operation_id: opId, kind: 'ACKNOWLEDGED' });
    expect(again.status).toBe(200);
    await post(f.adult, url(spaceId, `/${eid}/responses`), { operation_id: randomUUID(), kind: 'RESPONDING' });
    expect(
      (await post(f.child, url(spaceId, `/${eid}/responses`), { operation_id: randomUUID(), kind: 'RESPONDING' }))
        .status,
    ).toBe(403);
    expect(
      (await post(f.owner, url(spaceId, `/${eid}/responses`), { operation_id: randomUUID(), kind: 'RESPONDING' }))
        .status,
    ).toBe(403);
    const after = await f.owner.agent.get(url(spaceId, `/${eid}`));
    expect(after.body.recipients).toEqual([{ member_id: f.adultMemberId, response: 'RESPONDING', responded_at: NOW }]);
    const listed = await f.adult.agent.get(url(spaceId));
    expect(listed.body.emergencies.map((e: { id: string }) => e.id)).toEqual([eid]);

    // Taken off the recipient list: no longer reads the event or its location.
    const configured = await f.owner.agent
      .put(`/api/v1/spaces/${spaceId}/emergency-recipients`)
      .set('X-CSRF-Token', f.owner.csrf)
      .send({ member_ids: [f.childMemberId] });
    expect(configured.status).toBe(200);
    expect(configured.body).toEqual({ member_ids: [f.childMemberId], configured: true });
    expect((await f.adult.agent.get(url(spaceId, `/${eid}`))).status).toBe(403);
    expect((await f.adult.agent.get(url(spaceId))).body.emergencies).toEqual([]);

    await post(f.owner, url(spaceId, `/${eid}/close`), { operation_id: randomUUID(), lifecycle: 'CLOSED_SAFE' });
    const late = await post(f.owner, url(spaceId, `/${eid}/location`), {
      lat: 21,
      lng: 105,
      accuracy: 10,
      captured_at: NOW,
      provenance: 'LAST_KNOWN',
    });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('EMERGENCY_CLOSED');
  });

  it('manages the recipient list with members EDIT only, inside the Space', async () => {
    const initial = await f.child.agent.get(`/api/v1/spaces/${spaceId}/emergency-recipients`);
    expect(initial.status).toBe(200);
    expect(initial.body).toEqual({ member_ids: [f.adultMemberId], configured: false });
    const denied = await f.child.agent
      .put(`/api/v1/spaces/${spaceId}/emergency-recipients`)
      .set('X-CSRF-Token', f.child.csrf)
      .send({ member_ids: [f.childMemberId] });
    expect(denied.status).toBe(403);
    const foreign = await f.owner.agent
      .put(`/api/v1/spaces/${spaceId}/emergency-recipients`)
      .set('X-CSRF-Token', f.owner.csrf)
      .send({ member_ids: [randomUUID()] });
    expect(foreign.status).toBe(422);
  });

  it('answers 404 for every SOS route of a GROUP Space', async () => {
    const group = await createSharedSpace(
      t.ds,
      t.app.get(AccessService),
      {
        sessionId: randomUUID(),
        actorId: f.owner.actorId,
        deviceId: f.owner.deviceId,
        accountId: null,
      },
      'GROUP',
    );
    const gid = group.spaceId;
    const eid = randomUUID();
    const responses = [
      await trigger(f.owner, {}, gid),
      await f.owner.agent.get(url(gid)),
      await f.owner.agent.get(url(gid, `/${eid}`)),
      await post(f.owner, url(gid, `/${eid}/responses`), { operation_id: randomUUID(), kind: 'ACKNOWLEDGED' }),
      await post(f.owner, url(gid, `/${eid}/close`), { operation_id: randomUUID(), lifecycle: 'CLOSED_SAFE' }),
      await post(f.owner, url(gid, `/${eid}/location`), {
        lat: 1,
        lng: 1,
        accuracy: 1,
        captured_at: NOW,
        provenance: 'CURRENT',
      }),
      await f.owner.agent.get(`/api/v1/spaces/${gid}/emergency-recipients`),
      await f.owner.agent
        .put(`/api/v1/spaces/${gid}/emergency-recipients`)
        .set('X-CSRF-Token', f.owner.csrf)
        .send({ member_ids: [] }),
    ];
    expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404, 404, 404]);
  });

  it('limits new SOS events to 10 per hour per device with an explicit 429, but still accepts retries', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await trigger(f.owner);
      expect(res.status).toBe(201);
      ids.push(res.body.id);
    }
    const blocked = await trigger(f.owner);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
    const retry = await trigger(f.owner, { id: ids[0] });
    expect(retry.status).toBe(200);
    expect(await t.ds.query('SELECT id FROM emergency_events')).toHaveLength(10);
  });
});
