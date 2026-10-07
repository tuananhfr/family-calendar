import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import type { AppConfig } from '../../config/configuration';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import { readSyncHead } from './changes.service';
import type { MembershipDto, SnapshotResponseDto } from './dto/pull.dto';
import { liveVisibleRecords, readableWire } from './record-view';
import { RESOURCE_REGISTRY } from './resource-registry';
import { RESOURCE_TYPES } from './resource-types';

const RECORD_TYPES = RESOURCE_TYPES.filter((t) => t !== 'space_settings');

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Everything the caller may read in one REPEATABLE READ transaction, so `watermark` matches the rows (TEC-20). */
  snapshot(session: SessionContext, spaceId: string): Promise<SnapshotResponseDto> {
    return withTransaction(
      this.ds,
      async (em) => {
        const { ctx, head } = await readSyncHead(em, this.access, session, spaceId);

        let total = 0;
        for (const type of RECORD_TYPES) total += await RESOURCE_REGISTRY[type].countLive(em, spaceId);
        const max = this.config.get('sync.snapshotMaxRecords', { infer: true });
        if (total > max) {
          this.logger.warn(`snapshot refused: space ${spaceId} holds ${total} records (cap ${max})`);
          throw new ApiError(ErrorCode.SNAPSHOT_TOO_LARGE, 413);
        }

        const records: Record<string, Array<Record<string, unknown>>> = {};
        for (const type of RECORD_TYPES) {
          const def = RESOURCE_REGISTRY[type];
          records[type] = (await liveVisibleRecords(em, ctx, def, await def.listLive(em, spaceId))).map((v) => v.wire);
        }
        const space = await readableWire(em, ctx, RESOURCE_REGISTRY.space_settings, spaceId);
        const memberships: Array<{ id: string; actor_id: string; role_id: string }> = await em.query(
          "SELECT id, actor_id, role_id FROM memberships WHERE space_id = ? AND status = 'ACTIVE' ORDER BY created_at, id",
          [spaceId],
        );
        return {
          watermark: head.change_seq,
          policy_version: head.policy_version,
          space: space ?? {},
          records,
          memberships: memberships.map((m): MembershipDto => ({ id: m.id, actorId: m.actor_id, roleId: m.role_id })),
          access: {
            actorId: ctx.actorId,
            roleKey: ctx.roleKey,
            matrix: ctx.matrix,
            restrictions: ctx.restrictions as Record<string, string>,
            representedMemberIds: ctx.representedMemberIds,
            guardianOfMemberIds: ctx.guardianOfMemberIds,
          },
        };
      },
      { isolation: 'REPEATABLE READ' },
    );
  }
}
