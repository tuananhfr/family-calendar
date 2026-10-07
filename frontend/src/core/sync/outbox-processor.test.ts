import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../api/errors";
import { db } from "../db/db";
import type { Item } from "../model/item";
import { createLocalSpace, saveResource } from "../repo/write";
import { FakeSyncServer } from "../test-support/fake-sync-server";
import { makeItem, makeState } from "../test-support/items";
import { MAX_BACKOFF_MS } from "./backoff";
import { processOutbox, recoverInterruptedOps } from "./outbox-processor";

const T0 = new Date("2026-10-07T08:00:00.000Z");
const at = (ms: number) => () => new Date(T0.getTime() + ms);

let server: FakeSyncServer;

async function sharedSpace(): Promise<string> {
  const id = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
  await db.spaces.update(id, { sharingState: "SHARED" });
  return id;
}

async function addItem(spaceId: string, title = "Họp phụ huynh"): Promise<Item> {
  return saveResource("item", makeItem({ spaceId, title }), "create");
}

const ops = (spaceId: string) => db.outbox.where("spaceId").equals(spaceId).sortBy("clientCreatedAt");

beforeEach(async () => {
  await db.delete();
  await db.open();
  server = new FakeSyncServer();
});
afterEach(() => vi.restoreAllMocks());

describe("processOutbox", () => {
  it("APPLIED → new revision, SYNCED record and ACKNOWLEDGED op", async () => {
    const spaceId = await sharedSpace();
    const item = await addItem(spaceId);
    expect(await processOutbox(spaceId, server, at(0))).toEqual({ sent: 1, applied: 1, conflicts: 0, blocked: false });
    expect(await db.items.get(item.id)).toMatchObject({ revision: "1", syncState: "SYNCED", title: "Họp phụ huynh" });
    expect((await ops(spaceId)).map((o) => o.state)).toEqual(["ACKNOWLEDGED"]);
  });

  it("a crash before the local commit resends the same operation id and applies it once", async () => {
    const spaceId = await sharedSpace();
    const item = await addItem(spaceId);
    const [op] = await ops(spaceId);
    // The repo layer goes through db.table(), which is a different Table object than db.items.
    vi.spyOn(db.table("items"), "put").mockRejectedValueOnce(new Error("tab killed"));
    await expect(processOutbox(spaceId, server, at(0))).rejects.toThrow("tab killed");
    // Record and op change together or not at all.
    expect(await db.items.get(item.id)).toMatchObject({ revision: null, syncState: "PENDING" });
    expect((await db.outbox.get(op.operationId))?.state).toBe("SENDING");

    vi.restoreAllMocks();
    await processOutbox(spaceId, server, at(1000));
    expect(server.sent).toEqual([[op.operationId], [op.operationId]]);
    expect(server.live("item")).toHaveLength(1);
    expect(await db.items.get(item.id)).toMatchObject({ revision: "1", syncState: "SYNCED" });
    expect((await db.outbox.get(op.operationId))?.state).toBe("ACKNOWLEDGED");
  });

  it("SENDING left over after a reload goes back to QUEUED with the same id", async () => {
    const spaceId = await sharedSpace();
    await addItem(spaceId);
    const [op] = await ops(spaceId);
    await db.outbox.update(op.operationId, { state: "SENDING", attempts: 1 });
    expect(await recoverInterruptedOps()).toBe(1);
    expect(await db.outbox.get(op.operationId)).toMatchObject({ state: "QUEUED", attempts: 1, operationId: op.operationId });
  });

  it("NETWORK → RETRY_WAIT with backoff; not resent before nextAttemptAt", async () => {
    const spaceId = await sharedSpace();
    await addItem(spaceId);
    server.failSend.push(new ApiRequestError("NETWORK", 0));
    expect(await processOutbox(spaceId, server, at(0))).toMatchObject({ sent: 1, applied: 0 });
    const [op] = await ops(spaceId);
    expect(op).toMatchObject({ state: "RETRY_WAIT", attempts: 1, lastErrorCode: "NETWORK" });
    const wait = new Date(op.nextAttemptAt!).getTime() - T0.getTime();
    expect(wait).toBeGreaterThanOrEqual(800);
    expect(wait).toBeLessThanOrEqual(1200);

    expect(await processOutbox(spaceId, server, at(500))).toMatchObject({ sent: 0 });
    expect(await processOutbox(spaceId, server, at(MAX_BACKOFF_MS))).toMatchObject({ sent: 1, applied: 1 });
    expect(server.sent).toHaveLength(2);
  });

  it("a business 4xx is INVALID and never retried", async () => {
    const spaceId = await sharedSpace();
    const item = await addItem(spaceId);
    server.rejectByResource.set(item.id, { code: "VALIDATION_FAILED", fields: { title: "TOO_LONG" } });
    await processOutbox(spaceId, server, at(0));
    expect((await ops(spaceId))[0]).toMatchObject({ state: "INVALID", lastErrorCode: "VALIDATION_FAILED", lastErrorFields: { title: "TOO_LONG" } });
    expect((await db.items.get(item.id))?.syncState).toBe("CONFLICT");
    expect(await processOutbox(spaceId, server, at(MAX_BACKOFF_MS * 10))).toMatchObject({ sent: 0 });
  });

  it("REVISION_CONFLICT keeps the local edit and stores the server copy", async () => {
    const spaceId = await sharedSpace();
    const item = await addItem(spaceId);
    await processOutbox(spaceId, server, at(0));
    const theirs = server.put("item", { ...server.live("item")[0], title: "Họp phụ huynh (đổi giờ)" });
    const local = (await db.items.get(item.id))!;
    await saveResource("item", { ...local, title: "Họp phụ huynh lớp 3" }, "update");

    expect(await processOutbox(spaceId, server, at(1000))).toEqual({ sent: 1, applied: 0, conflicts: 1, blocked: false });
    const op = (await ops(spaceId)).at(-1)!;
    expect(op).toMatchObject({ state: "CONFLICT", lastErrorCode: "REVISION_CONFLICT", conflictCurrent: theirs });
    expect(await db.items.get(item.id)).toMatchObject({ title: "Họp phụ huynh lớp 3", syncState: "CONFLICT", revision: "1" });
  });

  it("AUTH_REQUIRED stops, keeps the outbox and marks the space; a later success clears it", async () => {
    const spaceId = await sharedSpace();
    await addItem(spaceId);
    server.failSend.push(new ApiRequestError("AUTH_REQUIRED", 401));
    expect(await processOutbox(spaceId, server, at(0))).toMatchObject({ applied: 0, blocked: false });
    expect((await ops(spaceId))[0].state).toBe("QUEUED");
    expect((await db.syncCursors.get(spaceId))?.halt).toBe("AUTH_REQUIRED");

    await processOutbox(spaceId, server, at(1000));
    expect((await ops(spaceId))[0].state).toBe("ACKNOWLEDGED");
    expect((await db.syncCursors.get(spaceId))?.halt ?? null).toBeNull();
  });

  it("DEVICE_REVOKED blocks every op and stops sending", async () => {
    const spaceId = await sharedSpace();
    await addItem(spaceId);
    await addItem(spaceId, "Đi chợ");
    server.failSend.push(new ApiRequestError("DEVICE_REVOKED", 401));
    expect(await processOutbox(spaceId, server, at(0))).toMatchObject({ blocked: true });
    expect((await ops(spaceId)).map((o) => o.state)).toEqual(["BLOCKED", "BLOCKED"]);
    expect(await db.syncCursors.get(spaceId)).toMatchObject({ halt: "BLOCKED", haltCode: "DEVICE_REVOKED" });
    expect(await processOutbox(spaceId, server, at(MAX_BACKOFF_MS))).toMatchObject({ sent: 0, blocked: true });
    expect(server.sent).toHaveLength(1);
  });

  it("priority 1 goes out first in its own request", async () => {
    const spaceId = await sharedSpace();
    const a = await addItem(spaceId, "Một");
    await addItem(spaceId, "Hai");
    const done = await saveResource("occurrence_state", makeState(a, a.schedule.start, "DONE", { spaceId }), "occurrence_action");
    await processOutbox(spaceId, server, at(0));
    const urgent = (await ops(spaceId)).find((o) => o.resourceId === done.id)!;
    expect(server.sent[0]).toEqual([urgent.operationId]);
    expect(server.sent[1]).toHaveLength(2);
  });

  it("an edit queued behind an unacknowledged create is rebased on the create's revision", async () => {
    const spaceId = await sharedSpace();
    const item = await addItem(spaceId);
    server.failSend.push(new ApiRequestError("NETWORK", 0));
    await processOutbox(spaceId, server, at(0));
    await saveResource("item", { ...(await db.items.get(item.id))!, title: "Họp phụ huynh — phòng 204" }, "update");
    expect(await ops(spaceId)).toHaveLength(2);

    expect(await processOutbox(spaceId, server, at(MAX_BACKOFF_MS))).toMatchObject({ applied: 2, conflicts: 0 });
    expect(server.sent.slice(1).map((b) => b.length)).toEqual([1, 1]);
    expect(server.live("item")[0]).toMatchObject({ title: "Họp phụ huynh — phòng 204", revision: "2" });
    expect(await db.items.get(item.id)).toMatchObject({ revision: "2", syncState: "SYNCED", title: "Họp phụ huynh — phòng 204" });
  });

  it("RESOURCE_DELETED is final: the local copy becomes a tombstone, nothing is restored", async () => {
    const spaceId = await sharedSpace();
    const item = await addItem(spaceId);
    await processOutbox(spaceId, server, at(0));
    server.remove("item", item.id);
    await saveResource("item", { ...(await db.items.get(item.id))!, title: "Sửa khi offline" }, "update");
    await processOutbox(spaceId, server, at(1000));
    expect((await ops(spaceId)).at(-1)).toMatchObject({ state: "ACKNOWLEDGED", lastErrorCode: "RESOURCE_DELETED" });
    const local = await db.items.get(item.id);
    expect(local?.deletedAt).not.toBeNull();
    expect(local?.syncState).toBe("SYNCED");
    expect(server.live("item")).toHaveLength(0);
  });

  it("a LOCAL_ONLY space never calls the server", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Riêng" });
    await addItem(spaceId);
    expect(await processOutbox(spaceId, server, at(0))).toEqual({ sent: 0, applied: 0, conflicts: 0, blocked: false });
    expect(server.sent).toHaveLength(0);
  });
});
