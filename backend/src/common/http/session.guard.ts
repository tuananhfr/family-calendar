import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { SessionsService } from '../../modules/identity/sessions.service';
import { ApiError } from '../errors/api-error';
import { ErrorCode } from '../errors/error-codes';
import { AUTH_MODE_KEY, type AuthMode, type SessionRequest } from './current-session.decorator';
import { SESSION_COOKIE } from './session-cookies';

/** Deny by default: every route needs a live session unless marked @Public or @OptionalSession. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const mode =
      this.reflector.getAllAndOverride<AuthMode | undefined>(AUTH_MODE_KEY, [ctx.getHandler(), ctx.getClass()]) ??
      'required';
    if (mode === 'public') return true;

    const http = ctx.switchToHttp();
    const req = http.getRequest<SessionRequest>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      if (mode === 'optional') return true;
      throw new ApiError(ErrorCode.AUTH_REQUIRED, 401);
    }
    try {
      const session = await this.sessions.resolve(token);
      req.fcSession = session;
      await this.sessions.touch(session, token, req, http.getResponse<Response>());
    } catch (err) {
      if (mode === 'optional' && err instanceof ApiError) return true;
      throw err;
    }
    return true;
  }
}
