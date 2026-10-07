import type { SpaceAccessContext } from '../access/evaluate-access';
import { DEFAULT_ROLE_MATRIX, DEFAULT_ROLE_RESTRICTIONS } from '../access/role-matrix';
import type { StoredRow } from '../sync/resource-definition';
import { buildAiContext, type SpaceReadView } from './context-builder';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const DAD = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const ctx: SpaceAccessContext = {
  actorId: ME,
  deviceId: 'd',
  spaceId: 's',
  spaceKind: 'FAMILY',
  roleKey: 'OWNER',
  matrix: DEFAULT_ROLE_MATRIX.OWNER,
  restrictions: DEFAULT_ROLE_RESTRICTIONS.OWNER,
  representedMemberIds: [DAD],
  representedProfiles: ['PARENT'],
  guardianOfMemberIds: [],
  policyVersion: '1',
};

function member(id: string, name: string, relationship: string, extra: Partial<StoredRow> = {}): StoredRow {
  return {
    id,
    created_by_actor_id: ME,
    data_class: 'NORMAL',
    sharing_scope: 'FAMILY_ALL',
    display_name: name,
    relationship,
    profile: relationship === 'SON' ? 'CHILD' : 'PARENT',
    status: 'ACTIVE',
    note: 'ghi chú riêng',
    phone: '0900000000',
    ...extra,
  };
}

let seq = 0;
function item(title: string, extra: Partial<StoredRow> = {}): StoredRow {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    created_by_actor_id: ME,
    data_class: 'NORMAL',
    sharing_scope: 'FAMILY_ALL',
    kind: 'EVENT',
    preset: 'EVENT',
    category: 'FAMILY',
    title,
    all_day: 0,
    start_local: '2026-10-09T18:30',
    end_local: null,
    time_zone: 'Asia/Ho_Chi_Minh',
    rrule: null,
    lunar_rule: null,
    responsible_member_id: null,
    note: 'không được gửi',
    $children: { memberIds: [] },
    ...extra,
  };
}

function view(items: StoredRow[], extra: Partial<SpaceReadView> = {}): SpaceReadView {
  return {
    timeZone: 'Asia/Ho_Chi_Minh',
    members: [member(DAD, 'Bố', 'FATHER'), member(KID, 'Bé An', 'SON')],
    items,
    exceptions: [],
    states: [],
    ...extra,
  };
}

const today = '2026-10-07';
const titles = (c: ReturnType<typeof buildAiContext>) => c.upcoming.map((u) => u.title);

describe('buildAiContext', () => {
  it('lists members by name and family role only', () => {
    const c = buildAiContext(view([]), ctx, { allowHealth: false, today });
    expect(c.members).toEqual([
      { name: 'Bố', role: 'Bố' },
      { name: 'Bé An', role: 'Con trai' },
    ]);
    expect(JSON.stringify(c)).not.toContain('0900000000');
  });

  it('leaves out archived members and private members of someone else', () => {
    const c = buildAiContext(
      view([], {
        members: [
          member(DAD, 'Bố', 'FATHER'),
          member(KID, 'Bé An', 'SON', { status: 'ARCHIVED' }),
          member(OTHER, 'Bí mật', 'OTHER', { sharing_scope: 'PRIVATE', created_by_actor_id: OTHER }),
        ],
      }),
      ctx,
      { allowHealth: false, today },
    );
    expect(c.members.map((m) => m.name)).toEqual(['Bố']);
  });

  it('keeps NORMAL items, with date, time and the people involved, but never notes', () => {
    const c = buildAiContext(
      view([item('Họp phụ huynh', { responsible_member_id: DAD, $children: { memberIds: [KID] } })]),
      ctx,
      { allowHealth: false, today },
    );
    expect(c.upcoming).toEqual([
      { kind: 'EVENT', title: 'Họp phụ huynh', date: '2026-10-09', time: '18:30', member: 'Bé An, Bố' },
    ]);
    expect(JSON.stringify(c)).not.toContain('không được gửi');
  });

  it('drops SENSITIVE and health items unless health data is allowed', () => {
    const items = [
      item('Thuốc huyết áp', { data_class: 'SENSITIVE', kind: 'REMINDER', preset: 'MEDICATION', category: 'HEALTH' }),
      item('Khám răng', { category: 'HEALTH' }),
      item('Đi chợ'),
    ];
    expect(titles(buildAiContext(view(items), ctx, { allowHealth: false, today }))).toEqual(['Đi chợ']);
    expect(titles(buildAiContext(view(items), ctx, { allowHealth: true, today })).sort()).toEqual(
      ['Khám răng', 'Thuốc huyết áp', 'Đi chợ'].sort(),
    );
  });

  it("keeps the asker's own PRIVATE items and drops everyone else's", () => {
    const items = [
      item('Kế hoạch riêng của tôi', { sharing_scope: 'PRIVATE' }),
      item('Quà bí mật', { sharing_scope: 'PRIVATE', created_by_actor_id: OTHER }),
      item('Nhật ký riêng', { data_class: 'PRIVATE', created_by_actor_id: OTHER }),
    ];
    expect(titles(buildAiContext(view(items), ctx, { allowHealth: true, today }))).toEqual(['Kế hoạch riêng của tôi']);
  });

  it('expands repeats over the next 14 days and skips done, skipped and canceled occurrences', () => {
    const daily = item('Đưa con đi học', { start_local: '2026-10-01T07:00', rrule: 'FREQ=DAILY' });
    const c = buildAiContext(
      view([daily], {
        states: [{ item_id: daily.id, occurrence_key: `${String(daily.id)}@2026-10-07T07:00`, status: 'DONE' }],
        exceptions: [{ item_id: daily.id, occurrence_key: `${String(daily.id)}@2026-10-08T07:00`, kind: 'CANCEL' }],
      }),
      ctx,
      { allowHealth: false, today },
    );
    expect(c.upcoming.map((u) => u.date)).toEqual(
      Array.from({ length: 12 }, (_, i) => `2026-10-${String(9 + i).padStart(2, '0')}`),
    );
  });

  it('ignores items outside the window and deleted ones', () => {
    const c = buildAiContext(
      view([
        item('Đã qua', { start_local: '2026-10-06T08:00' }),
        item('Quá xa', { start_local: '2026-10-21T08:00' }),
        item('Đã xóa', { deleted_at: new Date() }),
        item('Cả ngày', { all_day: 1, start_local: '2026-10-20' }),
      ]),
      ctx,
      { allowHealth: false, today },
    );
    expect(c.upcoming).toEqual([{ kind: 'EVENT', title: 'Cả ngày', date: '2026-10-20', member: '' }]);
  });
});
