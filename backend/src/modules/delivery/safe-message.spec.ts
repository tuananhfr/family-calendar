import { GENERIC_BODY, GENERIC_TITLE, buildSafeMessage } from './safe-message';

const ref = {
  type: 'REMINDER_DUE',
  spaceId: 's1',
  itemId: 'i1',
  occurrenceKey: 'i1@2026-10-10T07:00',
  deliveryId: 'd1',
};

describe('buildSafeMessage', () => {
  it('keeps SENSITIVE generic even when details are allowed', () => {
    const m = buildSafeMessage(
      { title: 'Thuốc huyết áp', dataClass: 'SENSITIVE', sharingScope: 'FAMILY_ALL' },
      { showDetails: true },
      ref,
    );
    expect(m.title).toBe(GENERIC_TITLE);
    expect(m.body).toBe(GENERIC_BODY);
    expect(JSON.stringify(m)).not.toContain('huyết áp');
  });

  it('treats health items as sensitive whatever their label', () => {
    const m = buildSafeMessage(
      { title: 'Uống thuốc', dataClass: 'NORMAL', sharingScope: 'FAMILY_ALL', category: 'HEALTH' },
      { showDetails: true },
      ref,
    );
    expect(m.body).toBe(GENERIC_BODY);
  });

  it('hides PRIVATE and NORMAL titles unless the recipient chose to see details', () => {
    const priv = { title: 'Quà sinh nhật', dataClass: 'NORMAL', sharingScope: 'PRIVATE' } as const;
    expect(buildSafeMessage(priv, { showDetails: false }, ref).body).toBe(GENERIC_BODY);
    const normal = { title: 'Họp phụ huynh', dataClass: 'NORMAL', sharingScope: 'FAMILY_ALL' } as const;
    expect(buildSafeMessage(normal, { showDetails: false }, ref).body).toBe(GENERIC_BODY);
    const shown = buildSafeMessage(normal, { showDetails: true }, ref);
    expect(shown).toMatchObject({ title: GENERIC_TITLE, body: 'Họp phụ huynh' });
  });

  it('carries only references and a stable tag per occurrence', () => {
    const a = buildSafeMessage(
      { title: 'A', dataClass: 'NORMAL', sharingScope: 'FAMILY_ALL' },
      { showDetails: true },
      ref,
    );
    const b = buildSafeMessage(
      { title: 'B', dataClass: 'NORMAL', sharingScope: 'FAMILY_ALL' },
      { showDetails: true },
      { ...ref, deliveryId: 'd2' },
    );
    expect(a.tag).toBe(b.tag);
    expect(a.tag).not.toContain('2026');
    expect(a.data).toEqual(ref);
  });
});
