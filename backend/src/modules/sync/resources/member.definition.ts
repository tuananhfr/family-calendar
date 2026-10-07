import { hasLevel } from '../../access/evaluate-access';
import { PROFILES, RELATIONSHIPS } from '../domain-enums';
import { jsonArray, localDate, oneOf, plain, text } from '../fields';
import { sharedReadRules, type StoredRow } from '../record-access';
import { TableResource } from '../resource-definition';

const PRIVATE_FIELDS = ['phone', 'email', 'birthDate'] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Every member of the Space sees the Member list (names, roles in the calendar), but phone, email and birth
 * date are PRIVATE fields (modules.md §1): only `members` VIEW, the Member's own representatives and the
 * author receive them.
 */
export const memberDefinition = new TableResource({
  type: 'member',
  table: 'members',
  access: sharedReadRules('members', (row) =>
    JSON.stringify([row.profile, row.status, row.sharing_scope, row.deleted_at === null]),
  ),
  policyOnDelete: true,
  // Linking an Actor to a Member is a server workflow (join approval), never a field a client sets.
  ignoredKeys: ['linkedActorId'],
  fields: [
    { key: 'displayName', column: 'display_name', codec: text(50) },
    { key: 'relationship', column: 'relationship', codec: oneOf(RELATIONSHIPS) },
    { key: 'profile', column: 'profile', codec: oneOf(PROFILES) },
    { key: 'birthDate', column: 'birth_date', codec: localDate, optional: true },
    { key: 'phone', column: 'phone', codec: plain(20, 6, /^[0-9+\-\s().]{6,20}$/), optional: true },
    { key: 'email', column: 'email', codec: plain(254, 3, EMAIL), optional: true },
    { key: 'avatar', column: 'avatar', codec: plain(100), optional: true },
    { key: 'color', column: 'color', codec: plain(30), optional: true },
    { key: 'interests', column: 'interests', codec: jsonArray(text(30), { max: 5, unique: true }) },
    { key: 'note', column: 'note', codec: text(500, 0), optional: true },
    { key: 'status', column: 'status', codec: oneOf(['ACTIVE', 'ARCHIVED'] as const) },
  ],
  async attach(em, rows) {
    const ids = rows.map((r) => r.id as string);
    const links: Array<{ member_id: string; actor_id: string }> = await em.query(
      `SELECT member_id, actor_id FROM member_representations
        WHERE member_id IN (${ids.map(() => '?').join(', ')}) AND relation = 'SELF'`,
      ids,
    );
    const byMember = new Map(links.map((l) => [l.member_id, l.actor_id]));
    for (const row of rows) row.linked_actor_id = byMember.get(row.id as string) ?? null;
  },
  extraWire: (row: StoredRow) => ({ linkedActorId: (row.linked_actor_id as string | null | undefined) ?? null }),
  redact(wire, row, viewer) {
    if (!viewer) return;
    const memberId = row.id as string;
    const allowed =
      hasLevel(viewer, 'members', 'VIEW') ||
      viewer.representedMemberIds.includes(memberId) ||
      viewer.guardianOfMemberIds.includes(memberId) ||
      row.created_by_actor_id === viewer.actorId;
    if (!allowed) for (const key of PRIVATE_FIELDS) delete wire[key];
  },
});
