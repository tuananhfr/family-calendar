export const BACKOFF_BASE_MS = 1_000;
export const MAX_BACKOFF_MS = 5 * 60_000;
const JITTER = 0.2;

/** 1 s · 2^attempt, capped at 5 min, ±20 % jitter so tabs/devices that failed together don't retry together. */
export function nextBackoffMs(attempt: number, rand: () => number = Math.random): number {
  const base = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, Math.min(attempt, 30)), MAX_BACKOFF_MS);
  const jittered = base * (1 - JITTER + 2 * JITTER * rand());
  return Math.round(Math.min(jittered, MAX_BACKOFF_MS));
}
