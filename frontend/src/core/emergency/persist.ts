import { db } from "../db/db";
import { getLocalIdentity } from "../db/local-identity";
import { currentOnlineIdentity } from "../db/online-identity";
import { newId } from "../ids";
import { hasLevel, type AccessContext } from "../access/evaluate";
import type { Space } from "../model/space";
import { isEmergencyRecord, type EmergencyPosition, type EmergencyQueueRow, type EmergencyRecord, type EmergencyStatus } from "./model";

export function makeEmergencyOperation(event: EmergencyRecord, kind: EmergencyQueueRow["kind"] = "RECONCILE", payload?: EmergencyQueueRow["payload"]): EmergencyQueueRow {
  return { id: `${event.id}:${kind}`, spaceId: event.spaceId, eventId: event.id, actorId: event.createdByActorId, operationId: newId(), kind, payload, attempts: 0, nextAttemptAt: 0 };
}

export async function createEmergency(space: Space, access: AccessContext, now = new Date()): Promise<EmergencyRecord> {
  if (space.kind !== "FAMILY" || access.spaceKind !== "FAMILY" || (access.spaceId && access.spaceId !== space.id) || !hasLevel(access, "sos.trigger", "EDIT")) throw new Error("FORBIDDEN");
  const identity = space.sharingState === "SHARED" ? currentOnlineIdentity() : await getLocalIdentity();
  if (!identity || identity.actorId !== access.actorId) throw new Error("AUTH_REQUIRED");
  return db.transaction("rw", db.spaces, db.emergencyEvents, db.emergencyQueue, async () => {
    const currentSpace = await db.spaces.get(space.id);
    if (!currentSpace || currentSpace.deletedAt || currentSpace.sharingState !== space.sharingState) throw new Error("SPACE_CHANGED");
    const active = (await db.emergencyEvents.where("spaceId").equals(space.id).toArray()).find((row) => isEmergencyRecord(row) && row.status === "ACTIVE" && row.createdByActorId === identity.actorId);
    if (active && isEmergencyRecord(active)) return active;
    const event: EmergencyRecord = { id: newId(), spaceId: space.id, createdAt: now.toISOString(), createdByActorId: identity.actorId, deviceId: identity.deviceId, status: "ACTIVE", mode: space.sharingState, delivery: "LOCAL_PENDING" };
    await db.emergencyEvents.add(event);
    if (event.mode === "SHARED") await db.emergencyQueue.add(makeEmergencyOperation(event));
    return event;
  });
}

export async function closeEmergency(id: string, status: Exclude<EmergencyStatus, "ACTIVE">, actorId: string, reason?: string, now = new Date()): Promise<void> {
  if (status === "CLOSED_ENDED" && (!reason?.trim() || reason.length > 200)) throw new Error("REASON_REQUIRED");
  await db.transaction("rw", db.emergencyEvents, db.emergencyQueue, async () => {
    const event = await db.emergencyEvents.get(id);
    if (!isEmergencyRecord(event) || event.createdByActorId !== actorId) throw new Error("FORBIDDEN");
    if (event.status !== "ACTIVE") return;
    const closed = { ...event, status, closedAt: now.toISOString(), reason: reason?.trim(), delivery: "LOCAL_PENDING" as const };
    await db.emergencyEvents.put(closed);
    await db.emergencyQueue.delete(`${id}:LOCATION`);
    if (event.mode === "SHARED") await db.emergencyQueue.put(makeEmergencyOperation(closed));
  });
}

export async function saveEmergencyPosition(id: string, actorId: string, position: EmergencyPosition): Promise<void> {
  if (![position.lat, position.lng, position.accuracy].every(Number.isFinite) || Math.abs(position.lat) > 90 || Math.abs(position.lng) > 180 || position.accuracy < 0 || position.accuracy > 100_000 || !Number.isFinite(Date.parse(position.capturedAt))) throw new Error("INVALID_LOCATION");
  await db.transaction("rw", db.emergencyEvents, db.emergencyQueue, async () => {
    const event = await db.emergencyEvents.get(id);
    if (!isEmergencyRecord(event) || event.status !== "ACTIVE" || event.createdByActorId !== actorId) return;
    if (event.position && Date.parse(event.position.capturedAt) > Date.parse(position.capturedAt)) return;
    await db.emergencyEvents.update(id, { position });
    if (event.mode === "SHARED") await db.emergencyQueue.put(makeEmergencyOperation(event, "LOCATION", position));
  });
}

export async function queueEmergencyResponse(event: EmergencyRecord, actorId: string, kind: "ACKNOWLEDGED" | "RESPONDING"): Promise<void> {
  if (event.mode !== "SHARED" || event.status !== "ACTIVE" || actorId === event.createdByActorId) throw new Error("FORBIDDEN");
  const operation = makeEmergencyOperation(event, "RESPONSE", { kind });
  await db.emergencyQueue.put({ ...operation, actorId });
}
