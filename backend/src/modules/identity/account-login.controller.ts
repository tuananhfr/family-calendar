import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiAcceptedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/http/current-session.decorator';
import { RateLimit } from '../../common/http/rate-limit';
import { setSessionCookies } from '../../common/http/session-cookies';
import { AccountLoginService } from './account-login.service';
import { IdentityOptionsDto, LoginCompletedDto, LoginPreviewDto, LoginTokenDto, LoginVerifyDto } from './dto/account-login.dto';
import { MagicLinkAcceptedDto, MagicLinkRequestDto } from './dto/recovery.dto';
import { SessionsService } from './sessions.service';
@ApiTags('account')
@Public()
@Controller('auth')
export class AccountLoginController {
  constructor(private readonly login: AccountLoginService, private readonly sessions: SessionsService) {}
  @Get('options') @ApiOkResponse({ type: IdentityOptionsDto })
  options(): IdentityOptionsDto { return { email_configured: this.login.emailConfigured }; }
  @Post('login') @HttpCode(202) @RateLimit({ bucket: 'login', limit: 20, windowSeconds: 3600, by: 'ip' })
  @ApiAcceptedResponse({ type: MagicLinkAcceptedDto })
  async request(@Body() dto: MagicLinkRequestDto): Promise<MagicLinkAcceptedDto> {
    await this.login.request(dto.email); return { accepted: true };
  }
  @Post('login/preview') @HttpCode(200) @RateLimit({ bucket: 'login-preview', limit: 60, windowSeconds: 3600, by: 'ip' })
  @ApiOkResponse({ type: LoginPreviewDto })
  preview(@Body() dto: LoginTokenDto): Promise<LoginPreviewDto> { return this.login.preview(dto.token); }
  @Post('login/verify') @HttpCode(200) @RateLimit({ bucket: 'login-verify', limit: 20, windowSeconds: 3600, by: 'ip' })
  @ApiOkResponse({ type: LoginCompletedDto })
  async verify(@Body() dto: LoginVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginCompletedDto> {
    const out = await this.login.verify(dto, req.get('user-agent'));
    setSessionCookies(res, out.issued, this.sessions.cookieOptions);
    return { actor_id: out.actorId, device_id: out.deviceId };
  }
}
