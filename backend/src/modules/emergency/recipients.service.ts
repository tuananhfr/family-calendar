import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import { hasLevel, type SpaceAccessContext } from '../access/evaluate-access';
import { recordAudit } from '../audit/record-audit';
import type { EmergencyRecipientsDto, EmergencyRecipientsViewDto } from './dto/emergency.dto';

export interface EffectiveRecipients {
  memberIds: string[];
  configured: boolean;
}

/** OWNER/ADULT members by default: who receives must be a deliberate choice, not "everyone on the calendar". */
const DEFAULT_RECIPIENT_ROLES = ['OWNER', 'ADULT'];

@Injectable()
export class EmergencyRecipientsService {
  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
  ) {}

  /** SOS exists only in FAMILY Spaces (sos.md); a GROUP answers as if the route did not exist. */
  async familyContext(session: SessionContext, spaceId: string, em?: EntityManager): Promise<SpaceAccessContext> {
    const ctx = await this.access.loadContext(session, spaceId, em);
    if (ctx.spaceKind !== 'FAMILY') throw new ApiError(ErrorCode.NOT_FOUND, 404);
    return ctx;
  }

  async effective(em: EntityManager, spaceId: string): Promise<EffectiveRecipients> {
    const configured: Array<{ member_id: string; active: number }> = await em.query(
      `SELECT er.member_id, (m.deleted_at IS NULL AND m.status = 'ACTIVE') AS active
         FROM emergency_recipients er JOIN members m ON m.space_id = er.space_id AND m.id = er.member_id
        WHERE er.space_id = ? ORDER BY er.member_id`,
      [spaceId],
    );
    if (configured.length > 0) {
      return { memberIds: configured.filter((r) => Number(r.active) === 1).map((r) => r.member_id), configured: true };
    }
    const fallback: Array<{ member_id: string }> = await em.query(
      `SELECT DISTINCT mr.member_id
         FROM member_representations mr
         JOIN memberships ms ON ms.space_id = mr.space_id AND ms.actor_id = mr.actor_id AND ms.status = 'ACTIVE'
         JOIN roles r ON r.space_id = ms.space_id AND r.id = ms.role_id AND r.role_key IN (?)
         JOIN members m ON m.space_id = mr.space_id AND m.id = mr.member_id AND m.deleted_at IS NULL
                       AND m.status = 'ACTIVE'
        WHERE mr.space_id = ? AND mr.relation = 'SELF'
        ORDER BY mr.member_id`,
      [DEFAULT_RECIPIENT_ROLES, spaceId],
    );
    return { memberIds: fallback.map((r) => r.member_id), configured: false };
  }

  async view(session: SessionContext, spaceId: string): Promise<EmergencyRecipientsViewDto> {
    await this.familyContext(session, spaceId);
    const e = await this.effective(this.ds.manager, spaceId);
    return { member_ids: e.memberIds, configured: e.configured };
  }

  /** Replaces the list; an empty list returns to the default. */
  async replace(
    session: SessionContext,
    spaceId: string,
    dto: EmergencyRecipientsDto,
  ): Promise<EmergencyRecipientsViewDto> {
    const ids = [...new Set(dto.member_ids)].sort();
    return withTransaction(this.ds, async (em) => {
      const ctx = await this.familyContext(session, spaceId, em);
      if (!hasLevel(ctx, 'members', 'EDIT')) throw new ApiError(ErrorCode.FORBIDDEN, 403);
      if (ids.length > 0) {
        const found: Array<{ id: string }> = await em.query(
          `SELECT id FROM members WHERE space_id = ? AND id IN (?) AND deleted_at IS NULL AND status = 'ACTIVE'`,
          [spaceId, ids],
        );
        if (found.length !== ids.length) {
          throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { member_ids: 'MEMBER_NOT_IN_SPACE' });
        }
      }
      await em.query('DELETE FROM emergency_recipients WHERE space_id = ?', [spaceId]);
      const now = new Date();
      for (const id of ids) {
        await em.query(
          'INSERT INTO emergency_recipients (space_id, member_id, created_by_actor_id, created_at) VALUES (?, ?, ?, ?)',
          [spaceId, id, session.actorId, now],
        );
      }
      await recordAudit(em, {
        spaceId,
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'sos.recipients',
        resourceType: 'space',
        resourceId: spaceId,
      });
      const e = await this.effective(em, spaceId);
      return { member_ids: e.memberIds, configured: e.configured };
    });
  }
}
