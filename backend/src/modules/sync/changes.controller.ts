import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import { ChangesService, MAX_CHANGES_LIMIT } from './changes.service';
import { ChangesResponseDto, SnapshotResponseDto } from './dto/pull.dto';
import { SnapshotService } from './snapshot.service';

@ApiTags('sync')
@ApiCookieAuth('fc_sid')
@Controller('spaces/:id/sync')
export class ChangesController {
  constructor(
    private readonly changesService: ChangesService,
    private readonly snapshots: SnapshotService,
  ) {}

  @Get('changes')
  @ApiQuery({ name: 'cursor', required: false, description: 'Last next_cursor (or snapshot watermark); default 0.' })
  @ApiQuery({ name: 'limit', required: false, description: `1-${MAX_CHANGES_LIMIT}, default ${MAX_CHANGES_LIMIT}.` })
  @ApiOkResponse({
    type: ChangesResponseDto,
    description: '409 RESYNC_REQUIRED when the cursor is ahead of the Space or older than the offline horizon.',
  })
  changes(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<ChangesResponseDto> {
    return this.changesService.changes(session, spaceId, cursor, limit);
  }

  @Get('snapshot')
  @ApiOkResponse({ type: SnapshotResponseDto, description: '413 SNAPSHOT_TOO_LARGE above the record cap.' })
  snapshot(@CurrentSession() session: SessionContext, @Param('id') spaceId: string): Promise<SnapshotResponseDto> {
    return this.snapshots.snapshot(session, spaceId);
  }
}
