import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { AutomationRunner } from '../../src/modules/ai/automations/automation.runner';
import { AI_PROVIDER } from '../../src/modules/ai/providers/ai-provider';
import { FakeAiProvider } from '../../src/modules/ai/providers/fake.provider';
import { FakeClock } from '../helpers/clock';
import { truncateAll } from '../helpers/db';
import type { RegisteredDevice } from '../helpers/session';
import { createSharedSpace } from '../helpers/spaces';
import { base, itemPayload, op, seedFamily, sendOps, type Family } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';
import { AccessService } from '../../src/modules/access/access.service';

// Wednesday 10:00 in Asia/Ho_Chi_Minh.
const NOW = '2026-10-07T03:00:00.000Z';

function post(dev: RegisteredDevice, path: string, body: Record<string, unknown>) {
  return dev.agent.post(path).set('X-CSRF-Token', dev.csrf).send(body);
}

describe('AI assistant (int)', () => {
  const clock = new FakeClock(NOW);
  const provider = new FakeAiProvider();
  let t: TestApp;
  let f: Family;
  let spaceId: string;

  beforeAll(async () => {
    t = await createTestApp({ clock, overrides: [{ token: AI_PROVIDER, value: provider }] });
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    clock.set(NOW);
    provider.reset();
    f = await seedFamily(t.app, t.ds, '10.83.0');
    spaceId = f.space.spaceId;
  });

  afterAll(() => t.close());

  const ai = (sid: string, rest: string) => `/api/v1/spaces/${sid}/ai/${rest}`;
  const consent = (dev: RegisteredDevice, allowHealth = false, sid = spaceId) =>
    post(dev, ai(sid, 'consent'), { accepted: true, allow_health: allowHealth });
  const ask = (dev: RegisteredDevice, text: string, extra: Record<string, unknown> = {}, sid = spaceId) =>
    post(dev, ai(sid, 'messages'), { text, ...extra });

  async function addItem(dev: RegisteredDevice, overrides: Record<string, unknown>): Promise<string> {
    const payload = itemPayload(spaceId, dev.actorId, overrides);
    const res = await sendOps(dev, spaceId, [
      op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload }),
    ]);
    expect(res.body.results[0].status).toBe('APPLIED');
    return payload.id;
  }

  it('answers 404 for a Space the server does not have (LOCAL_ONLY never reaches the server, AI-001)', async () => {
    const local = randomUUID();
    for (const res of [
      await consent(f.owner, false, local),
      await ask(f.owner, 'Xin chào', {}, local),
      await f.owner.agent.get(ai(local, 'conversations')),
      await f.owner.agent.get(ai(local, 'status')),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
    expect(provider.calls).toHaveLength(0);
  });

  it('needs the ai capability and an explicit consent before anything is sent', async () => {
    const child = await ask(f.child, 'Xin chào');
    expect(child.status).toBe(403);
    expect(child.body.error.code).toBe('FORBIDDEN');

    const before = await ask(f.owner, 'Xin chào');
    expect(before.status).toBe(403);
    expect(before.body.error.code).toBe('AI_CONSENT_REQUIRED');

    const status = await f.owner.agent.get(ai(spaceId, 'status'));
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ configured: true, consent: null });

    const given = await consent(f.owner);
    expect(given.status).toBe(200);
    expect(given.body).toMatchObject({ accepted: true, allow_health: false, accepted_at: NOW });
    expect((await f.owner.agent.get(ai(spaceId, 'status'))).body.consent).toMatchObject({ allow_health: false });
    // Consent is per person: the other adult has not agreed yet.
    expect((await ask(f.adult, 'Xin chào')).body.error.code).toBe('AI_CONSENT_REQUIRED');
    expect(provider.calls).toHaveLength(0);

    const withdrawn = await post(f.owner, ai(spaceId, 'consent'), { accepted: false, allow_health: false });
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body).toMatchObject({ accepted: false });
    expect((await ask(f.owner, 'Xin chào')).body.error.code).toBe('AI_CONSENT_REQUIRED');
  });

  it('returns drafts from tool calls and never writes an item itself', async () => {
    await consent(f.owner);
    const itemsBefore = await t.ds.query('SELECT COUNT(*) AS n FROM items');
    provider.script({
      text: 'Mình đã soạn một nhắc nhở, bạn kiểm tra rồi bấm Thêm nhé.',
      toolCalls: [
        {
          name: 'propose_item',
          input: {
            kind: 'REMINDER',
            preset: 'MEDICATION',
            title: 'Uống thuốc',
            date: '2026-10-08',
            time: '07:30',
            end_time: null,
            category: 'HEALTH',
            member_name: 'Mẹ',
            note: null,
          },
        },
        { name: 'delete_everything', input: {} },
      ],
    });
    const res = await ask(f.owner, 'Tạo nhắc nhở uống thuốc cho Mẹ');
    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Mình đã soạn một nhắc nhở, bạn kiểm tra rồi bấm Thêm nhé.');
    expect(res.body.drafts).toEqual([
      {
        type: 'ITEM',
        kind: 'REMINDER',
        preset: 'MEDICATION',
        title: 'Uống thuốc',
        date: '2026-10-08',
        time: '07:30',
        end_time: null,
        all_day: false,
        category: 'HEALTH',
        member_id: f.adultMemberId,
        member_name: 'Mẹ',
        note: null,
      },
    ]);
    expect(await t.ds.query('SELECT COUNT(*) AS n FROM items')).toEqual(itemsBefore);
    expect(provider.calls[0].tools.map((tool) => tool.name).sort()).toEqual([
      'propose_item',
      'propose_timetable',
      'summarize_period',
    ]);

    // The same conversation continues with its history; another person cannot append to it.
    const cid = res.body.conversation_id as string;
    provider.script({ text: 'Được.', toolCalls: [] });
    const next = await ask(f.owner, 'Cảm ơn', { conversation_id: cid });
    expect(next.status).toBe(200);
    expect(next.body.conversation_id).toBe(cid);
    expect(provider.calls[1].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    await consent(f.adult);
    const foreign = await ask(f.adult, 'Xem trộm', { conversation_id: cid });
    expect(foreign.status).toBe(404);

    const list = await f.owner.agent.get(ai(spaceId, 'conversations'));
    expect(list.status).toBe(200);
    expect(list.body.conversations).toHaveLength(1);
    expect(list.body.conversations[0]).toMatchObject({ id: cid, message_count: 4 });
    expect((await f.adult.agent.get(ai(spaceId, 'conversations'))).body.conversations).toEqual([]);
    const detail = await f.owner.agent.get(ai(spaceId, `conversations/${cid}`));
    expect(detail.status).toBe(200);
    expect(detail.body.messages.map((m: { role: string }) => m.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(detail.body.messages[1].drafts).toHaveLength(1);
    expect((await f.adult.agent.get(ai(spaceId, `conversations/${cid}`))).status).toBe(404);
  });

  it('sends only the minimal context: no SENSITIVE unless allowed, no PRIVATE of others', async () => {
    await addItem(f.owner, { title: 'Họp phụ huynh' });
    await addItem(f.owner, {
      kind: 'REMINDER',
      preset: 'MEDICATION',
      category: 'HEALTH',
      dataClass: 'SENSITIVE',
      sharingScope: 'PRIVATE',
      title: 'Thuốc huyết áp',
    });
    await addItem(f.owner, { title: 'Kế hoạch riêng của tôi', sharingScope: 'PRIVATE' });
    await addItem(f.adult, { title: 'Quà bí mật cho chồng', sharingScope: 'PRIVATE' });

    await consent(f.owner, false);
    expect((await ask(f.owner, 'Tuần này có gì?')).status).toBe(200);
    const sent = provider.calls[0].system;
    expect(sent).toContain('Họp phụ huynh');
    expect(sent).toContain('Kế hoạch riêng của tôi');
    expect(sent).toContain('Bé An');
    expect(sent).not.toContain('huyết áp');
    expect(sent).not.toContain('Quà bí mật');

    await consent(f.owner, true);
    await ask(f.owner, 'Còn gì nữa?');
    expect(provider.calls[1].system).toContain('Thuốc huyết áp');
    expect(provider.calls[1].system).not.toContain('Quà bí mật');
  });

  it('keeps the user text out of logs, also when the provider fails', async () => {
    await consent(f.owner);
    const lines: string[] = [];
    const capture = (...args: unknown[]) => {
      lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
    const spies = [
      jest.spyOn(Logger.prototype, 'log').mockImplementation(capture),
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(capture),
      jest.spyOn(Logger.prototype, 'error').mockImplementation(capture),
      jest.spyOn(Logger.prototype, 'debug').mockImplementation(capture),
    ];
    const marker = 'BÍ-MẬT-GIA-ĐÌNH-7731';
    try {
      expect((await ask(f.owner, `Nhắc ${marker}`)).status).toBe(200);
      provider.fail(new Error(`upstream echoed: ${marker}`));
      const failed = await ask(f.owner, `Lần nữa ${marker}`);
      expect(failed.status).toBe(503);
      expect(failed.body.error.code).toBe('TEMPORARILY_UNAVAILABLE');
    } finally {
      for (const s of spies) s.mockRestore();
    }
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).not.toContain(marker);
  });

  it('limits each person to 30 messages an hour', async () => {
    await consent(f.owner);
    for (let i = 0; i < 30; i++) expect((await ask(f.owner, `Câu ${i}`)).status).toBe(200);
    const limited = await ask(f.owner, 'Câu 31');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(provider.calls).toHaveLength(30);
  });

  it('works in a GROUP Space for an organizer', async () => {
    const access = t.app.get(AccessService);
    const group = await createSharedSpace(
      t.ds,
      access,
      { sessionId: randomUUID(), actorId: f.owner.actorId, deviceId: f.owner.deviceId, accountId: null },
      'GROUP',
    );
    await consent(f.owner, false, group.spaceId);
    expect((await ask(f.owner, 'Xin chào', {}, group.spaceId)).status).toBe(200);
  });
});

describe('AI automations (int)', () => {
  const clock = new FakeClock(NOW);
  let t: TestApp;
  let f: Family;
  let spaceId: string;

  beforeAll(async () => {
    t = await createTestApp({ clock, overrides: [{ token: AI_PROVIDER, value: new FakeAiProvider() }] });
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    clock.set(NOW);
    f = await seedFamily(t.app, t.ds, '10.84.0');
    spaceId = f.space.spaceId;
  });

  afterAll(() => t.close());

  async function addAutomation(
    ruleKey: string,
    params: Record<string, unknown> = {},
    dev: RegisteredDevice = f.owner,
  ): Promise<string> {
    const payload = { ...base(spaceId, dev.actorId), ruleKey, enabled: true, params };
    const res = await sendOps(dev, spaceId, [
      op({ resource_type: 'automation', resource_id: payload.id, action: 'create', payload }),
    ]);
    expect(res.body.results[0].status).toBe('APPLIED');
    return payload.id;
  }

  async function addItem(overrides: Record<string, unknown>): Promise<string> {
    const payload = itemPayload(spaceId, f.owner.actorId, overrides);
    const res = await sendOps(f.owner, spaceId, [
      op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload }),
    ]);
    expect(res.body.results[0].status).toBe('APPLIED');
    return payload.id;
  }

  const notifications = (): Promise<Array<{ actor_id: string; type: string; title_safe: string }>> =>
    t.ds.query("SELECT actor_id, type, title_safe FROM notifications WHERE type = 'AUTOMATION' ORDER BY actor_id");
  const run = () => t.app.get(AutomationRunner).runDue();

  it('sends the weekly summary on Sunday evening in the Space time zone, once per week', async () => {
    const automationId = await addAutomation('WEEKLY_SUMMARY');
    await addItem({ title: 'Họp phụ huynh', schedule: { allDay: false, start: '2026-10-13T08:00', timeZone: 'Asia/Ho_Chi_Minh' } });
    await addItem({
      title: 'Bí mật',
      sharingScope: 'PRIVATE',
      schedule: { allDay: false, start: '2026-10-14T08:00', timeZone: 'Asia/Ho_Chi_Minh' },
    });

    // Sunday 18:59 local: not yet.
    clock.set('2026-10-11T11:59:00.000Z');
    await run();
    expect(await notifications()).toEqual([]);

    // Sunday 19:05 local (12:05Z); a UTC-based check would think it is still early afternoon.
    clock.set('2026-10-11T12:05:00.000Z');
    await run();
    await run();
    const sent = await notifications();
    expect(sent.map((n) => n.actor_id).sort()).toEqual([f.owner.actorId, f.adult.actorId, f.child.actorId].sort());
    for (const n of sent) {
      expect(n.title_safe).toMatch(/^Tuần tới: \d+ lịch, \d+ nhắc nhở, \d+ việc cần làm\.$/);
      expect(n.title_safe).not.toContain('Họp');
    }
    // Counts follow what each person may read: the owner sees the private item, the adult does not.
    const byActor = new Map(sent.map((n) => [n.actor_id, n.title_safe]));
    expect(byActor.get(f.owner.actorId)).toBe('Tuần tới: 2 lịch, 0 nhắc nhở, 0 việc cần làm.');
    expect(byActor.get(f.adult.actorId)).toBe('Tuần tới: 1 lịch, 0 nhắc nhở, 0 việc cần làm.');

    clock.set('2026-10-11T16:30:00.000Z');
    await run();
    expect(await notifications()).toHaveLength(3);
    const runs: Array<{ status: string }> = await t.ds.query(
      'SELECT status FROM automation_runs WHERE automation_id = ?',
      [automationId],
    );
    expect(runs).toEqual([{ status: 'DONE' }]);
    const [automation]: Array<{ last_run_at: Date | null }> = await t.ds.query(
      'SELECT last_run_at FROM automations WHERE id = ?',
      [automationId],
    );
    expect(automation.last_run_at).not.toBeNull();

    // The following Sunday is a new week.
    clock.set('2026-10-18T12:05:00.000Z');
    await run();
    expect(await notifications()).toHaveLength(6);

    const history = await f.owner.agent.get(`/api/v1/spaces/${spaceId}/automations/runs`);
    expect(history.status).toBe(200);
    expect(history.body.runs).toHaveLength(2);
    expect(history.body.runs[0]).toMatchObject({ automation_id: automationId, rule_key: 'WEEKLY_SUMMARY', status: 'DONE' });
    expect((await f.child.agent.get(`/api/v1/spaces/${spaceId}/automations/runs`)).status).toBe(403);
  });

  it('does nothing for a disabled rule or a Space that is not shared yet', async () => {
    const id = await addAutomation('WEEKLY_SUMMARY');
    await t.ds.query('UPDATE automations SET enabled = 0 WHERE id = ?', [id]);
    clock.set('2026-10-11T12:05:00.000Z');
    await run();
    expect(await notifications()).toEqual([]);
    await t.ds.query('UPDATE automations SET enabled = 1 WHERE id = ?', [id]);
    await t.ds.query("UPDATE spaces SET sharing_state = 'INITIALIZING' WHERE id = ?", [spaceId]);
    await run();
    expect(await notifications()).toEqual([]);
  });

  it('reminds the person responsible N days before a payment, once, without the amount or title', async () => {
    await addAutomation('PAYMENT_DUE_REMINDER', { days_before: 3 });
    await addItem({
      kind: 'REMINDER',
      preset: 'PAYMENT',
      category: 'FINANCE',
      title: 'Tiền học Bé An',
      amount: 4500000,
      currency: 'VND',
      responsibleMemberId: f.adultMemberId,
      schedule: { allDay: true, start: '2026-10-14', timeZone: 'Asia/Ho_Chi_Minh' },
    });
    clock.set('2026-10-10T03:00:00.000Z');
    await run();
    expect(await notifications()).toEqual([]);
    clock.set('2026-10-11T03:00:00.000Z');
    await run();
    await run();
    const sent = await notifications();
    expect(sent).toEqual([{ actor_id: f.adult.actorId, type: 'AUTOMATION', title_safe: 'Sắp đến hạn thanh toán.' }]);
  });

  it('creates one review task three days before a child exam, through the normal write path', async () => {
    const examId = await addItem({
      title: 'Thi giữa kỳ Toán',
      category: 'STUDY',
      responsibleMemberId: f.childMemberId,
      schedule: { allDay: false, start: '2026-10-16T07:30', timeZone: 'Asia/Ho_Chi_Minh' },
    });
    await addItem({ title: 'Thi đấu cờ của bố', category: 'SPORT' });
    await addAutomation('EXAM_REVIEW_TASK', { days_before: 3 });
    await run();
    await run();
    const tasks: Array<{ title: string; start_local: string; kind: string; responsible_member_id: string; revision: string }> =
      await t.ds.query("SELECT title, start_local, kind, responsible_member_id, revision FROM items WHERE kind = 'TASK'");
    expect(tasks).toEqual([
      expect.objectContaining({
        title: 'Ôn bài: Thi giữa kỳ Toán',
        start_local: '2026-10-13',
        responsible_member_id: f.childMemberId,
      }),
    ]);
    // Written like any other change, so other devices pull it.
    const log: unknown[] = await t.ds.query(
      "SELECT resource_id FROM sync_changes WHERE space_id = ? AND resource_type = 'item'",
      [spaceId],
    );
    expect(log.length).toBeGreaterThanOrEqual(2);
    expect(examId).toBeDefined();
  });
});

describe('AI not configured (int)', () => {
  let t: TestApp;
  let f: Family;

  beforeAll(async () => {
    t = await createTestApp();
    await truncateAll(t.ds);
    f = await seedFamily(t.app, t.ds, '10.85.0');
  });

  afterAll(() => t.close());

  it('reports AI_NOT_CONFIGURED without an API key', async () => {
    const sid = f.space.spaceId;
    const status = await f.owner.agent.get(`/api/v1/spaces/${sid}/ai/status`);
    expect(status.body).toEqual({ configured: false, consent: null });
    await post(f.owner, `/api/v1/spaces/${sid}/ai/consent`, { accepted: true, allow_health: false });
    const res = await post(f.owner, `/api/v1/spaces/${sid}/ai/messages`, { text: 'Xin chào' });
    expect(res.status).toBe(503);
    expect(res.body.error).toEqual({ code: 'AI_NOT_CONFIGURED', message: 'Chưa cấu hình trợ lý.' });
  });
});

