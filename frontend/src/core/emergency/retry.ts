import { db } from "../db/db";
import { currentOnlineIdentity } from "../db/online-identity";
import { isEmergencyRecord } from "./model";

export async function retryEmergencyDelivery(id: string, actorId: string): Promise<void> {
  await db.transaction("rw", [db.emergencyEvents, db.emergencyQueue, db.spaces, db.syncCursors, db.settings], async () => {
    const event = await db.emergencyEvents.get(id);
    if (!isEmergencyRecord(event) || event.mode !== "SHARED" || currentOnlineIdentity()?.actorId !== actorId) throw new Error("FORBIDDEN");
    const space = await db.spaces.get(event.spaceId);
    const cursor = await db.syncCursors.get(event.spaceId);
    if (!space || space.deletedAt || space.sharingState !== "SHARED" || cursor?.halt || cursor?.access?.actorId !== actorId || (await db.settings.get("online.enabled"))?.value !== true) throw new Error("AUTH_REQUIRED");
    if (event.delivery === "BLOCKED" && !["AUTH_REQUIRED", "SESSION_EXPIRED"].includes(event.errorCode ?? "")) throw new Error("FORBIDDEN");
    const operations = await db.emergencyQueue.where("eventId").equals(id).filter((row) => row.actorId === actorId).toArray();
    for (const row of operations) await db.emergencyQueue.update(row.id, { blocked: false, nextAttemptAt: 0, leaseUntil: 0 });
    if (operations.some((row) => row.kind === "RECONCILE")) await db.emergencyEvents.update(id, { delivery: "LOCAL_PENDING", errorCode: undefined });
  });
}
