import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../../config/configuration';
import { withTransaction } from '../../database/transaction';
import { sha256Hex } from '../crypto/tokens';
import { ApiError } from '../errors/api-error';
import { ErrorCode } from '../errors/error-codes';
import type { SessionRequest } from './current-session.decorator';

export interface RateLimitRule {
  /** Logical bucket name, e.g. 'devices'. */
  bucket: string;
  limit: number;
  windowSeconds: number;
  by: 'ip' | 'actor' | 'device';
}

export const RATE_LIMIT_KEY = 'fc:rate-limit';

export const RateLimit = (rule: RateLimitRule) => SetMetadata(RATE_LIMIT_KEY, rule);

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Sliding-window counter stored in MariaDB so every API process shares it. Keys are hashed so
 * the table never holds IPs or emails.
 */
@Injectable()
export class RateLimitService {
  private readonly scale: number;

  constructor(
    private readonly ds: DataSource,
    config: ConfigService<AppConfig, true>,
  ) {
    this.scale = config.get('rateLimitScale', { infer: true });
  }

  async hit(bucket: string, identifier: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const windowMs = windowSeconds * 1000;
    const nowMs = Date.now();
    const currentStart = new Date(Math.floor(nowMs / windowMs) * windowMs);
    const previousStart = new Date(currentStart.getTime() - windowMs);
    const rateKey = sha256Hex(`${bucket}:${windowSeconds}:${identifier}`);
    const effectiveLimit = limit * this.scale;

    const counts = await withTransaction(this.ds, async (em) => {
      // The upsert takes the row lock, so concurrent hits on one key serialize and none is lost.
      await em.query(
        `INSERT INTO rate_limits (rate_key, window_start, count) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE count = count + 1`,
        [rateKey, currentStart],
      );
      const rows: Array<{ window_start: Date; count: number | string }> = await em.query(
        'SELECT window_start, count FROM rate_limits WHERE rate_key = ? AND window_start IN (?, ?)',
        [rateKey, currentStart, previousStart],
      );
      let current = 0;
      let previous = 0;
      for (const r of rows) {
        if (new Date(r.window_start).getTime() === currentStart.getTime()) current = Number(r.count);
        else previous = Number(r.count);
      }
      return { current, previous };
    });

    if (Math.random() < 0.01) void this.purge();

    const elapsed = (nowMs - currentStart.getTime()) / windowMs;
    const estimate = counts.previous * (1 - elapsed) + counts.current;
    if (estimate <= effectiveLimit) return { allowed: true, retryAfterSeconds: 0 };
    const retryAfterSeconds = Math.max(1, Math.ceil((currentStart.getTime() + windowMs - nowMs) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  private async purge(): Promise<void> {
    try {
      await this.ds.query('DELETE FROM rate_limits WHERE window_start < ?', [new Date(Date.now() - 2 * 86_400_000)]);
    } catch {
      // Best effort; stale rows only cost space.
    }
  }
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.getAllAndOverride<RateLimitRule | undefined>(RATE_LIMIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!rule) return true;
    const http = ctx.switchToHttp();
    const req = http.getRequest<SessionRequest>();
    const identifier =
      rule.by === 'ip' ? (req.ip ?? 'unknown') : rule.by === 'actor' ? req.fcSession?.actorId : req.fcSession?.deviceId;
    if (!identifier) return true;
    const result = await this.limiter.hit(rule.bucket, identifier, rule.limit, rule.windowSeconds);
    if (result.allowed) return true;
    http.getResponse<Response>().setHeader('Retry-After', String(result.retryAfterSeconds));
    throw new ApiError(ErrorCode.RATE_LIMITED, 429);
  }
}
