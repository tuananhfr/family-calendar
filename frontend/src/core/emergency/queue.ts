import { api, ApiRequestError } from "../api/client";
import { db } from "../db/db";
import { currentOnlineIdentity } from "../db/online-identity";
import { newId } from "../ids";
import { emergencyPath, type EmergencyAccepted } from "./api";
import { isEmergencyRecord, shouldPurgePosition, type EmergencyPosition, type EmergencyQueueRow } from "./model";

const owner = newId();
const blockedCodes = new Set(["AUTH_REQUIRED", "SESSION_EXPIRED", "DEVICE_REVOKED", "SPACE_ACCESS_REVOKED", "FORBIDDEN", "NOT_FOUND", "ID_COLLISION", "VALIDATION_FAILED"]);

async function claim(id: string, now: number): Promise<EmergencyQueueRow | undefined> {
  return db.transaction("rw", db.emergencyQueue, async () => {
    const row = await db.emergencyQueue.get(id);
    if (!row || row.blocked || row.nextAttemptAt > now || (row.leaseUntil ?? 0) > now) return undefined;
    const claimed = { ...row, leaseOwner: owner, leaseUntil: now + 30_000 };
    await db.emergencyQueue.put(claimed);
    return claimed;
  });
}

export async function flushEmergencyQueue(now = Date.now()): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if ((await db.settings.get("online.enabled"))?.value !== true) return;
  const identity = currentOnlineIdentity();
  if (!identity) return;
  const rows = await db.emergencyQueue.toArray();
  rows.sort((a, b) => Number(a.kind !== "RECONCILE") - Number(b.kind !== "RECONCILE"));
  for (const queued of rows) {
    const space = await db.spaces.get(queued.spaceId);
    const cursor = await db.syncCursors.get(queued.spaceId);
    if (!space || space.deletedAt || space.kind !== "FAMILY" || space.sharingState !== "SHARED" || queued.actorId !== identity.actorId || cursor?.halt) continue;
    const row = await claim(queued.id, now);
    if (!row) continue;
    const event = await db.emergencyEvents.get(row.eventId);
    if (!isEmergencyRecord(event) || (row.kind !== "RECONCILE" && event.status !== "ACTIVE")) {
      await finish(row);
      continue;
    }
    try {
      const path = emergencyPath(row.spaceId, row.eventId);
      if (row.kind === "RECONCILE") {
        // Reconcile the latest lifecycle so a close made offline never replays an ACTIVE alert first.
        const accepted = await api<EmergencyAccepted>("POST", emergencyPath(row.spaceId), { id: event.id, operation_id: row.operationId, client_triggered_at: event.createdAt, lifecycle: event.status, closed_at: event.closedAt, reason: event.reason });
        await db.transaction("rw", db.emergencyEvents, db.emergencyQueue, async () => {
          const current = await db.emergencyEvents.get(event.id);
          const pending = await db.emergencyQueue.get(row.id);
          if (!isEmergencyRecord(current)) return;
          const sameOperation = pending?.operationId === row.operationId;
          const terminal = accepted.lifecycle !== "ACTIVE";
          const status = current.status === "ACTIVE" || terminal ? accepted.lifecycle : current.status;
          await db.emergencyEvents.update(event.id, { serverReceivedAt: accepted.server_received_at, revision: accepted.revision, status, delivery: sameOperation ? "SERVER_ACCEPTED" : current.delivery, serverClosedConfirmedAt: terminal ? current.serverClosedConfirmedAt ?? new Date().toISOString() : current.serverClosedConfirmedAt, errorCode: undefined });
          if (sameOperation) await db.emergencyQueue.delete(row.id);
        });
      } else if (row.kind === "LOCATION") {
        const position = row.payload as EmergencyPosition;
        if (!event.serverReceivedAt || !position) { await retry(row, "WAITING_FOR_EVENT", now); continue; }
        await api("POST", path + "/location", { lat: position.lat, lng: position.lng, accuracy: position.accuracy, captured_at: position.capturedAt, provenance: position.provenance });
        await finish(row);
      } else {
        await api("POST", path + "/responses", { operation_id: row.operationId, ...row.payload });
        await finish(row);
      }
    } catch (error) {
      const code = error instanceof ApiRequestError ? error.code : "NETWORK";
      if (code === "EMERGENCY_CLOSED" && row.kind !== "RECONCILE") await finish(row);
      else if (blockedCodes.has(code)) {
        await db.transaction("rw", db.emergencyQueue, db.emergencyEvents, async () => {
          const pending = await db.emergencyQueue.get(row.id);
          if (pending?.operationId !== row.operationId) return;
          await db.emergencyQueue.update(row.id, { blocked: true, leaseUntil: 0 });
          if (row.kind === "RECONCILE") await db.emergencyEvents.update(row.eventId, { delivery: "BLOCKED", errorCode: code });
          else if (code === "FORBIDDEN" || code === "SPACE_ACCESS_REVOKED") await db.emergencyEvents.delete(row.eventId);
        });
      } else await retry(row, code, now);
    }
  }
}

async function finish(row: EmergencyQueueRow) {
  await db.transaction("rw", db.emergencyQueue, async () => {
    if ((await db.emergencyQueue.get(row.id))?.operationId === row.operationId) await db.emergencyQueue.delete(row.id);
  });
}

async function retry(row: EmergencyQueueRow, code: string, now: number) {
  await db.transaction("rw", db.emergencyQueue, db.emergencyEvents, async () => {
    if ((await db.emergencyQueue.get(row.id))?.operationId !== row.operationId) return;
    await db.emergencyQueue.update(row.id, { attempts: row.attempts + 1, nextAttemptAt: now + Math.min(60_000, 1000 * 2 ** Math.min(row.attempts, 6)), leaseUntil: 0 });
    if (row.kind === "RECONCILE") await db.emergencyEvents.update(row.eventId, { delivery: "FAILED_RETRYABLE", errorCode: code });
  });
}

export async function purgeExpiredEmergencyPositions(now = Date.now()): Promise<void> {
  await db.transaction("rw", db.emergencyEvents, db.emergencyQueue, async () => {
    for (const row of await db.emergencyEvents.toArray()) if (isEmergencyRecord(row) && shouldPurgePosition(row, now)) {
      await db.emergencyEvents.update(row.id, { position: undefined });
      await db.emergencyQueue.delete(`${row.id}:LOCATION`);
    }
  });
}
