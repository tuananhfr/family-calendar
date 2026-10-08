import { db } from "@/core/db/db";
import { newId } from "@/core/ids";
import { RESOURCE_STORE, type BaseRecord } from "@/core/sync/resource-types";
import { createHttpTransport } from "@/core/sync/http-transport";
import { archiveDraft } from "@/core/sync/drafts";
import { payloadOf } from "@/core/sync/bootstrap-client";
export async function resolveConflict(operationId: string, choice: "server" | "local") {
  const op = await db.outbox.get(operationId);
  if (!op || !["CONFLICT", "INVALID"].includes(op.state)) return;
  const snapshot = await createHttpTransport().getSnapshot(op.spaceId);
  const current = op.resourceType === "space_settings" ? snapshot.space as unknown as BaseRecord : (snapshot.records[op.resourceType] ?? []).find((r: Record<string, unknown>) => r.id === op.resourceId) as BaseRecord | undefined;
  if (choice === "local" && !current) throw new Error("RESOURCE_DELETED");
  await db.transaction("rw", [RESOURCE_STORE[op.resourceType], "outbox", "sharedDrafts", "blobs"], async () => {
    const table = db.table<BaseRecord>(RESOURCE_STORE[op.resourceType]);
    const local = await table.get(op.resourceId);
    const chain = await db.outbox.where("resourceId").equals(op.resourceId).filter((o) => o.spaceId === op.spaceId && o.resourceType === op.resourceType && o.state !== "ACKNOWLEDGED").toArray();
    for (const pending of chain) await db.outbox.delete(pending.operationId);
    if (choice === "server") {
      await archiveDraft(op, local);
      if (current) await table.put({ ...current, syncState: "SYNCED" }); else await table.delete(op.resourceId);
    } else {
      const now = new Date().toISOString();
      const payload = local ? payloadOf(local) : op.payload;
      await db.outbox.put({ ...op, operationId: newId(), action: op.action === "delete" ? "delete" : "update",
        payload, baseRevision: current!.revision, clientCreatedAt: now, state: "QUEUED", attempts: 0,
        nextAttemptAt: null, lastErrorCode: undefined, lastErrorFields: undefined, conflictCurrent: undefined });
      if (local) await table.put({ ...local, revision: current!.revision, syncState: "PENDING" });
    }
  });
}
