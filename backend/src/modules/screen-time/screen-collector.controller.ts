import { Body, Controller, Delete, Get, Headers, HttpCode, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/http/current-session.decorator';
import { RateLimit } from '../../common/http/rate-limit';
import { RedeemScreenPairingDto, ScreenBatchDto, ScreenCollectorStateDto } from './screen-time.dto';
import { ScreenTimeService } from './screen-time.service';
import { ScreenLinkResponse } from './screen-time.responses';

@ApiTags('screen-time-collector')
@Public()
@ApiResponse({ status: 401, description: 'AUTH_REQUIRED / DEVICE_REVOKED' })
@ApiResponse({ status: 403, description: 'FORBIDDEN / SPACE_ACCESS_REVOKED' })
@ApiResponse({ status: 409, description: 'OPERATION_ID_REUSED' })
@ApiResponse({ status: 422, description: 'VALIDATION_FAILED / INVITE_INVALID' })
@ApiResponse({ status: 429, description: 'RATE_LIMITED' })
@Controller('screen-time/collector')
@RateLimit({ bucket: 'screen-collector', limit: 120, windowSeconds: 60, by: 'ip' })
export class ScreenCollectorController {
  constructor(private readonly screen: ScreenTimeService) {}

  private token(header?: string): string {
    return header?.startsWith('Bearer ') ? header.slice(7) : '';
  }

  @Post('link')
  @ApiCreatedResponse({ type: ScreenLinkResponse })
  @RateLimit({ bucket: 'screen-redeem', limit: 10, windowSeconds: 600, by: 'ip' })
  @ApiOperation({ summary: 'Đổi mã dùng một lần lấy token chỉ được upload cho thiết bị này.' })
  link(@Body() dto: RedeemScreenPairingDto) {
    return this.screen.redeem(dto.code);
  }

  @Get('config')
  @ApiBearerAuth('screen-device')
  config(@Headers('authorization') header?: string) {
    return this.screen.config(this.token(header));
  }

  @Put('state')
  @ApiBearerAuth('screen-device')
  state(@Body() dto: ScreenCollectorStateDto, @Headers('authorization') header?: string) {
    return this.screen.state(this.token(header), dto);
  }

  @Post('batches')
  @ApiBearerAuth('screen-device')
  @HttpCode(200)
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['accepted', 'duplicate'],
      properties: { accepted: { type: 'integer' }, duplicate: { type: 'boolean' } },
    },
  })
  ingest(@Body() dto: ScreenBatchDto, @Headers('authorization') header?: string) {
    return this.screen.ingest(this.token(header), dto);
  }

  @Delete('link')
  @ApiBearerAuth('screen-device')
  @HttpCode(204)
  disconnect(@Headers('authorization') header?: string) {
    return this.screen.collectorDisconnect(this.token(header));
  }
}
