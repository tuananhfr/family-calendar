import { addDays, type LocalDate } from '../../common/time/local-date';
import { datePart, timePart } from '../../common/time/zoned';
import type { SpaceAccessContext } from '../access/evaluate-access';
import { itemOccurrences, type SpaceReadView } from '../calendar/space-read-view';
import type { StoredRow } from '../sync/resource-definition';
import { RESOURCE_REGISTRY } from '../sync/resource-registry';

export type { SpaceReadView };

export interface AiContext {
  today: LocalDate;
  members: Array<{ name: string; role: string }>;
  upcoming: Array<{ kind: string; title: string; date: string; time?: string; member: string }>;
}

export const CONTEXT_DAYS = 14;
const MAX_UPCOMING = 200;

const RELATIONSHIP_LABEL: Record<string, string> = {
  FATHER: 'Bố',
  MOTHER: 'Mẹ',
  SON: 'Con trai',
  DAUGHTER: 'Con gái',
  GRANDFATHER: 'Ông',
  GRANDMOTHER: 'Bà',
  GUARDIAN: 'Người giám hộ',
  OTHER: 'Thành viên',
};

function isPrivate(row: StoredRow): boolean {
  return row.data_class === 'PRIVATE' || row.sharing_scope === 'PRIVATE';
}

export function isHealthLike(row: StoredRow): boolean {
  return row.data_class === 'SENSITIVE' || row.category === 'HEALTH' || row.preset === 'MEDICATION';
}

function shareableWith(ctx: SpaceAccessContext, row: StoredRow): boolean {
  return !isPrivate(row) || row.created_by_actor_id === ctx.actorId;
}

/** Members the assistant may know about; drafts can only point at these. */
export function aiVisibleMembers(members: StoredRow[], ctx: SpaceAccessContext): StoredRow[] {
  const rules = RESOURCE_REGISTRY.member.access;
  return members.filter(
    (m) => !m.deleted_at && m.status !== 'ARCHIVED' && rules.canRead(ctx, m, null) && shareableWith(ctx, m),
  );
}

/**
 * Minimal context for the assistant (modules.md §11): member names and roles, and the next 14 days of items the
 * asker can read. Stricter than read access: PRIVATE only when the asker made it (even OWNER never sends another
 * person's), health/SENSITIVE only with the explicit health opt-in, and no notes, places, amounts or contacts.
 */
export function buildAiContext(
  data: SpaceReadView,
  ctx: SpaceAccessContext,
  opts: { allowHealth: boolean; today: LocalDate; days?: number },
): AiContext {
  const itemRules = RESOURCE_REGISTRY.item.access;
  const visibleMembers = aiVisibleMembers(data.members, ctx);
  const nameOf = new Map(visibleMembers.map((m) => [m.id as string, String(m.display_name)]));

  const from = opts.today;
  const to = addDays(from, (opts.days ?? CONTEXT_DAYS) - 1);
  const upcoming: Array<AiContext['upcoming'][number] & { sortKey: string }> = [];
  for (const item of data.items) {
    if (item.deleted_at || !shareableWith(ctx, item) || !itemRules.canRead(ctx, item, null)) continue;
    if (!opts.allowHealth && isHealthLike(item)) continue;
    const itemId = item.id as string;
    const occurrences = itemOccurrences(item, data, { from, to });
    const memberIds = [
      ...((item.$children?.memberIds as string[] | undefined) ?? []),
      ...(item.responsible_member_id ? [item.responsible_member_id as string] : []),
    ];
    const member = [...new Set(memberIds.map((id) => nameOf.get(id)).filter((n): n is string => !!n))].join(', ');
    for (const occ of occurrences) {
      const date = datePart(occ.start);
      const time = occ.allDay ? null : timePart(occ.start);
      upcoming.push({
        kind: String(item.kind),
        title: occ.title ?? String(item.title),
        date,
        ...(time ? { time } : {}),
        member,
        sortKey: `${date}T${time ?? '00:00'}|${itemId}`,
      });
    }
  }
  upcoming.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

  return {
    today: opts.today,
    members: visibleMembers.map((m) => ({
      name: String(m.display_name),
      role: RELATIONSHIP_LABEL[String(m.relationship)] ?? 'Thành viên',
    })),
    upcoming: upcoming.slice(0, MAX_UPCOMING).map(({ sortKey: _sortKey, ...rest }) => rest),
  };
}
