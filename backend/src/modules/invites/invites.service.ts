import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import { newOpaqueToken, sha256Hex } from '../../common/crypto/tokens';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import type { AppConfig } from '../../config/configuration';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import { hasLevel, type SpaceAccessContext } from '../access/evaluate-access';
import { recordAudit } from '../audit/record-audit';
import { EmailChannel } from '../delivery/channels/email.channel';
import type { CreateInviteDto, CreateInviteResponseDto, InvitePreviewDto, InviteSummaryDto } from './dto/invite.dto';

export interface InviteRow {
  id: string;
  space_id: string;
  issued_by_actor_id: string;
  max_uses: number;
  uses: number;
  proposed_role_key: string | null;
  email: string | null;
  status: 'ACTIVE' | 'REVOKED';
  expires_at: Date;
  created_at: Date;
}

/** Roles that can only be handed out by someone who holds one of them. */
export const OWNER_ROLE_KEYS = ['OWNER', 'ORGANIZER'];

export function inviteState(invite: InviteRow, now = new Date()): 'ACTIVE' | 'EXPIRED' | 'USED_UP' | 'REVOKED' {
  if (invite.status === 'REVOKED') return 'REVOKED';
  if (invite.expires_at.getTime() <= now.getTime()) return 'EXPIRED';
  if (invite.uses >= invite.max_uses) return 'USED_UP';
  return 'ACTIVE';
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function invalidInvite(status = 404): ApiError {
  return new ApiError(ErrorCode.INVITE_INVALID, status);
}

/** Context of a caller allowed to manage members (create/list/revoke invites, decide requests) in a SHARED Space. */
export async function memberManager(
  em: EntityManager,
  access: AccessService,
  session: SessionContext,
  spaceId: string,
): Promise<SpaceAccessContext> {
  if (!isClientId(spaceId)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
  const ctx = await access.loadContext(session, spaceId, em);
  const [space]: Array<{ sharing_state: string }> = await em.query('SELECT sharing_state FROM spaces WHERE id = ?', [
    spaceId,
  ]);
  if (space?.sharing_state !== 'SHARED' || !hasLevel(ctx, 'members', 'EDIT')) {
    throw new ApiError(ErrorCode.FORBIDDEN, 403);
  }
  return ctx;
}

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);
  private readonly appUrl: string;

  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    private readonly email: EmailChannel,
    config: ConfigService<AppConfig, true>,
  ) {
    this.appUrl = `${config.get('frontendOrigin', { infer: true })}${config.get('publicBasePath', { infer: true })}`;
  }

  async create(session: SessionContext, spaceId: string, dto: CreateInviteDto): Promise<CreateInviteResponseDto> {
    const created = await this.insert(session, spaceId, dto);
    if (dto.email) await this.sendInviteEmail(normalizeInviteEmail(dto.email), created.token);
    return created;
  }

  private insert(session: SessionContext, spaceId: string, dto: CreateInviteDto): Promise<CreateInviteResponseDto> {
    return withTransaction(this.ds, async (em) => {
      const ctx = await memberManager(em, this.access, session, spaceId);
      if (dto.proposed_role) {
        const [role]: unknown[] = await em.query(
          'SELECT id FROM roles WHERE space_id = ? AND role_key = ? AND deleted_at IS NULL',
          [spaceId, dto.proposed_role],
        );
        if (!role || OWNER_ROLE_KEYS.includes(dto.proposed_role)) {
          throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { proposed_role: 'NOT_IN_SPACE' });
        }
      }
      const id = randomUUID();
      const token = newOpaqueToken();
      const expiresAt = new Date(Date.now() + dto.expires_in_hours * 3600 * 1000);
      await em.query(
        `INSERT INTO invites (id, space_id, issued_by_actor_id, token_hash, max_uses, uses, approval_policy,
           proposed_role_key, email, status, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'ACTIVE', ?, UTC_TIMESTAMP(3))`,
        [
          id,
          spaceId,
          ctx.actorId,
          sha256Hex(token),
          dto.max_uses,
          dto.approval_policy,
          dto.proposed_role ?? null,
          dto.email ? normalizeInviteEmail(dto.email) : null,
          expiresAt,
        ],
      );
      await recordAudit(em, {
        spaceId,
        actorId: ctx.actorId,
        deviceId: ctx.deviceId,
        action: 'invite.create',
        resourceType: 'invite',
        resourceId: id,
      });
      return {
        invite_id: id,
        token,
        url: `/tham-gia/?token=${encodeURIComponent(token)}`,
        expires_at: expiresAt.toISOString(),
      };
    });
  }

  /**
   * Sent after commit so a mail failure never undoes the invite; the text names no Space or person because the
   * address may be read by someone else (privacy over convenience).
   */
  private async sendInviteEmail(to: string, token: string): Promise<void> {
    const link = `${this.appUrl}/tham-gia/?token=${encodeURIComponent(token)}`;
    try {
      await this.email.send({
        to,
        subject: 'Lịch Gia Đình: bạn có một lời mời',
        text: [
          'Bạn được mời tham gia một không gian trên Lịch Gia Đình.',
          '',
          'Mở liên kết sau để xem và gửi yêu cầu tham gia:',
          link,
          '',
          'Nếu bạn không biết người mời, hãy bỏ qua thư này.',
        ].join('\n'),
      });
    } catch {
      this.logger.warn('invite email could not be sent');
    }
  }

  list(session: SessionContext, spaceId: string): Promise<InviteSummaryDto[]> {
    return withTransaction(this.ds, async (em) => {
      await memberManager(em, this.access, session, spaceId);
      const rows: InviteRow[] = await em.query(
        'SELECT * FROM invites WHERE space_id = ? ORDER BY created_at DESC, id',
        [spaceId],
      );
      return rows.map((r) => this.summary(r));
    });
  }

  /** Revoking also closes every request still waiting on this invite (identity-and-security.md). */
  revoke(session: SessionContext, spaceId: string, inviteId: string): Promise<InviteSummaryDto> {
    return withTransaction(this.ds, async (em) => {
      const ctx = await memberManager(em, this.access, session, spaceId);
      const [invite]: InviteRow[] = isClientId(inviteId)
        ? await em.query('SELECT * FROM invites WHERE id = ? AND space_id = ? FOR UPDATE', [inviteId, spaceId])
        : [];
      if (!invite) throw new ApiError(ErrorCode.NOT_FOUND, 404);
      if (invite.status !== 'REVOKED') {
        await em.query("UPDATE invites SET status = 'REVOKED', revoked_at = UTC_TIMESTAMP(3) WHERE id = ?", [inviteId]);
        await em.query(
          `UPDATE join_requests SET status = 'REJECTED', decided_by_actor_id = ?, decided_at = UTC_TIMESTAMP(3),
             updated_at = UTC_TIMESTAMP(3)
           WHERE invite_id = ? AND status IN ('PENDING', 'PENDING_GUARDIAN')`,
          [ctx.actorId, inviteId],
        );
        await recordAudit(em, {
          spaceId,
          actorId: ctx.actorId,
          deviceId: ctx.deviceId,
          action: 'invite.revoke',
          resourceType: 'invite',
          resourceId: inviteId,
        });
        invite.status = 'REVOKED';
      }
      return this.summary(invite);
    });
  }

  /** The four fields a recipient needs to recognise the Space; nothing about its content (SHR-001). */
  async preview(token: string): Promise<InvitePreviewDto> {
    const invite = await this.findUsable(this.ds.manager, token);
    const [space]: Array<{ name: string; kind: 'FAMILY' | 'GROUP' }> = await this.ds.query(
      'SELECT name, kind FROM spaces WHERE id = ?',
      [invite.space_id],
    );
    return {
      space_name: space.name,
      space_kind: space.kind,
      inviter_display_name: await this.inviterName(this.ds.manager, invite),
      expires_at: invite.expires_at.toISOString(),
    };
  }

  async inviterName(em: EntityManager, invite: Pick<InviteRow, 'space_id' | 'issued_by_actor_id'>): Promise<string> {
    const [inviter]: Array<{ display_name: string }> = await em.query(
      `SELECT mb.display_name FROM member_representations mr
         JOIN members mb ON mb.space_id = mr.space_id AND mb.id = mr.member_id AND mb.deleted_at IS NULL
        WHERE mr.space_id = ? AND mr.actor_id = ? AND mr.relation = 'SELF'
        ORDER BY mb.created_at LIMIT 1`,
      [invite.space_id, invite.issued_by_actor_id],
    );
    return inviter?.display_name ?? 'Một thành viên';
  }

  /** An invite that can still take requests; unknown, revoked, expired and used-up look the same. */
  async findUsable(em: EntityManager, token: string, lock = false): Promise<InviteRow> {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw invalidInvite();
    const [invite]: InviteRow[] = await em.query(
      `SELECT i.* FROM invites i JOIN spaces s ON s.id = i.space_id
        WHERE i.token_hash = ? AND s.sharing_state = 'SHARED'${lock ? ' FOR UPDATE' : ''}`,
      [sha256Hex(token)],
    );
    if (!invite || inviteState(invite) !== 'ACTIVE') throw invalidInvite();
    return invite;
  }

  private summary(r: InviteRow): InviteSummaryDto {
    return {
      invite_id: r.id,
      status: inviteState(r),
      max_uses: Number(r.max_uses),
      uses: Number(r.uses),
      expires_at: r.expires_at.toISOString(),
      proposed_role: r.proposed_role_key,
      email: r.email,
      created_at: r.created_at.toISOString(),
    };
  }
}
