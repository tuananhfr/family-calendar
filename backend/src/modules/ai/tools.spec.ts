import { AI_TOOLS, parseToolCall } from './tools';

const members = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Bố' },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Bé An' },
];

describe('AI_TOOLS', () => {
  it('offers exactly the three draft-only tools with closed schemas', () => {
    expect(AI_TOOLS.map((t) => t.name).sort()).toEqual(['propose_item', 'propose_timetable', 'summarize_period']);
    const closed = (schema: unknown): boolean => {
      if (!schema || typeof schema !== 'object') return true;
      const s = schema as Record<string, unknown>;
      if (s.type === 'object' && s.additionalProperties !== false) return false;
      return Object.values(s).every((v) => (Array.isArray(v) ? v.every(closed) : closed(v)));
    };
    for (const tool of AI_TOOLS) expect(closed(tool.inputSchema)).toBe(true);
  });
});

describe('parseToolCall', () => {
  it('turns propose_item into an item draft and resolves the member by name', () => {
    const draft = parseToolCall(
      {
        name: 'propose_item',
        input: {
          kind: 'REMINDER',
          preset: 'MEDICATION',
          title: '  Uống thuốc  ',
          date: '2026-10-08',
          time: '07:30',
          end_time: null,
          category: 'HEALTH',
          member_name: 'bố',
          note: null,
        },
      },
      members,
    );
    expect(draft).toEqual({
      type: 'ITEM',
      kind: 'REMINDER',
      preset: 'MEDICATION',
      title: 'Uống thuốc',
      date: '2026-10-08',
      time: '07:30',
      end_time: null,
      all_day: false,
      category: 'HEALTH',
      member_id: members[0].id,
      member_name: 'Bố',
      note: null,
    });
  });

  it('leaves the time empty (all-day) when the model gives none, and repairs a preset of the wrong kind', () => {
    const draft = parseToolCall(
      {
        name: 'propose_item',
        input: { kind: 'TASK', preset: 'MEDICATION', title: 'Dọn nhà', date: '2026-10-09', category: 'NOPE' },
      },
      members,
    );
    expect(draft).toMatchObject({
      kind: 'TASK',
      preset: 'PERSONAL',
      time: null,
      all_day: true,
      category: 'OTHER',
      member_id: null,
      member_name: null,
    });
  });

  it('rejects drafts without a usable title or date', () => {
    expect(parseToolCall({ name: 'propose_item', input: { kind: 'EVENT', title: '', date: '2026-10-09' } }, members))
      .toBeNull();
    expect(
      parseToolCall({ name: 'propose_item', input: { kind: 'EVENT', title: 'Họp', date: '2026-02-30' } }, members),
    ).toBeNull();
    expect(
      parseToolCall({ name: 'propose_item', input: { kind: 'EVENT', title: 'Họp', date: '2026-10-09', time: '25:00' } }, members),
    ).toMatchObject({ time: null });
    expect(parseToolCall({ name: 'propose_item', input: 'not an object' }, members)).toBeNull();
  });

  it('keeps valid timetable rows only', () => {
    const draft = parseToolCall(
      {
        name: 'propose_timetable',
        input: {
          member_name: 'Bé An',
          entries: [
            { weekday: 1, start: '07:00', end: '07:45', subject: 'Toán', room: 'P.201' },
            { weekday: 8, start: '07:00', end: '07:45', subject: 'Sai thứ', room: null },
            { weekday: 2, start: '09:00', end: '08:00', subject: 'Sai giờ', room: null },
          ],
        },
      },
      members,
    );
    expect(draft).toEqual({
      type: 'TIMETABLE',
      member_id: members[1].id,
      member_name: 'Bé An',
      entries: [{ weekday: 1, start: '07:00', end: '07:45', subject: 'Toán', room: 'P.201' }],
    });
    expect(parseToolCall({ name: 'propose_timetable', input: { member_name: null, entries: [] } }, members)).toBeNull();
  });

  it('returns a summary card for summarize_period and ignores unknown tools', () => {
    expect(
      parseToolCall(
        { name: 'summarize_period', input: { from: '2026-10-07', to: '2026-10-13', summary: 'Tuần bận rộn.' } },
        members,
      ),
    ).toEqual({ type: 'SUMMARY', from: '2026-10-07', to: '2026-10-13', summary: 'Tuần bận rộn.' });
    expect(parseToolCall({ name: 'create_item', input: {} }, members)).toBeNull();
  });
});
