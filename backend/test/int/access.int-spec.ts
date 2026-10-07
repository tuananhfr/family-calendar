import { randomUUID } from 'node:crypto';
import type { SessionContext } from '../../src/common/http/current-session.decorator';
import { ApiError } from '../../src/common/errors/api-error';
import { withTransaction } from '../../src/database/transaction';
import { AccessService } from '../../src/modules/access/access.service';
import { DEFAULT_ROLE_MATRIX, DEFAULT_ROLE_RESTRICTIONS } from '../../src/modules/access/role-matrix';
import { truncateAll } from '../helpers/db';
import { createSharedSpace, insertActorWithDevice, insertMember, type SeededSpace } from '../helpers/spaces';
import { createTestApp, type TestApp } from '../helpers/test-app';

async function errorCodeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof ApiError) return err.code;
    throw err;
  }
  throw new Error('expected an ApiError');
}

function errnoOf(err: unknown): unknown {
  const e = err as { errno?: unknown; driverError?: { errno?: unknown } };
  return e.driverError?.errno ?? e.errno;
}

describe('access context (int)', () => {
  let t: TestApp;
  let access: AccessService;
  let owner: SessionContext;
  let child: SessionContext;
  let space: SeededSpace;
  let childMemberId: string;

  beforeAll(async () => {
    t = await createTestApp();
    access = t.app.get(AccessService);
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    owner = await insertActorWithDevice(t.ds);
    child = await insertActorWithDevice(t.ds);
    space = await createSharedSpace(t.ds, access, owner);
    await withTransaction(t.ds, (em) => access.addMembership(em, space.spaceId, child.actorId, space.roleIds.MEMBER));
    childMemberId = await insertMember(t.ds, space.spaceId, owner.actorId, 'CHILD', 'Bin');
    await withTransaction(t.ds, (em) =>
      access.addRepresentation(em, space.spaceId, child.actorId, childMemberId, 'SELF'),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  it('loads the OWNER and MEMBER matrices from the seeded roles', async () => {
    const o = await access.loadContext(owner, space.spaceId);
    expect(o).toMatchObject({
      actorId: owner.actorId,
      deviceId: owner.deviceId,
      spaceId: space.spaceId,
      spaceKind: 'FAMILY',
      roleKey: 'OWNER',
      representedMemberIds: [],
      guardianOfMemberIds: [],
    });
    expect(o.matrix).toEqual(DEFAULT_ROLE_MATRIX.OWNER);

    const c = await access.loadContext(child, space.spaceId);
    expect(c.roleKey).toBe('MEMBER');
    expect(c.matrix).toEqual(DEFAULT_ROLE_MATRIX.MEMBER);
    expect(c.restrictions).toEqual(DEFAULT_ROLE_RESTRICTIONS.MEMBER);
    expect(c.representedMemberIds).toEqual([childMemberId]);
    expect(c.representedProfiles).toEqual(['CHILD']);
    // Linking the child's representation already changed the audience once.
    expect(o.policyVersion).toBe('2');
    expect(c.policyVersion).toBe(o.policyVersion);
  });

  it('seeds the GROUP roles for a GROUP space', async () => {
    const organizer = await insertActorWithDevice(t.ds);
    const group = await createSharedSpace(t.ds, access, organizer, 'GROUP');
    expect(Object.keys(group.roleIds).sort()).toEqual(['GUEST', 'ORGANIZER', 'PARTICIPANT']);
    const ctx = await access.loadContext(organizer, group.spaceId);
    expect(ctx.spaceKind).toBe('GROUP');
    expect(ctx.matrix).toEqual(DEFAULT_ROLE_MATRIX.ORGANIZER);
  });

  it('reports guardianship separately from representation', async () => {
    const guardian = await insertActorWithDevice(t.ds);
    await withTransaction(t.ds, async (em) => {
      await access.addMembership(em, space.spaceId, guardian.actorId, space.roleIds.GUARDIAN);
      await access.addRepresentation(em, space.spaceId, guardian.actorId, childMemberId, 'GUARDIAN');
    });
    const g = await access.loadContext(guardian, space.spaceId);
    expect(g.guardianOfMemberIds).toEqual([childMemberId]);
    expect(g.representedMemberIds).toEqual([]);
    expect(g.representedProfiles).toEqual([]);
  });

  it('changing a role bumps policy_version by exactly 1 in the same transaction', async () => {
    const before = await access.loadContext(child, space.spaceId);
    const inside = await withTransaction(t.ds, async (em) => {
      const v = await access.assignRole(em, space.spaceId, child.actorId, space.roleIds.ADULT);
      const [row]: Array<{ v: string }> = await em.query('SELECT policy_version AS v FROM spaces WHERE id = ?', [
        space.spaceId,
      ]);
      return { returned: v, seenInTx: row.v };
    });
    expect(inside.returned).toBe(String(BigInt(before.policyVersion) + 1n));
    expect(inside.seenInTx).toBe(inside.returned);

    const after = await access.loadContext(child, space.spaceId);
    expect(after.roleKey).toBe('ADULT');
    expect(after.policyVersion).toBe(inside.returned);
  });

  it('rolls back the role change and the version bump together', async () => {
    const before = await access.loadContext(child, space.spaceId);
    await expect(
      withTransaction(t.ds, async (em) => {
        await access.assignRole(em, space.spaceId, child.actorId, space.roleIds.ADULT);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    const ctx = await access.loadContext(child, space.spaceId);
    expect(ctx.roleKey).toBe('MEMBER');
    expect(ctx.policyVersion).toBe(before.policyVersion);
  });

  it('rejects a role that belongs to another space', async () => {
    const otherOwner = await insertActorWithDevice(t.ds);
    const other = await createSharedSpace(t.ds, access, otherOwner);
    await expect(
      withTransaction(t.ds, (em) => access.assignRole(em, space.spaceId, child.actorId, other.roleIds.ADULT)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    let errno: unknown;
    try {
      await t.ds.query('UPDATE memberships SET role_id = ? WHERE space_id = ? AND actor_id = ?', [
        other.roleIds.ADULT,
        space.spaceId,
        child.actorId,
      ]);
    } catch (err) {
      errno = errnoOf(err);
    }
    expect(errno).toBe(1452);
  });

  it('throws DEVICE_REVOKED for a revoked device even with a live session context', async () => {
    await t.ds.query("UPDATE devices SET status = 'REVOKED', revoked_at = ? WHERE id = ?", [
      new Date(),
      child.deviceId,
    ]);
    expect(await errorCodeOf(access.loadContext(child, space.spaceId))).toBe('DEVICE_REVOKED');
  });

  it('throws SPACE_ACCESS_REVOKED for a REMOVED membership and bumps the policy version', async () => {
    const before = await access.loadContext(child, space.spaceId);
    const v = await withTransaction(t.ds, (em) => access.removeMembership(em, space.spaceId, child.actorId));
    expect(v).toBe(String(BigInt(before.policyVersion) + 1n));
    expect(await errorCodeOf(access.loadContext(child, space.spaceId))).toBe('SPACE_ACCESS_REVOKED');
  });

  it('keeps at least one OWNER', async () => {
    await expect(
      withTransaction(t.ds, (em) => access.assignRole(em, space.spaceId, owner.actorId, space.roleIds.ADULT)),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', fields: { role: 'LAST_OWNER' } });
    await expect(
      withTransaction(t.ds, (em) => access.removeMembership(em, space.spaceId, owner.actorId)),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    await withTransaction(t.ds, (em) => access.assignRole(em, space.spaceId, child.actorId, space.roleIds.OWNER));
    await withTransaction(t.ds, (em) => access.assignRole(em, space.spaceId, owner.actorId, space.roleIds.ADULT));
    expect((await access.loadContext(owner, space.spaceId)).roleKey).toBe('ADULT');
  });

  it('re-activating a REMOVED membership restores access and bumps the policy version', async () => {
    const removedAt = await withTransaction(t.ds, (em) => access.removeMembership(em, space.spaceId, child.actorId));
    await withTransaction(t.ds, (em) => access.addMembership(em, space.spaceId, child.actorId, space.roleIds.GUEST));
    const ctx = await access.loadContext(child, space.spaceId);
    expect(ctx.roleKey).toBe('GUEST');
    expect(ctx.policyVersion).toBe(String(BigInt(removedAt) + 1n));
  });

  it('throws FORBIDDEN for a non-member and for an unknown space, without telling them apart', async () => {
    const stranger = await insertActorWithDevice(t.ds);
    expect(await errorCodeOf(access.loadContext(stranger, space.spaceId))).toBe('FORBIDDEN');
    expect(await errorCodeOf(access.loadContext(owner, randomUUID()))).toBe('FORBIDDEN');
  });

  it('enforces the recovery_credentials.space_id foreign key now that spaces exist', async () => {
    let errno: unknown;
    try {
      await t.ds.query(
        'INSERT INTO recovery_credentials (id, space_id, actor_id, secret_hash, created_at) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), randomUUID(), owner.actorId, 'a'.repeat(64), new Date()],
      );
    } catch (err) {
      errno = errnoOf(err);
    }
    expect(errno).toBe(1452);
  });
});
