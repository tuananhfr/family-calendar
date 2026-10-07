import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import type { SpaceAccessContext } from '../access/evaluate-access';
import { recordAudit } from '../audit/record-audit';
import { appendChange, lockSpace } from '../sync/change-log';
import { RESOURCE_REGISTRY } from '../sync/resource-registry';
import type {
  ApproveJoinRequestDto,
  CreateJoinRequestDto,
  GuardianRequestDto,
  JoinRequestCreatedDto,
  JoinRequestDecisionDto,
  JoinRequestStatusDto,
  JoinRequestSummaryDto,
} from './dto/invite.dto';
import type { JoinRequestStatus } from './entities/join-request.entity';
import {
  InvitesService,
  OWNER_ROLE_KEYS,
  invalidInvite,
  inviteState,
  memberManager,
  type InviteRow,
} from './invites.service';

interface RequestRow {
  id: string;
  invite_id: string;
  space_id: string;
  actor_id: string;
  display_name: string;
  proposed_profile: string | null;
  member_id: string | null;
  status: JoinRequestStatus;
  approved_member_id: string | null;
  created_at: Date;
}

/** Waiting requests whose invite can no longer be used read as EXPIRED; nothing is rewritten. */
function visibleStatus(req: RequestRow, invite: InviteRow): string {
  const waiting = req.status === 'PENDING' || req.status === 'PENDING_GUARDIAN';
  return waiting && inviteState(invite) !== 'ACTIVE' ? 'EXPIRED' : req.status;
}

// A child's request to join a Group's member is someone the child is SELF for, guarded in some Family Space.
const GUARDED_REQUESTER_SQL = `SELECT 1 FROM member_representations self_rep
   JOIN member_representations guard ON guard.space_id = self_rep.space_id AND guard.member_id = self_rep.member_id
   JOIN spaces fs ON fs.id = self_rep.space_id AND fs.kind = 'FAMILY'
  WHERE self_rep.actor_id = jr.actor_id AND self_rep.relation = 'SELF'
    AND guard.actor_id = ? AND guard.relation = 'GUARDIAN'`;

@Injectable()
export class JoinRequestsService {
  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    private readonly invites: InvitesService,
  ) {}

  create(session: SessionContext, token: string, dto: CreateJoinRequestDto): Promise<JoinRequestCreatedDto> {
    return withTransaction(this.ds, async (em) => {
      const invite = await this.invites.findUsable(em, token, true);
      return this.createFor(em, session, invite, dto);
    });
  }

  /** Idempotent per invite and Actor; the caller has already locked and validated the invite. */
  async createFor(
    em: EntityManager,
    session: SessionContext,
    invite: InviteRow,
    dto: CreateJoinRequestDto,
  ): Promise<JoinRequestCreatedDto> {
    const [existing]: RequestRow[] = await em.query(
      'SELECT * FROM join_requests WHERE invite_id = ? AND actor_id = ?',
      [invite.id, session.actorId],
    );
    if (existing) return { request_id: existing.id, status: visibleStatus(existing, invite) };

    const [membership]: Array<{ status: string }> = await em.query(
      'SELECT status FROM memberships WHERE space_id = ? AND actor_id = ?',
      [invite.space_id, session.actorId],
    );
    if (membership?.status === 'ACTIVE') {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'Bạn đã là thành viên của không gian này.', {
        token: 'ALREADY_MEMBER',
      });
    }
    const [space]: Array<{ kind: 'FAMILY' | 'GROUP' }> = await em.query('SELECT kind FROM spaces WHERE id = ?', [
      invite.space_id,
    ]);
    // Group membership for a child needs a Family guardian first (identity-and-security.md "Quyền Group").
    const status: JoinRequestStatus =
      space.kind === 'GROUP' && dto.proposed_profile === 'CHILD' ? 'PENDING_GUARDIAN' : 'PENDING';
    const id = randomUUID();
    await em.query(
      `INSERT INTO join_requests (id, invite_id, space_id, actor_id, device_id, display_name, proposed_profile,
           member_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [
        id,
        invite.id,
        invite.space_id,
        session.actorId,
        session.deviceId,
        dto.display_name.trim(),
        dto.proposed_profile ?? null,
        dto.member_id ?? null,
        status,
      ],
    );
    await recordAudit(em, {
      spaceId: invite.space_id,
      actorId: session.actorId,
      deviceId: session.deviceId,
      action: 'join_request.create',
      resourceType: 'join_request',
      resourceId: id,
    });
    return { request_id: id, status };
  }

  /** The requester's own view; other people's request ids answer 404. */
  async status(session: SessionContext, requestId: string): Promise<JoinRequestStatusDto> {
    const { req, invite } = await this.load(this.ds.manager, requestId);
    if (req.actor_id !== session.actorId) throw new ApiError(ErrorCode.NOT_FOUND, 404);
    const status = visibleStatus(req, invite);
    return status === 'APPROVED' ? { status, space_id: req.space_id } : { status };
  }

  list(session: SessionContext, spaceId: string): Promise<JoinRequestSummaryDto[]> {
    return withTransaction(this.ds, async (em) => {
      await memberManager(em, this.access, session, spaceId);
      const rows: Array<RequestRow & { device_label: string | null }> = await em.query(
        `SELECT jr.*, d.label AS device_label FROM join_requests jr JOIN devices d ON d.id = jr.device_id
          WHERE jr.space_id = ? ORDER BY jr.created_at DESC, jr.id`,
        [spaceId],
      );
      const invites = await this.invitesById(em, [...new Set(rows.map((r) => r.invite_id))]);
      return rows.map((r) => {
        const invite = invites.get(r.invite_id)!;
        return {
          request_id: r.id,
          invite_id: r.invite_id,
          display_name: r.display_name,
          proposed_profile: r.proposed_profile,
          member_id: r.member_id,
          proposed_role: invite.proposed_role_key,
          device_label: r.device_label,
          status: visibleStatus(r, invite),
          created_at: r.created_at.toISOString(),
        };
      });
    });
  }

  /**
   * Re-checks approver rights, request and invite state, expiry and remaining uses under the Space lock, so two
   * concurrent approvals can never both spend the last use (identity-and-security.md "Invite và QR approval").
   */
  approve(
    session: SessionContext,
    spaceId: string,
    requestId: string,
    dto: ApproveJoinRequestDto,
  ): Promise<JoinRequestDecisionDto> {
    return withTransaction(
      this.ds,
      async (em) => {
        if (!isClientId(spaceId)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
        await lockSpace(em, spaceId);
        const ctx = await memberManager(em, this.access, session, spaceId);
        const { req, invite } = await this.load(em, requestId, spaceId, true);
        if (req.status === 'APPROVED') {
          return { request_id: req.id, status: 'APPROVED', member_id: req.approved_member_id ?? undefined };
        }
        if (req.status === 'PENDING_GUARDIAN') {
          throw new ApiError(ErrorCode.INVITE_INVALID, 409, 'Yêu cầu đang chờ người giám hộ xác nhận.', {
            status: 'PENDING_GUARDIAN',
          });
        }
        if (req.status !== 'PENDING' || inviteState(invite) !== 'ACTIVE') throw invalidInvite(409);

        const roleKey = await this.checkRole(em, ctx, dto.role_key);
        const memberId = await this.resolveMember(em, ctx, dto);
        await this.access.addMembership(em, spaceId, req.actor_id, roleKey.id);
        await this.access.addRepresentation(em, spaceId, req.actor_id, memberId, 'SELF');
        await em.query('UPDATE invites SET uses = uses + 1 WHERE id = ?', [invite.id]);
        await em.query(
          `UPDATE join_requests SET status = 'APPROVED', approved_member_id = ?, decided_by_actor_id = ?,
             decided_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
          [memberId, ctx.actorId, req.id],
        );
        await recordAudit(em, {
          spaceId,
          actorId: ctx.actorId,
          deviceId: ctx.deviceId,
          action: 'join_request.approve',
          resourceType: 'join_request',
          resourceId: req.id,
        });
        return { request_id: req.id, status: 'APPROVED', member_id: memberId };
      },
      { isolation: 'READ COMMITTED' },
    );
  }

  reject(session: SessionContext, spaceId: string, requestId: string): Promise<JoinRequestDecisionDto> {
    return withTransaction(this.ds, async (em) => {
      const ctx = await memberManager(em, this.access, session, spaceId);
      const { req } = await this.load(em, requestId, spaceId, true);
      if (req.status === 'APPROVED') throw invalidInvite(409);
      if (req.status !== 'REJECTED') {
        await em.query(
          `UPDATE join_requests SET status = 'REJECTED', decided_by_actor_id = ?, decided_at = UTC_TIMESTAMP(3),
             updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
          [ctx.actorId, req.id],
        );
        await recordAudit(em, {
          spaceId,
          actorId: ctx.actorId,
          deviceId: ctx.deviceId,
          action: 'join_request.reject',
          resourceType: 'join_request',
          resourceId: req.id,
        });
      }
      return { request_id: req.id, status: 'REJECTED' };
    });
  }

  guardianConfirm(session: SessionContext, requestId: string): Promise<JoinRequestDecisionDto> {
    return withTransaction(this.ds, async (em) => {
      const { req, invite } = await this.load(em, requestId, undefined, true);
      const [guardian]: unknown[] = await em.query(
        `SELECT 1 FROM join_requests jr WHERE jr.id = ? AND EXISTS (${GUARDED_REQUESTER_SQL})`,
        [req.id, session.actorId],
      );
      if (!guardian) throw new ApiError(ErrorCode.FORBIDDEN, 403);
      if (req.status === 'PENDING') return { request_id: req.id, status: 'PENDING' };
      if (req.status !== 'PENDING_GUARDIAN' || inviteState(invite) !== 'ACTIVE') throw invalidInvite(409);
      await em.query(
        `UPDATE join_requests SET status = 'PENDING', guardian_actor_id = ?, updated_at = UTC_TIMESTAMP(3)
          WHERE id = ?`,
        [session.actorId, req.id],
      );
      await recordAudit(em, {
        spaceId: req.space_id,
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'join_request.guardian_confirm',
        resourceType: 'join_request',
        resourceId: req.id,
      });
      return { request_id: req.id, status: 'PENDING' };
    });
  }

  /** Requests waiting for this caller as a Family guardian of the requester. */
  async guardianInbox(session: SessionContext): Promise<GuardianRequestDto[]> {
    const rows: Array<RequestRow & { space_name: string; space_kind: string }> = await this.ds.query(
      `SELECT jr.*, s.name AS space_name, s.kind AS space_kind FROM join_requests jr JOIN spaces s ON s.id = jr.space_id
        WHERE jr.status = 'PENDING_GUARDIAN' AND EXISTS (${GUARDED_REQUESTER_SQL})
        ORDER BY jr.created_at, jr.id`,
      [session.actorId],
    );
    const invites = await this.invitesById(this.ds.manager, [...new Set(rows.map((r) => r.invite_id))]);
    return rows
      .filter((r) => inviteState(invites.get(r.invite_id)!) === 'ACTIVE')
      .map((r) => ({
        request_id: r.id,
        display_name: r.display_name,
        space_name: r.space_name,
        space_kind: r.space_kind,
        created_at: r.created_at.toISOString(),
      }));
  }

  private async load(
    em: EntityManager,
    requestId: string,
    spaceId?: string,
    lock = false,
  ): Promise<{ req: RequestRow; invite: InviteRow }> {
    const suffix = lock ? ' FOR UPDATE' : '';
    const [req]: RequestRow[] = isClientId(requestId)
      ? await em.query(`SELECT * FROM join_requests WHERE id = ?${suffix}`, [requestId])
      : [];
    if (!req || (spaceId !== undefined && req.space_id !== spaceId)) throw new ApiError(ErrorCode.NOT_FOUND, 404);
    const [invite]: InviteRow[] = await em.query(`SELECT * FROM invites WHERE id = ?${suffix}`, [req.invite_id]);
    return { req, invite };
  }

  private async invitesById(em: EntityManager, ids: string[]): Promise<Map<string, InviteRow>> {
    if (ids.length === 0) return new Map();
    const rows: InviteRow[] = await em.query(
      `SELECT * FROM invites WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids,
    );
    return new Map(rows.map((r) => [r.id, r]));
  }

  private async checkRole(em: EntityManager, ctx: SpaceAccessContext, roleKey: string): Promise<{ id: string }> {
    const [role]: Array<{ id: string }> = await em.query(
      'SELECT id FROM roles WHERE space_id = ? AND role_key = ? AND deleted_at IS NULL',
      [ctx.spaceId, roleKey],
    );
    if (!role) throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { role_key: 'NOT_IN_SPACE' });
    if (OWNER_ROLE_KEYS.includes(roleKey) && !OWNER_ROLE_KEYS.includes(ctx.roleKey)) {
      throw new ApiError(ErrorCode.FORBIDDEN, 403);
    }
    return role;
  }

  private async resolveMember(em: EntityManager, ctx: SpaceAccessContext, dto: ApproveJoinRequestDto): Promise<string> {
    if (!!dto.member_id === !!dto.new_member) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { member_id: 'MEMBER_OR_NEW_MEMBER' });
    }
    if (dto.member_id) {
      const [member] = await RESOURCE_REGISTRY.member.find(em, ctx.spaceId, [dto.member_id]);
      if (!member || member.deleted_at) {
        throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { member_id: 'NOT_IN_SPACE' });
      }
      // One device-holder per Member: a second SELF link would let the newcomer read as someone else.
      const [linked]: unknown[] = await em.query(
        "SELECT 1 FROM member_representations WHERE space_id = ? AND member_id = ? AND relation = 'SELF'",
        [ctx.spaceId, dto.member_id],
      );
      if (linked) throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { member_id: 'ALREADY_LINKED' });
      return dto.member_id;
    }
    return this.createMember(em, ctx, dto.new_member!);
  }

  private async createMember(
    em: EntityManager,
    ctx: SpaceAccessContext,
    input: NonNullable<ApproveJoinRequestDto['new_member']>,
  ): Promise<string> {
    const def = RESOURCE_REGISTRY.member;
    const id = randomUUID();
    let draft;
    try {
      draft = await def.parse(
        {
          dataClass: 'NORMAL',
          sharingScope: ctx.spaceKind === 'GROUP' ? 'GROUP_MEMBERS' : 'FAMILY_ALL',
          displayName: input.display_name,
          relationship: input.relationship,
          profile: input.profile,
          interests: [],
          status: 'ACTIVE',
        },
        {
          em,
          spaceId: ctx.spaceId,
          spaceKind: ctx.spaceKind,
          actorId: ctx.actorId,
          action: 'create',
          resourceId: id,
          existing: null,
        },
      );
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      const fields = Object.fromEntries(Object.entries(err.fields ?? {}).map(([k, v]) => [`new_member.${k}`, v]));
      throw new ApiError(err.code, err.status, undefined, fields);
    }
    const meta = { spaceId: ctx.spaceId, revision: '1', now: new Date() };
    await def.insert(em, { ...draft, id }, meta);
    await appendChange(em, ctx.spaceId, 'member', id, '1', 'UPSERT', meta.now);
    return id;
  }
}
