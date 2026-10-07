import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import type { SpaceSummaryDto } from './dto/bootstrap.dto';

interface SummaryRow {
  id: string;
  kind: 'FAMILY' | 'GROUP';
  name: string;
  time_zone: string;
  sharing_state: 'INITIALIZING' | 'SHARED';
  policy_version: string;
  role_key: string;
}

// An INITIALIZING Space is visible to its creator only (sync-protocol.md "Bật chia sẻ lần đầu").
const SUMMARY_SQL = `SELECT s.id, s.kind, s.name, s.time_zone, s.sharing_state, s.policy_version, r.role_key
   FROM memberships m
   JOIN spaces s ON s.id = m.space_id
   JOIN roles r ON r.space_id = m.space_id AND r.id = m.role_id
  WHERE m.actor_id = ? AND m.status = 'ACTIVE'
    AND (s.sharing_state = 'SHARED' OR s.created_by_actor_id = m.actor_id)`;

function toSummary(row: SummaryRow): SpaceSummaryDto {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    timeZone: row.time_zone,
    sharingState: row.sharing_state,
    roleKey: row.role_key,
    policyVersion: String(row.policy_version),
  };
}

@Injectable()
export class SpacesService {
  constructor(private readonly ds: DataSource) {}

  async list(session: SessionContext): Promise<SpaceSummaryDto[]> {
    const rows: SummaryRow[] = await this.ds.query(`${SUMMARY_SQL} ORDER BY s.created_at, s.id`, [session.actorId]);
    return rows.map(toSummary);
  }

  async get(session: SessionContext, spaceId: string): Promise<SpaceSummaryDto> {
    if (!isClientId(spaceId)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    const [row]: SummaryRow[] = await this.ds.query(`${SUMMARY_SQL} AND s.id = ?`, [session.actorId, spaceId]);
    if (!row) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    return toSummary(row);
  }
}
