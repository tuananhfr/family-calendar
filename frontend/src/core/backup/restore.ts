import { db } from "../db/db";
import { isQuotaError, StorageFullError } from "../db/errors";
import { getLocalIdentity } from "../db/local-identity";
import type { Item } from "../model/item";
import type { StoredFile } from "../model/storage";
import { EXTRA_BACKUP_STORES, SPACE_STORES, type BackupFailure } from "./format";
import { findConflicts, readBackup, restorableRows, sameContent, type ParsedBackup, type RestoreConflict } from "./validate";

export type RestoreMode = "REPLACE" | "MERGE";
export type ConflictResolution = "KEEP_LOCAL" | "USE_BACKUP";

export type RestoreReport =
  | {
      ok: true;
      mode: RestoreMode;
      /** NEEDS_RESOLUTION: MERGE found conflicts without a resolution; nothing was written. */
      status: "RESTORED" | "NEEDS_RESOLUTION";
      written: Record<string, number>;
      conflicts: RestoreConflict[];
      /** SOS events that were ACTIVE in the backup and came back CLOSED_ENDED. */
      closedEmergencyCount: number;
    }
  | BackupFailure;

// Runtime stores tied to a Space that a REPLACE must clear so nothing stale (ops, alerts) refers to old rows.
const SPACE_RUNTIME_STORES = ["outbox", "notifications", "firedReminders"] as const;

async function clearSpace(spaceId: string): Promise<void> {
  const files = (await db.files.where("spaceId").equals(spaceId).toArray()) as StoredFile[];
  const items = (await db.items.where("spaceId").equals(spaceId).toArray()) as Item[];
  const blobIds = [
    ...items.map((i) => i.audioAssetId).filter((id): id is string => !!id),
    ...files.map((f) => f.thumbnailBlobId).filter((id): id is string => !!id),
  ];
  if (files.length > 0) await db.blobs.where("fileId").anyOf(files.map((f) => f.id)).delete();
  await db.blobs.bulkDelete(blobIds);
  for (const store of [...SPACE_STORES, ...SPACE_RUNTIME_STORES]) await db.table(store).where("spaceId").equals(spaceId).delete();
  await db.syncCursors.delete(spaceId);
}

function blobRows(backup: ParsedBackup) {
  return backup.blobs.map(({ bytes, ...meta }) => ({ ...meta, data: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: meta.mime }) }));
}

/**
 * Restores a verified backup in one transaction: a bad file, missing resolution or full disk leaves the database
 * exactly as it was. Never queues outbox operations and never makes a Space SHARED (domain-model.md Portability).
 */
export async function restoreBackup(
  file: Blob,
  mode: RestoreMode,
  resolutions: Record<string, ConflictResolution> = {},
  opts: { now?: Date; maxBytes?: number } = {},
): Promise<RestoreReport> {
  const read = await readBackup(file, { maxBytes: opts.maxBytes });
  if (!read.ok) return read;
  const { backup } = read;
  const now = opts.now ?? new Date();
  const { actorId } = await getLocalIdentity();
  const rows = restorableRows(backup, actorId, now);
  const closedEmergencyCount = (backup.rows.emergencyEvents ?? []).filter((e) => e.status === "ACTIVE").length;
  const blobs = blobRows(backup);
  const tables = [...SPACE_STORES, ...SPACE_RUNTIME_STORES, "syncCursors", "blobs", "settings"];

  try {
    return await db.transaction("rw", tables, async () => {
      const written: Record<string, number> = {};
      const count = (store: string, n: number) => {
        if (n > 0) written[store] = (written[store] ?? 0) + n;
      };

      if (mode === "REPLACE") {
        for (const spaceId of backup.manifest.spaceIds) await clearSpace(spaceId);
        for (const [store, list] of Object.entries(rows)) {
          await db.table(store).bulkPut(list);
          count(store, list.length);
        }
        await db.blobs.bulkPut(blobs);
        count("blobs", blobs.length);
        await db.settings.bulkPut(backup.settings);
        count("settings", backup.settings.length);
        return { ok: true as const, mode, status: "RESTORED" as const, written, conflicts: [], closedEmergencyCount };
      }

      const conflicts = await findConflicts(rows);
      if (conflicts.some((c) => !resolutions[c.key])) {
        return { ok: true as const, mode, status: "NEEDS_RESOLUTION" as const, written: {}, conflicts, closedEmergencyCount: 0 };
      }
      for (const [store, list] of Object.entries(rows)) {
        const table = db.table<Record<string, unknown>, string>(store);
        const local = await table.bulkGet(list.map((r) => r.id as string));
        const put: Array<Record<string, unknown>> = [];
        list.forEach((row, i) => {
          const existing = local[i];
          if (!existing) put.push(row);
          else if (!(EXTRA_BACKUP_STORES as readonly string[]).includes(store) && !sameContent(existing, row) && resolutions[`${store}/${row.id as string}`] === "USE_BACKUP") {
            // Content from the backup, but the Space's link to the server stays as it is on this device.
            put.push({ ...row, revision: existing.revision, ...(store === "spaces" ? { sharingState: existing.sharingState } : {}) });
          }
        });
        await table.bulkPut(put);
        count(store, put.length);
      }
      const haveBlobs = new Set((await db.blobs.bulkGet(blobs.map((b) => b.id))).filter((b) => !!b).map((b) => b!.id));
      const newBlobs = blobs.filter((b) => !haveBlobs.has(b.id));
      await db.blobs.bulkPut(newBlobs);
      count("blobs", newBlobs.length);
      // Device preferences already set here win; the backup only fills in what is missing.
      const haveKeys = new Set((await db.settings.bulkGet(backup.settings.map((s) => s.key))).filter((s) => !!s).map((s) => s!.key));
      const newSettings = backup.settings.filter((s) => !haveKeys.has(s.key));
      await db.settings.bulkPut(newSettings);
      count("settings", newSettings.length);
      return { ok: true as const, mode, status: "RESTORED" as const, written, conflicts, closedEmergencyCount };
    });
  } catch (error) {
    if (isQuotaError(error)) throw new StorageFullError({ cause: error });
    throw error;
  }
}
