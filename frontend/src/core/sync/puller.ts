import { ApiRequestError } from "../api/errors";
import { db, type SyncCursorRow } from "../db/db";
import { withSpaceLock } from "./outbox-processor";
import { RESOURCE_STORE, RESOURCE_TYPES, type BaseRecord } from "./resource-types";
import { applySnapshot, fromWire, pendingResourceKeys } from "./snapshot-apply";
import type { ChangesPage, SyncTransport } from "./transport";

import { recordMedia } from "./drafts";

const MAX_PAGES = 1000;

async function applyPage(spaceId: string, page: ChangesPage): Promise<number> {
  const stores = [...new Set(RESOURCE_TYPES.map((t) => RESOURCE_STORE[t]))];
  return db.transaction("rw", [...stores, "outbox", "syncCursors", "blobs"], async () => {
    const pending = await pendingResourceKeys(spaceId);
    let applied = 0;
    for (const change of page.changes) {
      if (pending.has(`${change.resource_type}:${change.resource_id}`)) continue;
      const table = db.table<BaseRecord, string>(RESOURCE_STORE[change.resource_type]);
      const local = await table.get(change.resource_id);
      if (local && local.spaceId !== spaceId) continue;
      if (change.op === "UPSERT" && change.record) {
        const next = fromWire(change.record, change.revision);
        if (local) {
          const prior = local as BaseRecord & { avatar?: string; audioAssetId?: string };
          if ((change.resource_type === "member" && prior.avatar !== change.record.avatar) || (["item", "reminder_rule"].includes(change.resource_type) && prior.audioAssetId !== change.record.audioAssetId))
            for (const blob of await recordMedia(change.resource_type, prior)) await db.blobs.delete(blob.id);
        }
        // The space row also carries local-only fields (sharingState) the wire copy may not repeat.
        await table.put(change.resource_type === "space_settings" && local ? { ...local, ...next, sharingState: "SHARED" } as BaseRecord : next);
        applied += 1;
      } else if (change.op === "DELETE" && local) {
        for (const blob of await recordMedia(change.resource_type, local)) await db.blobs.delete(blob.id);
        await table.put({ ...local, deletedAt: local.deletedAt ?? new Date().toISOString(), revision: change.revision, syncState: "SYNCED" });
        applied += 1;
      }
    }
    const row = await db.syncCursors.get(spaceId);
    await db.syncCursors.put({ ...(row as SyncCursorRow), spaceId, cursor: page.next_cursor, updatedAt: new Date().toISOString() });
    return applied;
  });
}

/**
 * Pulls changes since the stored cursor. No cursor yet, RESYNC_REQUIRED or a new policy_version → one snapshot
 * (records the viewer lost are dropped), then pulling resumes from its watermark. Pending drafts are never overwritten.
 */
export async function pullChanges(spaceId: string, t: SyncTransport): Promise<{ applied: number; resynced: boolean }> {
  return withSpaceLock(spaceId, async () => {
    let applied = 0;
    let resynced = false;
    const space = await db.spaces.get(spaceId);
    if (!space || space.deletedAt !== null || space.sharingState !== "SHARED") return { applied, resynced };
    let row = await db.syncCursors.get(spaceId);
    if (row?.halt === "BLOCKED") return { applied, resynced };

    const resync = async () => {
      if (resynced) throw new ApiRequestError("RESYNC_REQUIRED", 409);
      await applySnapshot(spaceId, await t.getSnapshot(spaceId));
      resynced = true;
      row = await db.syncCursors.get(spaceId);
    };

    if (!row?.cursor || !row.policyVersion) await resync();
    for (let i = 0; i < MAX_PAGES; i++) {
      let page: ChangesPage;
      try {
        page = await t.getChanges(spaceId, row!.cursor!);
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === "RESYNC_REQUIRED") {
          await resync();
          continue;
        }
        throw error;
      }
      if (page.policy_version !== row!.policyVersion) {
        await resync();
        continue;
      }
      applied += await applyPage(spaceId, page);
      row = await db.syncCursors.get(spaceId);
      if (!page.has_more) break;
    }
    return { applied, resynced };
  });
}
