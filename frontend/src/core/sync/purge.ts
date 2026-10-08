import { db } from "../db/db";
import { RESOURCE_STORE, RESOURCE_TYPES, type BaseRecord } from "./resource-types";
import { archiveDraft, removeProjectionRecord } from "./drafts";
export async function purgeSharedProjection(spaceId: string, reason = "SPACE_ACCESS_REVOKED") {
  const stores = [...new Set(RESOURCE_TYPES.map((type) => RESOURCE_STORE[type]))];
  await db.transaction("rw", [...stores, "outbox", "syncCursors", "blobs", "sharedDrafts", "notifications"], async () => {
    const pending = await db.outbox.where("spaceId").equals(spaceId).filter((o) => o.state !== "ACKNOWLEDGED").toArray();
    for (const op of pending) await archiveDraft(op, await db.table(RESOURCE_STORE[op.resourceType]).get(op.resourceId));
    for (const type of RESOURCE_TYPES) {
      if (type === "space_settings") continue;
      for (const row of await db.table<BaseRecord>(RESOURCE_STORE[type]).where("spaceId").equals(spaceId).toArray())
        await removeProjectionRecord(type, row);
    }
    await db.spaces.update(spaceId, { deletedAt: new Date().toISOString() });
    await db.outbox.where("spaceId").equals(spaceId).delete();
    await db.notifications.where("spaceId").equals(spaceId).delete();
    await db.syncCursors.put({ spaceId, cursor: null, halt: "BLOCKED", haltCode: reason, updatedAt: new Date().toISOString() });
  });
}
