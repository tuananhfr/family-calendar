import type { EntityManager } from 'typeorm';
import { hasLevel, type SpaceAccessContext } from '../../access/evaluate-access';
import {
  FieldErrors,
  INVALID,
  bool,
  instant,
  isPlainObject,
  oneOf,
  parseJsonColumn,
  plain,
  text,
  timeZone,
  type Codec,
} from '../fields';
import type { AccessRules, StoredRow } from '../record-access';
import { validationError, type Draft, type ParseContext, type ResourceDefinition, type WriteMeta } from '../resource-definition';

const BASE_KEYS = ['id', 'spaceId', 'createdByActorId', 'dataClass', 'sharingScope', 'createdAt', 'updatedAt', 'deletedAt', 'revision', 'syncState'];
const SPACE_KEYS = ['kind', 'name', 'timeZone', 'sharingState', 'settings'];

const SETTINGS: Record<string, { codec: Codec; optional?: boolean }> = {
  description: { codec: text(200, 0), optional: true },
  avatar: { codec: plain(100), optional: true },
  weekStartsOn: { codec: oneOf(['0', '1'] as const) },
  dateFormat: { codec: oneOf(['dd/MM/yyyy', 'yyyy-MM-dd'] as const) },
  showIllustrations: { codec: bool },
  showQuickReminders: { codec: bool },
  showUpcomingBirthdays: { codec: bool },
  weatherEnabled: { codec: bool },
  weatherCity: { codec: text(60, 0), optional: true },
};

export function parseSettings(v: unknown, e: FieldErrors): Record<string, unknown> | typeof INVALID {
  if (!isPlainObject(v)) return e.add('settings', 'REQUIRED');
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(v)) if (!(key in SETTINGS)) e.add(`settings.${key}`, 'UNKNOWN_FIELD');
  for (const [key, spec] of Object.entries(SETTINGS)) {
    const value = v[key];
    if (value === undefined || value === null) {
      if (!spec.optional) e.add(`settings.${key}`, 'REQUIRED');
      continue;
    }
    // weekStartsOn is a number on the wire; the enum codec works on its string form.
    const parsed = spec.codec.parse(key === 'weekStartsOn' ? String(value) : value, `settings.${key}`, e);
    if (parsed === INVALID) continue;
    out[key] = key === 'weekStartsOn' ? Number(parsed) : typeof value === 'boolean' ? value : parsed;
  }
  return e.empty ? out : INVALID;
}

const access: AccessRules = {
  canRead: () => true,
  canWrite: (ctx) => hasLevel(ctx, 'settings', 'EDIT'),
  canDelete: () => false,
  // Renaming or re-timezoning a Space never changes who may see what.
  fingerprint: () => '',
};

function withResourceColumns(row: StoredRow): StoredRow {
  return {
    ...row,
    space_id: row.id,
    data_class: 'NORMAL',
    sharing_scope: row.kind === 'GROUP' ? 'GROUP_MEMBERS' : 'FAMILY_ALL',
    deleted_at: null,
  };
}

/** The Space row itself, exposed as resource `space_settings` (id = space id); only `update` is allowed. */
export const spaceSettingsDefinition: ResourceDefinition = {
  type: 'space_settings',
  table: 'spaces',
  actions: ['update'],
  access,

  async lock(em: EntityManager, id: string) {
    const rows: StoredRow[] = await em.query('SELECT * FROM spaces WHERE id = ? FOR UPDATE', [id]);
    return rows[0] ? withResourceColumns(rows[0]) : null;
  },

  async find(em: EntityManager, spaceId: string, ids: string[]) {
    if (!ids.includes(spaceId)) return [];
    const rows: StoredRow[] = await em.query('SELECT * FROM spaces WHERE id = ?', [spaceId]);
    return rows.map(withResourceColumns);
  },

  async listLive(em: EntityManager, spaceId: string) {
    return this.find(em, spaceId, [spaceId]);
  },

  countLive: () => Promise.resolve(1),

  parse(payload: unknown, ctx: ParseContext): Promise<Draft> {
    const e = new FieldErrors();
    if (!isPlainObject(payload)) throw validationError({ payload: 'INVALID' });
    for (const key of Object.keys(payload)) {
      if (!BASE_KEYS.includes(key) && !SPACE_KEYS.includes(key)) e.add(key, 'UNKNOWN_FIELD');
    }
    if (payload.id !== undefined && payload.id !== ctx.resourceId) e.add('id', 'ID_MISMATCH');
    if (ctx.existing && payload.kind !== undefined && payload.kind !== ctx.existing.kind) e.add('kind', 'IMMUTABLE');
    const name = text(100).parse(payload.name, 'name', e);
    const tz = timeZone.parse(payload.timeZone, 'timeZone', e);
    const settings = parseSettings(payload.settings, e);
    if (!e.empty) throw validationError(e.map);
    return Promise.resolve({
      id: ctx.resourceId,
      columns: { name, time_zone: tz, settings: JSON.stringify(settings) },
      children: {},
      createdByActorId: (ctx.existing?.created_by_actor_id as string | undefined) ?? ctx.actorId,
    });
  },

  materialize(draft: Draft, existing: StoredRow | null, meta: WriteMeta): StoredRow {
    return { ...(existing ?? {}), ...draft.columns, revision: meta.revision, updated_at: meta.now };
  },

  insert(): Promise<void> {
    return Promise.reject(new Error('space_settings rows are created by bootstrap'));
  },

  async update(em: EntityManager, draft: Draft, meta: WriteMeta) {
    await em.query('UPDATE spaces SET name = ?, time_zone = ?, settings = ?, revision = ?, updated_at = ? WHERE id = ?', [
      draft.columns.name,
      draft.columns.time_zone,
      draft.columns.settings,
      meta.revision,
      meta.now,
      draft.id,
    ]);
  },

  softDelete(): Promise<void> {
    return Promise.reject(new Error('space_settings cannot be deleted'));
  },

  toWire(row: StoredRow, _viewer: SpaceAccessContext | null) {
    return {
      id: row.id,
      spaceId: row.id,
      createdByActorId: row.created_by_actor_id,
      dataClass: 'NORMAL',
      sharingScope: row.kind === 'GROUP' ? 'GROUP_MEMBERS' : 'FAMILY_ALL',
      revision: String(row.revision),
      createdAt: instant.out(row.created_at),
      updatedAt: instant.out(row.updated_at),
      deletedAt: null,
      kind: row.kind,
      name: row.name,
      timeZone: row.time_zone,
      // The client only knows LOCAL/SHARED; a Space still INITIALIZING is not shared yet.
      sharingState: row.sharing_state === 'SHARED' ? 'SHARED' : 'LOCAL',
      settings: parseJsonColumn(row.settings) ?? {},
    };
  },
};
