import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { ResolvedSession, SessionRequest } from '../../common/http/current-session.decorator';
import { clearSessionCookies } from '../../common/http/session-cookies';
import { SessionDto } from './dto/session.dto';
import { SessionsService } from './sessions.service';

function requireSession(req: SessionRequest): ResolvedSession {
  if (!req.fcSession) throw new ApiError(ErrorCode.AUTH_REQUIRED, 401);
  return req.fcSession;
}

@ApiTags('session')
@ApiCookieAuth('fc_sid')
@Controller('session')
export class SessionController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  @ApiOkResponse({ type: SessionDto })
  async current(@Req() req: SessionRequest, @Res({ passthrough: true }) res: Response): Promise<SessionDto> {
    const s = requireSession(req);
    const csrfToken = await this.sessions.csrfTokenFor(s, req, res);
    return { actorId: s.actorId, deviceId: s.deviceId, accountId: s.accountId, csrfToken };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiNoContentResponse()
  async logout(@Req() req: SessionRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    const s = requireSession(req);
    await this.sessions.revokeSession(s.sessionId);
    clearSessionCookies(res, this.sessions.cookieOptions.secure);
  }
}
