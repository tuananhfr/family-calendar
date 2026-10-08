import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../api/errors";
import { db } from "../db/db";
import { createLocalSpace, saveResource } from "../repo/write";
import { FakeSyncServer } from "../test-support/fake-sync-server";
import { makeItem } from "../test-support/items";
import { startSyncEngine } from "./sync-engine";
import { readSyncStatus, resetSyncRuntimeForTests } from "./sync-status";

let server: FakeSyncServer;
let stop: (() => void) | undefined;
let win: EventTarget;
let doc: EventTarget & { visibilityState: string };

async function sharedSpace(): Promise<string> {
  const id = await createLocalSpace({ kind: "FAMILY", name: "Nhà" });
  await db.spaces.update(id, { sharingState: "SHARED" });
  return id;
}

function start() {
  stop = startSyncEngine({ transport: server, debounceMs: 20, intervalMs: 60_000, windowTarget: win, documentTarget: doc });
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  resetSyncRuntimeForTests();
  server = new FakeSyncServer();
  win = new EventTarget();
  doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
});
afterEach(() => {
  stop?.();
  stop = undefined;
});

describe("startSyncEngine", () => {
  it("syncs shared spaces on start and after local writes (debounced)", async () => {
    const spaceId = await sharedSpace();
    const first = await saveResource("item", makeItem({ spaceId, title: "Một" }), "create");
    start();
    await vi.waitFor(async () => expect((await db.items.get(first.id))?.syncState).toBe("SYNCED"));
    await vi.waitFor(async () => expect((await readSyncStatus(spaceId)).state).toBe("SYNCED"));
    expect((await readSyncStatus(spaceId)).lastSyncedAt).toBeDefined();

    const second = await saveResource("item", makeItem({ spaceId, title: "Hai" }), "create");
    await vi.waitFor(async () => expect((await db.items.get(second.id))?.syncState).toBe("SYNCED"));
    expect(server.live("item")).toHaveLength(2);
  });

  it("online and visibilitychange trigger a run; stop() ends every trigger", async () => {
    const spaceId = await sharedSpace();
    const pulls = vi.spyOn(server, "getChanges");
    start();
    await vi.waitFor(() => expect(pulls).toHaveBeenCalledTimes(1));
    win.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(pulls).toHaveBeenCalledTimes(2));
    doc.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(pulls).toHaveBeenCalledTimes(3));

    stop!();
    await saveResource("item", makeItem({ spaceId }), "create");
    win.dispatchEvent(new Event("online"));
    await new Promise((r) => setTimeout(r, 80));
    expect(pulls).toHaveBeenCalledTimes(3);
    expect(server.sent).toHaveLength(0);
  });

  it("an unreachable server shows OFFLINE and keeps the op", async () => {
    const spaceId = await sharedSpace();
    await saveResource("item", makeItem({ spaceId }), "create");
    server.failSend.push(new ApiRequestError("NETWORK", 0));
    server.failChanges.push(new ApiRequestError("NETWORK", 0));
    vi.spyOn(server, "getSnapshot").mockRejectedValueOnce(new ApiRequestError("NETWORK", 0));
    start();
    await vi.waitFor(async () => expect((await readSyncStatus(spaceId)).state).toBe("OFFLINE"));
    expect((await readSyncStatus(spaceId)).pending).toBe(1);
  });

  it("a revoked device stops syncing that space", async () => {
    const spaceId = await sharedSpace();
    vi.spyOn(server, "getSnapshot").mockRejectedValue(new ApiRequestError("DEVICE_REVOKED", 401));
    start();
    await vi.waitFor(async () => expect((await readSyncStatus(spaceId)).state).toBe("BLOCKED"));
  });

  it("LOCAL_ONLY spaces cause no request at all", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Riêng" });
    await saveResource("item", makeItem({ spaceId }), "create");
    const snapshot = vi.spyOn(server, "getSnapshot");
    start();
    await new Promise((r) => setTimeout(r, 80));
    expect(server.sent).toHaveLength(0);
    expect(snapshot).not.toHaveBeenCalled();
  });
});
