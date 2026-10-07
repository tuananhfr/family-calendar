import { z } from "zod";
import { baseRecordShape, idSchema, requiredText } from "./base";

export const SYSTEM_FOLDER_KEYS = ["PHOTOS", "DOCUMENTS", "STUDY", "HEALTH", "VIDEOS", "OTHER"] as const;
export type SystemFolderKey = (typeof SYSTEM_FOLDER_KEYS)[number];

export const folderSchema = z.object({
  ...baseRecordShape,
  name: requiredText(100, "NAME"),
  /** One level of sub-folders in V1. */
  parentId: idSchema.nullable(),
  /** System folders are created up front and cannot be deleted. */
  systemKey: z.enum(SYSTEM_FOLDER_KEYS).nullable().optional(),
});
export type Folder = z.infer<typeof folderSchema>;

export const FILE_KINDS = ["IMAGE", "DOCUMENT", "VIDEO", "AUDIO", "OTHER"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const BLOB_STATES = ["LOCAL_ONLY", "UPLOADING", "SYNCED", "MISSING"] as const;
export type BlobState = (typeof BLOB_STATES)[number];

const MB = 1024 * 1024;
export const MAX_FILE_BYTES: Record<FileKind, number> = {
  IMAGE: 25 * MB,
  DOCUMENT: 25 * MB,
  VIDEO: 200 * MB,
  AUDIO: 25 * MB,
  OTHER: 25 * MB,
};

const DOCUMENT_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

export function fileKindFromMime(mime: string): FileKind {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "IMAGE";
  if (m.startsWith("video/")) return "VIDEO";
  if (m.startsWith("audio/")) return "AUDIO";
  if (DOCUMENT_MIMES.includes(m)) return "DOCUMENT";
  return "OTHER";
}

export const fileSchema = z
  .object({
    ...baseRecordShape,
    folderId: idSchema,
    name: requiredText(255, "NAME"),
    mime: z.string().min(1).max(127),
    size: z.int().min(0),
    sha256: z.string().regex(/^[0-9a-f]{64}$/, { error: "INVALID_SHA256" }),
    kind: z.enum(FILE_KINDS),
    /** Id in the `blobs` store of the client-made WebP thumbnail (≤320px). */
    thumbnailBlobId: z.string().max(64).optional(),
    /** From EXIF; GPS coordinates are never kept. */
    takenAt: z.string().nullable().optional(),
    blobState: z.enum(BLOB_STATES),
  })
  .refine((f) => f.size <= MAX_FILE_BYTES[f.kind], { error: "FILE_TOO_LARGE", path: ["size"] });
export type StoredFile = z.infer<typeof fileSchema>;
