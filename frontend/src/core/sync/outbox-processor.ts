import { ApiRequestError } from "../api/errors";
import { db, type SyncCursorRow } from "../db/db";
import { resourceTable } from "../repo/read";
import { nextBackoffMs } from "./backoff";
import type { OutboxOp, OutboxState } from "./outbox-types";
import { RESOURCE_STORE, type BaseRecord, type ResourceType } from "./resource-types";
import { toOperationWire, type OperationResultWire, type SyncTransport } from "./transport";

export const MAX_BATCH_OPS = 50;
// Server limit is 512 KB per request; the margin covers the envelope and multi-byte characters.
export const MAX_BATCH_BYTES = 400 * 1024;
const MAX_ROUNDS = 200;

export interface OutboxRunResult {
  sent: number;
  applied: number;
  conflicts: number;
  blocked: boolean;
}

/** States that still hold the next ops of the same record back (send order per record is preserved). */
const CHAIN_STATES: ReadonlySet<OutboxState> = new Set(["QUEUED", "SENDING", "RETRY_WAIT", "CONFLICT", "BLOCKED"]);
const AUTH_CODES = new Set(["AUTH_REQUIRED", "SESSION_EXPIRED"]);
const BLOCK_CODES = new Set(["DEVICE_REVOKED", "SPACE_ACCESS_REVOKED"]);
// CONTRACT_UNSUPPORTED stays pending until an app update can resend it (sync-protocol.md Error contract).
const TRANSIENT_CODES = new Set(["NETWORK", "RATE_LIMITED", "TEMPORARILY_UNAVAILABLE", "INTERNAL", "CONTRACT_UNSUPPORTED"]);

const fallbackLocks = new Map<string, Promise<unknown>>();

/**
 * Serialises sync work for one Space across tabs (Web Locks); the server's operation-id idempotency still has to
 * hold because a lease is no proof of exactly-once.
 */
export async function withSpaceLock<T>(spaceId: string, fn: () => Promise<T>): Promise<T> {
  const name = `fc-sync-${spaceId}`;
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (locks?.request) return locks.request(name, () => fn()) as Promise<T>;
  const prev = fallbackLocks.get(name) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => undefined);
  fallbackLocks.set(name, tail);
  try {
    return await run;
  } finally {
    if (fallbackLocks.get(name) === tail) fallbackLocks.delete(name);
  }
}

/** SENDING found outside a running send means the tab died mid-request: resend later under the same id. */
export async function recoverInterruptedOps(spaceId?: string): Promise<number> {
  return db.transaction("rw", db.outbox, async () => {
    const stuck = await db.outbox.where("state").equals("SENDING").toArray();
    const mine = stuck.filter((op) => !spaceId || op.spaceId === spaceId);
    for (const op of mine) await db.outbox.update(op.operationId, { state: "QUEUED" });
    return mine.length;
  });
}

const resourceKey = (op: Pick<OutboxOp, "resourceType" | "resourceId">) => `${op.resourceType}:${op.resourceId}`;
const byCreation = (a: OutboxOp, b: OutboxOp) =>
  a.clientCreatedAt < b.clientCreatedAt ? -1 : a.clientCreatedAt > b.clientCreatedAt ? 1 : a.operationId < b.operationId ? -1 : 1;

function isDue(op: OutboxOp, now: Date): boolean {
  if (op.state === "QUEUED") return true;
  return op.state === "RETRY_WAIT" && (!op.nextAttemptAt || new Date(op.nextAttemptAt).getTime() <= now.getTime());
}

async function nextBatch(spaceId: string, now: Date, limit: number): Promise<OutboxOp[]> {
  const open = (await db.outbox.where("spaceId").equals(spaceId).toArray()).filter((op) => CHAIN_STATES.has(op.state)).sort(byCreation);
  const heads = new Map<string, OutboxOp>();
  for (const op of open) if (!heads.has(resourceKey(op))) heads.set(resourceKey(op), op);
  const due = [...heads.values()].filter((op) => isDue(op, now));
  // Urgent ops (occurrence actions, SOS) never wait behind a large calendar batch.
  const urgent = due.filter((op) => op.priority === 1);
  const pool = urgent.length > 0 ? urgent : due;
  const batch: OutboxOp[] = [];
  let bytes = 0;
  for (const op of pool) {
    const size = JSON.stringify(toOperationWire(op)).length * 2;
    if (batch.length > 0 && (batch.length >= limit || bytes + size > MAX_BATCH_BYTES)) break;
    batch.push(op);
    bytes += size;
  }
  return batch;
}

async function setHalt(spaceId: string, halt: SyncCursorRow["halt"], code?: string): Promise<void> {
  const row = await db.syncCursors.get(spaceId);
  if (!row && !halt) return;
  if (row && (row.halt ?? null) === halt && row.haltCode === code) return;
  await db.syncCursors.put({ ...(row ?? { spaceId, cursor: null, updatedAt: new Date().toISOString() }), halt, haltCode: code });
}

async function blockSpace(spaceId: string, code: string): Promise<void> {
  await db.transaction("rw", [db.outbox, db.syncCursors], async () => {
    const live = await db.outbox.where("spaceId").equals(spaceId).toArray();
    for (const op of live) {
      if (op.state === "QUEUED" || op.state === "SENDING" || op.state === "RETRY_WAIT") {
        await db.outbox.update(op.operationId, { state: "BLOCKED", lastErrorCode: code });
      }
    }
    await setHalt(spaceId, "BLOCKED", code);
  });
}

function scopeFor(type: ResourceType): string[] {
  return [RESOURCE_STORE[type], "outbox", "syncCursors"];
}

async function retryLater(ops: OutboxOp[], code: string, now: Date): Promise<void> {
  await db.transaction("rw", db.outbox, async () => {
    for (const op of ops) {
      const fresh = await db.outbox.get(op.operationId);
      const attempts = fresh?.attempts ?? op.attempts;
      const nextAttemptAt = new Date(now.getTime() + nextBackoffMs(Math.max(0, attempts - 1))).toISOString();
      await db.outbox.update(op.operationId, { state: "RETRY_WAIT", nextAttemptAt, lastErrorCode: code });
    }
  });
}

async function requeue(ops: OutboxOp[], code?: string): Promise<void> {
  await db.transaction("rw", db.outbox, async () => {
    for (const op of ops) await db.outbox.update(op.operationId, { state: "QUEUED", ...(code ? { lastErrorCode: code } : {}) });
  });
}

async function laterOpsOf(op: OutboxOp): Promise<OutboxOp[]> {
  const same = await db.outbox
    .where("resourceId")
    .equals(op.resourceId)
    .filter((o) => o.operationId !== op.operationId && o.resourceType === op.resourceType && CHAIN_STATES.has(o.state))
    .toArray();
  return same.sort(byCreation);
}

/** Canonical record + new revision + ACKNOWLEDGED in one transaction (sync-protocol.md State client). */
async function acknowledge(op: OutboxOp, revision: string, record: Record<string, unknown> | null, code?: string): Promise<void> {
  const table = resourceTable(op.resourceType);
  await db.transaction("rw", scopeFor(op.resourceType), async () => {
    const later = await laterOpsOf(op);
    const local = await table.get(op.resourceId);
    const syncState: BaseRecord["syncState"] = later.length > 0 ? "PENDING" : "SYNCED";
    if (op.action === "delete" || code === "RESOURCE_DELETED") {
      if (local) await table.put({ ...local, deletedAt: local.deletedAt ?? new Date().toISOString(), revision, syncState });
    } else if (!record) {
      // Applied but no longer readable by this actor (e.g. made PRIVATE by its creator elsewhere).
      if (later.length === 0) await table.delete(op.resourceId);
    } else {
      const id = typeof record.id === "string" ? record.id : op.resourceId;
      if (id !== op.resourceId) {
        // occurrence_action upserts by natural key; the server may already hold that row under another id.
        await table.delete(op.resourceId);
        for (const o of later) {
          const payload = o.payload && typeof o.payload === "object" ? { ...(o.payload as object), id } : o.payload;
          await db.outbox.update(o.operationId, { resourceId: id, payload });
        }
      }
      const next = later.length > 0 && local ? { ...local, id, revision, syncState } : { ...(record as unknown as BaseRecord), revision, syncState };
      if (op.resourceType === "space_settings" && local) await table.put({ ...local, ...next });
      else await table.put(next as BaseRecord);
    }
    // Ops queued on top of this one were built from the same local copy; they now start from the new revision.
    for (const o of later) {
      if (o.attempts === 0 && o.action !== "create") await db.outbox.update(o.operationId, { baseRevision: revision });
    }
    await db.outbox.update(op.operationId, { state: "ACKNOWLEDGED", nextAttemptAt: null, lastErrorCode: code, lastErrorFields: undefined });
  });
}

async function markNeedsAttention(op: OutboxOp, state: "CONFLICT" | "INVALID", result: OperationResultWire): Promise<void> {
  const table = resourceTable(op.resourceType);
  await db.transaction("rw", scopeFor(op.resourceType), async () => {
    await db.outbox.update(op.operationId, {
      state,
      nextAttemptAt: null,
      lastErrorCode: result.error?.code,
      lastErrorFields: result.error?.fields,
      ...("current" in result ? { conflictCurrent: (result.current ?? null) as Record<string, unknown> | null } : {}),
    });
    if (await table.get(op.resourceId)) await table.update(op.resourceId, { syncState: "CONFLICT" });
  });
}

type Step = "continue" | "stop";

async function applyResult(spaceId: string, op: OutboxOp, result: OperationResultWire | undefined, now: Date, totals: OutboxRunResult): Promise<Step> {
  if (!result) {
    await retryLater([op], "NO_RESULT", now);
    return "continue";
  }
  if (result.status === "APPLIED") {
    await acknowledge(op, result.revision ?? op.baseRevision ?? "0", (result.record ?? null) as Record<string, unknown> | null);
    totals.applied += 1;
    return "continue";
  }
  const code = result.error?.code ?? "INTERNAL";
  if (code === "REVISION_CONFLICT") {
    await markNeedsAttention(op, "CONFLICT", result);
    totals.conflicts += 1;
    return "continue";
  }
  if (code === "RESOURCE_DELETED") {
    // Never resurrect: the delete elsewhere wins and the user may re-create explicitly.
    await acknowledge(op, op.baseRevision ?? "0", null, code);
    return "continue";
  }
  if (AUTH_CODES.has(code)) {
    await requeue([op], code);
    await setHalt(spaceId, "AUTH_REQUIRED", code);
    return "stop";
  }
  if (BLOCK_CODES.has(code)) {
    await blockSpace(spaceId, code);
    totals.blocked = true;
    return "stop";
  }
  if (TRANSIENT_CODES.has(code)) {
    await retryLater([op], code, now);
    return "continue";
  }
  // Business 4xx: retrying the same body can never succeed; a fix goes out as a new operation.
  await markNeedsAttention(op, "INVALID", result);
  totals.conflicts += 1;
  return "continue";
}

async function sendBatch(spaceId: string, batch: OutboxOp[], t: SyncTransport, now: () => Date, totals: OutboxRunResult): Promise<Step | "split"> {
  await db.transaction("rw", db.outbox, async () => {
    for (const op of batch) await db.outbox.update(op.operationId, { state: "SENDING", attempts: op.attempts + 1 });
  });
  const sending = batch.map((op) => ({ ...op, state: "SENDING" as const, attempts: op.attempts + 1 }));
  totals.sent += batch.length;

  let response: Awaited<ReturnType<SyncTransport["sendOperations"]>>;
  try {
    response = await t.sendOperations(spaceId, sending.map(toOperationWire));
  } catch (error) {
    if (!(error instanceof ApiRequestError)) {
      await requeue(sending);
      throw error;
    }
    const code = error.code;
    if (AUTH_CODES.has(code)) {
      await requeue(sending, code);
      await setHalt(spaceId, "AUTH_REQUIRED", code);
      return "stop";
    }
    if (BLOCK_CODES.has(code) || code === "FORBIDDEN") {
      await blockSpace(spaceId, code);
      totals.blocked = true;
      return "stop";
    }
    if (TRANSIENT_CODES.has(code) || code === "RESYNC_REQUIRED") {
      await retryLater(sending, code, now());
      return "stop";
    }
    // Request-level 413/422: find the culprit by sending one op per request.
    if (sending.length > 1) {
      await requeue(sending);
      return "split";
    }
    await markNeedsAttention(sending[0], "INVALID", { operation_id: sending[0].operationId, status: "REJECTED", error: { code, message: error.message, fields: error.fields } });
    totals.conflicts += 1;
    return "continue";
  }

  await setHalt(spaceId, null);
  const results = new Map(response.results.map((r) => [r.operation_id, r]));
  for (const op of sending) {
    if ((await applyResult(spaceId, op, results.get(op.operationId), now(), totals)) === "stop") return "stop";
  }
  return "continue";
}

/**
 * Sends the due outbox ops of a SHARED Space (urgent first, one op per record per request so edits stay ordered)
 * and applies each result atomically. LOCAL_ONLY Spaces never reach the network.
 */
export async function processOutbox(spaceId: string, t: SyncTransport, now: () => Date = () => new Date()): Promise<OutboxRunResult> {
  return withSpaceLock(spaceId, async () => {
    const totals: OutboxRunResult = { sent: 0, applied: 0, conflicts: 0, blocked: false };
    const space = await db.spaces.get(spaceId);
    if (!space || space.deletedAt !== null || space.sharingState !== "SHARED") return totals;
    if ((await db.syncCursors.get(spaceId))?.halt === "BLOCKED") return { ...totals, blocked: true };
    await recoverInterruptedOps(spaceId);
    let limit = MAX_BATCH_OPS;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const batch = await nextBatch(spaceId, now(), limit);
      if (batch.length === 0) break;
      const step = await sendBatch(spaceId, batch, t, now, totals);
      if (step === "stop") break;
      if (step === "split") limit = 1;
    }
    return totals;
  });
}
