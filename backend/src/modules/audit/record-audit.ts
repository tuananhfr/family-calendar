import type { EntityManager } from 'typeorm';

export interface AuditInput {
  spaceId?: string | null;
  actorId: string | null;
  deviceId: string | null;
  /** Dotted verb such as 'device.revoke' or 'item.create'. */
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  revision?: string | null;
}

/**
 * Writes one audit row inside the caller's transaction. The shape deliberately has no field for
 * titles, notes or amounts (modules.md §2.4).
 */
export async function recordAudit(em: EntityManager, e: AuditInput): Promise<void> {
  await em.query(
    `INSERT INTO audit_events (space_id, actor_id, device_id, action, resource_type, resource_id, revision, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
    [
      e.spaceId ?? null,
      e.actorId,
      e.deviceId,
      e.action,
      e.resourceType ?? null,
      e.resourceId ?? null,
      e.revision ?? null,
    ],
  );
}
