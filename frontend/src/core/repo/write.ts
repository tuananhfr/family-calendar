import { db } from "../db/db";
import { isQuotaError, RepoError, StorageFullError } from "../db/errors";
import { getLocalIdentity } from "../db/local-identity";
import { ensurePersistentStorage } from "../db/persist";
import { newId } from "../ids";
import { DEFAULT_TIME_ZONE, type SpaceKind } from "../model/common";
import { DEFAULT_SPACE_SETTINGS, type Space } from "../model/space";
import type { OutboxAction, OutboxOp } from "../sync/outbox-types";
import { LOCAL_ONLY_FIELDS, RESOURCE_STORE, type BaseRecord, type ResourceType } from "../sync/resource-types";
import { isValidTimeZone } from "../time/zoned";
import { resourceTable } from "./read";

export { RepoError, StorageFullError } from "../db/errors";

async function runWrite<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isQuotaError(error)) throw new StorageFullError({ cause: error });
    throw error;
  }
}

function scope(type: ResourceType): string[] {
  return [...new Set([RESOURCE_STORE[type], "spaces", "outbox"])];
}

function toPayload(record: BaseRecord): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...record };
  for (const field of LOCAL_ONLY_FIELDS) delete payload[field];
  return payload;
}

async function lastOpenOp(type: ResourceType, resourceId: string): Promise<OutboxOp | undefined> {
  const ops = await db.outbox
    .where("resourceId")
    .equals(resourceId)
    .filter((op) => op.resourceType === type && op.state !== "ACKNOWLEDGED")
    .toArray();
  ops.sort((a, b) => (a.clientCreatedAt < b.clientCreatedAt ? -1 : a.clientCreatedAt > b.clientCreatedAt ? 1 : 0));
  return ops.at(-1);
}

// An op still QUEUED with zero attempts has never left this device, so rewriting it cannot confuse the server's
// idempotency check; anything else is immutable and a new op is appended.
function isUnsent(op: OutboxOp | undefined): op is OutboxOp {
  return !!op && op.state === "QUEUED" && op.attempts === 0;
}

function newOp(
  base: Pick<OutboxOp, "spaceId" | "resourceType" | "resourceId" | "action" | "baseRevision" | "payload">,
  now: string,
): OutboxOp {
  return {
    ...base,
    operationId: newId(),
    clientCreatedAt: now,
    schemaVersion: 1,
    state: "QUEUED",
    attempts: 0,
    nextAttemptAt: null,
    priority: base.action === "occurrence_action" ? 1 : 0,
  };
}

/**
 * Writes a record locally; in a SHARED Space also queues one outbox op in the same transaction, so either both
 * land or neither does. Throws StorageFullError when IndexedDB is out of quota (nothing is kept).
 */
export async function saveResource<T extends BaseRecord>(
  type: ResourceType,
  record: T,
  action: "create" | "update" | "occurrence_action",
): Promise<T> {
  const table = resourceTable<T>(type);
  return runWrite(() =>
    db.transaction("rw", scope(type), async () => {
      const space = await db.spaces.get(record.spaceId);
      if (!space || space.deletedAt !== null) throw new RepoError("SPACE_NOT_FOUND", record.spaceId);
      const existing = await table.get(record.id);
      if (existing && existing.spaceId !== record.spaceId) throw new RepoError("WRONG_SPACE", record.id);
      if (action === "create" && existing) throw new RepoError("ALREADY_EXISTS", record.id);
      if (action === "update" && (!existing || existing.deletedAt !== null)) throw new RepoError("NOT_FOUND", record.id);

      const now = new Date().toISOString();
      const shared = space.sharingState === "SHARED";
      const next: T = {
        ...record,
        createdAt: existing?.createdAt || record.createdAt || now,
        updatedAt: now,
        revision: existing?.revision ?? null,
        syncState: shared ? "PENDING" : "LOCAL",
      };
      await table.put(next);

      if (shared) {
        const payload = toPayload(next);
        const last = await lastOpenOp(type, record.id);
        if (isUnsent(last) && last.action !== "delete") {
          await db.outbox.update(last.operationId, { payload, clientCreatedAt: now });
        } else {
          const opAction: OutboxAction = action;
          await db.outbox.add(
            newOp(
              { spaceId: record.spaceId, resourceType: type, resourceId: record.id, action: opAction, baseRevision: existing?.revision ?? null, payload },
              now,
            ),
          );
        }
      }
      return next;
    }),
  );
}

/** Tombstones a record (deletedAt) and, in a SHARED Space, queues a delete op. */
export async function deleteResource(type: ResourceType, id: string): Promise<void> {
  const table = resourceTable(type);
  await runWrite(() =>
    db.transaction("rw", scope(type), async () => {
      const existing = await table.get(id);
      if (!existing) throw new RepoError("NOT_FOUND", id);
      if (existing.deletedAt !== null) return;
      const space = await db.spaces.get(existing.spaceId);
      const shared = space?.sharingState === "SHARED";
      const now = new Date().toISOString();
      let syncState: BaseRecord["syncState"] = shared ? "PENDING" : "LOCAL";

      if (shared) {
        const last = await lastOpenOp(type, id);
        if (isUnsent(last) && last.action === "create") {
          // The server never saw this record; dropping the create is the whole delete.
          await db.outbox.delete(last.operationId);
          syncState = "LOCAL";
        } else if (isUnsent(last)) {
          await db.outbox.update(last.operationId, { action: "delete", payload: null, clientCreatedAt: now });
        } else {
          await db.outbox.add(
            newOp(
              { spaceId: existing.spaceId, resourceType: type, resourceId: id, action: "delete", baseRevision: existing.revision, payload: null },
              now,
            ),
          );
        }
      }
      await table.put({ ...existing, deletedAt: now, updatedAt: now, syncState });
    }),
  );
}

/** Creates a LOCAL_ONLY Space owned by this device's local Actor; returns its id. */
export async function createLocalSpace(input: { kind: SpaceKind; name: string; timeZone?: string }): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new RangeError("Space name is required");
  const timeZone = input.timeZone ?? DEFAULT_TIME_ZONE;
  if (!isValidTimeZone(timeZone)) throw new RangeError(`Unknown time zone: ${timeZone}`);
  const { actorId } = await getLocalIdentity();
  const id = newId();
  const now = new Date().toISOString();
  const space: Space = {
    id,
    spaceId: id,
    createdByActorId: actorId,
    dataClass: "NORMAL",
    sharingScope: input.kind === "FAMILY" ? "FAMILY_ALL" : "GROUP_MEMBERS",
    revision: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncState: "LOCAL",
    kind: input.kind,
    name,
    timeZone,
    sharingState: "LOCAL",
    settings: { ...DEFAULT_SPACE_SETTINGS },
  };
  await runWrite(() => db.spaces.add(space));
  // First user-created data is the moment TEC-06 asks for persistence; the result only affects eviction risk.
  void ensurePersistentStorage();
  return id;
}
