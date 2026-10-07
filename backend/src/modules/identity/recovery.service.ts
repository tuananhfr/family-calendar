import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { sha256Hex } from '../../common/crypto/tokens';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import { recordAudit } from '../audit/record-audit';
import type { RedeemRecoveryDto } from './dto/recovery.dto';
import { SessionsService, type IssuedSession } from './sessions.service';

// Crockford base32: no I, L, O, U, so a code read aloud or retyped is unambiguous; 24 symbols = 120 bits.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 24;

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let raw = '';
  // 256 is a multiple of 32, so masking keeps every symbol equally likely.
  for (const b of bytes) raw += ALPHABET[b & 31];
  return raw;
}

function format(raw: string): string {
  return raw.match(/.{4}/g)!.join('-');
}

/** Accepts the code as typed: any case, spaces or dashes, and the usual O/0 and I/L/1 slips. */
export function normalizeRecoveryCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 64) return null;
  const raw = input.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return raw.length === CODE_LENGTH && [...raw].every((c) => ALPHABET.includes(c)) ? raw : null;
}

const invalid = () => new ApiError(ErrorCode.RECOVERY_INVALID, 422);

@Injectable()
export class RecoveryService {
  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    private readonly sessions: SessionsService,
  ) {}

  /** Issues a fresh code for the caller in this Space; any earlier unused code stops working. */
  issue(session: SessionContext, spaceId: string): Promise<{ code: string }> {
    return withTransaction(this.ds, async (em) => {
      if (!isClientId(spaceId)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
      await this.access.loadContext(session, spaceId, em);
      const [space]: Array<{ sharing_state: string }> = await em.query(
        'SELECT sharing_state FROM spaces WHERE id = ?',
        [spaceId],
      );
      if (space?.sharing_state !== 'SHARED') throw new ApiError(ErrorCode.FORBIDDEN, 403);
      const code = await this.rotate(em, spaceId, session.actorId);
      await recordAudit(em, {
        spaceId,
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'recovery.issue',
      });
      return { code: format(code) };
    });
  }

  /**
   * Binds a new Device to the Actor named by the code, in one transaction with spending the code and issuing its
   * replacement. The Device only ever gets that Actor's own grants.
   */
  redeem(
    dto: RedeemRecoveryDto,
    userAgent: string | undefined,
  ): Promise<{ actorId: string; deviceId: string; code: string; issued: IssuedSession }> {
    const raw = normalizeRecoveryCode(dto.code);
    if (!raw) return Promise.reject(invalid());
    return withTransaction(this.ds, async (em) => {
      const [cred]: Array<{ id: string; space_id: string; actor_id: string }> = await em.query(
        'SELECT id, space_id, actor_id FROM recovery_credentials WHERE secret_hash = ? AND used_at IS NULL FOR UPDATE',
        [sha256Hex(raw)],
      );
      if (!cred || (dto.device.actor_id !== undefined && dto.device.actor_id !== cred.actor_id)) throw invalid();
      const [taken]: unknown[] = await em.query('SELECT 1 FROM devices WHERE id = ?', [dto.device.device_id]);
      if (taken) throw new ApiError(ErrorCode.ID_COLLISION, 409);

      const next = await this.rotate(em, cred.space_id, cred.actor_id);
      const issued = await this.sessions.createDeviceWithSession(
        cred.actor_id,
        dto.device.device_id,
        { label: dto.device.label ?? null, userAgent: userAgent ?? null },
        em,
      );
      await recordAudit(em, {
        spaceId: cred.space_id,
        actorId: cred.actor_id,
        deviceId: dto.device.device_id,
        action: 'recovery.redeem',
        resourceType: 'device',
        resourceId: dto.device.device_id,
      });
      return { actorId: cred.actor_id, deviceId: dto.device.device_id, code: format(next), issued };
    });
  }

  private async rotate(em: EntityManager, spaceId: string, actorId: string): Promise<string> {
    await em.query(
      'UPDATE recovery_credentials SET used_at = UTC_TIMESTAMP(3) WHERE space_id = ? AND actor_id = ? AND used_at IS NULL',
      [spaceId, actorId],
    );
    const code = generateCode();
    await em.query(
      `INSERT INTO recovery_credentials (id, space_id, actor_id, secret_hash, used_at, created_at)
       VALUES (?, ?, ?, ?, NULL, UTC_TIMESTAMP(3))`,
      [randomUUID(), spaceId, actorId, sha256Hex(code)],
    );
    return code;
  }
}
