import { db } from "../db/db";
import type { Space } from "../model/space";
import { RESOURCE_STORE, type BaseRecord, type ItemChildType, type ResourceType } from "../sync/resource-types";

export function resourceTable<T extends BaseRecord = BaseRecord>(type: ResourceType) {
  return db.table<T, string>(RESOURCE_STORE[type]);
}

/** Live (not tombstoned) records of one Space. Access filtering is the caller's job (core/access). */
export async function listActive<T extends BaseRecord = BaseRecord>(type: ResourceType, spaceId: string): Promise<T[]> {
  return resourceTable<T>(type)
    .where("spaceId")
    .equals(spaceId)
    .filter((r) => r.deletedAt === null)
    .toArray();
}

export async function getActive<T extends BaseRecord = BaseRecord>(type: ResourceType, id: string): Promise<T | undefined> {
  const row = await resourceTable<T>(type).get(id);
  return row && row.deletedAt === null ? row : undefined;
}

/** Includes tombstones; for sync and conflict screens. */
export async function getResource<T extends BaseRecord = BaseRecord>(type: ResourceType, id: string): Promise<T | undefined> {
  return resourceTable<T>(type).get(id);
}

export async function listActiveByItem<T extends BaseRecord = BaseRecord>(type: ItemChildType, itemId: string): Promise<T[]> {
  return resourceTable<T>(type)
    .where("itemId")
    .equals(itemId)
    .filter((r) => r.deletedAt === null)
    .toArray();
}

export async function getSpace(id: string): Promise<Space | undefined> {
  const s = await db.spaces.get(id);
  return s && s.deletedAt === null ? s : undefined;
}

export async function listSpaces(): Promise<Space[]> {
  return db.spaces.filter((s) => s.deletedAt === null).toArray();
}
