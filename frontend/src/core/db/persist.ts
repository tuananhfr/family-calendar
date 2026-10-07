/**
 * Asks the browser to keep IndexedDB across storage pressure (Safari otherwise evicts after 7 days without use).
 * Call when the user first creates data (TEC-06); a refusal is not an error.
 */
export async function ensurePersistentStorage(): Promise<"granted" | "denied" | "unsupported"> {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (!storage || typeof storage.persist !== "function") return "unsupported";
  try {
    if (typeof storage.persisted === "function" && (await storage.persisted())) return "granted";
    return (await storage.persist()) ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

export interface StorageEstimateInfo {
  usage: number;
  quota: number;
  /** 0..1; the UI warns below 0.1 (modules.md §9). */
  freeRatio: number;
}

export async function estimateStorage(): Promise<StorageEstimateInfo | null> {
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (!storage || typeof storage.estimate !== "function") return null;
  try {
    const { usage = 0, quota = 0 } = await storage.estimate();
    return { usage, quota, freeRatio: quota > 0 ? Math.max(0, (quota - usage) / quota) : 0 };
  } catch {
    return null;
  }
}
