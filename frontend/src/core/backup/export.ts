import { strToU8, zipSync, type Zippable } from "fflate";
import { canRead, canReadItem, hasLevel, type AccessContext } from "../access/evaluate";
import type { Capability } from "../access/capabilities";
import { db, type BlobRow } from "../db/db";
import type { Item } from "../model/item";
import type { StoredFile } from "../model/storage";
import { getSpace } from "../repo/read";
import type { BaseRecord } from "../sync/resource-types";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BLOB_META_STORE,
  EXTRA_BACKUP_STORES,
  ITEM_CHILD_STORES,
  RESOURCE_BACKUP_STORES,
  SECRET_SETTING_KEY,
  SETTINGS_STORE,
  blobPath,
  dataPath,
  sha256Hex,
  type BackupManifest,
  type BlobMeta,
} from "./format";

export class BackupError extends Error {
  constructor(readonly code: "FORBIDDEN" | "SPACE_NOT_FOUND") {
    super(code);
    this.name = "BackupError";
  }
}

export interface ExportOptions {
  includeAudio: boolean;
  includeFiles: boolean;
  actor: AccessContext;
  now?: Date;
}

const STORE_CAPABILITY: Record<string, Capability> = {
  financeAccounts: "finance",
  financeTxns: "finance",
  financeBudgets: "finance",
  financeSavings: "finance",
  financeLoans: "finance",
  financeGoals: "finance",
  healthProfiles: "health",
  healthMetrics: "health",
  healthNotes: "health",
  folders: "storage",
  files: "storage",
};

// Members, roles, templates…: no capability of their own, only the PRIVATE/SENSITIVE rules apply.
function visibleWithoutCapability(actor: AccessContext, rec: BaseRecord): boolean {
  if (rec.sharingScope === "PRIVATE" && rec.createdByActorId !== actor.actorId) return false;
  return rec.dataClass !== "SENSITIVE" || rec.createdByActorId === actor.actorId || canRead(actor, rec, "health");
}

function visible(actor: AccessContext, store: string, rec: BaseRecord): boolean {
  const cap = STORE_CAPABILITY[store];
  return cap ? canRead(actor, rec, cap) : visibleWithoutCapability(actor, rec);
}

/** Zip with manifest.json, data/<store>.json and blobs/<id>; only what `actor` may see (domain-model.md Portability). */
export async function exportBackup(spaceId: string, opts: ExportOptions): Promise<Blob> {
  if (!hasLevel(opts.actor, "backup", "VIEW")) throw new BackupError("FORBIDDEN");
  const space = await getSpace(spaceId);
  if (!space) throw new BackupError("SPACE_NOT_FOUND");

  const data: Record<string, unknown[]> = {};
  await db.transaction("r", db.tables, async () => {
    for (const { store } of RESOURCE_BACKUP_STORES) {
      const rows = await db.table<BaseRecord, string>(store).where("spaceId").equals(spaceId).filter((r) => r.deletedAt === null).toArray();
      data[store] = store === "items" || ITEM_CHILD_STORES.includes(store) ? rows : rows.filter((r) => visible(opts.actor, store, r));
    }
    const items = (data.items as Item[]).filter((i) => canReadItem(opts.actor, i));
    data.items = items;
    // Child rows follow their item: an unreadable item's rule or exception is as private as the item.
    const itemIds = new Set(items.map((i) => i.id));
    for (const store of ITEM_CHILD_STORES) data[store] = (data[store] as Array<BaseRecord & { itemId: string }>).filter((r) => itemIds.has(r.itemId));

    for (const store of EXTRA_BACKUP_STORES) data[store] = await db.table(store).where("spaceId").equals(spaceId).toArray();
    data[SETTINGS_STORE] = (await db.settings.toArray()).filter((s) => !SECRET_SETTING_KEY.test(s.key));

    const blobIds = new Set<string>();
    if (opts.includeAudio) for (const i of items) if (i.audioAssetId) blobIds.add(i.audioAssetId);
    let blobs: BlobRow[] = [];
    if (opts.includeFiles) {
      const files = data.files as StoredFile[];
      for (const f of files) if (f.thumbnailBlobId) blobIds.add(f.thumbnailBlobId);
      const fileIds = files.map((f) => f.id);
      if (fileIds.length > 0) blobs = await db.blobs.where("fileId").anyOf(fileIds).toArray();
    }
    const extra = (await db.blobs.bulkGet([...blobIds].filter((id) => !blobs.some((b) => b.id === id)))).filter((b): b is BlobRow => !!b);
    data[BLOB_META_STORE] = [...blobs, ...extra];
  });

  const blobRows = data[BLOB_META_STORE] as BlobRow[];
  const zip: Zippable = {};
  const blobEntries: BackupManifest["blobs"] = [];
  for (const b of blobRows) {
    const bytes = new Uint8Array(await b.data.arrayBuffer());
    // Media is already compressed; storing it also keeps a damaged byte local to that one blob.
    zip[blobPath(b.id)] = [bytes, { level: 0 }];
    blobEntries.push({ id: b.id, sha256: await sha256Hex(bytes), size: bytes.length, mime: b.mime });
  }
  data[BLOB_META_STORE] = blobRows.map(
    (b): BlobMeta => ({ id: b.id, ...(b.fileId ? { fileId: b.fileId } : {}), kind: b.kind, mime: b.mime, size: b.size, createdAt: b.createdAt }),
  );

  const counts: Record<string, number> = {};
  const dataSha256: Record<string, string> = {};
  for (const [store, rows] of Object.entries(data)) {
    const bytes = strToU8(JSON.stringify(rows));
    zip[dataPath(store)] = bytes;
    counts[store] = rows.length;
    dataSha256[dataPath(store)] = await sha256Hex(bytes);
  }

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    dbSchemaVersion: db.verno,
    createdAt: (opts.now ?? new Date()).toISOString(),
    spaceIds: [spaceId],
    timeZone: space.timeZone,
    counts,
    blobs: blobEntries,
    includesAudio: opts.includeAudio,
    includesFiles: opts.includeFiles,
    dataSha256,
    exportedByActorId: opts.actor.actorId,
  };
  zip["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  return new Blob([zipSync(zip)], { type: "application/zip" });
}

/** 'lich-gia-dinh-2026-10-07-0830.zip' in the Space time zone. */
export function backupFileName(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `lich-gia-dinh-${get("year")}-${get("month")}-${get("day")}-${get("hour")}${get("minute")}.zip`;
}
