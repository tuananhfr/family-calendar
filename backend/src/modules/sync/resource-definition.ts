import type { EntityManager } from 'typeorm';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { isScopeValidForSpace, type SpaceAccessContext, type SpaceKind } from '../access/evaluate-access';
import { DATA_CLASSES, SHARING_SCOPES } from '../../database/resource-entity';
import { FieldErrors, INVALID, instant, isPlainObject, oneOf, parseArray, type Codec } from './fields';
import type { AccessRules, StoredRow } from './record-access';
import type { ResourceType, SyncAction } from './resource-types';

export type { StoredRow } from './record-access';

export interface ParseContext {
  em: EntityManager;
  spaceId: string;
  spaceKind: SpaceKind;
  actorId: string;
  action: SyncAction;
  resourceId: string;
  /** Current row when updating; null on create. */
  existing: StoredRow | null;
  /** Bootstrap uploads keep the local author instead of the uploading Actor. */
  trustCreatedBy?: boolean;
}

/** Validated payload, ready to write. */
export interface Draft {
  id: string;
  columns: Record<string, unknown>;
  children: Record<string, unknown[]>;
  createdByActorId: string;
}

export interface WriteMeta {
  spaceId: string;
  revision: string;
  now: Date;
}

/** Contract every registry entry fulfils; TableResource is the common implementation. */
export interface ResourceDefinition {
  readonly type: ResourceType;
  readonly table: string;
  readonly actions: readonly SyncAction[];
  readonly access: AccessRules;
  /** Column holding the parent item id (item children only). */
  readonly parentItemColumn?: string;
  /** Columns that identify one occurrence row; enables `occurrence_action` (upsert by natural key). */
  readonly naturalKey?: readonly string[];
  /** Deleting changes who may see what (members, roles). */
  readonly policyOnDelete?: boolean;
  /** Locks the row by id in any Space (callers compare space_id). */
  lock(em: EntityManager, id: string): Promise<StoredRow | null>;
  lockByNaturalKey?(em: EntityManager, spaceId: string, draft: Draft): Promise<StoredRow | null>;
  /** Rows by id, deleted ones included, children attached. */
  find(em: EntityManager, spaceId: string, ids: string[]): Promise<StoredRow[]>;
  /** Every live row of the Space with children attached. */
  listLive(em: EntityManager, spaceId: string): Promise<StoredRow[]>;
  countLive(em: EntityManager, spaceId: string): Promise<number>;
  parse(payload: unknown, ctx: ParseContext): Promise<Draft>;
  /** The row a draft would produce, for access evaluation before writing. */
  materialize(draft: Draft, existing: StoredRow | null, meta: WriteMeta): StoredRow;
  insert(em: EntityManager, draft: Draft, meta: WriteMeta): Promise<void>;
  update(em: EntityManager, draft: Draft, meta: WriteMeta): Promise<void>;
  softDelete(em: EntityManager, row: StoredRow, meta: WriteMeta): Promise<void>;
  /** Returns a VALIDATION_FAILED field map when this row must not be deleted (system folder, role in use). */
  deleteBlockers?(em: EntityManager, row: StoredRow): Promise<Record<string, string> | null>;
  /** Wire shape = frontend zod schema of the type, minus syncState. */
  toWire(row: StoredRow, viewer: SpaceAccessContext | null): Record<string, unknown>;
  /** Occurrence actions: true when the request asks for what the row already says. */
  sameOutcome?(row: StoredRow, draft: Draft): boolean;
}

export interface FieldSpec {
  /** Wire path; dotted for nested objects ('schedule.start'). */
  key: string;
  column: string;
  codec: Codec;
  /** May be absent (or null); stored as NULL / `default`, answered by omitting the key. */
  optional?: boolean;
  /** May be null; answered as null. */
  nullable?: boolean;
  default?: unknown;
}

export interface ChildSpec {
  key: string;
  table: string;
  parentColumn: string;
  item: Codec;
  max: number;
  unique?: boolean;
  orderBy: string;
  toColumns(value: unknown, index: number): Record<string, unknown>;
  fromRow(row: Record<string, unknown>): unknown;
}

export interface RefSpec {
  /** Wire key; for `many` the key of a child list or JSON array. */
  key: string;
  table: string;
  many?: boolean;
  /** Extra rule on the referenced row (e.g. same parent item); returns an error code. */
  check?(ref: Record<string, unknown>, columns: Record<string, unknown>): string | null;
}

export interface TableSpec {
  type: ResourceType;
  table: string;
  actions?: readonly SyncAction[];
  fields: FieldSpec[];
  children?: ChildSpec[];
  refs?: RefSpec[];
  access: AccessRules;
  parentItemColumn?: string;
  naturalKey?: readonly string[];
  policyOnDelete?: boolean;
  /** Wire keys accepted but ignored (set by server workflows). */
  ignoredKeys?: string[];
  /** Wire keys that may not change after create. */
  immutable?: string[];
  /** Cross-field rules on the raw payload once per-field parsing passed. */
  validate?(input: Record<string, unknown>, columns: Record<string, unknown>, e: FieldErrors, ctx: ParseContext): void;
  /** Rules that need the database (uniqueness, parent shape); runs after references resolved. */
  checkAsync?(columns: Record<string, unknown>, e: FieldErrors, ctx: ParseContext): Promise<void>;
  /** Columns the server derives (maturity date, acting actor). */
  derive?(columns: Record<string, unknown>, ctx: ParseContext): Record<string, unknown>;
  deleteBlockers?(em: EntityManager, row: StoredRow): Promise<Record<string, string> | null>;
  /** Adds server-side keys to the wire record (e.g. Member.linkedActorId). */
  attach?(em: EntityManager, rows: StoredRow[]): Promise<void>;
  extraWire?(row: StoredRow): Record<string, unknown>;
  redact?(wire: Record<string, unknown>, row: StoredRow, viewer: SpaceAccessContext | null): void;
  sameOutcome?(row: StoredRow, draft: Draft): boolean;
}

const BASE_KEYS = new Set([
  'id',
  'spaceId',
  'createdByActorId',
  'dataClass',
  'sharingScope',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'revision',
  'syncState',
]);

export function validationError(fields: Record<string, string>): ApiError {
  return new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, fields);
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (!isPlainObject(cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur = obj;
  for (const part of parts.slice(0, -1)) {
    if (!isPlainObject(cur[part])) cur[part] = {};
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

const scopeCodec = oneOf(SHARING_SCOPES);
const classCodec = oneOf(DATA_CLASSES);

export class TableResource implements ResourceDefinition {
  readonly type: ResourceType;
  readonly table: string;
  readonly actions: readonly SyncAction[];
  readonly access: AccessRules;
  readonly parentItemColumn?: string;
  readonly naturalKey?: readonly string[];
  readonly policyOnDelete?: boolean;

  constructor(private readonly spec: TableSpec) {
    this.type = spec.type;
    this.table = spec.table;
    this.actions = spec.actions ?? ['create', 'update', 'delete'];
    this.access = spec.access;
    this.parentItemColumn = spec.parentItemColumn;
    this.naturalKey = spec.naturalKey;
    this.policyOnDelete = spec.policyOnDelete;
    if (spec.deleteBlockers) this.deleteBlockers = (em, row) => spec.deleteBlockers!(em, row);
    if (spec.sameOutcome) this.sameOutcome = (row, draft) => spec.sameOutcome!(row, draft);
    if (spec.naturalKey) this.lockByNaturalKey = (em, spaceId, draft) => this.lockNatural(em, spaceId, draft);
  }

  deleteBlockers?: ResourceDefinition['deleteBlockers'];
  sameOutcome?: ResourceDefinition['sameOutcome'];
  lockByNaturalKey?: ResourceDefinition['lockByNaturalKey'];

  async lock(em: EntityManager, id: string): Promise<StoredRow | null> {
    const rows: StoredRow[] = await em.query(`SELECT * FROM ${this.table} WHERE id = ? FOR UPDATE`, [id]);
    if (rows.length === 0) return null;
    await this.hydrate(em, rows);
    return rows[0];
  }

  private async lockNatural(em: EntityManager, spaceId: string, draft: Draft): Promise<StoredRow | null> {
    const cols = this.naturalKey!;
    const rows: StoredRow[] = await em.query(
      `SELECT * FROM ${this.table} WHERE space_id = ? AND ${cols.map((c) => `${c} = ?`).join(' AND ')} FOR UPDATE`,
      [spaceId, ...cols.map((c) => draft.columns[c])],
    );
    if (rows.length === 0) return null;
    await this.hydrate(em, rows);
    return rows[0];
  }

  async find(em: EntityManager, spaceId: string, ids: string[]): Promise<StoredRow[]> {
    if (ids.length === 0) return [];
    const rows: StoredRow[] = await em.query(
      `SELECT * FROM ${this.table} WHERE space_id = ? AND id IN (${placeholders(ids.length)})`,
      [spaceId, ...ids],
    );
    await this.hydrate(em, rows);
    return rows;
  }

  async listLive(em: EntityManager, spaceId: string): Promise<StoredRow[]> {
    const rows: StoredRow[] = await em.query(
      `SELECT * FROM ${this.table} WHERE space_id = ? AND deleted_at IS NULL ORDER BY id`,
      [spaceId],
    );
    await this.hydrate(em, rows);
    return rows;
  }

  async countLive(em: EntityManager, spaceId: string): Promise<number> {
    const [row]: Array<{ n: string | number }> = await em.query(
      `SELECT COUNT(*) AS n FROM ${this.table} WHERE space_id = ? AND deleted_at IS NULL`,
      [spaceId],
    );
    return Number(row.n);
  }

  private async hydrate(em: EntityManager, rows: StoredRow[]): Promise<void> {
    if (rows.length === 0) return;
    for (const row of rows) row.$children = {};
    const ids = rows.map((r) => r.id as string);
    for (const child of this.spec.children ?? []) {
      const childRows: Array<Record<string, unknown>> = await em.query(
        `SELECT * FROM ${child.table} WHERE ${child.parentColumn} IN (${placeholders(ids.length)}) ORDER BY ${child.orderBy}`,
        ids,
      );
      const byParent = new Map<string, unknown[]>();
      for (const cr of childRows) {
        const parentId = cr[child.parentColumn] as string;
        if (!byParent.has(parentId)) byParent.set(parentId, []);
        byParent.get(parentId)!.push(child.fromRow(cr));
      }
      for (const row of rows) row.$children![child.key] = byParent.get(row.id as string) ?? [];
    }
    if (this.spec.attach) await this.spec.attach(em, rows);
  }

  async parse(payload: unknown, ctx: ParseContext): Promise<Draft> {
    const e = new FieldErrors();
    if (!isPlainObject(payload)) throw validationError({ payload: 'INVALID' });
    const input = payload;
    const columns: Record<string, unknown> = {};

    const known = new Set([
      ...BASE_KEYS,
      ...this.spec.fields.map((f) => f.key.split('.')[0]),
      ...(this.spec.children ?? []).map((c) => c.key),
      ...(this.spec.ignoredKeys ?? []),
    ]);
    for (const key of Object.keys(input)) if (!known.has(key)) e.add(key, 'UNKNOWN_FIELD');
    for (const nested of new Set(this.spec.fields.filter((f) => f.key.includes('.')).map((f) => f.key.split('.')[0]))) {
      const obj = input[nested];
      if (!isPlainObject(obj)) {
        e.add(nested, 'REQUIRED');
        continue;
      }
      const allowed = new Set(this.spec.fields.filter((f) => f.key.startsWith(`${nested}.`)).map((f) => f.key.slice(nested.length + 1)));
      for (const key of Object.keys(obj)) if (!allowed.has(key)) e.add(`${nested}.${key}`, 'UNKNOWN_FIELD');
    }

    if (input.id !== undefined && input.id !== ctx.resourceId) e.add('id', 'ID_MISMATCH');
    const dataClass =
      input.dataClass === undefined ? e.add('dataClass', 'REQUIRED') : classCodec.parse(input.dataClass, 'dataClass', e);
    const scope = input.sharingScope === undefined ? e.add('sharingScope', 'REQUIRED') : scopeCodec.parse(input.sharingScope, 'sharingScope', e);
    if (scope !== INVALID && !isScopeValidForSpace(scope, ctx.spaceKind)) e.add('sharingScope', 'SCOPE_NOT_IN_SPACE');
    if (input.spaceId !== undefined && input.spaceId !== ctx.spaceId) e.add('spaceId', 'SPACE_MISMATCH');
    columns.data_class = dataClass;
    columns.sharing_scope = scope;

    for (const f of this.spec.fields) {
      const v = getPath(input, f.key);
      if (v === undefined || v === null) {
        if (v === null && !f.nullable && !f.optional) e.add(f.key, 'REQUIRED');
        else if (v === undefined && !f.optional && !f.nullable && f.default === undefined) e.add(f.key, 'REQUIRED');
        columns[f.column] = f.default ?? null;
        continue;
      }
      const parsed = f.codec.parse(v, f.key, e);
      if (parsed !== INVALID) columns[f.column] = parsed;
    }

    const children: Record<string, unknown[]> = {};
    for (const child of this.spec.children ?? []) {
      const parsed = parseArray(child.item, input[child.key], child.key, e, { max: child.max, unique: child.unique });
      if (parsed !== INVALID) children[child.key] = parsed;
    }

    if (ctx.existing) {
      for (const key of this.spec.immutable ?? []) {
        const f = this.spec.fields.find((x) => x.key === key);
        if (f && columns[f.column] !== undefined && String(columns[f.column]) !== String(ctx.existing[f.column])) {
          e.add(key, 'IMMUTABLE');
        }
      }
    }

    if (e.empty && this.spec.validate) this.spec.validate(input, columns, e, ctx);
    if (e.empty) await this.checkRefs(ctx, columns, children, e);
    if (e.empty && this.spec.checkAsync) await this.spec.checkAsync(columns, e, ctx);
    if (!e.empty) throw validationError(e.map);

    const createdByActorId = ctx.existing
      ? (ctx.existing.created_by_actor_id as string)
      : ctx.trustCreatedBy && typeof input.createdByActorId === 'string'
        ? input.createdByActorId
        : ctx.actorId;
    Object.assign(columns, this.spec.derive?.(columns, ctx) ?? {});
    return { id: ctx.resourceId, columns, children, createdByActorId };
  }

  private async checkRefs(
    ctx: ParseContext,
    columns: Record<string, unknown>,
    children: Record<string, unknown[]>,
    e: FieldErrors,
  ): Promise<void> {
    for (const ref of this.spec.refs ?? []) {
      let ids: string[];
      if (ref.many) {
        const fromChild = children[ref.key];
        const field = this.spec.fields.find((f) => f.key === ref.key);
        const raw = fromChild ?? (field ? JSON.parse((columns[field.column] as string | null) ?? '[]') : []);
        ids = (raw as unknown[]).filter((v): v is string => typeof v === 'string');
      } else {
        const field = this.spec.fields.find((f) => f.key === ref.key)!;
        const v = columns[field.column];
        ids = typeof v === 'string' ? [v] : [];
      }
      if (ids.length === 0) continue;
      const rows: Array<Record<string, unknown>> = await ctx.em.query(
        `SELECT * FROM ${ref.table} WHERE space_id = ? AND id IN (${placeholders(ids.length)}) AND deleted_at IS NULL`,
        [ctx.spaceId, ...ids],
      );
      const found = new Map(rows.map((r) => [r.id as string, r]));
      for (const refId of ids) {
        const row = found.get(refId);
        if (!row) {
          e.add(ref.key, 'NOT_IN_SPACE');
          break;
        }
        const problem = ref.check?.(row, columns);
        if (problem) {
          e.add(ref.key, problem);
          break;
        }
      }
    }
  }

  materialize(draft: Draft, existing: StoredRow | null, meta: WriteMeta): StoredRow {
    return {
      ...(existing ?? {}),
      ...draft.columns,
      id: draft.id,
      space_id: meta.spaceId,
      created_by_actor_id: draft.createdByActorId,
      revision: meta.revision,
      created_at: existing?.created_at ?? meta.now,
      updated_at: meta.now,
      deleted_at: null,
      $children: { ...draft.children },
    };
  }

  async insert(em: EntityManager, draft: Draft, meta: WriteMeta): Promise<void> {
    const cols = {
      id: draft.id,
      space_id: meta.spaceId,
      created_by_actor_id: draft.createdByActorId,
      revision: meta.revision,
      created_at: meta.now,
      updated_at: meta.now,
      deleted_at: null,
      ...draft.columns,
    };
    const names = Object.keys(cols);
    await em.query(
      `INSERT INTO ${this.table} (${names.join(', ')}) VALUES (${placeholders(names.length)})`,
      names.map((n) => (cols as Record<string, unknown>)[n]),
    );
    await this.writeChildren(em, draft, meta.spaceId);
  }

  async update(em: EntityManager, draft: Draft, meta: WriteMeta): Promise<void> {
    const cols: Record<string, unknown> = {
      ...draft.columns,
      revision: meta.revision,
      updated_at: meta.now,
      deleted_at: null,
    };
    const names = Object.keys(cols);
    await em.query(`UPDATE ${this.table} SET ${names.map((n) => `${n} = ?`).join(', ')} WHERE id = ?`, [
      ...names.map((n) => cols[n]),
      draft.id,
    ]);
    for (const child of this.spec.children ?? []) {
      await em.query(`DELETE FROM ${child.table} WHERE ${child.parentColumn} = ?`, [draft.id]);
    }
    await this.writeChildren(em, draft, meta.spaceId);
  }

  private async writeChildren(em: EntityManager, draft: Draft, spaceId: string): Promise<void> {
    for (const child of this.spec.children ?? []) {
      const values = draft.children[child.key] ?? [];
      for (let i = 0; i < values.length; i++) {
        const cols = { space_id: spaceId, [child.parentColumn]: draft.id, ...child.toColumns(values[i], i) };
        const names = Object.keys(cols);
        await em.query(
          `INSERT INTO ${child.table} (${names.join(', ')}) VALUES (${placeholders(names.length)})`,
          names.map((n) => cols[n]),
        );
      }
    }
  }

  async softDelete(em: EntityManager, row: StoredRow, meta: WriteMeta): Promise<void> {
    await em.query(`UPDATE ${this.table} SET deleted_at = ?, updated_at = ?, revision = ? WHERE id = ?`, [
      meta.now,
      meta.now,
      meta.revision,
      row.id,
    ]);
  }

  toWire(row: StoredRow, viewer: SpaceAccessContext | null): Record<string, unknown> {
    const wire: Record<string, unknown> = {
      id: row.id,
      spaceId: row.space_id,
      createdByActorId: row.created_by_actor_id,
      dataClass: row.data_class,
      sharingScope: row.sharing_scope,
      revision: String(row.revision),
      createdAt: instant.out(row.created_at),
      updatedAt: instant.out(row.updated_at),
      deletedAt: row.deleted_at === null || row.deleted_at === undefined ? null : instant.out(row.deleted_at),
    };
    for (const f of this.spec.fields) {
      const raw = row[f.column];
      if (raw === null || raw === undefined) {
        if (f.nullable) setPath(wire, f.key, null);
        else if (!f.optional) setPath(wire, f.key, null);
        continue;
      }
      setPath(wire, f.key, f.codec.out(raw));
    }
    for (const child of this.spec.children ?? []) wire[child.key] = row.$children?.[child.key] ?? [];
    Object.assign(wire, this.spec.extraWire?.(row) ?? {});
    this.spec.redact?.(wire, row, viewer);
    return wire;
  }
}

/** Builds the payload error for a value whose type the registry does not know. */
export function unknownTypeError(): ApiError {
  return validationError({ resource_type: 'UNKNOWN_RESOURCE_TYPE' });
}
