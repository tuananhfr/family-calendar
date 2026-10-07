import { randomUUID } from 'node:crypto';
import {
  canDeleteItem,
  canDeleteRecord,
  canRecord,
  canRecordItem,
  itemCapabilities,
  type AccessRecord,
  type Profile,
  type SpaceAccessContext,
} from './evaluate-access';
import {
  CAPABILITIES,
  DEFAULT_ROLE_MATRIX,
  DEFAULT_ROLE_RESTRICTIONS,
  normalizeMatrix,
  normalizeRestrictions,
  type RoleKey,
} from './role-matrix';

// Same case table as frontend/src/core/access/evaluate.test.ts (copied, not imported — ARC-02).

function ctx(
  role: RoleKey,
  profiles: Profile[],
  extra: Partial<SpaceAccessContext> = {},
  spaceKind: 'FAMILY' | 'GROUP' = 'FAMILY',
): SpaceAccessContext {
  return {
    actorId: randomUUID(),
    deviceId: randomUUID(),
    spaceId: randomUUID(),
    spaceKind,
    roleKey: role,
    matrix: DEFAULT_ROLE_MATRIX[role],
    restrictions: DEFAULT_ROLE_RESTRICTIONS[role],
    representedMemberIds: [randomUUID()],
    representedProfiles: profiles,
    guardianOfMemberIds: [],
    policyVersion: '1',
    ...extra,
  };
}

function rec(
  createdBy: string,
  scope: string,
  dataClass = 'NORMAL',
  extra: { memberIds?: string[]; ownerMemberId?: string } = {},
): AccessRecord {
  return { createdByActorId: createdBy, sharingScope: scope, dataClass, ...extra };
}

const canRead = (c: SpaceAccessContext, r: AccessRecord, cap: Parameters<typeof canRecord>[2]) =>
  canRecord(c, r, cap, 'VIEW');
const canWrite = (c: SpaceAccessContext, r: AccessRecord, cap: Parameters<typeof canRecord>[2]) =>
  canRecord(c, r, cap, 'EDIT');

describe('DEFAULT_ROLE_MATRIX (modules.md §2.2)', () => {
  it('matches the table for a few spot checks', () => {
    expect(DEFAULT_ROLE_MATRIX.OWNER.permissions).toBe('EDIT');
    expect(DEFAULT_ROLE_MATRIX.ADULT.permissions).toBe('NONE');
    expect(DEFAULT_ROLE_MATRIX.ADULT.settings).toBe('VIEW');
    expect(DEFAULT_ROLE_MATRIX.MEMBER['calendar.view']).toBe('VIEW');
    expect(DEFAULT_ROLE_MATRIX.SENIOR.members).toBe('VIEW');
    expect(DEFAULT_ROLE_MATRIX.GUARDIAN.health).toBe('VIEW');
    expect(DEFAULT_ROLE_MATRIX.GUARDIAN['calendar.create']).toBe('NONE');
    expect(DEFAULT_ROLE_MATRIX.GUEST['sos.trigger']).toBe('NONE');
    expect(DEFAULT_ROLE_MATRIX.MEMBER['sos.trigger']).toBe('EDIT');
    expect(DEFAULT_ROLE_MATRIX.ORGANIZER.permissions).toBe('EDIT');
    expect(DEFAULT_ROLE_MATRIX.PARTICIPANT.finance).toBe('NONE');
    for (const role of Object.values(DEFAULT_ROLE_MATRIX)) expect(Object.keys(role)).toHaveLength(14);
  });
});

describe('normalizeMatrix / normalizeRestrictions', () => {
  it('fails closed on unknown, missing or malformed levels', () => {
    const m = normalizeMatrix({ 'calendar.view': 'EDIT', finance: 'ADMIN', bogus: 'EDIT' });
    expect(m['calendar.view']).toBe('EDIT');
    expect(m.finance).toBe('NONE');
    expect(m.health).toBe('NONE');
    expect(Object.keys(m).sort()).toEqual([...CAPABILITIES].sort());
    expect(normalizeMatrix(null).permissions).toBe('NONE');
    expect(normalizeMatrix('{"permissions":"EDIT"}').permissions).toBe('EDIT');
  });

  it('keeps only known restrictions', () => {
    expect(
      normalizeRestrictions({ 'calendar.create': 'OWN_OR_ASSIGNED', health: 'NOPE', x: 'RELATED_MEMBERS' }),
    ).toEqual({ 'calendar.create': 'OWN_OR_ASSIGNED' });
    expect(normalizeRestrictions(null)).toEqual({});
  });
});

describe('itemCapabilities', () => {
  it('maps preset/category to the capability of §2.3', () => {
    expect(itemCapabilities({ preset: 'MEDICATION', category: 'HEALTH' })[0]).toBe('health');
    expect(itemCapabilities({ preset: 'APPOINTMENT', category: 'HEALTH' })[0]).toBe('health');
    expect(itemCapabilities({ preset: 'TIMETABLE', category: 'STUDY' })[0]).toBe('timetable');
    expect(itemCapabilities({ preset: 'PAYMENT', category: 'FINANCE' })).toEqual(['finance', 'calendar.view']);
    expect(itemCapabilities({ preset: 'HOUSEWORK', category: 'HOUSEWORK' })[0]).toBe('calendar.view');
  });
});

describe('canRecord', () => {
  it("OWNER cannot read another actor's PRIVATE record; the creator can", () => {
    const owner = ctx('OWNER', ['PARENT']);
    const other = ctx('ADULT', ['PARENT']);
    const r = rec(other.actorId, 'PRIVATE', 'PRIVATE');
    expect(canRead(owner, r, 'calendar.view')).toBe(false);
    expect(canWrite(owner, r, 'calendar.view')).toBe(false);
    expect(canRead(other, r, 'calendar.view')).toBe(true);
    expect(canWrite(other, r, 'calendar.view')).toBe(true);
  });

  it('MEMBER cannot read finance', () => {
    const child = ctx('MEMBER', ['CHILD']);
    const owner = ctx('OWNER', ['PARENT']);
    const txn = rec(owner.actorId, 'FAMILY_ALL', 'PRIVATE');
    expect(canRead(child, txn, 'finance')).toBe(false);
    expect(canRead(owner, txn, 'finance')).toBe(true);
  });

  it("SENIOR can view the calendar but not edit someone else's item; can edit own/assigned items", () => {
    const senior = ctx('SENIOR', ['SENIOR']);
    const owner = ctx('OWNER', ['PARENT']);
    const othersItem = rec(owner.actorId, 'FAMILY_ALL');
    expect(canRead(senior, othersItem, 'calendar.view')).toBe(true);
    expect(canWrite(senior, othersItem, 'calendar.view')).toBe(false);
    expect(canWrite(senior, rec(senior.actorId, 'FAMILY_ALL'), 'calendar.view')).toBe(true);
    const assigned = rec(owner.actorId, 'FAMILY_ALL', 'NORMAL', { memberIds: [senior.representedMemberIds[0]] });
    expect(canWrite(senior, assigned, 'calendar.view')).toBe(true);
    expect(canDeleteRecord(senior, rec(senior.actorId, 'FAMILY_ALL'), 'calendar.view')).toBe(false);
    expect(canDeleteRecord(owner, othersItem, 'calendar.view')).toBe(true);
  });

  it('GUARDIAN reads health of the guarded member only', () => {
    const guarded = randomUUID();
    const guardian = ctx('GUARDIAN', ['PARENT'], { guardianOfMemberIds: [guarded] });
    const owner = ctx('OWNER', ['PARENT']);
    const guardedProfile = rec(owner.actorId, 'FAMILY_ALL', 'SENSITIVE', { ownerMemberId: guarded });
    const otherProfile = rec(owner.actorId, 'FAMILY_ALL', 'SENSITIVE', { ownerMemberId: randomUUID() });
    expect(canRead(guardian, guardedProfile, 'health')).toBe(true);
    expect(canWrite(guardian, guardedProfile, 'health')).toBe(false);
    expect(canRead(guardian, otherProfile, 'health')).toBe(false);
  });

  it('a member always reads and edits their own health record even with health NONE', () => {
    const child = ctx('MEMBER', ['CHILD']);
    const owner = ctx('OWNER', ['PARENT']);
    const own = rec(owner.actorId, 'FAMILY_ALL', 'SENSITIVE', { ownerMemberId: child.representedMemberIds[0] });
    expect(canRead(child, own, 'health')).toBe(true);
    expect(canWrite(child, own, 'health')).toBe(true);
    expect(
      canRead(child, rec(owner.actorId, 'FAMILY_ALL', 'SENSITIVE', { ownerMemberId: randomUUID() }), 'health'),
    ).toBe(false);
  });

  it('PARENTS_SENIORS is hidden from CHILD profiles, PARENTS_CHILDREN from SENIOR profiles', () => {
    const owner = ctx('OWNER', ['PARENT']);
    const child = ctx('MEMBER', ['CHILD']);
    const senior = ctx('SENIOR', ['SENIOR']);
    expect(canRead(child, rec(owner.actorId, 'PARENTS_SENIORS'), 'calendar.view')).toBe(false);
    expect(canRead(senior, rec(owner.actorId, 'PARENTS_SENIORS'), 'calendar.view')).toBe(true);
    expect(canRead(senior, rec(owner.actorId, 'PARENTS_CHILDREN'), 'calendar.view')).toBe(false);
    expect(canRead(child, rec(owner.actorId, 'PARENTS_CHILDREN'), 'calendar.view')).toBe(true);
    expect(canRead(owner, rec(child.actorId, 'PARENTS_SENIORS'), 'calendar.view')).toBe(true);
  });

  it('a GROUP context cannot use FAMILY_* scopes and vice versa', () => {
    const organizer = ctx('ORGANIZER', ['PARENT'], {}, 'GROUP');
    const other = randomUUID();
    expect(canRead(organizer, rec(other, 'FAMILY_ALL'), 'calendar.view')).toBe(false);
    expect(canRead(organizer, rec(organizer.actorId, 'FAMILY_ALL'), 'calendar.view')).toBe(false);
    expect(canRead(organizer, rec(other, 'GROUP_MEMBERS'), 'calendar.view')).toBe(true);
    expect(canRead(organizer, rec(other, 'GROUP_MANAGERS'), 'calendar.view')).toBe(true);
    const owner = ctx('OWNER', ['PARENT']);
    expect(canRead(owner, rec(other, 'GROUP_MEMBERS'), 'calendar.view')).toBe(false);
  });

  it('a GROUP context with a FAMILY_ALL record is denied even for writes by the creator', () => {
    const organizer = ctx('ORGANIZER', ['PARENT'], {}, 'GROUP');
    expect(canWrite(organizer, rec(organizer.actorId, 'FAMILY_ALL'), 'calendar.create')).toBe(false);
    expect(canDeleteRecord(organizer, rec(organizer.actorId, 'FAMILY_ALL'), 'calendar.delete')).toBe(false);
  });

  it('an unknown scope fails closed', () => {
    const owner = ctx('OWNER', ['PARENT']);
    expect(canRead(owner, rec(owner.actorId, 'EVERYONE'), 'calendar.view')).toBe(false);
  });

  it('GROUP_MANAGERS is hidden from plain participants', () => {
    const participant = ctx('PARTICIPANT', ['CHILD'], {}, 'GROUP');
    expect(canRead(participant, rec(randomUUID(), 'GROUP_MANAGERS'), 'calendar.view')).toBe(false);
    expect(canRead(participant, rec(randomUUID(), 'GROUP_MEMBERS'), 'calendar.view')).toBe(true);
  });

  it('GUEST sees family-wide calendar but cannot write', () => {
    const guest = ctx('GUEST', ['PARENT']);
    const r = rec(randomUUID(), 'FAMILY_ALL');
    expect(canRead(guest, r, 'calendar.view')).toBe(true);
    expect(canWrite(guest, r, 'calendar.view')).toBe(false);
    expect(canRead(guest, r, 'storage')).toBe(false);
  });

  it('SENSITIVE items shared family-wide stay hidden from members without health access', () => {
    const owner = ctx('OWNER', ['PARENT']);
    const child = ctx('MEMBER', ['CHILD']);
    const medication = { ...rec(owner.actorId, 'FAMILY_ALL', 'SENSITIVE'), preset: 'MEDICATION', category: 'HEALTH' };
    expect(canRecordItem(owner, medication, 'VIEW')).toBe(true);
    expect(canRecordItem(child, medication, 'VIEW')).toBe(false);
    const forChild = { ...medication, memberIds: [child.representedMemberIds[0]] };
    expect(canRecordItem(child, forChild, 'VIEW')).toBe(true);
  });

  it('payment reminders are reachable through finance or calendar capability', () => {
    const owner = ctx('OWNER', ['PARENT']);
    const child = ctx('MEMBER', ['CHILD']);
    const payment = { ...rec(owner.actorId, 'FAMILY_ALL'), preset: 'PAYMENT', category: 'FINANCE' };
    expect(canRecordItem(child, payment, 'VIEW')).toBe(true);
    expect(canRecordItem(child, payment, 'EDIT')).toBe(false);
    expect(canRecordItem(owner, payment, 'EDIT')).toBe(true);
    expect(canDeleteItem(child, payment)).toBe(false);
    expect(canDeleteItem(owner, payment)).toBe(true);
  });

  it('uses the matrix stored on the context, not the default for its role key', () => {
    const custom = ctx('MEMBER', ['CHILD'], { matrix: { ...DEFAULT_ROLE_MATRIX.MEMBER, finance: 'VIEW' } });
    expect(canRead(custom, rec(randomUUID(), 'FAMILY_ALL', 'PRIVATE'), 'finance')).toBe(true);
    expect(canWrite(custom, rec(randomUUID(), 'FAMILY_ALL', 'PRIVATE'), 'finance')).toBe(false);
  });
});
