import { Body, Controller, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentSession, Public, type SessionContext } from '../../common/http/current-session.decorator';
import { RateLimit } from '../../common/http/rate-limit';
import { setSessionCookies } from '../../common/http/session-cookies';
import { RecoveryCodeDto, RedeemRecoveryDto, RedeemRecoveryResponseDto } from './dto/recovery.dto';
import { RecoveryService } from './recovery.service';
import { SessionsService } from './sessions.service';

@ApiTags('recovery')
@Controller()
export class RecoveryController {
  constructor(
    private readonly recovery: RecoveryService,
    private readonly sessions: SessionsService,
  ) {}

  @Post('spaces/:id/recovery-codes')
  @HttpCode(201)
  @ApiCookieAuth('fc_sid')
  @ApiCreatedResponse({
    type: RecoveryCodeDto,
    description: 'Active member of a SHARED Space; the previous code dies.',
  })
  issue(@CurrentSession() session: SessionContext, @Param('id') spaceId: string): Promise<RecoveryCodeDto> {
    return this.recovery.issue(session, spaceId);
  }

  @Post('recovery/redeem')
  @Public()
  @HttpCode(200)
  @RateLimit({ bucket: 'recovery-redeem', limit: 5, windowSeconds: 3600, by: 'ip' })
  @ApiOkResponse({
    type: RedeemRecoveryResponseDto,
    description:
      'Sets fc_sid and fc_csrf for the new device. 422 RECOVERY_INVALID for any wrong, used or mismatched code.',
  })
  async redeem(
    @Body() dto: RedeemRecoveryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RedeemRecoveryResponseDto> {
    const out = await this.recovery.redeem(dto, req.get('user-agent'));
    setSessionCookies(res, out.issued, this.sessions.cookieOptions);
    return { actor_id: out.actorId, device_id: out.deviceId, code: out.code };
  }
}
