import {
  CAPABILITIES,
  DEFAULT_ROLE_MATRIX,
  LEVELS,
  RESTRICTIONS,
  normalizeMatrix,
  normalizeRestrictions,
} from '../../access/role-matrix';
import { isPlainObject, jsonObject, parseJsonColumn, plain, text } from '../fields';
import { sharedReadRules } from '../record-access';
import { TableResource } from '../resource-definition';

const OWNER = 'OWNER';

const matrix = jsonObject((v, path, e) => {
  if (!isPlainObject(v)) return e.add(path, 'INVALID');
  for (const key of Object.keys(v)) {
    if (!(CAPABILITIES as readonly string[]).includes(key)) return e.add(`${path}.${key}`, 'UNKNOWN_CAPABILITY');
  }
  for (const cap of CAPABILITIES) {
    if (!(LEVELS as readonly unknown[]).includes(v[cap])) return e.add(`${path}.${cap}`, 'INVALID');
  }
  return v;
});

const restrictions = jsonObject((v, path, e) => {
  if (!isPlainObject(v)) return e.add(path, 'INVALID');
  for (const [key, value] of Object.entries(v)) {
    if (!(CAPABILITIES as readonly string[]).includes(key)) return e.add(`${path}.${key}`, 'UNKNOWN_CAPABILITY');
    if (!(RESTRICTIONS as readonly unknown[]).includes(value)) return e.add(`${path}.${key}`, 'INVALID');
  }
  return v;
});

/** Roles are readable by every member (the client hides UI by them); only `permissions` EDIT changes them. */
export const roleDefinition = new TableResource({
  type: 'role',
  table: 'roles',
  access: sharedReadRules('permissions', (row) =>
    JSON.stringify([
      normalizeMatrix(parseJsonColumn(row.matrix)),
      normalizeRestrictions(parseJsonColumn(row.restrictions)),
      row.deleted_at === null,
    ]),
  ),
  immutable: ['key'],
  // Built-in flag is decided by the server (seeded roles), never by a client.
  ignoredKeys: ['system'],
  fields: [
    { key: 'key', column: 'role_key', codec: plain(40, 2, /^[A-Z][A-Z0-9_]{1,39}$/) },
    { key: 'name', column: 'name', codec: text(50) },
    { key: 'matrix', column: 'matrix', codec: matrix },
    { key: 'restrictions', column: 'restrictions', codec: restrictions, optional: true },
    { key: 'basedOn', column: 'based_on', codec: plain(40, 1), optional: true },
  ],
  async checkAsync(columns, e, ctx) {
    if (!ctx.existing) {
      const rows: unknown[] = await ctx.em.query('SELECT id FROM roles WHERE space_id = ? AND role_key = ?', [
        ctx.spaceId,
        columns.role_key,
      ]);
      if (rows.length > 0) e.add('key', 'DUPLICATE');
      return;
    }
    // The OWNER role keeps its name and full matrix so a Space can never lock itself out (§2.1).
    if (ctx.existing.role_key === OWNER) {
      if (columns.name !== ctx.existing.name) e.add('name', 'OWNER_IMMUTABLE');
      const parsed = JSON.parse(columns.matrix as string) as Record<string, string>;
      if (CAPABILITIES.some((c) => parsed[c] !== DEFAULT_ROLE_MATRIX.OWNER[c])) e.add('matrix', 'OWNER_IMMUTABLE');
    }
  },
  derive: (_columns, ctx) => ({ is_system: ctx.existing ? Number(ctx.existing.is_system) : 0 }),
  extraWire: (row) => ({ system: Boolean(Number(row.is_system)) }),
  async deleteBlockers(em, row) {
    if (Number(row.is_system)) return { key: 'SYSTEM_ROLE' };
    const rows: unknown[] = await em.query(
      "SELECT id FROM memberships WHERE space_id = ? AND role_id = ? AND status = 'ACTIVE' LIMIT 1",
      [row.space_id, row.id],
    );
    return rows.length > 0 ? { key: 'ROLE_IN_USE' } : null;
  },
});
