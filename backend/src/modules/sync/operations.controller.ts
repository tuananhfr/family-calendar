import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import { SyncOperationsRequestDto, SyncOperationsResponseDto } from './dto/operation.dto';
import { MAX_BATCH_BYTES } from './operation-envelope';
import { OperationsService } from './operations.service';

@ApiTags('sync')
@ApiCookieAuth('fc_sid')
@Controller('spaces/:id/sync')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Post('operations')
  @HttpCode(200)
  @ApiOkResponse({
    type: SyncOperationsResponseDto,
    description:
      'One result per operation, in order. 413 PAYLOAD_TOO_LARGE above 50 operations or 512 KB; 401/403 when the ' +
      'session, device or membership no longer allows writing to the Space.',
  })
  async apply(
    @CurrentSession() session: SessionContext,
    @Param('id') spaceId: string,
    @Body() dto: SyncOperationsRequestDto,
    @Req() req: Request,
  ): Promise<SyncOperationsResponseDto> {
    if (Number(req.get('content-length') ?? 0) > MAX_BATCH_BYTES) throw new ApiError(ErrorCode.PAYLOAD_TOO_LARGE, 413);
    return this.operations.apply(session, spaceId, dto.operations);
  }
}
