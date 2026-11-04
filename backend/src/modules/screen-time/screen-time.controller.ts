import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentSession, type SessionContext } from '../../common/http/current-session.decorator';
import { RateLimit } from '../../common/http/rate-limit';
import { DeleteScreenDataDto, PairScreenDeviceDto, SaveScreenGoalDto, ScreenSummaryQueryDto } from './screen-time.dto';
import { ScreenTimeService } from './screen-time.service';
import { ScreenMembersResponse, ScreenPairingResponse, ScreenSummaryResponse } from './screen-time.responses';

@ApiTags('screen-time')
@ApiCookieAuth('fc_sid')
@ApiResponse({ status: 401, description: 'AUTH_REQUIRED / DEVICE_REVOKED' })
@ApiResponse({ status: 403, description: 'FORBIDDEN / SPACE_ACCESS_REVOKED' })
@ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
@ApiResponse({ status: 409, description: 'REVISION_CONFLICT' })
@ApiResponse({ status: 429, description: 'RATE_LIMITED' })
@Controller('spaces/:spaceId/screen-time')
export class ScreenTimeController {
  constructor(private readonly screen: ScreenTimeService) {}

  @Get('members')
  @ApiOkResponse({ type: ScreenMembersResponse })
  @ApiOperation({ summary: 'Danh sách thành viên mà phiên hiện tại được xem thời gian màn hình.' })
  members(@CurrentSession() session: SessionContext, @Param('spaceId') spaceId: string) {
    return this.screen.members(session, spaceId);
  }

  @Get('members/:memberId/summary')
  @ApiOkResponse({ type: ScreenSummaryResponse })
  summary(
    @CurrentSession() s: SessionContext,
    @Param('spaceId') space: string,
    @Param('memberId') member: string,
    @Query() query: ScreenSummaryQueryDto,
  ) {
    return this.screen.summary(s, space, member, query);
  }

  @Post('members/:memberId/pairings')
  @ApiCreatedResponse({ type: ScreenPairingResponse })
  @RateLimit({ bucket: 'screen-pair', limit: 10, windowSeconds: 600, by: 'actor' })
  pair(
    @CurrentSession() s: SessionContext,
    @Param('spaceId') space: string,
    @Param('memberId') member: string,
    @Body() dto: PairScreenDeviceDto,
  ) {
    return this.screen.pair(s, space, member, dto);
  }

  @Put('members/:memberId/goal')
  @ApiOkResponse({
    schema: { type: 'object', required: ['version'], properties: { version: { type: 'integer', minimum: 1 } } },
  })
  saveGoal(
    @CurrentSession() s: SessionContext,
    @Param('spaceId') space: string,
    @Param('memberId') member: string,
    @Body() dto: SaveScreenGoalDto,
  ) {
    return this.screen.saveGoal(s, space, member, dto);
  }

  @Delete('members/:memberId/devices/:deviceId')
  @HttpCode(204)
  disconnect(
    @CurrentSession() s: SessionContext,
    @Param('spaceId') space: string,
    @Param('memberId') member: string,
    @Param('deviceId') device: string,
  ) {
    return this.screen.disconnect(s, space, member, device);
  }

  @Get('members/:memberId/export')
  @ApiOkResponse({ type: ScreenSummaryResponse })
  @ApiOperation({ summary: 'Xuất JSON trong khoảng ngày đã chọn (tối đa 31 ngày).' })
  export(
    @CurrentSession() s: SessionContext,
    @Param('spaceId') space: string,
    @Param('memberId') member: string,
    @Query() query: ScreenSummaryQueryDto,
  ) {
    return this.screen.summary(s, space, member, query);
  }

  @Delete('members/:memberId/data')
  @HttpCode(204)
  delete(
    @CurrentSession() s: SessionContext,
    @Param('spaceId') space: string,
    @Param('memberId') member: string,
    @Body() _dto: DeleteScreenDataDto,
  ) {
    return this.screen.deleteData(s, space, member);
  }
}
