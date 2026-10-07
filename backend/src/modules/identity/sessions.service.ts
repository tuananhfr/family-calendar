import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { DataSource, type EntityManager } from 'typeorm';
import { newOpaqueToken, safeEqual, sha256Hex } from '../../common/crypto/tokens';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { ResolvedSession } from '../../common/http/current-session.decorator';
import { CSRF_COOKIE, setCsrfCookie, setSessionCookies, SESSION_COOKIE } from '../../common/http/session-cookies';
import type { AppConfig } from '../../config/configuration';
import { withTransaction } from '../../database/transaction';

export interface IssuedSession {
  sessionId: string;
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
}

interface SessionRow {
  id: string;
  actor_id: string;
  device_id: string;
  csrf_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  last_seen_at: Date;
  device_status: 'ACTIVE' | 'REVOKED';
  account_id: string | null;
}

const LAST_SEEN_THROTTLE_MS = 5 * 60_000;

@Injectable()
export class SessionsService {
  private readonly ttlMs: number;
  private readonly cookieSecure: boolean;

  constructor(
    private readonly ds: DataSource,
    config: ConfigService<AppConfig, true>,
  ) {
    this.ttlMs = config.get('sessionTtlDays', { infer: true }) * 86_400_000;
    this.cookieSecure = config.get('cookieSecure', { infer: true });
  }

  get cookieOptions(): { secure: boolean; maxAgeMs: number } {
    return { secure: this.cookieSecure, maxAgeMs: this.ttlMs };
  }

  /** Creates a session row for an existing device; raw tokens are returned once and never stored. */
  async issueSession(em: EntityManager, actorId: string, deviceId: string): Promise<IssuedSession> {
    const sessionToken = newOpaqueToken();
    const csrfToken = newOpaqueToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    const sessionId = randomUUID();
    await em.query(
      `INSERT INTO sessions (id, token_hash, actor_id, device_id, csrf_hash, expires_at, revoked_at, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [sessionId, sha256Hex(sessionToken), actorId, deviceId, sha256Hex(csrfToken), expiresAt, now, now],
    );
    return { sessionId, sessionToken, csrfToken, expiresAt };
  }

  /**
   * Adds a device to an existing actor and opens its session. Callers (join approval, recovery)
   * must already have proven the right to bind this device to the actor.
   */
  async createDeviceWithSession(
    actorId: string,
    deviceId: string,
    meta: { label?: string | null; userAgent?: string | null },
    em?: EntityManager,
  ): Promise<IssuedSession> {
    const run = async (m: EntityManager) => {
      await this.insertDevice(m, actorId, deviceId, meta);
      return this.issueSession(m, actorId, deviceId);
    };
    return em ? run(em) : withTransaction(this.ds, run);
  }

  async insertDevice(
    em: EntityManager,
    actorId: string,
    deviceId: string,
    meta: { label?: string | null; userAgent?: string | null },
  ): Promise<void> {
    await em.query(
      `INSERT INTO devices (id, actor_id, label, user_agent_hash, status, created_at, revoked_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, NULL)`,
      [deviceId, actorId, meta.label ?? null, meta.userAgent ? sha256Hex(meta.userAgent) : null, new Date()],
    );
  }

  async resolve(token: string): Promise<ResolvedSession> {
    const rows: SessionRow[] = await this.ds.query(
      `SELECT s.id, s.actor_id, s.device_id, s.csrf_hash, s.expires_at, s.revoked_at, s.last_seen_at,
              d.status AS device_status,
              (SELECT al.account_id FROM account_links al
                WHERE al.actor_id = s.actor_id AND al.unlinked_at IS NULL
                ORDER BY al.linked_at DESC LIMIT 1) AS account_id
         FROM sessions s JOIN devices d ON d.id = s.device_id
        WHERE s.token_hash = ?`,
      [sha256Hex(token)],
    );
    const row = rows[0];
    if (!row) throw new ApiError(ErrorCode.AUTH_REQUIRED, 401);
    // Device revocation outranks other states so the client knows to purge rather than re-login.
    if (row.device_status === 'REVOKED') throw new ApiError(ErrorCode.DEVICE_REVOKED, 401);
    if (row.revoked_at) throw new ApiError(ErrorCode.AUTH_REQUIRED, 401);
    if (new Date(row.expires_at).getTime() <= Date.now()) throw new ApiError(ErrorCode.SESSION_EXPIRED, 401);
    return {
      sessionId: row.id,
      actorId: row.actor_id,
      deviceId: row.device_id,
      accountId: row.account_id,
      csrfHash: row.csrf_hash,
      lastSeenAt: new Date(row.last_seen_at),
      expiresAt: new Date(row.expires_at),
    };
  }

  /**
   * Throttled last-seen update plus sliding expiry: once half the TTL has passed the session is
   * extended and the cookies re-sent, so devices in regular use never silently drop out.
   */
  async touch(session: ResolvedSession, token: string, req: Request, res: Response): Promise<void> {
    const now = Date.now();
    const extend = session.expiresAt.getTime() - now < this.ttlMs / 2;
    const stale = now - session.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS;
    if (!extend && !stale) return;
    if (extend) {
      await this.ds.query('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?', [
        new Date(now),
        new Date(now + this.ttlMs),
        session.sessionId,
      ]);
      const csrf: unknown = req.cookies?.[CSRF_COOKIE];
      if (typeof csrf === 'string' && safeEqual(sha256Hex(csrf), session.csrfHash)) {
        setSessionCookies(res, { sessionToken: token, csrfToken: csrf }, this.cookieOptions);
      } else {
        res.cookie(SESSION_COOKIE, token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: this.cookieSecure,
          path: '/',
          maxAge: this.ttlMs,
        });
      }
      return;
    }
    await this.ds.query('UPDATE sessions SET last_seen_at = ? WHERE id = ?', [new Date(now), session.sessionId]);
  }

  /** Returns the CSRF token from the cookie when it still matches; otherwise rotates it. */
  async csrfTokenFor(session: ResolvedSession, req: Request, res: Response): Promise<string> {
    const cookie: unknown = req.cookies?.[CSRF_COOKIE];
    if (typeof cookie === 'string' && safeEqual(sha256Hex(cookie), session.csrfHash)) return cookie;
    const csrfToken = newOpaqueToken();
    await this.ds.query('UPDATE sessions SET csrf_hash = ? WHERE id = ?', [sha256Hex(csrfToken), session.sessionId]);
    setCsrfCookie(res, csrfToken, this.cookieOptions);
    return csrfToken;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.ds.query('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', [
      new Date(),
      sessionId,
    ]);
  }
}
