import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/db";
import { createLocalSpace, saveResource } from "../repo/write";
import { makeItem } from "../test-support/items";
import type { OutboxOp, OutboxState } from "./outbox-types";
import { computeSyncStatus, readSyncStatus, resetSyncRuntimeForTests, setReachable, setSyncing } from "./sync-status";

const op = (state: OutboxState) => ({ state }) as OutboxOp;

beforeEach(async () => {
  await db.delete();
  await db.open();
  resetSyncRuntimeForTests();
});

describe("computeSyncStatus", () => {
  const shared = { sharingState: "SHARED" as const, ops: [], syncing: false, reachable: true };

  it("never says SYNCED while something is pending", () => {
    for (const state of ["QUEUED", "SENDING", "RETRY_WAIT"] as const) {
      const s = computeSyncStatus({ ...shared, ops: [op("ACKNOWLEDGED"), op(state)] });
      expect(s.state).not.toBe("SYNCED");
      expect(s.pending).toBe(1);
    }
    expect(computeSyncStatus({ ...shared, ops: [op("QUEUED")] }).state).toBe("PENDING");
    expect(computeSyncStatus({ ...shared, ops: [op("QUEUED")], syncing: true }).state).toBe("SYNCING");
    expect(computeSyncStatus({ ...shared, ops: [op("QUEUED")], reachable: false }).state).toBe("OFFLINE");
  });

  it("SYNCED only with nothing open and the server reachable", () => {
    expect(computeSyncStatus({ ...shared, ops: [op("ACKNOWLEDGED")], lastSyncedAt: "2026-10-07T01:00:00.000Z" })).toEqual({
      mode: "SHARED",
      state: "SYNCED",
      pending: 0,
      conflicts: 0,
      lastSyncedAt: "2026-10-07T01:00:00.000Z",
    });
    expect(computeSyncStatus({ ...shared, reachable: false }).state).toBe("OFFLINE");
  });

  it("halts and conflicts win over pending", () => {
    expect(computeSyncStatus({ ...shared, ops: [op("QUEUED"), op("CONFLICT"), op("INVALID")] })).toMatchObject({ state: "CONFLICT", conflicts: 2, pending: 1 });
    expect(computeSyncStatus({ ...shared, ops: [op("QUEUED")], halt: "AUTH_REQUIRED" }).state).toBe("AUTH_REQUIRED");
    expect(computeSyncStatus({ ...shared, ops: [op("BLOCKED")], halt: "BLOCKED" })).toMatchObject({ state: "BLOCKED", pending: 1 });
  });

  it("a LOCAL_ONLY space reports mode LOCAL", () => {
    expect(computeSyncStatus({ sharingState: "LOCAL", ops: [], syncing: false, reachable: false })).toMatchObject({ mode: "LOCAL", state: "SYNCED", pending: 0 });
  });
});

describe("readSyncStatus", () => {
  it("reads outbox, halt and runtime flags of one space", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà" });
    await db.spaces.update(spaceId, { sharingState: "SHARED" });
    await saveResource("item", makeItem({ spaceId }), "create");
    expect(await readSyncStatus(spaceId)).toMatchObject({ mode: "SHARED", state: "PENDING", pending: 1 });
    setSyncing(spaceId, true);
    expect((await readSyncStatus(spaceId)).state).toBe("SYNCING");
    setSyncing(spaceId, false);
    setReachable(false);
    expect((await readSyncStatus(spaceId)).state).toBe("OFFLINE");
    await db.syncCursors.put({ spaceId, cursor: "0", updatedAt: "", halt: "AUTH_REQUIRED" });
    expect((await readSyncStatus(spaceId)).state).toBe("AUTH_REQUIRED");
  });
});
