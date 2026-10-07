import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { CLOCK, type Clock } from '../jobs/clock';
import type { MarkNotificationsReadDto, NotificationDto, NotificationListDto } from './dto/notification.dto';
import type { NotificationType } from './entities/notification.entity';

const DEFAULT_LIMIT = 50;

interface Row {
  id: string;
  space_id: string;
  type: NotificationType;
  resource_ref: unknown;
  title_safe: string;
  created_at: Date;
  read_at: Date | null;
}

interface Cursor {
  t: string;
  id: string;
}

function parseRef(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    try {
      return parseRef(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

function encodeCursor(row: Row): string {
  return Buffer.from(JSON.stringify({ t: new Date(row.created_at).toISOString(), id: row.id })).toString('base64url');
}

function decodeCursor(raw: string): Cursor {
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (typeof c.t === 'string' && typeof c.id === 'string' && !Number.isNaN(Date.parse(c.t))) {
      return { t: c.t, id: c.id };
    }
  } catch {
    // fall through
  }
  throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { cursor: 'INVALID' });
}

/** Only the caller's own notifications, and only for Spaces they still belong to: leaving a Space hides its bell. */
const VISIBLE = `FROM notifications n
  JOIN memberships m ON m.space_id = n.space_id AND m.actor_id = n.actor_id AND m.status = 'ACTIVE'
 WHERE n.actor_id = ?`;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly ds: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(session: SessionContext, cursor?: string, limit = DEFAULT_LIMIT): Promise<NotificationListDto> {
    const params: unknown[] = [session.actorId];
    let after = '';
    if (cursor) {
      const c = decodeCursor(cursor);
      const t = new Date(c.t);
      after = ' AND (n.created_at < ? OR (n.created_at = ? AND n.id < ?))';
      params.push(t, t, c.id);
    }
    const rows: Row[] = await this.ds.query(
      `SELECT n.id, n.space_id, n.type, n.resource_ref, n.title_safe, n.created_at, n.read_at ${VISIBLE}${after}
        ORDER BY n.created_at DESC, n.id DESC LIMIT ?`,
      [...params, limit + 1],
    );
    const page = rows.slice(0, limit);
    return {
      notifications: page.map((r) => this.toDto(r)),
      next_cursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
      unread_count: await this.unreadCount(session),
    };
  }

  async markRead(session: SessionContext, dto: MarkNotificationsReadDto): Promise<{ unread_count: number }> {
    const hasIds = Array.isArray(dto.ids) && dto.ids.length > 0;
    if (hasIds === (dto.all === true)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'Cần chọn thông báo cụ thể hoặc đánh dấu tất cả.', {
        ids: 'ONE_OF_IDS_OR_ALL',
      });
    }
    const now = this.clock.now();
    // actor_id in the WHERE: ids of someone else's notifications are silently ignored.
    if (hasIds) {
      await this.ds.query('UPDATE notifications SET read_at = ? WHERE actor_id = ? AND read_at IS NULL AND id IN (?)', [
        now,
        session.actorId,
        dto.ids,
      ]);
    } else {
      await this.ds.query('UPDATE notifications SET read_at = ? WHERE actor_id = ? AND read_at IS NULL', [
        now,
        session.actorId,
      ]);
    }
    return { unread_count: await this.unreadCount(session) };
  }

  private async unreadCount(session: SessionContext): Promise<number> {
    const [{ n }]: Array<{ n: string | number }> = await this.ds.query(
      `SELECT COUNT(*) AS n ${VISIBLE} AND n.read_at IS NULL`,
      [session.actorId],
    );
    return Number(n);
  }

  private toDto(r: Row): NotificationDto {
    return {
      id: r.id,
      space_id: r.space_id,
      type: r.type,
      resource_ref: parseRef(r.resource_ref),
      title_safe: r.title_safe,
      created_at: new Date(r.created_at).toISOString(),
      read_at: r.read_at ? new Date(r.read_at).toISOString() : null,
    };
  }
}
