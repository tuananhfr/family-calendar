import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { newOpaqueToken, sha256Hex } from '../../common/crypto/tokens';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import { addDays } from '../../common/time/local-date';
import { addMonthsClamped } from '../../common/time/month-offset';
import { datePart, todayIn, zonedToInstant } from '../../common/time/zoned';
import type { AppConfig } from '../../config/configuration';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import { sharedSpaceContext } from '../access/shared-space-context';
import { recordAudit } from '../audit/record-audit';
import { itemOccurrences, loadSpaceReadView } from '../calendar/space-read-view';
import { CLOCK, type Clock } from '../jobs/clock';
import type { StoredRow } from '../sync/resource-definition';
import type { CreateIcsFeedDto, IcsFeedCreatedDto, IcsFeedDto } from './dto/ics.dto';
import { writeIcs, type IcsEvent, type IcsTime } from './ics-writer';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_ACTIVE_FEEDS = 20;
const PAST_DAYS = 30;
const FUTURE_MONTHS = 36;
const MAX_EVENTS = 5000;
/** The only audiences a link may expose: whoever holds the URL is treated like "everyone in the family". */
const PUBLIC_SCOPES = new Set(['FAMILY_ALL', 'GROUP_MEMBERS']);

interface FeedRow {
  id: string;
  label: string | null;
  include_child_names: number;
  created_at: Date;
  last_used_at: Date | null;
}

function feedDto(r: FeedRow): IcsFeedDto {
  return {
    id: r.id,
    label: r.label,
    include_child_names: Number(r.include_child_names) === 1,
    created_at: new Date(r.created_at).toISOString(),
    last_used_at: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
  };
}

function exposable(row: StoredRow): boolean {
  return row.data_class === 'NORMAL' && PUBLIC_SCOPES.has(String(row.sharing_scope));
}

@Injectable()
export class IcsService {
  private readonly apiOrigin: string;

  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    config: ConfigService<AppConfig, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.apiOrigin = config.get('apiOrigin', { infer: true });
  }

  async create(session: SessionContext, spaceId: string, dto: CreateIcsFeedDto): Promise<IcsFeedCreatedDto> {
    await sharedSpaceContext(this.ds, this.access, session, spaceId, 'backup', 'EDIT');
    const token = newOpaqueToken();
    const id = randomUUID();
    const now = this.clock.now();
    const label = dto.label?.trim() || null;
    await withTransaction(this.ds, async (em) => {
      const [{ n }]: Array<{ n: string | number }> = await em.query(
        'SELECT COUNT(*) AS n FROM ics_feeds WHERE space_id = ? AND revoked_at IS NULL FOR UPDATE',
        [spaceId],
      );
      if (Number(n) >= MAX_ACTIVE_FEEDS) {
        throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'Đã có quá nhiều link ICS. Hãy thu hồi bớt link cũ.', {
          feeds: 'TOO_MANY',
        });
      }
      await em.query(
        `INSERT INTO ics_feeds (id, space_id, created_by_actor_id, token_hash, label, include_child_names, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, spaceId, session.actorId, sha256Hex(token), label, dto.include_child_names ? 1 : 0, now],
      );
      await recordAudit(em, {
        spaceId,
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'ics_feed.create',
        resourceType: 'ics_feed',
        resourceId: id,
      });
    });
    return {
      id,
      label,
      include_child_names: dto.include_child_names === true,
      created_at: now.toISOString(),
      last_used_at: null,
      url: `${this.apiOrigin}/api/v1/ics/${token}.ics`,
    };
  }

  /** Idempotent: revoking an already revoked link succeeds; an unknown id is 404. */
  async revoke(session: SessionContext, spaceId: string, feedId: string): Promise<void> {
    await sharedSpaceContext(this.ds, this.access, session, spaceId, 'backup', 'EDIT');
    if (!isClientId(feedId)) throw new ApiError(ErrorCode.NOT_FOUND, 404);
    await withTransaction(this.ds, async (em) => {
      const [row]: Array<{ revoked_at: Date | null }> = await em.query(
        'SELECT revoked_at FROM ics_feeds WHERE id = ? AND space_id = ? FOR UPDATE',
        [feedId, spaceId],
      );
      if (!row) throw new ApiError(ErrorCode.NOT_FOUND, 404);
      if (row.revoked_at) return;
      await em.query('UPDATE ics_feeds SET revoked_at = ? WHERE id = ?', [this.clock.now(), feedId]);
      await recordAudit(em, {
        spaceId,
        actorId: session.actorId,
        deviceId: session.deviceId,
        action: 'ics_feed.revoke',
        resourceType: 'ics_feed',
        resourceId: feedId,
      });
    });
  }

  async activeFeeds(spaceId: string): Promise<IcsFeedDto[]> {
    const rows: FeedRow[] = await this.ds.query(
      `SELECT id, label, include_child_names, created_at, last_used_at FROM ics_feeds
        WHERE space_id = ? AND revoked_at IS NULL ORDER BY created_at DESC, id`,
      [spaceId],
    );
    return rows.map(feedDto);
  }

  /**
   * The subscription body, or null (→ 404) for an unknown/revoked token, a Space no longer shared, or a link whose
   * creator has left the Space. Only NORMAL items for the whole family/group, never health items.
   */
  async render(token: string): Promise<string | null> {
    if (!TOKEN_PATTERN.test(token)) return null;
    const [feed]: Array<{
      id: string;
      space_id: string;
      include_child_names: number;
      name: string;
      time_zone: string;
    }> = await this.ds.query(
      `SELECT f.id, f.space_id, f.include_child_names, s.name, s.time_zone
         FROM ics_feeds f
         JOIN spaces s ON s.id = f.space_id AND s.sharing_state = 'SHARED'
         JOIN memberships m ON m.space_id = f.space_id AND m.actor_id = f.created_by_actor_id AND m.status = 'ACTIVE'
        WHERE f.token_hash = ? AND f.revoked_at IS NULL`,
      [sha256Hex(token)],
    );
    if (!feed) return null;
    const now = this.clock.now();
    await this.ds.query('UPDATE ics_feeds SET last_used_at = ? WHERE id = ?', [now, feed.id]);

    const view = await loadSpaceReadView(this.ds.manager, feed.space_id, feed.time_zone);
    const withChildren = Number(feed.include_child_names) === 1;
    const names = new Map(
      view.members
        .filter((m) => exposable(m) && m.status === 'ACTIVE' && (withChildren || m.profile !== 'CHILD'))
        .map((m) => [m.id as string, String(m.display_name)]),
    );
    const today = todayIn(feed.time_zone, now);
    const window = { from: addDays(today, -PAST_DAYS), to: addDays(addMonthsClamped(today, FUTURE_MONTHS), -1) };

    const events: Array<IcsEvent & { sortKey: string }> = [];
    for (const item of view.items) {
      if (!exposable(item) || Number(item.show_on_calendar) !== 1) continue;
      if (item.category === 'HEALTH' || item.preset === 'MEDICATION') continue;
      const tz = (item.time_zone as string) || feed.time_zone;
      const people = [
        ...((item.$children?.memberIds as string[] | undefined) ?? []),
        ...(item.responsible_member_id ? [item.responsible_member_id as string] : []),
      ];
      const shown = [...new Set(people.map((id) => names.get(id)).filter((n): n is string => !!n))];
      const stamp = new Date(item.updated_at as string | Date);
      for (const occ of itemOccurrences(item, view, window, { includeFinished: true })) {
        const at = (v: string): IcsTime => (occ.allDay ? { date: datePart(v) } : { at: zonedToInstant(v, tz) });
        events.push({
          // Stable per occurrence so calendar apps update instead of duplicating; hashed so it carries no date.
          uid: `${createHash('sha256').update(occ.occurrenceKey).digest('hex').slice(0, 32)}@lich-gia-dinh`,
          stamp,
          start: at(occ.start),
          ...(occ.end ? { end: at(occ.end) } : {}),
          summary: occ.title ?? String(item.title),
          ...(shown.length ? { description: `Thành viên: ${shown.join(', ')}` } : {}),
          sortKey: `${occ.start}|${occ.occurrenceKey}`,
        });
      }
    }
    events.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
    return writeIcs({
      name: feed.name,
      timeZone: feed.time_zone,
      events: events.slice(0, MAX_EVENTS).map(({ sortKey: _sortKey, ...ev }) => ev),
    });
  }
}
