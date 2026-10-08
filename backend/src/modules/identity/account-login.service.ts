import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import { newOpaqueToken, sha256Hex } from '../../common/crypto/tokens';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { RateLimitService } from '../../common/http/rate-limit';
import type { AppConfig } from '../../config/configuration';
import { withTransaction } from '../../database/transaction';
import { recordAudit } from '../audit/record-audit';
import { EmailChannel } from '../delivery/channels/email.channel';
import type { LoginVerifyDto, LoginActorDto } from './dto/account-login.dto';
import { normalizeEmail } from './magic-link.service';
import { SessionsService } from './sessions.service';

const PURPOSE = 'LOGIN';
const invalid = () => new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { token: 'INVALID' });
@Injectable()
export class AccountLoginService {
  private readonly logger = new Logger(AccountLoginService.name);
  private readonly appUrl: string;
  constructor(private readonly ds: DataSource, private readonly mail: EmailChannel,
    private readonly sessions: SessionsService, private readonly limits: RateLimitService,
    config: ConfigService<AppConfig, true>) {
    this.appUrl = config.get('frontendOrigin', { infer: true }) + config.get('publicBasePath', { infer: true });
  }
  get emailConfigured(): boolean { return !this.mail.writesFiles; }
  async request(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    if (!(await this.limits.hit('login-email', email, 5, 3600)).allowed) return;
    const token = newOpaqueToken();
    await this.ds.query(
      'INSERT INTO magic_link_tokens (id, token_hash, email, purpose, actor_id, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?, NULL, UTC_TIMESTAMP(3))',
      [randomUUID(), sha256Hex(token), email, PURPOSE, new Date(Date.now() + 15 * 60_000)]);
    try {
      await this.mail.send({ to: email, subject: 'Lịch Gia Đình: đăng nhập',
        text: 'Mở liên kết trong 15 phút để đăng nhập trên thiết bị này:\n\n' + this.appUrl + '/xac-thuc/#purpose=login&token=' + encodeURIComponent(token) });
    } catch { this.logger.warn('login email could not be sent'); }
  }
  private async token(em: EntityManager, token: string, lock: boolean): Promise<{ id: string; email: string }> {
    const [row]: Array<{ id: string; email: string; expires_at: Date }> = await em.query(
      'SELECT id, email, expires_at FROM magic_link_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL' + (lock ? ' FOR UPDATE' : ''),
      [sha256Hex(token), PURPOSE]);
    if (!row || row.expires_at.getTime() <= Date.now()) throw invalid();
    return row;
  }
  private actors(em: EntityManager, email: string): Promise<LoginActorDto[]> {
    return em.query(
      "SELECT al.actor_id, COALESCE(GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', '), 'Lịch Gia Đình') AS label FROM accounts a JOIN account_links al ON al.account_id = a.id AND al.unlinked_at IS NULL LEFT JOIN memberships m ON m.actor_id = al.actor_id AND m.status = 'ACTIVE' LEFT JOIN spaces s ON s.id = m.space_id AND s.sharing_state = 'SHARED' WHERE a.email = ? AND a.email_verified_at IS NOT NULL GROUP BY al.actor_id ORDER BY al.actor_id", [email]);
  }
  async preview(token: string): Promise<{ actors: LoginActorDto[] }> {
    const row = await this.token(this.ds.manager, token, false);
    return { actors: await this.actors(this.ds.manager, row.email) };
  }
  verify(dto: LoginVerifyDto, userAgent?: string) {
    return withTransaction(this.ds, async (em) => {
      const row = await this.token(em, dto.token, true);
      const actors = await this.actors(em, row.email);
      if (!actors.some((a) => a.actor_id === dto.actor_id)) throw invalid();
      const [existing]: unknown[] = await em.query('SELECT id FROM devices WHERE id = ?', [dto.device_id]);
      if (existing) throw new ApiError(ErrorCode.ID_COLLISION, 409);
      await em.query('UPDATE magic_link_tokens SET used_at = UTC_TIMESTAMP(3) WHERE id = ?', [row.id]);
      const issued = await this.sessions.createDeviceWithSession(dto.actor_id, dto.device_id, { label: dto.label, userAgent }, em);
      await recordAudit(em, { actorId: dto.actor_id, deviceId: dto.device_id, action: 'account.login' });
      return { issued, actorId: dto.actor_id, deviceId: dto.device_id };
    });
  }
}
