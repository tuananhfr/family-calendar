import { z } from "zod";
import { RESOURCE_SCHEMAS } from "../model/resource-schemas";
import { RESOURCE_STORE, type ResourceType } from "../sync/resource-types";

export const BACKUP_FORMAT = "family-calendar-backup";
export const BACKUP_FORMAT_VERSION = 1;
/** Whole file is read into memory to verify it; beyond this a phone tab risks being killed mid-restore. */
export const MAX_BACKUP_BYTES = 512 * 1024 * 1024;

export interface BackupBlobEntry {
  id: string;
  sha256: string;
  size: number;
  mime: string;
}

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  dbSchemaVersion: number;
  createdAt: string;
  spaceIds: string[];
  timeZone: string;
  /** Rows per file in data/, keyed by store name. */
  counts: Record<string, number>;
  blobs: BackupBlobEntry[];
  includesAudio: boolean;
  includesFiles: boolean;
  /** sha256 of every data/*.json file; detects damage, does not prove who made the file. */
  dataSha256: Record<string, string>;
  /** Restore on another device hands this actor's records (PRIVATE included) to the restoring actor. */
  exportedByActorId: string;
}

export const manifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  dbSchemaVersion: z.int().min(1),
  createdAt: z.string(),
  spaceIds: z.array(z.uuid()).min(1),
  timeZone: z.string(),
  counts: z.record(z.string(), z.int().min(0)),
  blobs: z.array(z.object({ id: z.string().min(1).max(64), sha256: z.string().regex(/^[0-9a-f]{64}$/), size: z.int().min(0), mime: z.string().max(127) })),
  includesAudio: z.boolean(),
  includesFiles: z.boolean(),
  dataSha256: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)),
  exportedByActorId: z.uuid(),
});

/** Registry stores, each validated with its resource schema on restore. */
export const RESOURCE_BACKUP_STORES = Object.entries(RESOURCE_STORE).map(([type, store]) => ({
  type: type as ResourceType,
  store: store as string,
  schema: RESOURCE_SCHEMAS[type as ResourceType],
}));

/** Space-scoped runtime stores that are still family data worth keeping. */
export const EXTRA_BACKUP_STORES = ["emergencyContacts", "emergencyEvents"] as const;
/** blobs.json holds blob metadata; the bytes are under blobs/<id>. */
export const BLOB_META_STORE = "blobs";
export const SETTINGS_STORE = "settings";

/**
 * Never written to a backup: identity/credentials, sync bookkeeping and delivery jobs (domain-model.md
 * Portability). Restoring an old outbox or fired-reminder log would replay stale operations and alerts.
 */
export const NEVER_BACKED_UP = ["localIdentity", "outbox", "syncCursors", "notifications", "firedReminders"] as const;

/** Device-level settings keys that may hold secrets; skipped even if some future module stores them here. */
export const SECRET_SETTING_KEY = /token|session|cookie|recovery|secret|credential|password|device|push/i;

export const SPACE_STORES = [...RESOURCE_BACKUP_STORES.map((s) => s.store), ...EXTRA_BACKUP_STORES];

export const ITEM_CHILD_STORES = ["itemExceptions", "occurrenceStates", "checklistItems", "checklistStates", "participations", "reminderRules"];

export const dataPath = (store: string) => `data/${store}.json`;
export const blobPath = (id: string) => `blobs/${id}`;

export interface BlobMeta {
  id: string;
  fileId?: string;
  kind: "FILE" | "THUMBNAIL" | "AUDIO";
  mime: string;
  size: number;
  createdAt: string;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type BackupFailureCode = "NOT_A_BACKUP" | "CORRUPTED" | "NEWER_VERSION" | "CHECKSUM_MISMATCH" | "TOO_LARGE";

export const BACKUP_FAILURE_MESSAGES: Record<BackupFailureCode, string> = {
  NOT_A_BACKUP: "Tệp này không phải bản sao lưu của Lịch Gia Đình.",
  CORRUPTED: "Bản sao lưu bị hỏng hoặc không đầy đủ. Dữ liệu hiện tại không thay đổi.",
  NEWER_VERSION: "Bản sao lưu được tạo từ phiên bản mới hơn. Hãy cập nhật ứng dụng rồi thử lại.",
  CHECKSUM_MISMATCH: "Nội dung bản sao lưu không khớp mã kiểm tra. Dữ liệu hiện tại không thay đổi.",
  TOO_LARGE: "Tệp sao lưu quá lớn để khôi phục trên thiết bị này.",
};

export interface BackupFailure {
  ok: false;
  code: BackupFailureCode;
  message: string;
}

export function backupFailure(code: BackupFailureCode): BackupFailure {
  return { ok: false, code, message: BACKUP_FAILURE_MESSAGES[code] };
}
