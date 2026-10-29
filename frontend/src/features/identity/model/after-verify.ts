const KEY = "fc.afterVerify";
// The magic link expires after 15 minutes; a stale return path would surprise a later, unrelated verification.
const MAX_AGE_MS = 30 * 60_000;

/** Remembers an in-app path to reopen once the email link is confirmed in this browser. */
export function rememberAfterVerify(path: string): void {
  try { localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() })); } catch { /* storage blocked: fall back to the default page */ }
}

/** Returns and clears the remembered path; only same-app relative paths are honoured. */
export function takeAfterVerify(): string | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    if (!raw) return undefined;
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || typeof at !== "number" || Date.now() - at > MAX_AGE_MS) return undefined;
    return /^\/(?![/\\])/.test(path) ? path : undefined;
  } catch { return undefined; }
}
