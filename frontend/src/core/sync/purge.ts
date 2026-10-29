import { db } from "../db/db";
import { RESOURCE_STORE, RESOURCE_TYPES, type BaseRecord } from "./resource-types";
import { archiveDraft, removeProjectionRecord } from "./drafts";
import { isEmergencyRecord } from "../emergency/model";
export async function purgeSharedProjection(spaceId: string, reason = "SPACE_ACCESS_REVOKED") {
  const stores = [...new Set(RESOURCE_TYPES.map((type) => RESOURCE_STORE[type]))];
  await db.transaction("rw", [...stores, "outbox", "syncCursors", "blobs", "sharedDrafts", "notifications", "emergencyEvents", "emergencyQueue", "emergencyDrafts"], async () => {
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
    for (const op of await db.emergencyQueue.where("spaceId").equals(spaceId).toArray()) {
      const event = await db.emergencyEvents.get(op.eventId);
      if (op.kind === "RECONCILE" && isEmergencyRecord(event) && event.createdByActorId === op.actorId) {
        await db.emergencyDrafts.put({ id: event.id, spaceId, event: { ...event, position: undefined, recipients: undefined, delivery: "BLOCKED", errorCode: reason }, reason });
      }
    }
    await db.emergencyEvents.where("spaceId").equals(spaceId).delete();
    await db.emergencyQueue.where("spaceId").equals(spaceId).delete();
    await db.syncCursors.put({ spaceId, cursor: null, halt: "BLOCKED", haltCode: reason, updatedAt: new Date().toISOString() });
  });
}
