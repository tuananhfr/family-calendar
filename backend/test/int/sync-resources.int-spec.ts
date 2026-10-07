import { randomUUID } from 'node:crypto';
import { truncateAll } from '../helpers/db';
import { base, itemPayload, op, seedFamily, sendOps, type Family } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';

interface Result {
  status: 'APPLIED' | 'REJECTED';
  revision?: string;
  record?: Record<string, unknown> | null;
  error?: { code: string; fields?: Record<string, string> };
}

const FULL_MATRIX = {
  'calendar.view': 'VIEW',
  'calendar.create': 'EDIT',
  'calendar.delete': 'NONE',
  members: 'VIEW',
  groups: 'NONE',
  finance: 'NONE',
  health: 'NONE',
  timetable: 'VIEW',
  storage: 'VIEW',
  settings: 'NONE',
  backup: 'NONE',
  permissions: 'NONE',
  ai: 'NONE',
  'sos.trigger': 'EDIT',
};

// Server-owned or server-normalised keys that a round trip does not echo verbatim.
function comparable(payload: Record<string, unknown>): Record<string, unknown> {
  const { createdAt: _c, updatedAt: _u, ...rest } = payload;
  return rest;
}

describe('sync resource round trips (int)', () => {
  let t: TestApp;
  let f: Family;
  let spaceId: string;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    f = await seedFamily(t.app, t.ds, '10.20.0');
    spaceId = f.space.spaceId;
  });

  afterAll(async () => {
    await t.close();
  });

  async function one(operation: ReturnType<typeof op>): Promise<Result> {
    const res = await sendOps(f.owner, spaceId, [operation]);
    expect(res.status).toBe(200);
    return res.body.results[0] as Result;
  }

  /** create → update → delete, asserting the record echoes what was sent. */
  async function roundTrip(
    type: string,
    payload: Record<string, unknown>,
    edit: Record<string, unknown>,
    expected: Record<string, unknown> = {},
    deletable = true,
  ): Promise<void> {
    const id = payload.id as string;
    const created = await one(op({ resource_type: type, resource_id: id, action: 'create', payload }));
    expect({ type, error: created.error }).toEqual({ type, error: undefined });
    expect(created).toMatchObject({ status: 'APPLIED', revision: '1' });
    expect(created.record).toMatchObject({ ...comparable(payload), ...expected, revision: '1' });

    const changed = { ...payload, ...edit };
    const updated = await one(op({ resource_type: type, resource_id: id, action: 'update', base_revision: '1', payload: changed }));
    expect({ type, error: updated.error }).toEqual({ type, error: undefined });
    expect(updated).toMatchObject({ status: 'APPLIED', revision: '2' });
    expect(updated.record).toMatchObject({ ...comparable(changed), ...expected, revision: '2' });

    if (!deletable) return;
    const deleted = await one(op({ resource_type: type, resource_id: id, action: 'delete', base_revision: '2' }));
    expect({ type, error: deleted.error }).toEqual({ type, error: undefined });
    expect(deleted).toMatchObject({ status: 'APPLIED', revision: '3', record: null });
  }

  const b = (extra: Record<string, unknown> = {}) => base(spaceId, f.owner.actorId, randomUUID(), extra);

  async function createItem(overrides: Record<string, unknown> = {}): Promise<string> {
    const p = itemPayload(spaceId, f.owner.actorId, overrides);
    const r = await one(op({ resource_type: 'item', resource_id: p.id, action: 'create', payload: p }));
    expect(r.status).toBe('APPLIED');
    return p.id;
  }

  it('round-trips calendar resources', async () => {
    await roundTrip(
      'item',
      itemPayload(spaceId, f.owner.actorId, {
        kind: 'REMINDER',
        preset: 'PAYMENT',
        category: 'FINANCE',
        priority: 'HIGH',
        note: 'Tiền điện',
        amount: 450000,
        locationText: 'Nhà',
        schedule: { allDay: true, start: '2026-10-15', timeZone: 'Asia/Ho_Chi_Minh', rrule: 'FREQ=MONTHLY;BYMONTHDAY=15' },
        memberIds: [f.adultMemberId],
      }),
      { title: 'Đóng tiền điện tháng 10' },
      { amount: '450000' },
    );
    const lunar = itemPayload(spaceId, f.owner.actorId, {
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
    await roundTrip('item', lunar, { title: 'Giỗ ông' }, {}, true);

    const itemId = await createItem({ kind: 'TASK', preset: 'HOUSEWORK', category: 'HOUSEWORK', memberIds: [f.childMemberId] });
    const key = `${itemId}@2026-10-10T08:00`;
    await roundTrip(
      'item_exception',
      { ...b(), itemId, occurrenceKey: key, kind: 'OVERRIDE', override: { start: '2026-10-11T08:00', end: '2026-10-11T09:00' } },
      { override: { start: '2026-10-12T08:00', end: '2026-10-12T09:00', title: 'Dời lịch' } },
    );
    await roundTrip(
      'reminder_rule',
      {
        ...b(),
        itemId,
        offsetsMinutes: [0, 60],
        channels: ['IN_APP', 'PUSH'],
        priority: 'HIGH',
        recipientMemberIds: [f.childMemberId],
        enabled: true,
      },
      { offsetsMinutes: [15], offsetMonths: [1] },
    );
    const checklistItem = { ...b(), itemId, text: 'Lau nhà', position: 0 };
    await roundTrip('checklist_item', checklistItem, { text: 'Lau nhà bếp', position: 1 }, {}, false);
    await roundTrip(
      'checklist_state',
      { ...b(), itemId, checklistItemId: checklistItem.id, occurrenceKey: key, checked: true },
      { checked: false },
    );
    await roundTrip(
      'participation',
      { ...b(), itemId, occurrenceKey: null, memberId: f.childMemberId, response: 'YES' },
      { response: 'MAYBE' },
    );
    await roundTrip(
      'occurrence_state',
      {
        ...b(),
        itemId,
        occurrenceKey: key,
        status: 'SNOOZED',
        actedAt: '2026-10-10T01:00:00.000Z',
        actedByActorId: f.owner.actorId,
        snoozeUntil: '2026-10-10T02:00:00.000Z',
      },
      { status: 'DONE', snoozeUntil: null },
    );
  });

  it('round-trips finance resources with money as strings', async () => {
    const priv = { dataClass: 'PRIVATE' };
    const account = { ...b(priv), name: 'Ví tiền mặt', type: 'CASH', openingBalance: 2000000 };
    await roundTrip('finance_account', account, { name: 'Ví chính' }, { openingBalance: '2000000' }, false);
    const bank = { ...b(priv), name: 'Vietcombank', type: 'BANK', openingBalance: '0' };
    expect((await one(op({ resource_type: 'finance_account', resource_id: bank.id, action: 'create', payload: bank }))).status).toBe('APPLIED');
    await roundTrip(
      'finance_txn',
      { ...b(priv), type: 'TRANSFER', amount: 500000, category: 'TRANSFER', date: '2026-10-07', accountId: account.id, toAccountId: bank.id },
      { note: 'Gửi tiết kiệm' },
      { amount: '500000' },
    );
    await roundTrip(
      'finance_budget',
      { ...b(priv), month: '2026-10', category: 'FOOD', limitAmount: '6000000' },
      { limitAmount: '6500000' },
    );
    await roundTrip(
      'finance_saving',
      { ...b(priv), name: 'Sổ 12 tháng', bank: 'VCB', principal: 100000000, ratePercent: 5.5, startDate: '2026-01-31', termMonths: 1 },
      { termMonths: 13 },
      { principal: '100000000', ratePercent: 5.5 },
    );
    await roundTrip(
      'finance_loan',
      { ...b(priv), direction: 'LENT', counterparty: 'Chú Ba', principal: 10000000, startDate: '2026-09-01', dueDate: '2026-12-01', payments: [{ date: '2026-10-01', amount: '2000000' }] },
      { payments: [] },
      { principal: '10000000' },
    );
    const goal = { ...b(priv), name: 'Du lịch Đà Lạt', targetAmount: 15000000, deadline: '2027-06-01', contributions: [{ date: '2026-10-01', amount: 500000 }] };
    const created = await one(op({ resource_type: 'finance_goal', resource_id: goal.id, action: 'create', payload: goal }));
    expect(created.record).toMatchObject({ targetAmount: '15000000', contributions: [{ date: '2026-10-01', amount: '500000' }] });
  });

  it('round-trips health, storage, automation, template, member and role resources', async () => {
    const sens = { dataClass: 'SENSITIVE' };
    await roundTrip(
      'health_profile',
      { ...b(sens), memberId: f.childMemberId, sex: 'FEMALE', bloodType: 'O+', heightCm: 120.5, allergies: ['Tôm'], conditions: [], insuranceNumber: 'HS123' },
      { allergies: ['Tôm', 'Cua'] },
    );
    await roundTrip(
      'health_metric',
      { ...b(sens), memberId: f.childMemberId, type: 'BLOOD_PRESSURE', value: 120, value2: 80, measuredAt: '2026-10-07T07:30' },
      { value: 118 },
    );
    await roundTrip(
      'health_note',
      { ...b(sens), memberId: f.childMemberId, date: '2026-10-07', title: 'Khám răng', body: '' },
      { body: 'Tái khám sau 6 tháng' },
    );

    const folder = { ...b(), name: 'Giấy tờ nhà', parentId: null };
    await roundTrip('folder', folder, { name: 'Giấy tờ' }, {}, false);
    const sha = 'a'.repeat(64);
    await roundTrip(
      'file',
      { ...b(), folderId: folder.id, name: 'so-do.pdf', mime: 'application/pdf', size: 1024, sha256: sha, kind: 'DOCUMENT', blobState: 'LOCAL_ONLY' },
      { name: 'so-do-nha.pdf' },
    );
    await roundTrip(
      'automation',
      { ...b(), ruleKey: 'WEEKLY_SUMMARY', enabled: true, params: { weekday: 'SU', time: '20:00' } },
      { enabled: false },
    );
    await roundTrip(
      'template',
      { ...b(), kind: 'TASK', preset: 'HOUSEWORK', category: 'HOUSEWORK', title: 'Dọn nhà cuối tuần', durationMinutes: 90, checklist: ['Lau nhà'], reminderOffsetsMinutes: [30] },
      { checklist: ['Lau nhà', 'Giặt đồ'] },
    );
    await roundTrip(
      'member',
      { ...b(), displayName: 'Bé Na', relationship: 'DAUGHTER', profile: 'CHILD', birthDate: '2018-05-01', interests: ['Vẽ'], status: 'ACTIVE' },
      { displayName: 'Na' },
    );
    await roundTrip(
      'role',
      { ...b(), key: 'CUSTOM_NANNY', name: 'Bảo mẫu', matrix: FULL_MATRIX, restrictions: { 'calendar.create': 'OWN_OR_ASSIGNED' }, system: false, basedOn: 'MEMBER' },
      { name: 'Người giúp việc' },
      { system: false },
    );
  });
  it('blocks deleting non-empty folders and system roles, and hides member private fields from a child', async () => {
    const folder = { ...b(), name: 'Ảnh', parentId: null };
    await one(op({ resource_type: 'folder', resource_id: folder.id, action: 'create', payload: folder }));
    const file = { ...b(), folderId: folder.id, name: 'a.jpg', mime: 'image/jpeg', size: 10, sha256: 'b'.repeat(64), kind: 'IMAGE', blobState: 'SYNCED' };
    const savedFile = await one(op({ resource_type: 'file', resource_id: file.id, action: 'create', payload: file }));
    // SYNCED is a server fact (set by the blob upload), never taken from the client.
    expect(savedFile.record).toMatchObject({ blobState: 'MISSING' });
    const blocked = await one(op({ resource_type: 'folder', resource_id: folder.id, action: 'delete', base_revision: '1' }));
    expect(blocked.error).toMatchObject({ code: 'VALIDATION_FAILED', fields: { id: 'FOLDER_NOT_EMPTY' } });

    const [owner]: Array<{ id: string; revision: string }> = await t.ds.query(
      "SELECT id, revision FROM roles WHERE space_id = ? AND role_key = 'OWNER'",
      [spaceId],
    );
    const sys = await one(op({ resource_type: 'role', resource_id: owner.id, action: 'delete', base_revision: String(owner.revision) }));
    expect(sys.error?.code).toBe('VALIDATION_FAILED');

    const member = { ...b(), displayName: 'Bà', relationship: 'GRANDMOTHER', profile: 'SENIOR', phone: '0901234567', birthDate: '1950-01-01', interests: [], status: 'ACTIVE' };
    expect((await one(op({ resource_type: 'member', resource_id: member.id, action: 'create', payload: member }))).status).toBe('APPLIED');
    const childEdit = await sendOps(f.child, spaceId, [
      op({ resource_type: 'member', resource_id: member.id, action: 'update', base_revision: '1', payload: { ...member, displayName: 'X' } }),
    ]);
    const r = childEdit.body.results[0] as Result & { current?: Record<string, unknown> };
    expect(r.error?.code).toBe('FORBIDDEN');
    expect(r.current).toMatchObject({ id: member.id, displayName: 'Bà' });
    expect(r.current).not.toHaveProperty('phone');
    expect(r.current).not.toHaveProperty('birthDate');
  });
});
