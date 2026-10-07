import { MAX_FILE_BYTES, type FileKind } from "@/core/model/storage";

/** modules.md §9: warn when less than 10% of the device quota is left. */
export const LOW_SPACE_RATIO = 0.1;

export interface StorageEstimateLike {
  usage: number;
  quota: number;
}

export type LimitCheck = { ok: true; warnLowSpace: boolean } | { ok: false; code: "FILE_TOO_LARGE" | "STORAGE_FULL"; message: string };

const KIND_LABELS: Record<FileKind, string> = {
  IMAGE: "Ảnh",
  DOCUMENT: "Tài liệu",
  VIDEO: "Video",
  AUDIO: "Âm thanh",
  OTHER: "Tệp",
};

const MB = 1024 * 1024;

/** `est` null = the browser gives no estimate; only the per-file limit is checked then. */
export function checkLimits(f: { size: number; kind: FileKind }, est: StorageEstimateLike | null): LimitCheck {
  const max = MAX_FILE_BYTES[f.kind];
  if (f.size > max) {
    return { ok: false, code: "FILE_TOO_LARGE", message: `Tệp quá lớn. ${KIND_LABELS[f.kind]} tối đa ${max / MB} MB.` };
  }
  if (!est || !(est.quota > 0)) return { ok: true, warnLowSpace: false };
  const freeAfter = est.quota - est.usage - f.size;
  if (freeAfter < 0) {
    return { ok: false, code: "STORAGE_FULL", message: "Bộ nhớ trên thiết bị đã đầy. Hãy xóa bớt tệp rồi thử lại." };
  }
  return { ok: true, warnLowSpace: freeAfter / est.quota < LOW_SPACE_RATIO };
}

/** navigator.storage.estimate(), or null where unsupported (old Safari, Node). */
export async function estimateStorage(): Promise<StorageEstimateLike | null> {
  try {
    const est = await globalThis.navigator?.storage?.estimate?.();
    return est && typeof est.quota === "number" ? { usage: est.usage ?? 0, quota: est.quota } : null;
  } catch {
    return null;
  }
}
