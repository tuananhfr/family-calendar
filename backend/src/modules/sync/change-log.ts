import type { EntityManager } from 'typeorm';
import type { ResourceType } from './resource-types';

export interface LockedSpace {
  kind: 'FAMILY' | 'GROUP';
  sharing_state: 'INITIALIZING' | 'SHARED';
  change_seq: string;
  policy_version: string;
}

/**
 * Takes the Space row lock. Every write to a Space goes through it first, so change_seq order equals commit
 * order (TEC-20 §2) and concurrent retries of one operation queue up instead of deadlocking.
 */
export async function lockSpace(em: EntityManager, spaceId: string): Promise<LockedSpace | null> {
  const rows: LockedSpace[] = await em.query(
    'SELECT kind, sharing_state, change_seq, policy_version FROM spaces WHERE id = ? FOR UPDATE',
    [spaceId],
  );
  return rows[0] ?? null;
}

/** Allocates the next seq under the Space lock and records the change; returns the seq. */
export async function appendChange(
  em: EntityManager,
  spaceId: string,
  type: ResourceType,
  resourceId: string,
  revision: string,
  op: 'UPSERT' | 'DELETE',
  now: Date,
): Promise<string> {
  await em.query('UPDATE spaces SET change_seq = change_seq + 1 WHERE id = ?', [spaceId]);
  const [{ seq }]: Array<{ seq: string }> = await em.query('SELECT change_seq AS seq FROM spaces WHERE id = ?', [
    spaceId,
  ]);
  await em.query(
    `INSERT INTO sync_changes (space_id, seq, resource_type, resource_id, revision, op, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [spaceId, seq, type, resourceId, revision, op, now],
  );
  if (op === 'DELETE') {
    await em.query(
      `INSERT INTO tombstones (space_id, resource_type, resource_id, revision, seq, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE revision = VALUES(revision), seq = VALUES(seq), deleted_at = VALUES(deleted_at)`,
      [spaceId, type, resourceId, revision, seq, now],
    );
  }
  return String(seq);
}

export async function currentPolicyVersion(em: EntityManager, spaceId: string): Promise<string> {
  const [row]: Array<{ v: string }> = await em.query('SELECT policy_version AS v FROM spaces WHERE id = ?', [spaceId]);
  return String(row?.v ?? '0');
}
