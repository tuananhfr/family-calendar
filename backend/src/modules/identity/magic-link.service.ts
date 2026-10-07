import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { newOpaqueToken, sha256Hex } from '../../common/crypto/tokens';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { RateLimitService } from '../../common/http/rate-limit';
import type { AppConfig } from '../../config/configuration';
import { withTransaction } from '../../database/transaction';
import { recordAudit } from '../audit/record-audit';
import { EmailChannel } from '../delivery/channels/email.channel';
import type { MagicLinkVerifiedDto } from './dto/recovery.dto';

const PURPOSE = 'LINK_ACCOUNT';
const TOKEN_TTL_MS = 15 * 60_000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const invalidToken = () => new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { token: 'INVALID' });

@Injectable()
export class MagicLinkService {
  private readonly logger = new Logger(MagicLinkService.name);
  private readonly frontendOrigin: string;

  constructor(
    private readonly ds: DataSource,
    private readonly email: EmailChannel,
    private readonly rateLimit: RateLimitService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.frontendOrigin = config.get('frontendOrigin', { infer: true });
  }

  /**
   * Same outcome for every address (anti-enumeration): whether an account exists, or the per-address limit was hit,
   * never changes what the caller sees.
   */
  async request(session: SessionContext, rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const perAddress = await this.rateLimit.hit('magic-link-email', email, 5, 3600);
    if (!perAddress.allowed) return;

    const token = newOpaqueToken();
    await this.ds.query(
      `INSERT INTO magic_link_tokens (id, token_hash, email, purpose, actor_id, expires_at, used_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, UTC_TIMESTAMP(3))`,
      [randomUUID(), sha256Hex(token), email, PURPOSE, session.actorId, new Date(Date.now() + TOKEN_TTL_MS)],
    );
    const link = `${this.frontendOrigin}/xac-thuc/?token=${encodeURIComponent(token)}`;
    try {
      const sent = await this.email.send({
        to: email,
        subject: 'Lịch Gia Đình: xác nhận email',
        text: `Mở liên kết sau trong 15 phút để gắn email này với thiết bị của bạn:\n\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua thư này.`,
      });
      // File mode means nothing was delivered; warn (stderr, any log level) with the path, never the token.
      if (sent.file) console.warn(`magic link written to ${sent.file}`);
    } catch {
      this.logger.warn('magic link email could not be sent');
    }
  }

  /** Links the caller's Actor as-is (same id, same records) to the account for the token's address. */
  verify(session: SessionContext, token: string): Promise<MagicLinkVerifiedDto> {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return Promise.reject(invalidToken());
    return withTransaction(this.ds, async (em) => {
      const [row]: Array<{ id: string; email: string; actor_id: string | null; expires_at: Date }> = await em.query(
        `SELECT id, email, actor_id, expires_at FROM magic_link_tokens
          WHERE token_hash = ? AND purpose = ? AND used_at IS NULL FOR UPDATE`,
        [sha256Hex(token), PURPOSE],
      );
      if (!row || row.actor_id !== session.actorId || row.expires_at.getTime() <= Date.now()) throw invalidToken();
      await em.query('UPDATE magic_link_tokens SET used_at = UTC_TIMESTAMP(3) WHERE id = ?', [row.id]);

      await em.query(
        `INSERT INTO accounts (id, email, email_verified_at, created_at) VALUES (?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP(3))`,
        [randomUUID(), row.email],
      );
      const [account]: Array<{ id: string }> = await em.query('SELECT id FROM accounts WHERE email = ?', [row.email]);
      // One active account per Actor: linking a new address replaces the old link.
      await em.query(
        'UPDATE account_links SET unlinked_at = UTC_TIMESTAMP(3) WHERE actor_id = ? AND account_id <> ? AND unlinked_at IS NULL',
        [session.actorId, account.id],
      );
      await em.query(
        `INSERT INTO account_links (account_id, actor_id, linked_at, unlinked_at) VALUES (?, ?, UTC_TIMESTAMP(3), NULL)
         ON DUPLICATE KEY UPDATE linked_at = IF(unlinked_at IS NULL, linked_at, UTC_TIMESTAMP(3)), unlinked_at = NULL`,
        [account.id, session.actorId],
      );
      await recordAudit(em, {
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'account.link',
        resourceType: 'account',
        resourceId: account.id,
      });
      return { account_id: account.id, email: row.email, actor_id: session.actorId };
    });
  }
}
