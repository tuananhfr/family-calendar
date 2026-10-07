import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId } from "../ids";
import { db } from "../db/db";
import { getLocalIdentity } from "../db/local-identity";
import type { BaseRecord } from "../sync/resource-types";
import { listActive } from "./read";
import { createLocalSpace, deleteResource, saveResource, StorageFullError } from "./write";

type TestItem = BaseRecord & { title: string };

async function makeItem(spaceId: string, title = "Đi chợ"): Promise<TestItem> {
  const { actorId } = await getLocalIdentity();
  return {
    id: newId(),
    spaceId,
    createdByActorId: actorId,
    dataClass: "NORMAL",
    sharingScope: "FAMILY_ALL",
    revision: null,
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
    syncState: "LOCAL",
    title,
  };
}

async function sharedSpace(): Promise<string> {
  const id = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
  await db.spaces.update(id, { sharingState: "SHARED", revision: "5" });
  return id;
}

const unhooks: (() => void)[] = [];

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  for (const u of unhooks.splice(0)) u();
});

function hookThrow(tableName: string, error: () => unknown) {
  const table = db.table(tableName);
  const fn = () => {
    throw error();
  };
  table.hook("creating", fn);
  unhooks.push(() => table.hook("creating").unsubscribe(fn));
}

describe("createLocalSpace", () => {
  it("creates a LOCAL space owned by the local actor with the default time zone", async () => {
    const id = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    const { actorId } = await getLocalIdentity();
    expect(await db.spaces.get(id)).toMatchObject({
      id,
      spaceId: id,
      kind: "FAMILY",
      name: "Nhà mình",
      timeZone: "Asia/Ho_Chi_Minh",
      sharingState: "LOCAL",
      createdByActorId: actorId,
      revision: null,
      syncState: "LOCAL",
      deletedAt: null,
    });
    expect(await db.outbox.count()).toBe(0);
  });
});

describe("saveResource", () => {
  it("LOCAL space: stores the record with syncState LOCAL and no outbox entry", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    const saved = await saveResource("item", await makeItem(spaceId), "create");
    expect(saved.syncState).toBe("LOCAL");
    expect(saved.createdAt).not.toBe("");
    expect(await db.items.get(saved.id)).toMatchObject({ title: "Đi chợ", syncState: "LOCAL" });
    expect(await db.outbox.count()).toBe(0);
  });

  it("SHARED space: stores PENDING record and exactly one QUEUED op carrying the old revision", async () => {
    const spaceId = await sharedSpace();
    const item = await makeItem(spaceId);
    // Pretend the server already acknowledged revision 7 of this item.
    await db.table("items").put({ ...item, revision: "7", syncState: "SYNCED" });
    const saved = await saveResource("item", { ...item, title: "Đi siêu thị" }, "update");
    expect(saved).toMatchObject({ syncState: "PENDING", revision: "7", title: "Đi siêu thị" });
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      spaceId,
      resourceType: "item",
      resourceId: item.id,
      action: "update",
      baseRevision: "7",
      state: "QUEUED",
      attempts: 0,
      schemaVersion: 1,
      nextAttemptAt: null,
    });
    expect(ops[0].payload).toMatchObject({ id: item.id, title: "Đi siêu thị" });
    expect(ops[0].payload).not.toHaveProperty("syncState");
  });

  it("SHARED space: a second edit before sending replaces the queued payload instead of stacking a stale op", async () => {
    const spaceId = await sharedSpace();
    const item = await makeItem(spaceId);
    await saveResource("item", item, "create");
    await saveResource("item", { ...item, title: "Lần 2" }, "update");
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ action: "create", baseRevision: null });
    expect(ops[0].payload).toMatchObject({ title: "Lần 2" });
  });

  it("rolls back the record when adding the outbox op fails (same transaction)", async () => {
    const spaceId = await sharedSpace();
    hookThrow("outbox", () => new Error("outbox broke"));
    const item = await makeItem(spaceId);
    await expect(saveResource("item", item, "create")).rejects.toThrow();
    expect(await db.items.get(item.id)).toBeUndefined();
    expect(await db.outbox.count()).toBe(0);
  });

  it("Review Focus #4: QuotaExceededError → StorageFullError, no record, no orphan outbox op", async () => {
    const spaceId = await sharedSpace();
    hookThrow("outbox", () => new DOMException("The quota has been exceeded.", "QuotaExceededError"));
    const item = await makeItem(spaceId);
    const err = await saveResource("item", item, "create").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StorageFullError);
    expect(await db.items.get(item.id)).toBeUndefined();
    expect(await db.outbox.count()).toBe(0);
  });

  it("maps a quota error on the record write itself too (LOCAL space)", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    hookThrow("items", () => new DOMException("full", "QuotaExceededError"));
    const item = await makeItem(spaceId);
    await expect(saveResource("item", item, "create")).rejects.toBeInstanceOf(StorageFullError);
    expect(await db.items.count()).toBe(0);
  });

  it("refuses to write into an unknown space or to create an existing id", async () => {
    await expect(saveResource("item", await makeItem(newId()), "create")).rejects.toThrow(/SPACE_NOT_FOUND/);
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    const item = await makeItem(spaceId);
    await saveResource("item", item, "create");
    await expect(saveResource("item", item, "create")).rejects.toThrow(/ALREADY_EXISTS/);
    await expect(saveResource("item", await makeItem(spaceId), "update")).rejects.toThrow(/NOT_FOUND/);
  });
});

describe("deleteResource", () => {
  it("tombstones the record so listActive no longer returns it", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
    const keep = await saveResource("item", await makeItem(spaceId, "Giữ"), "create");
    const drop = await saveResource("item", await makeItem(spaceId, "Xóa"), "create");
    await deleteResource("item", drop.id);
    const row = await db.items.get(drop.id);
    expect(row?.deletedAt).not.toBeNull();
    expect((await listActive("item", spaceId)).map((r) => r.id)).toEqual([keep.id]);
    expect(await db.outbox.count()).toBe(0);
  });

  it("SHARED space: enqueues a delete op with the acknowledged revision", async () => {
    const spaceId = await sharedSpace();
    const item = await makeItem(spaceId);
    await db.table("items").put({ ...item, revision: "9", syncState: "SYNCED" });
    await deleteResource("item", item.id);
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ action: "delete", baseRevision: "9", resourceId: item.id, state: "QUEUED" });
    expect(await db.items.get(item.id)).toMatchObject({ syncState: "PENDING" });
  });

  it("SHARED space: deleting a record whose create never left the device drops the queued create", async () => {
    const spaceId = await sharedSpace();
    const item = await makeItem(spaceId);
    await saveResource("item", item, "create");
    await deleteResource("item", item.id);
    expect(await db.outbox.count()).toBe(0);
    expect((await db.items.get(item.id))?.deletedAt).not.toBeNull();
  });
});
