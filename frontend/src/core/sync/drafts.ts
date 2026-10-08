import { db, type BlobRow } from "../db/db";
import { RESOURCE_STORE, type BaseRecord, type ResourceType } from "./resource-types";
import type { OutboxOp } from "./outbox-types";
export async function recordMedia(type: ResourceType, record?: BaseRecord): Promise<BlobRow[]> {
  if (!record) return [];
  if (type === "file") return db.blobs.where("fileId").equals(record.id).toArray();
  const row = record as BaseRecord & { avatar?: string; audioAssetId?: string };
  const id = row.avatar?.startsWith("blob:") ? row.avatar.slice(5) : row.audioAssetId;
  const blob = id ? await db.blobs.get(id) : undefined;
  return blob ? [blob] : [];
}
export async function archiveDraft(op: OutboxOp, record?: BaseRecord) {
  await db.sharedDrafts.put({ id: op.operationId, spaceId: op.spaceId, record,
    media: await recordMedia(op.resourceType, record), operation: { ...op, state: "BLOCKED" } });
}
export async function removeProjectionRecord(type: ResourceType, record: BaseRecord) {
  for (const blob of await recordMedia(type, record)) await db.blobs.delete(blob.id);
  await db.table(RESOURCE_STORE[type]).delete(record.id);
}
