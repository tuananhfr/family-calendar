import { screenMemberAccess, validateScreenBatch, validateScreenRange } from './screen-time.rules';
import type { SpaceAccessContext } from '../access/evaluate-access';
import { DEFAULT_ROLE_MATRIX } from '../access/role-matrix';
import type { ScreenBatchDto } from './screen-time.dto';

const ctx: SpaceAccessContext = {
  actorId: 'actor',
  deviceId: 'device',
  spaceId: 'family',
  spaceKind: 'FAMILY',
  roleKey: 'MEMBER',
  matrix: DEFAULT_ROLE_MATRIX.MEMBER,
  restrictions: {},
  representedMemberIds: ['self'],
  representedProfiles: ['CHILD'],
  guardianOfMemberIds: [],
  policyVersion: '1',
};
const now = new Date('2026-11-03T03:00:00Z');
const consent = new Date('2026-11-01T17:00:00Z');
const batch = (): ScreenBatchDto => ({
  batch_id: 'batch',
  time_zone: 'Asia/Ho_Chi_Minh',
  algorithm_version: 'android-events-v1',
  days: [
    {
      local_date: '2026-11-03',
      observed_from: '2026-11-02T17:00:00Z',
      captured_at: now.toISOString(),
      total_seconds: 1800,
      coverage: 'COMPLETE',
      apps: [{ package_name: 'app.one', label: 'One', seconds: 1800 }],
    },
  ],
});

describe('screen-time rules', () => {
  it('allows self viewing, assigned guardians and owners; denies unrelated adults', () => {
    expect(screenMemberAccess(ctx, 'self')).toEqual({ view: true, manage: false });
    expect(screenMemberAccess(ctx, 'another')).toEqual({ view: false, manage: false });
    expect(screenMemberAccess({ ...ctx, roleKey: 'ADULT' }, 'another').view).toBe(false);
    expect(screenMemberAccess({ ...ctx, guardianOfMemberIds: ['another'] }, 'another').manage).toBe(true);
    expect(screenMemberAccess({ ...ctx, roleKey: 'OWNER' }, 'another').manage).toBe(true);
    expect(screenMemberAccess({ ...ctx, spaceKind: 'GROUP', roleKey: 'OWNER' }, 'another').view).toBe(false);
  });
  it('accepts valid observations and rejects invalid dates/ranges', () => {
    expect(() => validateScreenBatch(batch(), batch().time_zone, now, consent)).not.toThrow();
    for (const range of [
      { from: '2026-02-30', to: '2026-03-01' },
      { from: '2026-01-01', to: '2026-03-01' },
      { from: '2026-11-03', to: '2026-11-02' },
    ]) {
      expect(() => validateScreenRange(range)).toThrow();
    }
  });
  it('rejects observations predating consent and false COMPLETE windows', () => {
    expect(() => validateScreenBatch(batch(), batch().time_zone, now, new Date('2026-11-03T00:00:00Z'))).toThrow();
    const value = batch();
    value.days[0].observed_from = '2026-11-03T00:00:00Z';
    expect(() => validateScreenBatch(value, value.time_zone, now, consent)).toThrow();
    value.days[0].coverage = 'PARTIAL';
    expect(() => validateScreenBatch(value, value.time_zone, now, consent)).not.toThrow();
  });
  it('rejects negative windows, excessive totals, future clocks, duplicate apps and timezone changes', () => {
    const invalid: ScreenBatchDto[] = [];
    let value = batch();
    value.days[0].captured_at = '2026-11-01T00:00:00Z';
    invalid.push(value);
    value = batch();
    value.days[0].total_seconds = 50000;
    invalid.push(value);
    value = batch();
    value.days[0].captured_at = '2026-11-03T04:00:00Z';
    invalid.push(value);
    value = batch();
    value.days[0].apps.push({ ...value.days[0].apps[0] });
    invalid.push(value);
    value = batch();
    value.time_zone = 'UTC';
    invalid.push(value);
    for (const item of invalid) expect(() => validateScreenBatch(item, 'Asia/Ho_Chi_Minh', now, consent)).toThrow();
  });
});
