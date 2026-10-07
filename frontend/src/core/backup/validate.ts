import { strFromU8, unzipSync } from "fflate";
import { db, type SettingRow } from "../db/db";
import type { Item } from "../model/item";
import type { Space } from "../model/space";
import type { StoredFile } from "../model/storage";
import type { BaseRecord } from "../sync/resource-types";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BLOB_META_STORE,
  EXTRA_BACKUP_STORES,
  ITEM_CHILD_STORES,
  MAX_BACKUP_BYTES,
  RESOURCE_BACKUP_STORES,
  SETTINGS_STORE,
  backupFailure,
  blobPath,
  dataPath,
  manifestSchema,
  sha256Hex,
  type BackupFailure,
  type BackupManifest,
  type BlobMeta,
} from "./format";

export interface RestoreConflict {
  /** `${store}/${id}`; the key of the resolutions map passed to restoreBackup. */
  key: string;
  store: string;
  id: string;
  /** Title/name from the backup so the user recognises the record. */
  label: string;
}

export interface RestorePreview {
  spaceNames: string[];
  createdAt: string;
  timeZone: string;
  counts: Record<string, number>;
  privateCount: number;
  sensitiveCount: number;
  includesAudio: boolean;
  includesFiles: boolean;
  /** Audio notes and files whose content is not in the backup (left out on export). */
  missingBlobCount: number;
  /** Spaces of the backup that already exist on this device. */
  existingSpaceIds: string[];
  /** Same id, different content; a MERGE needs a resolution for each. */
  conflicts: RestoreConflict[];
}

export interface ParsedBackup {
  manifest: BackupManifest;
  /** Rows per store (resource stores, emergency stores). */
  rows: Record<string, Array<Record<string, unknown>>>;
  settings: SettingRow[];
  blobs: Array<BlobMeta & { bytes: Uint8Array }>;
}

export type ValidateResult = { ok: true; manifest: BackupManifest; preview: RestorePreview } | BackupFailure;

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

function parseJson(bytes: Uint8Array | undefined): unknown {
  if (!bytes) return undefined;
  try {
    return JSON.parse(strFromU8(bytes));
  } catch {
    return undefined;
  }
}

class Corrupted extends Error {}

/** Reads and fully verifies a backup without touching the database. */
export async function readBackup(file: Blob, opts: { maxBytes?: number } = {}): Promise<{ ok: true; backup: ParsedBackup } | BackupFailure> {
  if (file.size > (opts.maxBytes ?? MAX_BACKUP_BYTES)) return backupFailure("TOO_LARGE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 4 || ZIP_MAGIC.some((b, i) => bytes[i] !== b)) return backupFailure("NOT_A_BACKUP");

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return backupFailure("CORRUPTED");
  }
  if (!files["manifest.json"]) return backupFailure("NOT_A_BACKUP");
  const raw = parseJson(files["manifest.json"]) as Partial<BackupManifest> | undefined;
  if (!raw || typeof raw !== "object") return backupFailure("CORRUPTED");
  if (raw.format !== BACKUP_FORMAT) return backupFailure("NOT_A_BACKUP");
  // Checked before the full schema: a newer manifest may legitimately have a shape this version can't read.
  if (typeof raw.formatVersion !== "number" || raw.formatVersion > BACKUP_FORMAT_VERSION) return backupFailure("NEWER_VERSION");
  if (typeof raw.dbSchemaVersion === "number" && raw.dbSchemaVersion > db.verno) return backupFailure("NEWER_VERSION");
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) return backupFailure("CORRUPTED");
  const manifest = parsed.data as BackupManifest;

  for (const [path, sha] of Object.entries(manifest.dataSha256)) {
    if (!files[path] || (await sha256Hex(files[path])) !== sha) return backupFailure("CHECKSUM_MISMATCH");
  }
  for (const b of manifest.blobs) {
    const content = files[blobPath(b.id)];
    if (!content || content.length !== b.size || (await sha256Hex(content)) !== b.sha256) return backupFailure("CHECKSUM_MISMATCH");
  }

  try {
    return { ok: true, backup: parseContents(manifest, files) };
  } catch (error) {
    if (error instanceof Corrupted) return backupFailure("CORRUPTED");
    throw error;
  }
}

function readRows(manifest: BackupManifest, files: Record<string, Uint8Array>, store: string): Array<Record<string, unknown>> {
  const path = dataPath(store);
  if (manifest.dataSha256[path] === undefined) throw new Corrupted(`${path} not listed`);
  const rows = parseJson(files[path]);
  if (!Array.isArray(rows) || rows.length !== manifest.counts[store]) throw new Corrupted(`${path} count`);
  if (!rows.every((r) => r && typeof r === "object" && !Array.isArray(r))) throw new Corrupted(`${path} rows`);
  return rows as Array<Record<string, unknown>>;
}

function parseContents(manifest: BackupManifest, files: Record<string, Uint8Array>): ParsedBackup {
  const spaceIds = new Set(manifest.spaceIds);
  const rows: ParsedBackup["rows"] = {};

  for (const { store, schema } of RESOURCE_BACKUP_STORES) {
    rows[store] = readRows(manifest, files, store);
    for (const r of rows[store]) {
      if (!schema.safeParse(r).success) throw new Corrupted(`${store} invalid`);
      if (!spaceIds.has(r.spaceId as string)) throw new Corrupted(`${store} foreign space`);
    }
  }
  for (const store of EXTRA_BACKUP_STORES) {
    rows[store] = readRows(manifest, files, store);
    if (!rows[store].every((r) => typeof r.id === "string" && spaceIds.has(r.spaceId as string))) throw new Corrupted(store);
  }

  // Relations: every child points at something inside the same backup.
  const ids = (store: string) => new Set(rows[store].map((r) => r.id as string));
  if (!manifest.spaceIds.every((id) => ids("spaces").has(id))) throw new Corrupted("space row missing");
  const itemIds = ids("items");
  for (const store of ITEM_CHILD_STORES) if (!rows[store].every((r) => itemIds.has(r.itemId as string))) throw new Corrupted(`${store} orphan`);
  const checklistIds = ids("checklistItems");
  if (!rows.checklistStates.every((r) => checklistIds.has(r.checklistItemId as string))) throw new Corrupted("checklist orphan");
  const folderIds = ids("folders");
  if (!rows.files.every((r) => folderIds.has(r.folderId as string))) throw new Corrupted("file orphan");

  const settings = readRows(manifest, files, SETTINGS_STORE);
  if (!settings.every((s) => typeof s.key === "string")) throw new Corrupted("settings");
  const metas = readRows(manifest, files, BLOB_META_STORE) as unknown as BlobMeta[];
  const listed = new Map(manifest.blobs.map((b) => [b.id, b]));
  if (metas.length !== listed.size || !metas.every((m) => listed.has(m.id))) throw new Corrupted("blob list");
  const blobs = metas.map((m) => ({ ...m, mime: listed.get(m.id)!.mime, bytes: files[blobPath(m.id)] }));

  return { manifest, rows, settings: settings as unknown as SettingRow[], blobs };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

// Sync bookkeeping differs by design after a restore (always LOCAL, no revision), so it never makes a conflict.
const BOOKKEEPING = new Set(["syncState", "revision", "sharingState"]);

export function sameContent(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const strip = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).filter(([k]) => !BOOKKEEPING.has(k)));
  return stable(strip(a)) === stable(strip(b));
}

const ACTOR_FIELDS = ["createdByActorId", "linkedActorId", "actedByActorId"] as const;

/**
 * Rows as they will be written: LOCAL with no server revision, the exporter's records handed to the restoring
 * actor, and SOS events closed — a restore must never look like a new emergency (sos.md).
 */
export function restorableRows(backup: ParsedBackup, actorId: string, now: Date): ParsedBackup["rows"] {
  const from = backup.manifest.exportedByActorId;
  const out: ParsedBackup["rows"] = {};
  for (const [store, rows] of Object.entries(backup.rows)) {
    out[store] = rows.map((row) => {
      const r: Record<string, unknown> = { ...row };
      if (store !== "emergencyContacts" && store !== "emergencyEvents") {
        r.syncState = "LOCAL";
        r.revision = null;
      }
      if (store === "spaces") r.sharingState = "LOCAL";
      if (from !== actorId) for (const f of ACTOR_FIELDS) if (r[f] === from) r[f] = actorId;
      if (store === "emergencyEvents" && r.status === "ACTIVE") {
        r.status = "CLOSED_ENDED";
        r.closeReason = "RESTORED";
        r.closedAt = now.toISOString();
      }
      return r;
    });
  }
  return out;
}

function labelOf(row: Record<string, unknown>): string {
  for (const k of ["title", "displayName", "name", "text", "key"]) if (typeof row[k] === "string") return row[k] as string;
  return row.id as string;
}

/** Same id, different content. Emergency rows are runtime truth on this device and never conflict. */
export async function findConflicts(rows: ParsedBackup["rows"]): Promise<RestoreConflict[]> {
  const out: RestoreConflict[] = [];
  for (const [store, list] of Object.entries(rows)) {
    if ((EXTRA_BACKUP_STORES as readonly string[]).includes(store)) continue;
    const local = await db.table(store).bulkGet(list.map((r) => r.id as string));
    list.forEach((row, i) => {
      const existing = local[i] as Record<string, unknown> | undefined;
      if (existing && !sameContent(existing, row)) out.push({ key: `${store}/${row.id as string}`, store, id: row.id as string, label: labelOf(row) });
    });
  }
  return out;
}

function previewOf(backup: ParsedBackup, conflicts: RestoreConflict[], existingSpaceIds: string[]): RestorePreview {
  const records = Object.values(backup.rows).flat() as Array<Partial<BaseRecord>>;
  const blobIds = new Set(backup.blobs.map((b) => b.id));
  const files = backup.rows.files as unknown as StoredFile[];
  const items = backup.rows.items as unknown as Item[];
  const missingFiles = files.filter((f) => !backup.blobs.some((b) => b.fileId === f.id)).length;
  const missingAudio = items.filter((i) => i.audioAssetId && !blobIds.has(i.audioAssetId)).length;
  return {
    spaceNames: (backup.rows.spaces as unknown as Space[]).map((s) => s.name),
    createdAt: backup.manifest.createdAt,
    timeZone: backup.manifest.timeZone,
    counts: backup.manifest.counts,
    privateCount: records.filter((r) => r.sharingScope === "PRIVATE" || r.dataClass === "PRIVATE").length,
    sensitiveCount: records.filter((r) => r.dataClass === "SENSITIVE").length,
    includesAudio: backup.manifest.includesAudio,
    includesFiles: backup.manifest.includesFiles,
    missingBlobCount: missingFiles + missingAudio,
    existingSpaceIds,
    conflicts,
  };
}

/** Full check plus a preview (counts, privacy, conflicts with this device); never writes. */
export async function validateBackup(file: Blob, opts: { maxBytes?: number } = {}): Promise<ValidateResult> {
  const read = await readBackup(file, opts);
  if (!read.ok) return read;
  const { backup } = read;
  const existing = (await db.spaces.bulkGet(backup.manifest.spaceIds)).filter((s): s is Space => !!s).map((s) => s.id);
  // Read-only: getLocalIdentity() would create an identity on a fresh device.
  const actorId = (await db.localIdentity.get("self"))?.actorId ?? backup.manifest.exportedByActorId;
  const conflicts = await findConflicts(restorableRows(backup, actorId, new Date()));
  return { ok: true, manifest: backup.manifest, preview: previewOf(backup, conflicts, existing) };
}
