import { useLiveQuery } from "dexie-react-hooks";
import { useSyncExternalStore } from "react";
import { db, type SyncCursorRow } from "../db/db";
import type { SharingState } from "../model/space";
import type { OutboxOp } from "./outbox-types";

export type SyncStatus = {
  mode: "LOCAL" | "SHARED";
  state: "SYNCED" | "PENDING" | "SYNCING" | "OFFLINE" | "CONFLICT" | "BLOCKED" | "AUTH_REQUIRED";
  pending: number;
  conflicts: number;
  lastSyncedAt?: string;
};

export interface SyncStatusInput {
  sharingState: SharingState;
  ops: Array<Pick<OutboxOp, "state">>;
  halt?: SyncCursorRow["halt"];
  syncing: boolean;
  /** Last request reached the server; `navigator.onLine` alone is no proof of that. */
  reachable: boolean;
  lastSyncedAt?: string;
}

const PENDING_STATES = new Set(["QUEUED", "SENDING", "RETRY_WAIT", "BLOCKED"]);
const ATTENTION_STATES = new Set(["CONFLICT", "INVALID"]);

/** Honest badge state: anything not acknowledged keeps it away from SYNCED. */
export function computeSyncStatus(input: SyncStatusInput): SyncStatus {
  const pending = input.ops.filter((o) => PENDING_STATES.has(o.state)).length;
  const conflicts = input.ops.filter((o) => ATTENTION_STATES.has(o.state)).length;
  const base = { pending, conflicts, ...(input.lastSyncedAt ? { lastSyncedAt: input.lastSyncedAt } : {}) };
  if (input.sharingState !== "SHARED") return { mode: "LOCAL", state: "SYNCED", ...base };
  const state: SyncStatus["state"] =
    input.halt === "BLOCKED"
      ? "BLOCKED"
      : input.halt === "AUTH_REQUIRED"
        ? "AUTH_REQUIRED"
        : conflicts > 0
          ? "CONFLICT"
          : input.syncing
            ? "SYNCING"
            : !input.reachable
              ? "OFFLINE"
              : pending > 0
                ? "PENDING"
                : "SYNCED";
  return { mode: "SHARED", state, ...base };
}

// Runtime flags are per tab: they describe this tab's requests, not data.
const syncingSpaces = new Set<string>();
let reachable = true;
let version = 0;
const listeners = new Set<() => void>();

function changed(): void {
  version += 1;
  for (const l of listeners) l();
}

export function setSyncing(spaceId: string, on: boolean): void {
  if (on === syncingSpaces.has(spaceId)) return;
  if (on) syncingSpaces.add(spaceId);
  else syncingSpaces.delete(spaceId);
  changed();
}

export function setReachable(value: boolean): void {
  if (value === reachable) return;
  reachable = value;
  changed();
}

export function isReachable(): boolean {
  return reachable;
}

export function resetSyncRuntimeForTests(): void {
  syncingSpaces.clear();
  reachable = true;
  listeners.clear();
  version = 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function loadInputs(spaceId: string) {
  const [space, ops, row] = await Promise.all([db.spaces.get(spaceId), db.outbox.where("spaceId").equals(spaceId).toArray(), db.syncCursors.get(spaceId)]);
  return { sharingState: space?.sharingState ?? "LOCAL", ops: ops.map((o) => ({ state: o.state })), halt: row?.halt ?? null, lastSyncedAt: row?.lastSyncedAt };
}

export async function readSyncStatus(spaceId: string): Promise<SyncStatus> {
  const data = await loadInputs(spaceId);
  return computeSyncStatus({ ...data, syncing: syncingSpaces.has(spaceId), reachable });
}

const LOCAL_STATUS: SyncStatus = { mode: "LOCAL", state: "SYNCED", pending: 0, conflicts: 0 };

/** Live sync badge for one Space (outbox and halt flags from IndexedDB, so other tabs' work shows up too). */
export function useSyncStatus(spaceId?: string): SyncStatus {
  const tick = useSyncExternalStore(subscribe, () => version, () => 0);
  const data = useLiveQuery(() => (spaceId ? loadInputs(spaceId) : undefined), [spaceId]);
  if (!spaceId || !data) return LOCAL_STATUS;
  void tick;
  return computeSyncStatus({ ...data, syncing: syncingSpaces.has(spaceId), reachable });
}
