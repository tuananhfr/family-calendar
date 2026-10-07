/** IndexedDB quota exhausted; the transaction was rolled back, nothing partial was kept. */
export class StorageFullError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("STORAGE_FULL", options);
    this.name = "StorageFullError";
  }
}

const QUOTA_NAMES = new Set(["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"]);

// Dexie wraps the DOMException (e.g. AbortError with `inner`), and browsers report quota at commit as an abort.
export function isQuotaError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 5) return false;
  const e = error as { name?: unknown; inner?: unknown; cause?: unknown; failures?: unknown };
  if (typeof e.name === "string" && QUOTA_NAMES.has(e.name)) return true;
  if (Array.isArray(e.failures) && e.failures.some((f) => isQuotaError(f, depth + 1))) return true;
  return isQuotaError(e.inner, depth + 1) || isQuotaError(e.cause, depth + 1);
}

export class RepoError extends Error {
  constructor(
    readonly code: "SPACE_NOT_FOUND" | "NOT_FOUND" | "ALREADY_EXISTS" | "WRONG_SPACE",
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "RepoError";
  }
}
