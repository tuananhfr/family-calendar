import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { SessionContext } from '../../src/common/http/current-session.decorator';
import { AccessService } from '../../src/modules/access/access.service';
import { withTransaction } from '../../src/database/transaction';

/** Inserts an Actor + ACTIVE Device directly; enough for services that take a SessionContext. */
export async function insertActorWithDevice(ds: DataSource): Promise<SessionContext> {
  const actorId = randomUUID();
  const deviceId = randomUUID();
  const now = new Date();
  await ds.query('INSERT INTO actors (id, created_at) VALUES (?, ?)', [actorId, now]);
  await ds.query('INSERT INTO devices (id, actor_id, status, created_at) VALUES (?, ?, ?, ?)', [
    deviceId,
    actorId,
    'ACTIVE',
    now,
  ]);
  return { sessionId: randomUUID(), actorId, deviceId, accountId: null };
}

export interface SeededSpace {
  spaceId: string;
  roleIds: Record<string, string>;
}

/** A SHARED Space with default roles and the owner's OWNER membership (stands in for bootstrap, Task 33). */
export async function createSharedSpace(
  ds: DataSource,
  access: AccessService,
  owner: SessionContext,
  kind: 'FAMILY' | 'GROUP' = 'FAMILY',
): Promise<SeededSpace> {
  const spaceId = randomUUID();
  const now = new Date();
  return withTransaction(ds, async (em) => {
    await em.query(
      `INSERT INTO spaces (id, kind, name, time_zone, sharing_state, settings, change_seq, policy_version,
         created_by_actor_id, revision, created_at, updated_at)
       VALUES (?, ?, ?, 'Asia/Ho_Chi_Minh', 'SHARED', '{}', 0, 1, ?, 1, ?, ?)`,
      [spaceId, kind, 'Nhà mình', owner.actorId, now, now],
    );
    const roleIds = await access.seedDefaultRoles(em, spaceId, kind, owner.actorId);
    await access.addMembership(em, spaceId, owner.actorId, roleIds[kind === 'FAMILY' ? 'OWNER' : 'ORGANIZER']);
    return { spaceId, roleIds };
  });
}

export async function insertMember(
  ds: DataSource,
  spaceId: string,
  createdBy: string,
  profile: 'PARENT' | 'SENIOR' | 'CHILD',
  displayName = 'Thành viên',
): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  const relationship = profile === 'CHILD' ? 'SON' : profile === 'SENIOR' ? 'GRANDMOTHER' : 'MOTHER';
  await ds.query(
    `INSERT INTO members (id, space_id, created_by_actor_id, data_class, sharing_scope, revision, created_at,
       updated_at, display_name, relationship, profile, interests, status)
     VALUES (?, ?, ?, 'NORMAL', 'FAMILY_ALL', 1, ?, ?, ?, ?, ?, '[]', 'ACTIVE')`,
    [id, spaceId, createdBy, now, now, displayName, relationship, profile],
  );
  return id;
}
