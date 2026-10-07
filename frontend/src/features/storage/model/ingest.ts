import { db, type BlobRow } from "@/core/db/db";
import { isQuotaError, StorageFullError } from "@/core/db/errors";
import { getLocalIdentity } from "@/core/db/local-identity";
import { newId } from "@/core/ids";
import type { Folder, StoredFile } from "@/core/model/storage";
import { getActive } from "@/core/repo/read";
import { RepoError, saveResource } from "@/core/repo/write";
import { readExif, stripGpsExif } from "./exif-strip";
import { kindOfFile, mimeOf } from "./file-kind";
import { checkLimits, estimateStorage, type StorageEstimateLike } from "./limits";
import { makeThumbnail } from "./thumbnail";

export class FileTooLargeError extends Error {
  readonly code = "FILE_TOO_LARGE";
  constructor(message: string) {
    super(message);
    this.name = "FileTooLargeError";
  }
}

export interface IngestOptions {
  estimate?: () => Promise<StorageEstimateLike | null>;
  makeThumbnail?: (image: Blob) => Promise<Blob | null>;
}

export interface IngestResult {
  file: StoredFile;
  /** Less than 10% of the device quota is left after this file. */
  warnLowSpace: boolean;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Stores a picked file in a folder: limits, GPS removal (JPEG), sha256, thumbnail, then the blob(s) and the
 * `file` record in ONE transaction — on a full disk nothing is kept, not even an orphan blob (Review Focus #4).
 * The file inherits the folder's data class and scope (Sức khỏe → SENSITIVE).
 */
export async function ingestFile(spaceId: string, folderId: string, file: File, opts: IngestOptions = {}): Promise<IngestResult> {
  const folder = await getActive<Folder>("folder", folderId);
  if (!folder || folder.spaceId !== spaceId) throw new RepoError("NOT_FOUND", folderId);

  const mime = mimeOf(file);
  const kind = kindOfFile(file);
  const limits = checkLimits({ size: file.size, kind }, await (opts.estimate ?? estimateStorage)());
  if (!limits.ok) {
    if (limits.code === "STORAGE_FULL") throw new StorageFullError();
    throw new FileTooLargeError(limits.message);
  }

  let bytes = await file.arrayBuffer();
  let takenAt: string | null = null;
  if (mime === "image/jpeg") {
    takenAt = readExif(bytes).takenAt ?? null;
    bytes = stripGpsExif(bytes);
  }
  const data = new Blob([bytes], { type: mime });
  const thumb = kind === "IMAGE" ? await (opts.makeThumbnail ?? makeThumbnail)(data) : null;
  const { actorId } = await getLocalIdentity();
  const now = new Date().toISOString();
  const fileId = newId();

  const blob: BlobRow = { id: newId(), fileId, kind: "FILE", mime, size: data.size, data, createdAt: now };
  const thumbRow: BlobRow | null = thumb ? { id: newId(), fileId, kind: "THUMBNAIL", mime: thumb.type || "image/webp", size: thumb.size, data: thumb, createdAt: now } : null;
  const record: StoredFile = {
    id: fileId,
    spaceId,
    createdByActorId: actorId,
    dataClass: folder.dataClass,
    sharingScope: folder.sharingScope,
    revision: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncState: "LOCAL",
    folderId,
    name: file.name.slice(0, 255) || "tep",
    mime,
    size: data.size,
    sha256: await sha256Hex(bytes),
    kind,
    ...(thumbRow ? { thumbnailBlobId: thumbRow.id } : {}),
    takenAt,
    blobState: "LOCAL_ONLY",
  };

  try {
    const saved = await db.transaction("rw", [db.blobs, db.files, db.spaces, db.outbox], async () => {
      await db.blobs.add(blob);
      if (thumbRow) await db.blobs.add(thumbRow);
      return saveResource("file", record, "create");
    });
    return { file: saved, warnLowSpace: limits.warnLowSpace };
  } catch (error) {
    if (error instanceof StorageFullError || isQuotaError(error)) throw new StorageFullError({ cause: error });
    throw error;
  }
}
