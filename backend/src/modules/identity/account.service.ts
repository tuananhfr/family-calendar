import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { withTransaction } from '../../database/transaction';
import { recordAudit } from '../audit/record-audit';
import type { AccountStatusDto } from './dto/recovery.dto';

@Injectable()
export class AccountService {
  constructor(private readonly ds: DataSource) {}

  async status(session: SessionContext): Promise<AccountStatusDto> {
    const [row]: Array<{ id: string; email: string }> = await this.ds.query(
      `SELECT a.id, a.email FROM account_links al JOIN accounts a ON a.id = al.account_id
        WHERE al.actor_id = ? AND al.unlinked_at IS NULL ORDER BY al.linked_at DESC LIMIT 1`,
      [session.actorId],
    );
    return row ? { linked: true, email: row.email, account_id: row.id } : { linked: false };
  }

  /** Drops the email link only; devices and sessions stay as they are. */
  unlink(session: SessionContext): Promise<AccountStatusDto> {
    return withTransaction(this.ds, async (em) => {
      const res: { affectedRows?: number } = await em.query(
        'UPDATE account_links SET unlinked_at = UTC_TIMESTAMP(3) WHERE actor_id = ? AND unlinked_at IS NULL',
        [session.actorId],
      );
      if (res.affectedRows) {
        await recordAudit(em, { actorId: session.actorId, deviceId: session.deviceId, action: 'account.unlink' });
      }
      return { linked: false };
    });
  }
}
