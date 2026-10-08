import { db } from "../db/db";
import { RESOURCE_STORE, RESOURCE_TYPES, type BaseRecord, type ResourceType } from "./resource-types";
import type { SnapshotWire } from "./transport";

import { archiveDraft, removeProjectionRecord, recordMedia } from "./drafts";

const recordKey = (type: string, id: string) => `${type}:${id}`;

/** Records with an op not yet acknowledged: local drafts the server copy must not replace (sync-protocol.md invariant 7). */
export async function pendingResourceKeys(spaceId: string): Promise<Set<string>> {
  const ops = await db.outbox.where("spaceId").equals(spaceId).toArray();
  return new Set(ops.filter((op) => op.state !== "ACKNOWLEDGED").map((op) => recordKey(op.resourceType, op.resourceId)));
}

export function fromWire(record: Record<string, unknown>, revision?: string): BaseRecord {
  return { ...(record as unknown as BaseRecord), revision: revision ?? (record.revision as string | null) ?? null, syncState: "SYNCED" };
}

const SYNCED_TYPES = RESOURCE_TYPES.filter((t): t is Exclude<ResourceType, "space_settings"> => t !== "space_settings");

/**
 * Makes the local projection equal to the snapshot (TEC-20): rows the viewer can no longer see are removed,
 * Only new unsent rows stay in the projection; edits to revoked rows are archived separately. Callers hold the Space's sync lock.
 */
export async function applySnapshot(spaceId: string, snap: SnapshotWire): Promise<{ removed: number; upserted: number }> {
  const stores = [...new Set(SYNCED_TYPES.map((t) => RESOURCE_STORE[t]))];
  return db.transaction("rw", [...stores, "spaces", "outbox", "syncCursors", "blobs", "sharedDrafts", "notifications"], async () => {
    const pending = await pendingResourceKeys(spaceId);
    let removed = 0;
    let upserted = 0;

    for (const type of SYNCED_TYPES) {
      const table = db.table<BaseRecord, string>(RESOURCE_STORE[type]);
      const incoming = (snap.records[type] ?? []) as Array<Record<string, unknown>>;
      const ids = new Set(incoming.map((r) => r.id as string));
      for (const local of await table.where("spaceId").equals(spaceId).toArray()) {
        if (ids.has(local.id)) continue;
        if (pending.has(recordKey(type, local.id)) && local.revision === null) {
          if (local.syncState !== "PENDING" && local.syncState !== "CONFLICT") await table.update(local.id, { syncState: "PENDING" });
          continue;
        }
        for (const op of await db.outbox.where("resourceId").equals(local.id).filter((o) => o.spaceId === spaceId && o.resourceType === type && o.state !== "ACKNOWLEDGED").toArray()) {
          await archiveDraft(op, local); await db.outbox.delete(op.operationId);
        }
        await removeProjectionRecord(type, local);
        await db.notifications.where("spaceId").equals(spaceId).filter((n) => n.resourceRef?.id === local.id).delete();
        removed += 1;
      }
      for (const record of incoming) {
        if (pending.has(recordKey(type, record.id as string))) continue;
        const prior = await table.get(record.id as string) as (BaseRecord & { avatar?: string; audioAssetId?: string }) | undefined;
        if (prior && ((type === "member" && prior.avatar !== record.avatar) || ((type === "item" || type === "reminder_rule") && prior.audioAssetId !== record.audioAssetId))) {
          for (const blob of await recordMedia(type, prior)) await db.blobs.delete(blob.id);
        }
        await table.put(fromWire(record));
        upserted += 1;
      }
    }

    const local = await db.spaces.get(spaceId);
    if (local && !pending.has(recordKey("space_settings", spaceId))) {
      await db.spaces.put({ ...local, ...(snap.space as object), id: spaceId, spaceId, sharingState: "SHARED", syncState: "SYNCED" });
    }
    const row = await db.syncCursors.get(spaceId);
    await db.syncCursors.put({
      ...row,
      spaceId,
      cursor: snap.watermark,
      halt: null,
      haltCode: undefined,
      policyVersion: snap.policy_version,
      updatedAt: new Date().toISOString(),
      access: snap.access as unknown as Record<string, unknown>,
      memberships: snap.memberships,
    });
    return { removed, upserted };
  });
}
