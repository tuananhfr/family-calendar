import type { EntityManager } from 'typeorm';
import type { SpaceAccessContext } from '../access/evaluate-access';
import type { ResourceDefinition, StoredRow } from './resource-definition';
import { RESOURCE_REGISTRY } from './resource-registry';

/** Parent items (deleted ones included) of item-child rows, keyed by item id. */
export async function loadParents(
  em: EntityManager,
  spaceId: string,
  def: ResourceDefinition,
  rows: StoredRow[],
): Promise<Map<string, StoredRow>> {
  if (!def.parentItemColumn || rows.length === 0) return new Map();
  const ids = [...new Set(rows.map((r) => r[def.parentItemColumn!] as string))];
  const parents = await RESOURCE_REGISTRY.item.find(em, spaceId, ids);
  return new Map(parents.map((p) => [p.id as string, p]));
}

export function parentOf(def: ResourceDefinition, row: StoredRow, parents: Map<string, StoredRow>): StoredRow | null {
  return def.parentItemColumn ? (parents.get(row[def.parentItemColumn] as string) ?? null) : null;
}

/** Rows the viewer may read, as wire records; everything else is dropped without a trace. */
export async function visibleRecords(
  em: EntityManager,
  ctx: SpaceAccessContext,
  def: ResourceDefinition,
  rows: StoredRow[],
): Promise<Array<{ row: StoredRow; wire: Record<string, unknown> }>> {
  const parents = await loadParents(em, ctx.spaceId, def, rows);
  return rows
    .filter((row) => def.access.canRead(ctx, row, parentOf(def, row, parents)))
    .map((row) => ({ row, wire: def.toWire(row, ctx) }));
}

/** Re-reads one row and returns its wire form only if the viewer may read it now. */
export async function readableWire(
  em: EntityManager,
  ctx: SpaceAccessContext,
  def: ResourceDefinition,
  id: string,
): Promise<Record<string, unknown> | null> {
  const rows = await def.find(em, ctx.spaceId, [id]);
  const [visible] = await visibleRecords(em, ctx, def, rows);
  return visible?.wire ?? null;
}

/** Like visibleRecords, minus children of a deleted item: the item's own DELETE already removes them. */
export async function liveVisibleRecords(
  em: EntityManager,
  ctx: SpaceAccessContext,
  def: ResourceDefinition,
  rows: StoredRow[],
): Promise<Array<{ row: StoredRow; wire: Record<string, unknown> }>> {
  const parents = await loadParents(em, ctx.spaceId, def, rows);
  return rows
    .filter((row) => {
      const parent = parentOf(def, row, parents);
      if (def.parentItemColumn && (!parent || parent.deleted_at)) return false;
      return !row.deleted_at && def.access.canRead(ctx, row, parent);
    })
    .map((row) => ({ row, wire: def.toWire(row, ctx) }));
}
