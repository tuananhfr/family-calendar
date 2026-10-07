import { randomUUID } from 'node:crypto';
import { solarToLunar } from '../../src/modules/calendar/lunar/lunar';
import { SessionsService } from '../../src/modules/identity/sessions.service';
import {
  NOTIFICATION_DISPATCHER,
  type DispatchJob,
  type NotificationDispatcher,
} from '../../src/modules/reminders/dispatch';
import { NotificationRunner } from '../../src/modules/reminders/notification-runner';
import { ReminderScheduler } from '../../src/modules/reminders/scheduler.service';
import { JobQueue } from '../../src/modules/jobs/job-queue';
import { WorkerLoop } from '../../src/modules/jobs/worker-loop';
import { FakeClock } from '../helpers/clock';
import { truncateAll } from '../helpers/db';
import { base, itemPayload, op, seedFamily, sendOps, type Family } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';

declare const __setProcessTimeZone: (tz: string | undefined) => void;
declare const __getProcessTimeZone: () => string | undefined;

const TZ = 'Asia/Ho_Chi_Minh';

class RecordingDispatcher implements NotificationDispatcher {
  sent: DispatchJob[] = [];
  dispatch(job: DispatchJob): Promise<'SUBMITTED'> {
    this.sent.push(job);
    return Promise.resolve('SUBMITTED');
  }
}

interface JobRow {
  id: string;
  occurrence_key: string;
  rule_revision: string;
  target_device_id: string | null;
  trigger_offset: string;
  scheduled_at: Date;
  status: string;
}

describe('reminder scheduler (int)', () => {
  const clock = new FakeClock('2026-10-07T00:30:00.000Z');
  const dispatcher = new RecordingDispatcher();
  const originalTz = __getProcessTimeZone();
  let t: TestApp;
  let f: Family;
  let spaceId: string;
  let scheduler: ReminderScheduler;
  let runner: NotificationRunner;
  let adultSecondDevice: string;

  beforeAll(async () => {
    // The host clock zone must never leak into Vietnamese wall times.
    __setProcessTimeZone('UTC');
    t = await createTestApp({ clock, overrides: [{ token: NOTIFICATION_DISPATCHER, value: dispatcher }] });
    scheduler = t.app.get(ReminderScheduler);
    runner = t.app.get(NotificationRunner);
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    clock.set('2026-10-07T00:30:00.000Z');
    dispatcher.sent = [];
    f = await seedFamily(t.app, t.ds, '10.80.0');
    spaceId = f.space.spaceId;
    adultSecondDevice = randomUUID();
    await t.app
      .get(SessionsService)
      .createDeviceWithSession(f.adult.actorId, adultSecondDevice, { label: 'Máy tính bảng' });
  });

  afterAll(async () => {
    __setProcessTimeZone(originalTz);
    await t.close();
  });

  async function create(type: string, payload: { id: string }) {
    const res = await sendOps(f.owner, spaceId, [
      op({ resource_type: type, resource_id: payload.id, action: 'create', payload }),
    ]);
    expect(res.body.results[0].status).toBe('APPLIED');
  }

  function medication(overrides: Record<string, unknown> = {}) {
    return itemPayload(spaceId, f.owner.actorId, {
      kind: 'REMINDER',
      preset: 'MEDICATION',
      category: 'HEALTH',
      title: 'Thuốc huyết áp',
      dataClass: 'SENSITIVE',
      responsibleMemberId: f.adultMemberId,
      schedule: { allDay: false, start: '2026-10-01T07:00', timeZone: TZ, rrule: 'FREQ=DAILY' },
      ...overrides,
    });
  }

  function rule(itemId: string, overrides: Record<string, unknown> = {}) {
    return {
      ...base(spaceId, f.owner.actorId),
      itemId,
      offsetsMinutes: [0],
      channels: ['PUSH'],
      priority: 'HIGH',
      recipientMemberIds: [f.adultMemberId],
      enabled: true,
      ...overrides,
    };
  }

  function jobs(itemId: string): Promise<JobRow[]> {
    return t.ds.query(
      `SELECT id, occurrence_key, rule_revision, target_device_id, trigger_offset, scheduled_at, status
         FROM notification_jobs WHERE item_id = ? ORDER BY scheduled_at, target_device_id, status`,
      [itemId],
    );
  }

  const pending = (rows: JobRow[]) => rows.filter((r) => r.status === 'SCHEDULED');

  it('creates one job per day and receiving device over a 7-day horizon, idempotently, at 07:00 Vietnam time', async () => {
    const med = medication();
    await create('item', med);
    await create('reminder_rule', rule(med.id));

    await scheduler.rescheduleItem(spaceId, med.id);
    await scheduler.rescheduleItem(spaceId, med.id);
    const rows = await jobs(med.id);
    expect(rows).toHaveLength(7 * 2);
    expect(new Set(rows.map((r) => r.target_device_id))).toEqual(new Set([f.adult.deviceId, adultSecondDevice]));
    expect([...new Set(rows.map((r) => r.scheduled_at.toISOString()))]).toEqual(
      ['08', '09', '10', '11', '12', '13', '14'].map((d) => `2026-10-${d}T00:00:00.000Z`),
    );
  });

  it('replaces pending jobs when the rule changes and stops them for DONE, moves them for SNOOZE', async () => {
    const med = medication();
    const r = rule(med.id);
    await create('item', med);
    await create('reminder_rule', r);
    await scheduler.rescheduleItem(spaceId, med.id);

    const edited = await sendOps(f.owner, spaceId, [
      op({
        resource_type: 'reminder_rule',
        resource_id: r.id,
        action: 'update',
        base_revision: '1',
        payload: { ...r, offsetsMinutes: [15] },
      }),
    ]);
    expect(edited.body.results[0].status).toBe('APPLIED');
    await scheduler.rescheduleItem(spaceId, med.id);
    let rows = await jobs(med.id);
    expect(rows.filter((x) => x.rule_revision === '1').every((x) => x.status === 'CANCELED')).toBe(true);
    expect(pending(rows)).toHaveLength(14);
    expect(pending(rows).every((x) => x.rule_revision === '2' && x.trigger_offset === '15')).toBe(true);
    expect(pending(rows)[0].scheduled_at.toISOString()).toBe('2026-10-07T23:45:00.000Z');

    const state = (occurrenceKey: string, status: string, snoozeUntil: string | null = null) => {
      const id = randomUUID();
      return op({
        resource_type: 'occurrence_state',
        resource_id: id,
        action: 'occurrence_action',
        payload: {
          ...base(spaceId, f.adult.actorId, id),
          itemId: med.id,
          occurrenceKey,
          status,
          actedAt: clock.now().toISOString(),
          snoozeUntil,
        },
      });
    };
    const done = `${med.id}@2026-10-09T07:00`;
    const snoozed = `${med.id}@2026-10-10T07:00`;
    await sendOps(f.adult, spaceId, [state(done, 'DONE'), state(snoozed, 'SNOOZED', '2026-10-10T01:00:00.000Z')]);
    await scheduler.rescheduleItem(spaceId, med.id);
    rows = await jobs(med.id);
    expect(pending(rows).filter((x) => x.occurrence_key === done)).toEqual([]);
    const forSnoozed = pending(rows).filter((x) => x.occurrence_key === snoozed);
    expect(forSnoozed).toHaveLength(2);
    expect(forSnoozed.every((x) => x.trigger_offset === 'snooze@2026-10-10T01:00:00.000Z')).toBe(true);
    expect(forSnoozed[0].scheduled_at.toISOString()).toBe('2026-10-10T01:00:00.000Z');
    expect(pending(rows)).toHaveLength(14 - 2 - 2 + 2);
  });

  it('does not fire a backlog after downtime: late medication expires, a recent payment still goes out', async () => {
    const med = medication();
    await create('item', med);
    await create('reminder_rule', rule(med.id));
    const payment = itemPayload(spaceId, f.owner.actorId, {
      kind: 'REMINDER',
      preset: 'PAYMENT',
      category: 'FINANCE',
      title: 'Tiền điện',
      schedule: { allDay: true, start: '2026-10-10', timeZone: TZ },
    });
    await create('item', payment);
    await create('reminder_rule', rule(payment.id));
    await scheduler.rescheduleItem(spaceId, med.id);
    await scheduler.rescheduleItem(spaceId, payment.id);
    const [paymentJob] = await jobs(payment.id);
    // All-day reminders fire at 08:00 local, never at midnight.
    expect(paymentJob.scheduled_at.toISOString()).toBe('2026-10-10T01:00:00.000Z');

    // Three days later, 09:00 in Vietnam.
    clock.set('2026-10-10T02:00:00.000Z');
    while ((await runner.runDue('worker-test', 50)) > 0);
    const medRows = (await jobs(med.id)).filter((x) => x.scheduled_at <= clock.now());
    expect(medRows).toHaveLength(3 * 2);
    expect(medRows.every((x) => x.status === 'EXPIRED')).toBe(true);
    expect((await jobs(payment.id)).every((x) => x.status === 'PUSH_SUBMITTED')).toBe(true);
    expect(dispatcher.sent.map((j) => j.itemId)).toEqual([payment.id, payment.id]);
    // The payment stays open (Upcoming shows it) — nothing marked it done.
    const [{ n }]: Array<{ n: string }> = await t.ds.query(
      'SELECT COUNT(*) AS n FROM occurrence_states WHERE item_id = ?',
      [payment.id],
    );
    expect(Number(n)).toBe(0);
  });

  it('schedules a lunar rule on the right solar day', async () => {
    const target = '2026-10-10';
    const lunar = solarToLunar(target);
    const memorial = itemPayload(spaceId, f.owner.actorId, {
      kind: 'EVENT',
      preset: 'DEATH_ANNIVERSARY',
      category: 'FAMILY',
      title: 'Rằm',
      calendarSystem: 'LUNAR',
      schedule: {
        allDay: true,
        start: '2026-01-01',
        timeZone: TZ,
        lunarRule: { freq: 'MONTHLY', day: lunar.day, includeLeap: false },
      },
    });
    await create('item', memorial);
    await create('reminder_rule', rule(memorial.id, { offsetsMinutes: [0] }));
    await scheduler.rescheduleItem(spaceId, memorial.id);
    const rows = await jobs(memorial.id);
    expect(rows.map((r) => r.occurrence_key)).toEqual([`${memorial.id}@${target}`, `${memorial.id}@${target}`]);
    expect(rows[0].scheduled_at.toISOString()).toBe('2026-10-10T01:00:00.000Z');
  });

  it('runs RESCHEDULE_REMINDERS from the durable queue and keeps the horizon scan recurring', async () => {
    const med = medication();
    await create('item', med);
    await create('reminder_rule', rule(med.id));
    // The sync write enqueued a reschedule at wall-clock time; bring it to the fake clock.
    await t.ds.query("UPDATE jobs SET run_at = ? WHERE type = 'RESCHEDULE_REMINDERS'", [clock.now()]);
    await t.app
      .get(JobQueue)
      .ensure({
        type: 'REMINDER_HORIZON_SCAN',
        dedupeKey: 'REMINDER_HORIZON_SCAN:next',
        runAt: clock.now(),
        payload: {},
      });

    await t.app.get(WorkerLoop).tick();
    expect(pending(await jobs(med.id))).toHaveLength(14);
    const queue: Array<{ type: string; status: string; run_at: Date }> = await t.ds.query(
      'SELECT type, status, run_at FROM jobs ORDER BY id',
    );
    expect(queue.filter((j) => j.type === 'RESCHEDULE_REMINDERS').every((j) => j.status === 'DONE')).toBe(true);
    const scan = queue.find((j) => j.type === 'REMINDER_HORIZON_SCAN')!;
    expect(scan.status).toBe('SCHEDULED');
    expect(scan.run_at.toISOString()).toBe('2026-10-07T01:30:00.000Z');
  });

  it('cancels a job at dispatch time when its device was revoked meanwhile', async () => {
    const med = medication();
    await create('item', med);
    await create('reminder_rule', rule(med.id));
    await scheduler.rescheduleItem(spaceId, med.id);
    await t.ds.query("UPDATE devices SET status = 'REVOKED', revoked_at = UTC_TIMESTAMP(3) WHERE id = ?", [
      adultSecondDevice,
    ]);
    clock.set('2026-10-08T00:00:30.000Z');
    while ((await runner.runDue('worker-test', 50)) > 0);
    const due = (await jobs(med.id)).filter((x) => x.scheduled_at <= clock.now());
    expect(due.find((x) => x.target_device_id === adultSecondDevice)?.status).toBe('CANCELED');
    expect(due.find((x) => x.target_device_id === f.adult.deviceId)?.status).toBe('PUSH_SUBMITTED');
  });
});
