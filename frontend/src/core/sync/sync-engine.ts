import { liveQuery, type Subscription } from "dexie";
import { ApiRequestError } from "../api/errors";
import { db } from "../db/db";
import { createHttpTransport } from "./http-transport";
import { processOutbox } from "./outbox-processor";
import { pullChanges } from "./puller";
import { setReachable, setSyncing } from "./sync-status";
import type { SyncTransport } from "./transport";

export const LOCAL_WRITE_DEBOUNCE_MS = 1_000;
export const SYNC_INTERVAL_MS = 60_000;
const MIN_RETRY_DELAY_MS = 1_000;

export interface SyncEngineOptions {
  transport?: SyncTransport;
  now?: () => Date;
  debounceMs?: number;
  intervalMs?: number;
  /** Receives `online`/`offline`; defaults to `window` when present. */
  windowTarget?: EventTarget | null;
  /** Receives `visibilitychange`; defaults to `document` when present. */
  documentTarget?: (EventTarget & { visibilityState?: string }) | null;
  /** Unexpected (non-API) errors; API errors are reflected in the sync status instead. */
  onError?: (error: unknown) => void;
}

async function markHalt(spaceId: string, halt: "AUTH_REQUIRED" | "BLOCKED" | null, code?: string): Promise<void> {
  await db.transaction("rw", db.syncCursors, async () => {
    const row = await db.syncCursors.get(spaceId);
    if (!row && !halt) return;
    if (!halt && row?.halt !== "AUTH_REQUIRED") return;
    await db.syncCursors.put({ ...(row ?? { spaceId, cursor: null, updatedAt: new Date().toISOString() }), halt, haltCode: code });
  });
}

/** Push then pull one SHARED Space; API failures end up in the status (OFFLINE / AUTH_REQUIRED / BLOCKED), not thrown. */
export async function syncSpace(spaceId: string, t: SyncTransport, now: () => Date = () => new Date()): Promise<void> {
  setSyncing(spaceId, true);
  try {
    const pushed = await processOutbox(spaceId, t, now);
    if (pushed.blocked) return;
    await pullChanges(spaceId, t);
    setReachable(true);
    await markHalt(spaceId, null);
    const row = await db.syncCursors.get(spaceId);
    if (row) await db.syncCursors.put({ ...row, lastSyncedAt: now().toISOString() });
  } catch (error) {
    if (!(error instanceof ApiRequestError)) throw error;
    if (error.code === "NETWORK") setReachable(false);
    else if (error.code === "AUTH_REQUIRED" || error.code === "SESSION_EXPIRED") await markHalt(spaceId, "AUTH_REQUIRED", error.code);
    else if (error.code === "DEVICE_REVOKED" || error.code === "SPACE_ACCESS_REVOKED" || error.code === "FORBIDDEN") await markHalt(spaceId, "BLOCKED", error.code);
  } finally {
    setSyncing(spaceId, false);
  }
}

async function sharedSpaceIds(): Promise<string[]> {
  const spaces = await db.spaces.where("sharingState").equals("SHARED").toArray();
  return spaces.filter((s) => s.deletedAt === null).map((s) => s.id);
}

async function nextRetryAt(spaceIds: string[]): Promise<number | null> {
  const waiting = await db.outbox.where("state").equals("RETRY_WAIT").toArray();
  const times = waiting.filter((op) => spaceIds.includes(op.spaceId) && op.nextAttemptAt).map((op) => new Date(op.nextAttemptAt!).getTime());
  return times.length > 0 ? Math.min(...times) : null;
}

let activeStop: (() => void) | null = null;

/**
 * Background sync for every SHARED Space of this device. Triggers: start, tab visible again, `online`,
 * outbox writes (debounced 1 s, also from other tabs), every 60 s, and the earliest RETRY_WAIT deadline.
 */
export function startSyncEngine(opts: SyncEngineOptions = {}): () => void {
  activeStop?.();
  const t = opts.transport ?? createHttpTransport();
  const now = opts.now ?? (() => new Date());
  const debounceMs = opts.debounceMs ?? LOCAL_WRITE_DEBOUNCE_MS;
  const intervalMs = opts.intervalMs ?? SYNC_INTERVAL_MS;
  const win = opts.windowTarget === undefined ? (typeof window === "undefined" ? null : window) : opts.windowTarget;
  const doc = opts.documentTarget === undefined ? (typeof document === "undefined" ? null : document) : opts.documentTarget;
  const onError = opts.onError ?? (() => undefined);

  let stopped = false;
  let running = false;
  let again = false;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const runAll = async (): Promise<void> => {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      const ids = await sharedSpaceIds();
      for (const id of ids) {
        if (stopped) return;
        await syncSpace(id, t, now);
      }
      clearTimeout(retryTimer);
      const at = await nextRetryAt(ids);
      if (at !== null && !stopped) {
        const delay = Math.min(Math.max(at - now().getTime(), MIN_RETRY_DELAY_MS), intervalMs);
        retryTimer = setTimeout(trigger, delay);
      }
    } catch (error) {
      onError(error);
    } finally {
      running = false;
      if (again && !stopped) {
        again = false;
        void runAll();
      }
    }
  };
  const trigger = () => void runAll();
  const debounced = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(trigger, debounceMs);
  };
  const onVisible = () => {
    if (doc?.visibilityState === undefined || doc.visibilityState === "visible") trigger();
  };
  const onOffline = () => setReachable(false);

  win?.addEventListener("online", trigger);
  win?.addEventListener("offline", onOffline);
  doc?.addEventListener("visibilitychange", onVisible);
  const interval = setInterval(trigger, intervalMs);

  // Queued op ids, not just a count: an op acked while another is queued leaves the count unchanged.
  let first = true;
  const sub: Subscription = liveQuery(() => db.outbox.where("state").equals("QUEUED").primaryKeys()).subscribe({
    next: () => {
      if (first) {
        first = false;
        return;
      }
      debounced();
    },
    error: onError,
  });

  trigger();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(debounceTimer);
    clearTimeout(retryTimer);
    clearInterval(interval);
    sub.unsubscribe();
    win?.removeEventListener("online", trigger);
    win?.removeEventListener("offline", onOffline);
    doc?.removeEventListener("visibilitychange", onVisible);
    if (activeStop === stop) activeStop = null;
  };
  activeStop = stop;
  return stop;
}
