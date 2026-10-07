import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApiError } from '../errors/api-error';
import { ErrorCode } from '../errors/error-codes';

export interface SessionContext {
  sessionId: string;
  actorId: string;
  deviceId: string;
  accountId: string | null;
}

/** What SessionGuard attaches to the request; these extra fields never leave the server. */
export interface ResolvedSession extends SessionContext {
  csrfHash: string;
  lastSeenAt: Date;
  expiresAt: Date;
}

export interface SessionRequest extends Request {
  fcSession?: ResolvedSession;
}

export type AuthMode = 'required' | 'optional' | 'public';
export const AUTH_MODE_KEY = 'fc:auth-mode';

/** No session needed and none is loaded (health, public previews). */
export const Public = () => SetMetadata(AUTH_MODE_KEY, 'public' satisfies AuthMode);

/** Session is loaded when a valid cookie (and, for writes, CSRF token) is present; otherwise anonymous. */
export const OptionalSession = () => SetMetadata(AUTH_MODE_KEY, 'optional' satisfies AuthMode);

function toContext(s: ResolvedSession): SessionContext {
  return { sessionId: s.sessionId, actorId: s.actorId, deviceId: s.deviceId, accountId: s.accountId };
}

/** Injects the SessionContext; throws AUTH_REQUIRED if the route ran without one. */
export const CurrentSession = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionContext => {
  const s = ctx.switchToHttp().getRequest<SessionRequest>().fcSession;
  if (!s) throw new ApiError(ErrorCode.AUTH_REQUIRED, 401);
  return toContext(s);
});

/** Like CurrentSession but yields undefined for anonymous callers on OptionalSession routes. */
export const MaybeSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionContext | undefined => {
    const s = ctx.switchToHttp().getRequest<SessionRequest>().fcSession;
    return s ? toContext(s) : undefined;
  },
);
