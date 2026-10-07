import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import type { RepresentationRelation } from './entities/member-representation.entity';
import type { Profile, SpaceAccessContext, SpaceKind } from './evaluate-access';
import {
  DEFAULT_ROLE_MATRIX,
  DEFAULT_ROLE_NAMES,
  DEFAULT_ROLE_RESTRICTIONS,
  normalizeMatrix,
  normalizeRestrictions,
  roleKeysFor,
} from './role-matrix';

interface MembershipRow {
  kind: SpaceKind;
  policy_version: string;
  status: 'ACTIVE' | 'REMOVED';
  role_key: string | null;
  matrix: unknown;
  restrictions: unknown;
}

interface RepresentationRow {
  member_id: string;
  relation: RepresentationRelation;
  profile: Profile;
}

const OWNER_ROLE_KEY = 'OWNER';

@Injectable()
export class AccessService {
  constructor(private readonly ds: DataSource) {}

  /**
   * Step 1 of §2.3 plus the actor's effective role. Re-checks the device itself because a session resolved at the
   * start of a long request may outlive a concurrent revoke.
   */
  async loadContext(session: SessionContext, spaceId: string, em?: EntityManager): Promise<SpaceAccessContext> {
    const q = em ?? this.ds.manager;
    const [device]: Array<{ status: string; actor_id: string }> = await q.query(
      'SELECT status, actor_id FROM devices WHERE id = ?',
      [session.deviceId],
    );
    if (!device || device.actor_id !== session.actorId) throw new ApiError(ErrorCode.AUTH_REQUIRED, 401);
    if (device.status !== 'ACTIVE') throw new ApiError(ErrorCode.DEVICE_REVOKED, 401);

    const [row]: MembershipRow[] = await q.query(
      `SELECT s.kind, s.policy_version, m.status, r.role_key, r.matrix, r.restrictions
         FROM spaces s
         JOIN memberships m ON m.space_id = s.id AND m.actor_id = ?
         LEFT JOIN roles r ON r.space_id = m.space_id AND r.id = m.role_id AND r.deleted_at IS NULL
        WHERE s.id = ?`,
      [session.actorId, spaceId],
    );
    // Unknown Space and "not a member" answer the same so Space ids cannot be probed.
    if (!row) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    if (row.status !== 'ACTIVE') throw new ApiError(ErrorCode.SPACE_ACCESS_REVOKED, 403);
    if (!row.role_key) throw new ApiError(ErrorCode.FORBIDDEN, 403);

    const reps: RepresentationRow[] = await q.query(
      `SELECT mr.member_id, mr.relation, mb.profile
         FROM member_representations mr
         JOIN members mb ON mb.space_id = mr.space_id AND mb.id = mr.member_id
        WHERE mr.space_id = ? AND mr.actor_id = ? AND mb.deleted_at IS NULL
        ORDER BY mr.member_id`,
      [spaceId, session.actorId],
    );
    const self = reps.filter((r) => r.relation === 'SELF');
    return {
      actorId: session.actorId,
      deviceId: session.deviceId,
      spaceId,
      spaceKind: row.kind,
      roleKey: row.role_key,
      matrix: normalizeMatrix(row.matrix),
      restrictions: normalizeRestrictions(row.restrictions),
      representedMemberIds: self.map((r) => r.member_id),
      representedProfiles: [...new Set(self.map((r) => r.profile))],
      guardianOfMemberIds: reps.filter((r) => r.relation === 'GUARDIAN').map((r) => r.member_id),
      policyVersion: String(row.policy_version),
    };
  }

  /**
   * Creates the built-in roles of §2.1 for a new Space; returns role key → id. The caller records the matching
   * sync changes (bootstrap owns the change feed).
   */
  async seedDefaultRoles(
    em: EntityManager,
    spaceId: string,
    kind: SpaceKind,
    createdByActorId: string,
  ): Promise<Record<string, string>> {
    const ids: Record<string, string> = {};
    const scope = kind === 'FAMILY' ? 'FAMILY_ALL' : 'GROUP_MEMBERS';
    for (const key of roleKeysFor(kind)) {
      const id = randomUUID();
      await em.query(
        `INSERT INTO roles (id, space_id, created_by_actor_id, data_class, sharing_scope, revision, created_at,
           updated_at, role_key, name, matrix, restrictions, is_system)
         VALUES (?, ?, ?, 'NORMAL', ?, 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), ?, ?, ?, ?, 1)`,
        [
          id,
          spaceId,
          createdByActorId,
          scope,
          key,
          DEFAULT_ROLE_NAMES[kind][key],
          JSON.stringify(DEFAULT_ROLE_MATRIX[key]),
          JSON.stringify(DEFAULT_ROLE_RESTRICTIONS[key]),
        ],
      );
      ids[key] = id;
    }
    return ids;
  }

  /** Adds (or re-activates) an Actor's membership; returns the membership id. */
  async addMembership(em: EntityManager, spaceId: string, actorId: string, roleId: string): Promise<string> {
    await this.lockSpace(em, spaceId);
    await this.requireRole(em, spaceId, roleId);
    const result: { affectedRows?: number } = await em.query(
      `INSERT INTO memberships (id, space_id, actor_id, role_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), status = 'ACTIVE', removed_at = NULL,
         updated_at = UTC_TIMESTAMP(3)`,
      [randomUUID(), spaceId, actorId, roleId],
    );
    // affectedRows 2 = an existing (possibly REMOVED) row changed, which alters what that actor may see.
    if ((result.affectedRows ?? 0) > 1) await this.bumpPolicyVersion(em, spaceId);
    const [row]: Array<{ id: string }> = await em.query(
      'SELECT id FROM memberships WHERE space_id = ? AND actor_id = ?',
      [spaceId, actorId],
    );
    return row.id;
  }

  /** Changes an ACTIVE member's role; returns the new policy version (bumped in the caller's transaction). */
  async assignRole(em: EntityManager, spaceId: string, actorId: string, roleId: string): Promise<string> {
    await this.lockSpace(em, spaceId);
    const roleKey = await this.requireRole(em, spaceId, roleId);
    const current = await this.activeMembership(em, spaceId, actorId);
    if (current.role_key === OWNER_ROLE_KEY && roleKey !== OWNER_ROLE_KEY)
      await this.requireAnotherOwner(em, spaceId, actorId);
    await em.query(
      'UPDATE memberships SET role_id = ?, updated_at = UTC_TIMESTAMP(3) WHERE space_id = ? AND actor_id = ?',
      [roleId, spaceId, actorId],
    );
    return this.bumpPolicyVersion(em, spaceId);
  }

  /** Marks a membership REMOVED; returns the new policy version. */
  async removeMembership(em: EntityManager, spaceId: string, actorId: string): Promise<string> {
    await this.lockSpace(em, spaceId);
    const current = await this.activeMembership(em, spaceId, actorId);
    if (current.role_key === OWNER_ROLE_KEY) await this.requireAnotherOwner(em, spaceId, actorId);
    await em.query(
      `UPDATE memberships SET status = 'REMOVED', removed_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3)
        WHERE space_id = ? AND actor_id = ?`,
      [spaceId, actorId],
    );
    return this.bumpPolicyVersion(em, spaceId);
  }

  /** Links an Actor to a Member as SELF or GUARDIAN; returns the new policy version. */
  async addRepresentation(
    em: EntityManager,
    spaceId: string,
    actorId: string,
    memberId: string,
    relation: RepresentationRelation,
  ): Promise<string> {
    await this.lockSpace(em, spaceId);
    await em.query(
      `INSERT INTO member_representations (space_id, actor_id, member_id, relation, created_at)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE relation = VALUES(relation)`,
      [spaceId, actorId, memberId, relation],
    );
    return this.bumpPolicyVersion(em, spaceId);
  }

  /**
   * Call on every change that alters who may see what (roles, memberships, representations, member profiles)
   * so clients drop cached records they can no longer read. Returns the new version.
   */
  async bumpPolicyVersion(em: EntityManager, spaceId: string): Promise<string> {
    await em.query('UPDATE spaces SET policy_version = policy_version + 1 WHERE id = ?', [spaceId]);
    const [row]: Array<{ v: string }> = await em.query('SELECT policy_version AS v FROM spaces WHERE id = ?', [
      spaceId,
    ]);
    return String(row.v);
  }

  // Serializes membership changes per Space so the "at least one OWNER" check cannot race.
  private async lockSpace(em: EntityManager, spaceId: string): Promise<void> {
    const rows: unknown[] = await em.query('SELECT id FROM spaces WHERE id = ? FOR UPDATE', [spaceId]);
    if (rows.length === 0) throw new ApiError(ErrorCode.FORBIDDEN, 403);
  }

  private async requireRole(em: EntityManager, spaceId: string, roleId: string): Promise<string> {
    const [row]: Array<{ role_key: string }> = await em.query(
      'SELECT role_key FROM roles WHERE space_id = ? AND id = ? AND deleted_at IS NULL',
      [spaceId, roleId],
    );
    if (!row) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    return row.role_key;
  }

  private async activeMembership(em: EntityManager, spaceId: string, actorId: string): Promise<{ role_key: string }> {
    const [row]: Array<{ role_key: string }> = await em.query(
      `SELECT r.role_key FROM memberships m JOIN roles r ON r.space_id = m.space_id AND r.id = m.role_id
        WHERE m.space_id = ? AND m.actor_id = ? AND m.status = 'ACTIVE'`,
      [spaceId, actorId],
    );
    if (!row) throw new ApiError(ErrorCode.NOT_FOUND, 404);
    return row;
  }

  private async requireAnotherOwner(em: EntityManager, spaceId: string, actorId: string): Promise<void> {
    const [{ n }]: Array<{ n: string }> = await em.query(
      `SELECT COUNT(*) AS n FROM memberships m JOIN roles r ON r.space_id = m.space_id AND r.id = m.role_id
        WHERE m.space_id = ? AND m.actor_id <> ? AND m.status = 'ACTIVE' AND r.role_key = ?`,
      [spaceId, actorId, OWNER_ROLE_KEY],
    );
    if (Number(n) === 0) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'Không gian phải còn ít nhất một chủ gia đình.', {
        role: 'LAST_OWNER',
      });
    }
  }
}
