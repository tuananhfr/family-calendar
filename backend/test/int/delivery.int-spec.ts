import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import request from 'supertest';
import { withTransaction } from '../../src/database/transaction';
import { AccessService } from '../../src/modules/access/access.service';
import { EmailChannel } from '../../src/modules/delivery/channels/email.channel';
import {
  WEB_PUSH_TRANSPORT,
  type WebPushOptions,
  type WebPushSubscription,
  type WebPushTransport,
} from '../../src/modules/delivery/channels/web-push.transport';
import { GENERIC_BODY, GENERIC_TITLE } from '../../src/modules/delivery/safe-message';
import { NotificationRunner } from '../../src/modules/reminders/notification-runner';
import { ReminderScheduler } from '../../src/modules/reminders/scheduler.service';
import { FakeClock } from '../helpers/clock';
import { truncateAll } from '../helpers/db';
import type { RegisteredDevice } from '../helpers/session';
import { base, itemPayload, op, seedFamily, sendOps, type Family } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';

declare const __setProcessTimeZone: (tz: string | undefined) => void;
declare const __getProcessTimeZone: () => string | undefined;

const TZ = 'Asia/Ho_Chi_Minh';
const SECRET = 'huyết áp';

class FakeWebPush implements WebPushTransport {
  calls: Array<{ endpoint: string; payload: string; options: WebPushOptions }> = [];
  status = 201;
  send(sub: WebPushSubscription, payload: string, options: WebPushOptions): Promise<{ statusCode: number }> {
    this.calls.push({ endpoint: sub.endpoint, payload, options });
    return Promise.resolve({ statusCode: this.status });
  }
}

interface JobRow {
  channel: string;
  status: string;
  last_error_code: string | null;
  target_device_id: string | null;
  scheduled_at: Date;
}

describe('delivery channels and notifications (int)', () => {
  const clock = new FakeClock('2026-10-07T00:30:00.000Z');
  const push = new FakeWebPush();
  const originalTz = __getProcessTimeZone();
  let t: TestApp;
  let f: Family;
  let spaceId: string;
  let scheduler: ReminderScheduler;
  let runner: NotificationRunner;

  beforeAll(async () => {
    __setProcessTimeZone('UTC');
    t = await createTestApp({ clock, overrides: [{ token: WEB_PUSH_TRANSPORT, value: push }] });
    scheduler = t.app.get(ReminderScheduler);
    runner = t.app.get(NotificationRunner);
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    clock.set('2026-10-07T00:30:00.000Z');
    push.calls = [];
    push.status = 201;
    f = await seedFamily(t.app, t.ds, '10.81.0');
    spaceId = f.space.spaceId;
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    __setProcessTimeZone(originalTz);
    await t.close();
  });

  function subscribe(dev: RegisteredDevice, body: Record<string, unknown>) {
    return dev.agent.post('/api/v1/push-subscriptions').set('X-CSRF-Token', dev.csrf).send(body);
  }

  function subscription(endpoint = `https://push.example.com/send/${randomUUID()}`, showDetails?: boolean) {
    return {
      endpoint,
      keys: {
        p256dh: 'BJugQiA4lGi-qfs5T-LidKyWdU5mur5B0xlZODtkkH2m7ovJhHqgGBm3KBGNVWzE_tddSBuLLMGtc6U5liaB6_Y',
        auth: 'BwcHBwcHBwcHBwcHBwcHBw',
      },
      ...(showDetails === undefined ? {} : { show_details: showDetails }),
    };
  }

  async function create(dev: RegisteredDevice, type: string, payload: { id: string }) {
    const res = await sendOps(dev, spaceId, [
      op({ resource_type: type, resource_id: payload.id, action: 'create', payload }),
    ]);
    expect(res.body.results[0].status).toBe('APPLIED');
  }

  function rule(actorId: string, itemId: string, overrides: Record<string, unknown> = {}) {
    return {
      ...base(spaceId, actorId),
      itemId,
      offsetsMinutes: [0],
      channels: ['PUSH'],
      priority: 'HIGH',
      recipientMemberIds: [f.adultMemberId],
      enabled: true,
      ...overrides,
    };
  }

  function medication() {
    return itemPayload(spaceId, f.owner.actorId, {
      kind: 'REMINDER',
      preset: 'MEDICATION',
      category: 'HEALTH',
      title: 'Thuốc huyết áp',
      dataClass: 'SENSITIVE',
      responsibleMemberId: f.adultMemberId,
      schedule: { allDay: false, start: '2026-10-01T07:00', timeZone: TZ, rrule: 'FREQ=DAILY' },
    });
  }

  function meeting(actorId: string, overrides: Record<string, unknown> = {}) {
    return itemPayload(spaceId, actorId, {
      title: 'Họp phụ huynh',
      responsibleMemberId: f.adultMemberId,
      schedule: { allDay: false, start: '2026-10-08T07:00', end: '2026-10-08T08:00', timeZone: TZ },
      ...overrides,
    });
  }

  function jobs(itemId: string): Promise<JobRow[]> {
    return t.ds.query(
      `SELECT channel, status, last_error_code, target_device_id, scheduled_at FROM notification_jobs
        WHERE item_id = ? AND scheduled_at <= ? ORDER BY CAST(channel AS CHAR)`,
      [itemId, clock.now()],
    );
  }

  async function runAll() {
    while ((await runner.runDue('worker-test', 50)) > 0);
  }

  /** Everything that could reach a log: console, raw stdout/stderr and every Nest Logger level. */
  function captureLogs(): () => string {
    const lines: string[] = [];
    const record = (...args: unknown[]) => {
      lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      jest.spyOn(console, level).mockImplementation(record);
    }
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(record);
    }
    jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      record(String(chunk));
      return true;
    });
    jest.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      record(String(chunk));
      return true;
    });
    return () => lines.join('\n');
  }

  it('keeps a medication name out of push, in-app, email and logs, and reports SMS as unsupported (PRV-001)', async () => {
    await t.ds.query("UPDATE members SET email = 'me@example.com' WHERE id = ?", [f.adultMemberId]);
    expect((await subscribe(f.adult, subscription(undefined, true))).status).toBe(201);
    const med = medication();
    await create(f.owner, 'item', med);
    await create(
      f.owner,
      'reminder_rule',
      rule(f.owner.actorId, med.id, { channels: ['PUSH', 'IN_APP', 'EMAIL', 'SMS'] }),
    );
    await scheduler.rescheduleItem(spaceId, med.id);
    const email = jest.spyOn(t.app.get(EmailChannel), 'send');
    const logs = captureLogs();

    // First attempt hits a push service error (logged, retried); the retry goes through.
    push.status = 500;
    clock.set('2026-10-08T00:00:30.000Z');
    await runAll();
    push.status = 201;
    clock.set('2026-10-08T00:05:00.000Z');
    await runAll();

    const rows = await jobs(med.id);
    expect(rows.map((r) => [r.channel, r.status])).toEqual([
      ['EMAIL', 'PUSH_SUBMITTED'],
      ['IN_APP', 'PUSH_SUBMITTED'],
      ['PUSH', 'PUSH_SUBMITTED'],
      ['SMS', 'UNSUPPORTED'],
    ]);
    expect(push.calls).toHaveLength(2);
    const message = JSON.parse(push.calls[1].payload) as Record<string, unknown>;
    expect(message).toMatchObject({ title: GENERIC_TITLE, body: GENERIC_BODY, data: { itemId: med.id } });
    expect(push.calls[1].options.TTL).toBe(3600);
    expect(push.calls[1].options.topic).toBe(message.tag);

    const [note]: Array<{ title_safe: string; actor_id: string }> = await t.ds.query(
      'SELECT title_safe, actor_id FROM notifications',
    );
    expect(note).toEqual({ title_safe: GENERIC_BODY, actor_id: f.adult.actorId });

    expect(email).toHaveBeenCalledTimes(1);
    expect(email.mock.calls[0][0]).toMatchObject({ to: 'me@example.com', subject: GENERIC_TITLE });

    const everything = [
      ...push.calls.map((c) => c.payload),
      JSON.stringify(push.calls.map((c) => c.options)),
      JSON.stringify(email.mock.calls),
      note.title_safe,
      logs(),
    ].join('\n');
    expect(logs()).not.toBe('');
    expect(everything).not.toContain(SECRET);
    expect(everything).not.toContain('Thuốc');
  });

  it('sends email only to a member with an address', async () => {
    const med = medication();
    await create(f.owner, 'item', med);
    await create(f.owner, 'reminder_rule', rule(f.owner.actorId, med.id, { channels: ['EMAIL'] }));
    await scheduler.rescheduleItem(spaceId, med.id);
    const email = jest.spyOn(t.app.get(EmailChannel), 'send');
    clock.set('2026-10-08T00:00:30.000Z');
    await runAll();
    expect(email).not.toHaveBeenCalled();
    expect((await jobs(med.id)).map((r) => r.status)).toEqual(['UNSUPPORTED']);
  });

  it('shows a title only on a device that chose details, and never to someone outside a private audience', async () => {
    const sub = subscription();
    const created = await subscribe(f.adult, sub);
    expect(created.status).toBe(201);
    // The owner guards the child, a recipient of the private item below, yet may not read that item.
    await withTransaction(t.ds, (em) =>
      t.app.get(AccessService).addRepresentation(em, spaceId, f.owner.actorId, f.childMemberId, 'GUARDIAN'),
    );
    await subscribe(f.owner, { ...subscription(), show_details: true });

    const first = meeting(f.owner.actorId);
    await create(f.owner, 'item', first);
    await create(f.owner, 'reminder_rule', rule(f.owner.actorId, first.id));
    await scheduler.rescheduleItem(spaceId, first.id);
    clock.set('2026-10-08T00:00:30.000Z');
    await runAll();
    expect(push.calls.map((c) => JSON.parse(c.payload).body)).toEqual([GENERIC_BODY]);

    // Same browser endpoint again: an update of the same subscription, not a second one.
    const again = await subscribe(f.adult, { ...sub, show_details: true });
    expect(again.status).toBe(201);
    expect(again.body.id).toBe(created.body.id);

    const second = meeting(f.owner.actorId, {
      schedule: { allDay: false, start: '2026-10-09T07:00', end: '2026-10-09T08:00', timeZone: TZ },
    });
    const secret = meeting(f.adult.actorId, {
      title: 'Quà sinh nhật bí mật',
      dataClass: 'PRIVATE',
      sharingScope: 'PRIVATE',
      schedule: { allDay: false, start: '2026-10-09T07:00', end: '2026-10-09T08:00', timeZone: TZ },
    });
    await create(f.owner, 'item', second);
    await create(f.owner, 'reminder_rule', rule(f.owner.actorId, second.id));
    await create(f.adult, 'item', secret);
    await create(
      f.adult,
      'reminder_rule',
      rule(f.adult.actorId, secret.id, { recipientMemberIds: [f.adultMemberId, f.childMemberId] }),
    );
    await scheduler.rescheduleItem(spaceId, second.id);
    await scheduler.rescheduleItem(spaceId, secret.id);
    push.calls = [];
    clock.set('2026-10-09T00:00:30.000Z');
    await runAll();
    expect(push.calls.every((c) => c.endpoint === sub.endpoint)).toBe(true);
    expect(push.calls.map((c) => JSON.parse(c.payload).body).sort()).toEqual(
      ['Họp phụ huynh', 'Quà sinh nhật bí mật'].sort(),
    );
  });

  it('drops a subscription the push service reports gone, and sends nothing to a revoked device', async () => {
    const created = await subscribe(f.adult, subscription());
    const med = medication();
    await create(f.owner, 'item', med);
    await create(f.owner, 'reminder_rule', rule(f.owner.actorId, med.id));
    await scheduler.rescheduleItem(spaceId, med.id);

    push.status = 410;
    clock.set('2026-10-08T00:00:30.000Z');
    await runAll();
    expect((await jobs(med.id)).map((r) => [r.status, r.last_error_code])).toEqual([['CANCELED', 'GONE']]);
    expect(await t.ds.query('SELECT id FROM push_subscriptions WHERE id = ?', [created.body.id])).toEqual([]);

    push.status = 201;
    expect((await subscribe(f.adult, subscription())).status).toBe(201);
    const revoked = await f.adult.agent
      .post(`/api/v1/devices/${f.adult.deviceId}/revoke`)
      .set('X-CSRF-Token', f.adult.csrf)
      .send({});
    expect(revoked.status).toBe(200);
    expect(await t.ds.query('SELECT id FROM push_subscriptions')).toEqual([]);
    push.calls = [];
    clock.set('2026-10-09T00:00:30.000Z');
    await runAll();
    expect(push.calls).toEqual([]);
  });

  it('validates push subscriptions, never returns the endpoint and lets only the owner delete one', async () => {
    const bad = [
      { ...subscription(), endpoint: 'http://push.example.com/x' },
      { ...subscription(), endpoint: 'https://localhost/x' },
      { ...subscription(), endpoint: 'https://10.0.0.5/x' },
      { ...subscription(), keys: { p256dh: 'not base64!', auth: 'x' } },
    ];
    for (const body of bad) {
      const res = await subscribe(f.adult, body);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    }

    const sub = subscription();
    const created = await subscribe(f.adult, sub);
    expect(created.body).toEqual({ id: created.body.id, show_details: false });
    const listed = await f.adult.agent.get('/api/v1/push-subscriptions');
    expect(listed.status).toBe(200);
    expect(listed.body.subscriptions).toEqual([
      expect.objectContaining({ id: created.body.id, current_device: true, show_details: false }),
    ]);
    expect(JSON.stringify(listed.body)).not.toContain('push.example.com');

    const foreign = await f.owner.agent
      .delete(`/api/v1/push-subscriptions/${created.body.id}`)
      .set('X-CSRF-Token', f.owner.csrf);
    expect(foreign.status).toBe(404);
    const own = await f.adult.agent
      .delete(`/api/v1/push-subscriptions/${created.body.id}`)
      .set('X-CSRF-Token', f.adult.csrf);
    expect(own.status).toBe(204);
    expect((await f.adult.agent.get('/api/v1/push-subscriptions')).body.subscriptions).toEqual([]);

    const meta = await request(t.app.getHttpServer()).get('/api/v1/meta');
    expect(meta.status).toBe(200);
    expect(meta.body).toMatchObject({
      api_version: 'v1',
      vapid_public_key: process.env.VAPID_PUBLIC_KEY,
      channels: { in_app: true, push: true, email: true, sms: false },
    });
  });

  it('lists only the caller’s notifications in active Spaces, pages them and marks them read', async () => {
    const insert = (actorId: string, minute: number) =>
      t.ds.query(
        `INSERT INTO notifications (id, actor_id, space_id, type, resource_ref, title_safe, created_at)
         VALUES (?, ?, ?, 'REMINDER_DUE', ?, ?, ?)`,
        [
          randomUUID(),
          actorId,
          spaceId,
          JSON.stringify({ item_id: randomUUID() }),
          `Nhắc ${minute}`,
          new Date(Date.UTC(2026, 9, 7, 0, minute)),
        ],
      );
    for (const m of [1, 2, 3]) await insert(f.adult.actorId, m);
    await insert(f.owner.actorId, 4);

    const page1 = await f.adult.agent.get('/api/v1/notifications?limit=2');
    expect(page1.status).toBe(200);
    expect(page1.body.unread_count).toBe(3);
    expect(page1.body.notifications.map((n: { title_safe: string }) => n.title_safe)).toEqual(['Nhắc 3', 'Nhắc 2']);
    expect(page1.body.notifications[0]).toMatchObject({
      space_id: spaceId,
      type: 'REMINDER_DUE',
      read_at: null,
      created_at: '2026-10-07T00:03:00.000Z',
    });
    const page2 = await f.adult.agent.get(
      `/api/v1/notifications?limit=2&cursor=${encodeURIComponent(page1.body.next_cursor)}`,
    );
    expect(page2.body.notifications.map((n: { title_safe: string }) => n.title_safe)).toEqual(['Nhắc 1']);
    expect(page2.body.next_cursor).toBeNull();

    const readOne = await f.adult.agent
      .post('/api/v1/notifications/read')
      .set('X-CSRF-Token', f.adult.csrf)
      .send({ ids: [page1.body.notifications[0].id] });
    expect(readOne.status).toBe(200);
    expect(readOne.body).toEqual({ unread_count: 2 });
    const empty = await f.adult.agent.post('/api/v1/notifications/read').set('X-CSRF-Token', f.adult.csrf).send({});
    expect(empty.status).toBe(422);
    // Someone else's id is ignored, not marked.
    const ownerList = await f.owner.agent.get('/api/v1/notifications');
    await f.adult.agent
      .post('/api/v1/notifications/read')
      .set('X-CSRF-Token', f.adult.csrf)
      .send({ ids: [ownerList.body.notifications[0].id] });
    expect((await f.owner.agent.get('/api/v1/notifications')).body.unread_count).toBe(1);
    const all = await f.adult.agent
      .post('/api/v1/notifications/read')
      .set('X-CSRF-Token', f.adult.csrf)
      .send({ all: true });
    expect(all.body).toEqual({ unread_count: 0 });

    await t.ds.query("UPDATE memberships SET status = 'REMOVED' WHERE actor_id = ?", [f.adult.actorId]);
    const gone = await f.adult.agent.get('/api/v1/notifications');
    expect(gone.body).toEqual({ notifications: [], next_cursor: null, unread_count: 0 });
  });
});
