import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import { withTransaction } from '../../database/transaction';
import { recordAudit } from '../audit/record-audit';
import type { CreateJoinRequestDto, JoinRequestCreatedDto, MyInvitationDto } from './dto/invite.dto';
import { InvitesService, invalidInvite, type InviteRow } from './invites.service';
import { JoinRequestsService } from './join-requests.service';

// Usable invites addressed to one of the caller's verified, linked emails that the caller has not answered yet.
const ADDRESSED_SQL = `SELECT i.*, s.name AS space_name, s.kind AS space_kind
   FROM invites i
   JOIN spaces s ON s.id = i.space_id AND s.sharing_state = 'SHARED'
   JOIN accounts a ON a.email = i.email AND a.email_verified_at IS NOT NULL
   JOIN account_links al ON al.account_id = a.id AND al.actor_id = ? AND al.unlinked_at IS NULL
  WHERE i.status = 'ACTIVE' AND i.expires_at > UTC_TIMESTAMP(3) AND i.uses < i.max_uses
    AND NOT EXISTS (SELECT 1 FROM join_requests jr WHERE jr.invite_id = i.id AND jr.actor_id = al.actor_id)
    AND NOT EXISTS (SELECT 1 FROM memberships m
                     WHERE m.space_id = i.space_id AND m.actor_id = al.actor_id AND m.status = 'ACTIVE')`;

type AddressedRow = InviteRow & { space_name: string; space_kind: 'FAMILY' | 'GROUP' };

@Injectable()
export class MeInvitationsService {
  constructor(
    private readonly ds: DataSource,
    private readonly invites: InvitesService,
    private readonly requests: JoinRequestsService,
  ) {}

  async list(session: SessionContext): Promise<MyInvitationDto[]> {
    const rows: AddressedRow[] = await this.ds.query(`${ADDRESSED_SQL} ORDER BY i.created_at DESC, i.id`, [
      session.actorId,
    ]);
    return Promise.all(
      rows.map(async (r) => ({
        invite_id: r.id,
        space_name: r.space_name,
        space_kind: r.space_kind,
        inviter_display_name: await this.invites.inviterName(this.ds.manager, r),
        expires_at: r.expires_at.toISOString(),
      })),
    );
  }

  accept(session: SessionContext, inviteId: string, dto: CreateJoinRequestDto): Promise<JoinRequestCreatedDto> {
    return withTransaction(this.ds, async (em) => {
      const invite = await this.addressed(em, session, inviteId);
      return this.requests.createFor(em, session, invite, dto);
    });
  }

  /** Recorded as a REJECTED request so the invite stops showing for this Actor; the inviter is not told why. */
  decline(session: SessionContext, inviteId: string): Promise<{ status: 'DECLINED' }> {
    return withTransaction(this.ds, async (em) => {
      const invite = await this.addressed(em, session, inviteId);
      const id = randomUUID();
      await em.query(
        `INSERT INTO join_requests (id, invite_id, space_id, actor_id, device_id, display_name, proposed_profile,
           member_id, status, decided_by_actor_id, decided_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, '', NULL, NULL, 'REJECTED', ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
        [id, invite.id, invite.space_id, session.actorId, session.deviceId, session.actorId],
      );
      await recordAudit(em, {
        spaceId: invite.space_id,
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'invite.decline',
        resourceType: 'invite',
        resourceId: invite.id,
      });
      return { status: 'DECLINED' as const };
    });
  }

  /** Invites not addressed to the caller look exactly like unknown ones. */
  private async addressed(em: EntityManager, session: SessionContext, inviteId: string): Promise<InviteRow> {
    if (!isClientId(inviteId)) throw invalidInvite();
    const [invite]: InviteRow[] = await em.query(`${ADDRESSED_SQL} AND i.id = ? FOR UPDATE`, [
      session.actorId,
      inviteId,
    ]);
    if (!invite) throw invalidInvite();
    return invite;
  }
}
