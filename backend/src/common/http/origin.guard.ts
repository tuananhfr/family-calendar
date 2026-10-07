import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AppConfig } from '../../config/configuration';
import { ApiError } from '../errors/api-error';
import { ErrorCode } from '../errors/error-codes';
import { isWriteMethod } from './write-methods';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Rejects cross-site writes by Origin (or Referer when Origin is absent). Requests with neither
 * header come from non-browser clients, which cannot ride a victim's cookies, so they pass here
 * and still face the CSRF token check.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed: Set<string>;

  constructor(config: ConfigService<AppConfig, true>) {
    this.allowed = new Set(config.get('allowedOrigins', { infer: true }));
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!isWriteMethod(req.method)) return true;
    const origin = req.get('origin');
    const referer = req.get('referer');
    const source =
      origin !== undefined ? (origin === 'null' ? null : originOf(origin)) : referer ? originOf(referer) : undefined;
    if (source === undefined) return true;
    if (source !== null && this.allowed.has(source)) return true;
    throw new ApiError(ErrorCode.CSRF_INVALID, 403);
  }
}
