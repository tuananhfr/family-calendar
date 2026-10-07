import type { EntityManager } from 'typeorm';
import { AccessService } from '../access/access.service';
import type { SpaceAccessContext } from '../access/evaluate-access';
import type { StoredRow } from '../sync/resource-definition';
import { RESOURCE_REGISTRY } from '../sync/resource-registry';
import type { NotificationChannel } from './dispatch';

export interface ReminderTarget {
  key: string;
  channel: NotificationChannel;
  deviceId: string | null;
  actorId: string | null;
  memberId: string | null;
}

/** Access context for an Actor seen through one of its devices; null when the device or membership is gone. */
export async function readerContext(
  em: EntityManager,
  access: AccessService,
  spaceId: string,
  actorId: string,
  deviceId: string,
): Promise<SpaceAccessContext | null> {
  try {
    return await access.loadContext({ sessionId: '', actorId, deviceId, accountId: null }, spaceId, em);
  } catch {
    return null;
  }
}

export function canReadItem(ctx: SpaceAccessContext, item: StoredRow): boolean {
  return RESOURCE_REGISTRY.item.access.canRead(ctx, item, null);
}

/**
 * Who a rule reminds: Actors linked (SELF or GUARDIAN) to the recipient Members, else to the responsible Member,
 * else the creator — and only those who may read the item, so a PRIVATE reminder never reaches anyone else.
 */
export async function resolveTargets(
  em: EntityManager,
  access: AccessService,
  spaceId: string,
  item: StoredRow,
  recipientMemberIds: string[],
  channels: NotificationChannel[],
): Promise<ReminderTarget[]> {
  const memberIds = recipientMemberIds.length
    ? recipientMemberIds
    : item.responsible_member_id
      ? [item.responsible_member_id as string]
      : [];
  let actorIds: string[];
  if (memberIds.length) {
    const rows: Array<{ actor_id: string }> = await em.query(
      `SELECT DISTINCT mr.actor_id FROM member_representations mr
         JOIN memberships m ON m.space_id = mr.space_id AND m.actor_id = mr.actor_id AND m.status = 'ACTIVE'
        WHERE mr.space_id = ? AND mr.member_id IN (?) ORDER BY mr.actor_id`,
      [spaceId, memberIds],
    );
    actorIds = rows.map((r) => r.actor_id);
  } else {
    actorIds = [item.created_by_actor_id as string];
  }

  const targets: ReminderTarget[] = [];
  const memberTargets = new Set<string>();
  for (const actorId of actorIds) {
    const devices: Array<{ id: string }> = await em.query(
      "SELECT id FROM devices WHERE actor_id = ? AND status = 'ACTIVE' ORDER BY created_at, id",
      [actorId],
    );
    if (devices.length === 0) continue;
    const ctx = await readerContext(em, access, spaceId, actorId, devices[0].id);
    if (!ctx || !canReadItem(ctx, item)) continue;
    if (channels.includes('PUSH')) {
      for (const d of devices) {
        targets.push({ key: `device:${d.id}`, channel: 'PUSH', deviceId: d.id, actorId, memberId: null });
      }
    }
    if (channels.includes('IN_APP')) {
      targets.push({ key: `actor:${actorId}`, channel: 'IN_APP', deviceId: null, actorId, memberId: null });
    }
    const linked = new Set([...ctx.representedMemberIds, ...ctx.guardianOfMemberIds]);
    for (const m of memberIds.length ? memberIds.filter((x) => linked.has(x)) : ctx.representedMemberIds) {
      memberTargets.add(m);
    }
  }
  for (const memberId of memberTargets) {
    for (const channel of ['EMAIL', 'SMS'] as const) {
      if (channels.includes(channel)) {
        targets.push({ key: `member:${memberId}`, channel, deviceId: null, actorId: null, memberId });
      }
    }
  }
  return targets;
}
