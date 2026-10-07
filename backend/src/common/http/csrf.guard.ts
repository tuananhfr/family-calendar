import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { safeEqual, sha256Hex } from '../crypto/tokens';
import { ApiError } from '../errors/api-error';
import { ErrorCode } from '../errors/error-codes';
import { AUTH_MODE_KEY, type AuthMode, type SessionRequest } from './current-session.decorator';
import { CSRF_COOKIE, CSRF_HEADER } from './session-cookies';
import { isWriteMethod } from './write-methods';

/** Double-submit check bound to the session: header == cookie and sha256(header) == sessions.csrf_hash. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<SessionRequest>();
    if (!isWriteMethod(req.method) || !req.fcSession) return true;

    const header = req.get(CSRF_HEADER) ?? '';
    const cookie: unknown = req.cookies?.[CSRF_COOKIE];
    const valid =
      typeof cookie === 'string' && safeEqual(header, cookie) && safeEqual(sha256Hex(header), req.fcSession.csrfHash);
    if (valid) return true;

    const mode = this.reflector.getAllAndOverride<AuthMode | undefined>(AUTH_MODE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (mode === 'optional') {
      // An unverified cookie must not lend its identity to the request; continue as anonymous.
      delete req.fcSession;
      return true;
    }
    throw new ApiError(ErrorCode.CSRF_INVALID, 403);
  }
}
