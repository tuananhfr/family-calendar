import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AccessService } from '../../src/modules/access/access.service';
import { withTransaction } from '../../src/database/transaction';
import { FakeClock } from '../helpers/clock';
import { truncateAll } from '../helpers/db';
import type { RegisteredDevice } from '../helpers/session';
import { itemPayload, op, seedFamily, sendOps, type Family } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';

const NOW = '2026-10-07T03:00:00.000Z';
const TOKEN_URL = /^http:\/\/127\.0\.0\.1:3007\/api\/v1\/ics\/([A-Za-z0-9_-]{43})\.ics$/;

function post(dev: RegisteredDevice, path: string, body: Record<string, unknown>) {
  return dev.agent.post(path).set('X-CSRF-Token', dev.csrf).send(body);
}

/** Unfolds RFC 5545 continuation lines so assertions can match whole properties. */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, '');
}

describe('ICS subscription feed (int)', () => {
  const clock = new FakeClock(NOW);
  let t: TestApp;
  let f: Family;
  let spaceId: string;

  beforeAll(async () => {
    t = await createTestApp({ clock });
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    clock.set(NOW);
    f = await seedFamily(t.app, t.ds, '10.86.0');
    spaceId = f.space.spaceId;
  });

  afterAll(() => t.close());

  const feeds = (sid = spaceId) => `/api/v1/spaces/${sid}/ics-feeds`;
  const anonymous = () => request(t.app.getHttpServer());

  async function addItem(dev: RegisteredDevice, overrides: Record<string, unknown>): Promise<string> {
    const payload = itemPayload(spaceId, dev.actorId, overrides);
    const res = await sendOps(dev, spaceId, [
      op({ resource_type: 'item', resource_id: payload.id, action: 'create', payload }),
    ]);
    expect(res.body.results[0].status).toBe('APPLIED');
    return payload.id;
  }

  async function createFeed(body: Record<string, unknown> = {}): Promise<{ id: string; url: string; token: string }> {
    const res = await post(f.owner, feeds(), body);
    expect(res.status).toBe(201);
    const match = TOKEN_URL.exec(res.body.url as string);
    expect(match).not.toBeNull();
    return { id: res.body.id as string, url: res.body.url as string, token: match![1] };
  }

  it('stores only a hash of the token and serves the feed without a session', async () => {
    const feed = await createFeed({ label: 'Google Calendar' });
    const rows: Array<Record<string, unknown>> = await t.ds.query('SELECT * FROM ics_feeds');
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(createHash('sha256').update(feed.token).digest('hex'));
    expect(JSON.stringify(rows)).not.toContain(feed.token);

    const res = await anonymous().get(`/api/v1/ics/${feed.token}.ics`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/calendar; charset=utf-8/);
    expect(res.headers['cache-control']).toBe('private, max-age=900');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  });

  it('contains only NORMAL items shared with the whole family, and hides children unless enabled', async () => {
    await addItem(f.owner, {
      title: 'Họp phụ huynh',
      memberIds: [f.childMemberId],
      responsibleMemberId: f.adultMemberId,
    });
    await addItem(f.owner, { title: 'Quà bí mật', sharingScope: 'PRIVATE' });
    await addItem(f.owner, { title: 'Chuyện người lớn', sharingScope: 'PARENTS_SENIORS' });
    await addItem(f.owner, {
      kind: 'REMINDER',
      preset: 'MEDICATION',
      category: 'HEALTH',
      dataClass: 'SENSITIVE',
      title: 'Thuốc huyết áp',
    });
    await addItem(f.owner, { title: 'Khám răng định kỳ', category: 'HEALTH' });
    await addItem(f.owner, { title: 'Ẩn khỏi lịch', showOnCalendar: false });

    const hidden = await createFeed();
    const body = unfold((await anonymous().get(`/api/v1/ics/${hidden.token}.ics`)).text);
    expect(body).toContain('SUMMARY:Họp phụ huynh\r\n');
    for (const text of ['Quà bí mật', 'người lớn', 'huyết áp', 'Khám răng', 'Ẩn khỏi lịch']) {
      expect(body).not.toContain(text);
    }
    expect(body).toContain('Mẹ');
    expect(body).not.toContain('Bé An');
    expect(body).toContain('DTSTART:20261010T010000Z\r\n');

    const named = await createFeed({ include_child_names: true });
    expect(unfold((await anonymous().get(`/api/v1/ics/${named.token}.ics`)).text)).toContain('Bé An');
  });

  it('expands lunar repeats into dated events for three years', async () => {
    await addItem(f.owner, {
      title: 'Giỗ ông',
      kind: 'EVENT',
      preset: 'DEATH_ANNIVERSARY',
      category: 'FAMILY',
      calendarSystem: 'LUNAR',
      schedule: {
        allDay: true,
        start: '2026-08-27',
        timeZone: 'Asia/Ho_Chi_Minh',
        lunarRule: { freq: 'YEARLY', month: 7, day: 15, includeLeap: false },
      },
    });
    const feed = await createFeed();
    const body = unfold((await anonymous().get(`/api/v1/ics/${feed.token}.ics`)).text);
    // 15/7 âm lịch (Vu Lan): 2027-08-16, 2028-09-03, 2029-08-24; 2026-08-27 is before the window.
    expect(body.match(/SUMMARY:Giỗ ông/g)).toHaveLength(3);
    for (const d of ['20270816', '20280903', '20290824']) expect(body).toContain(`DTSTART;VALUE=DATE:${d}\r\n`);
  });

  it('stops serving a revoked feed, an unknown token, or a feed whose creator left', async () => {
    const feed = await createFeed();
    const del = await f.owner.agent.delete(`${feeds()}/${feed.id}`).set('X-CSRF-Token', f.owner.csrf);
    expect(del.status).toBe(204);
    const gone = await anonymous().get(`/api/v1/ics/${feed.token}.ics`);
    expect(gone.status).toBe(404);
    expect(gone.body.error.code).toBe('NOT_FOUND');
    expect((await anonymous().get(`/api/v1/ics/${'a'.repeat(43)}.ics`)).status).toBe(404);

    // The adult may manage feeds too (backup EDIT); once removed from the family, their links stop.
    const adultFeed = await post(f.adult, feeds(), {});
    expect(adultFeed.status).toBe(201);
    const token = TOKEN_URL.exec(adultFeed.body.url as string)![1];
    expect((await anonymous().get(`/api/v1/ics/${token}.ics`)).status).toBe(200);
    const access = t.app.get(AccessService);
    await withTransaction(t.ds, (em) => access.removeMembership(em, spaceId, f.adult.actorId));
    expect((await anonymous().get(`/api/v1/ics/${token}.ics`)).status).toBe(404);
  });

  it('lets only people with backup EDIT create or revoke feeds, in a Space the server holds', async () => {
    const child = await post(f.child, feeds(), {});
    expect(child.status).toBe(403);
    const unknown = await post(f.owner, feeds(randomUUID()), {});
    expect(unknown.status).toBe(404);
    const feed = await createFeed();
    const revoke = await f.child.agent.delete(`${feeds()}/${feed.id}`).set('X-CSRF-Token', f.child.csrf);
    expect(revoke.status).toBe(403);
    const missing = await f.owner.agent.delete(`${feeds()}/${randomUUID()}`).set('X-CSRF-Token', f.owner.csrf);
    expect(missing.status).toBe(404);
  });

  it('reports integration status: five services not connected, ICS available, feeds without tokens', async () => {
    const feed = await createFeed({ label: 'Điện thoại của bố' });
    await anonymous().get(`/api/v1/ics/${feed.token}.ics`);
    const res = await f.owner.agent.get(`/api/v1/spaces/${spaceId}/integrations`);
    expect(res.status).toBe(200);
    const byProvider = new Map(
      (res.body.integrations as Array<{ provider: string; status: string; can_connect: boolean; message: string }>).map(
        (i) => [i.provider, i],
      ),
    );
    expect([...byProvider.keys()].sort()).toEqual(
      ['GMAIL', 'GOOGLE_CALENDAR', 'GOOGLE_DRIVE', 'OPEN_API', 'SMS', 'ZALO'].sort(),
    );
    for (const p of ['GMAIL', 'GOOGLE_CALENDAR', 'GOOGLE_DRIVE', 'SMS', 'ZALO']) {
      expect(byProvider.get(p)).toMatchObject({
        status: 'NOT_CONFIGURED',
        can_connect: false,
        message: 'Chưa kết nối — cần quản trị máy chủ cấu hình.',
      });
    }
    expect(byProvider.get('OPEN_API')).toMatchObject({ status: 'AVAILABLE' });
    expect(res.body.can_manage_ics).toBe(true);
    expect(res.body.ics_feeds).toEqual([
      expect.objectContaining({
        id: feed.id,
        label: 'Điện thoại của bố',
        include_child_names: false,
        last_used_at: NOW,
      }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain(feed.token);

    const child = await f.child.agent.get(`/api/v1/spaces/${spaceId}/integrations`);
    expect(child.status).toBe(403);
  });
});
