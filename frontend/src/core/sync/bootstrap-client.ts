import { api } from "../api/client";
import { db } from "../db/db";
import { getLocalIdentity } from "../db/local-identity";
import { newId } from "../ids";
import type { Space } from "../model/space";
import { RESOURCE_STORE, type BaseRecord, type ResourceType } from "./resource-types";
import { applySnapshot } from "./snapshot-apply";
import type { SnapshotWire } from "./transport";
import { ensureLocalSession } from "@/features/identity/model/session";
import { t } from "@/i18n/vi";
import { withSpaceLock } from "./outbox-processor";
const ORDER: ResourceType[] = ["member", "role", "folder", "file", "item", "item_exception", "occurrence_state", "checklist_item", "checklist_state", "participation", "reminder_rule", "finance_account", "finance_txn", "finance_budget", "finance_saving", "finance_loan", "finance_goal", "health_profile", "health_metric", "health_note", "automation", "template"];
const STORES = [...new Set(ORDER.map((t) => RESOURCE_STORE[t]))];
type BootstrapRecord = { resource_type: ResourceType; resource_id: string; payload: Record<string, unknown> };
type Chunk = { chunk_id: string; records: BootstrapRecord[] };
export interface ShareOptions { selfMemberId: string; includeFiles: boolean; includeAudio: boolean; }
interface Journal { space: Space; options: ShareOptions; chunks: Chunk[]; completed: number; counts: Record<string, number>; }
export function payloadOf(record: BaseRecord): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...record };
  delete payload.revision; delete payload.syncState;
  return payload;
}
async function makeJournal(spaceId: string, options: ShareOptions): Promise<Journal> {
  const local = await getLocalIdentity();
  return db.transaction("rw", ["spaces", ...STORES, "settings"], async () => {
    const prior = (await db.settings.get("bootstrap:" + spaceId))?.value as Journal | undefined;
    if (prior) return prior;
    const space = await db.spaces.get(spaceId);
    if (!space || space.sharingState !== "LOCAL") throw new Error(t("sharing.error"));
    const records: BootstrapRecord[] = [];
    const counts: Record<string, number> = {};
    for (const type of ORDER) {
      let rows = await db.table<BaseRecord>(RESOURCE_STORE[type]).where("spaceId").equals(spaceId).filter((r) => r.deletedAt === null).toArray();
      if (type === "role") rows = rows.filter((r) => !(r as BaseRecord & { system?: boolean }).system);
      if (rows.some((r) => r.createdByActorId !== local.actorId)) throw new Error(t("sharing.wrongIdentity"));
      if (type === "folder") {
        const sorted: BaseRecord[] = [], remaining = new Map(rows.map((r) => [r.id, r]));
        while (remaining.size) {
          const ready = [...remaining.values()].filter((r) => !(r as BaseRecord & { parentId?: string }).parentId || sorted.some((p) => p.id === (r as BaseRecord & { parentId?: string }).parentId));
          if (!ready.length) throw new Error(t("sharing.error"));
          for (const row of ready) { sorted.push(row); remaining.delete(row.id); }
        }
        rows = sorted;
      }
      counts[type] = rows.length;
      for (const row of rows) records.push({ resource_type: type, resource_id: row.id, payload: payloadOf(row) });
    }
    const chunks: Chunk[] = [];
    let batch: BootstrapRecord[] = [], bytes = 0;
    for (const record of records) {
      const size = new TextEncoder().encode(JSON.stringify(record)).byteLength;
      if (batch.length && (batch.length >= 200 || bytes + size > 150_000)) { chunks.push({ chunk_id: newId(), records: batch }); batch = []; bytes = 0; }
      batch.push(record); bytes += size;
    }
    if (batch.length) chunks.push({ chunk_id: newId(), records: batch });
    const journal: Journal = { space, options, chunks, completed: 0, counts };
    await db.settings.put({ key: "bootstrap:" + spaceId, value: journal });
    return journal;
  });
}
async function finish(spaceId: string, journal: Journal, snapshot: SnapshotWire) {
  await db.transaction("rw", ["spaces", ...STORES, "settings", "outbox", "syncCursors", "blobs", "sharedDrafts", "notifications"], async () => {
    const frozen = new Map(journal.chunks.flatMap((c) => c.records).map((r) => [r.resource_type + ":" + r.resource_id, r]));
    for (const type of ORDER) {
      const table = db.table<BaseRecord>(RESOURCE_STORE[type]);
      const current = await table.where("spaceId").equals(spaceId).toArray();
      const canonical = new Map(((snapshot.records[type] ?? []) as Array<Record<string, unknown>>).map((r) => [r.id as string, r]));
      for (const row of current) {
        if (type === "role" && (row as BaseRecord & { system?: boolean }).system) continue;
        const original = frozen.get(type + ":" + row.id);
        if (!original && row.deletedAt) continue;
        if (original && JSON.stringify(payloadOf(row)) === JSON.stringify(original.payload)) continue;
        const server = canonical.get(row.id);
        const action = row.deletedAt ? "delete" : original ? "update" : "create";
        const now = new Date().toISOString();
        await db.outbox.put({ operationId: newId(), spaceId, resourceType: type, resourceId: row.id, action,
          baseRevision: server ? String(server.revision) : null, payload: action === "delete" ? null : payloadOf(row),
          clientCreatedAt: now, schemaVersion: 1, state: "QUEUED", attempts: 0, nextAttemptAt: null, priority: 0 });
        await table.update(row.id, { syncState: "PENDING", revision: server ? String(server.revision) : null });
      }
    }
    const local = await db.spaces.get(spaceId);
    if (local && JSON.stringify(local.settings) !== JSON.stringify(journal.space.settings)) {
      await db.outbox.put({ operationId: newId(), spaceId, resourceType: "space_settings", resourceId: spaceId,
        action: "update", baseRevision: String(snapshot.space.revision), payload: payloadOf(local), clientCreatedAt: new Date().toISOString(),
        schemaVersion: 1, state: "QUEUED", attempts: 0, nextAttemptAt: null, priority: 0 });
    }
    await db.spaces.update(spaceId, { sharingState: "SHARED" });
    await applySnapshot(spaceId, snapshot);
    await db.settings.put({ key: "media-options:" + spaceId, value: { includeFiles: journal.options.includeFiles, includeAudio: journal.options.includeAudio } });
    await db.settings.delete("bootstrap:" + spaceId);
  });
}
export async function enableSharing(spaceId: string, options: ShareOptions, progress: (done: number, total: number) => void) {
  return withSpaceLock(spaceId, async () => {
    const session = await ensureLocalSession();
    const account = await api<{ linked: boolean }>("GET", "/account");
    if (!account.linked) throw new Error(t("sharing.requiresEmail"));
    const journal = await makeJournal(spaceId, options);
    if (journal.space.createdByActorId !== session.actorId) throw new Error(t("sharing.wrongIdentity"));
    const base = "/spaces/" + spaceId;
    const started = await api<{ state: string }>("POST", "/spaces/bootstrap", { space: {
      id: journal.space.id, kind: journal.space.kind, name: journal.space.name, time_zone: journal.space.timeZone, settings: journal.space.settings
    } });
    if (started.state !== "SHARED") {
      for (let i = journal.completed; i < journal.chunks.length; i++) {
        progress(i, journal.chunks.length);
        await api("POST", base + "/bootstrap/chunks", journal.chunks[i]);
        journal.completed = i + 1;
        await db.settings.put({ key: "bootstrap:" + spaceId, value: journal });
      }
      await api("POST", base + "/bootstrap/activate", { expected_counts: journal.counts, self_member_id: journal.options.selfMemberId });
    }
    const snapshot = await api<SnapshotWire>("GET", base + "/sync/snapshot");
    await finish(spaceId, journal, snapshot); progress(journal.chunks.length, journal.chunks.length);
  });
}
