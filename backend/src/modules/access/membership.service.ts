import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import { withTransaction } from '../../database/transaction';
import { recordAudit } from '../audit/record-audit';
import { lockSpace } from "../sync/change-log";
import { AccessService } from './access.service';
import { sharedSpaceContext } from './shared-space-context';
import type { MembershipListDto } from './dto/membership.dto';
@Injectable()
export class MembershipService {
  constructor(private readonly ds: DataSource, private readonly access: AccessService) {}
  async list(session: SessionContext, spaceId: string): Promise<MembershipListDto> {
    const ctx = await sharedSpaceContext(this.ds, this.access, session, spaceId, 'members', 'VIEW');
    const memberships = await this.ds.query(
      "SELECT m.actor_id, m.role_id, r.role_key, COALESCE(MAX(mb.display_name), 'Thành viên') AS display_name FROM memberships m JOIN roles r ON r.id = m.role_id AND r.space_id = m.space_id LEFT JOIN member_representations mr ON mr.actor_id = m.actor_id AND mr.space_id = m.space_id AND mr.relation = 'SELF' LEFT JOIN members mb ON mb.id = mr.member_id AND mb.deleted_at IS NULL AND (mb.sharing_scope <> 'PRIVATE' OR mb.created_by_actor_id = ?) WHERE m.space_id = ? AND m.status = 'ACTIVE' GROUP BY m.actor_id, m.role_id, r.role_key ORDER BY r.role_key, display_name", [session.actorId, spaceId]);
    const roles = await this.ds.query("SELECT id, role_key, name, matrix FROM roles WHERE space_id = ? AND deleted_at IS NULL ORDER BY role_key", [spaceId]);
    for (const role of roles) if (typeof role.matrix === 'string') role.matrix = JSON.parse(role.matrix);
    return { memberships, roles, can_manage: ['OWNER', 'ORGANIZER'].includes(ctx.roleKey) };
  }
  async change(session: SessionContext, spaceId: string, actorId: string, roleId?: string) {
    if (!isClientId(spaceId) || !isClientId(actorId)) throw new ApiError(ErrorCode.NOT_FOUND, 404);
    return withTransaction(this.ds, async (em) => {
      const space = await lockSpace(em, spaceId);
      if (space?.sharing_state !== "SHARED") throw new ApiError(ErrorCode.FORBIDDEN, 403);
      const ctx = await this.access.loadContext(session, spaceId, em);
      if (!['OWNER', 'ORGANIZER'].includes(ctx.roleKey)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
      const policy = roleId ? await this.access.assignRole(em, spaceId, actorId, roleId)
        : await this.access.removeMembership(em, spaceId, actorId);
      await recordAudit(em, { spaceId, actorId: session.actorId, deviceId: session.deviceId,
        action: roleId ? 'membership.role' : 'membership.remove', resourceType: 'membership', resourceId: actorId });
      return { policy_version: policy };
    });
  }
}
