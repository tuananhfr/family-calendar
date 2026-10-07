import { beforeEach, describe, expect, it } from "vitest";
import { ApiRequestError } from "../api/errors";
import { db } from "../db/db";
import type { Item } from "../model/item";
import { createLocalSpace, saveResource } from "../repo/write";
import { FakeSyncServer } from "../test-support/fake-sync-server";
import { makeItem } from "../test-support/items";
import { processOutbox } from "./outbox-processor";
import { pullChanges } from "./puller";
import { applySnapshot } from "./snapshot-apply";

let server: FakeSyncServer;

async function sharedSpace(): Promise<string> {
  const id = await createLocalSpace({ kind: "FAMILY", name: "Nhà mình" });
  await db.spaces.update(id, { sharingState: "SHARED" });
  return id;
}

/** Record as another device would have written it on the server. */
function remoteItem(spaceId: string, title: string): Item {
  const wire: Partial<Item> = makeItem({ spaceId, title });
  delete wire.syncState;
  delete wire.revision;
  return server.put("item", wire as Item) as unknown as Item;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  server = new FakeSyncServer();
});

describe("pullChanges", () => {
  it("first pull takes a snapshot, later pulls apply UPSERT and DELETE from the cursor", async () => {
    const spaceId = await sharedSpace();
    const a = remoteItem(spaceId, "Sinh nhật bà");
    expect(await pullChanges(spaceId, server)).toEqual({ applied: 0, resynced: true });
    expect(await db.items.get(a.id)).toMatchObject({ title: "Sinh nhật bà", revision: "1", syncState: "SYNCED" });
    expect(await db.syncCursors.get(spaceId)).toMatchObject({ cursor: "1", policyVersion: "1" });

    const b = remoteItem(spaceId, "Họp lớp");
    server.remove("item", a.id);
    expect(await pullChanges(spaceId, server)).toEqual({ applied: 2, resynced: false });
    expect(await db.items.get(b.id)).toMatchObject({ title: "Họp lớp", syncState: "SYNCED" });
    expect((await db.items.get(a.id))?.deletedAt).not.toBeNull();
    expect(server.snapshotCalls).toBe(1);
  });

  it("follows has_more across pages", async () => {
    const spaceId = await sharedSpace();
    await pullChanges(spaceId, server);
    server.pageSize = 2;
    for (let i = 0; i < 5; i++) remoteItem(spaceId, `Việc ${i}`);
    expect(await pullChanges(spaceId, server)).toEqual({ applied: 5, resynced: false });
    expect(await db.syncCursors.get(spaceId)).toMatchObject({ cursor: "5" });
  });

  it("never overwrites a record that still has a pending op", async () => {
    const spaceId = await sharedSpace();
    const item = await saveResource("item", makeItem({ spaceId, title: "Bản của tôi" }), "create");
    await processOutbox(spaceId, server);
    await pullChanges(spaceId, server);
    await saveResource("item", { ...(await db.items.get(item.id))!, title: "Bản của tôi (sửa offline)" }, "update");
    server.put("item", { ...server.live("item")[0], title: "Bản người khác" });
    await pullChanges(spaceId, server);
    expect(await db.items.get(item.id)).toMatchObject({ title: "Bản của tôi (sửa offline)", syncState: "PENDING" });
  });

  it("a new policy_version reloads the snapshot and drops records no longer visible, except pending ones", async () => {
    const spaceId = await sharedSpace();
    const visible = remoteItem(spaceId, "Còn thấy");
    const hidden = remoteItem(spaceId, "Bị thu hồi");
    await pullChanges(spaceId, server);
    const draft = await saveResource("item", makeItem({ spaceId, title: "Nháp chưa gửi" }), "create");

    // Audience change elsewhere: the record leaves the snapshot without any per-record REMOVE.
    server.records.delete(server.key("item", hidden.id));
    server.policyVersion = "2";
    remoteItem(spaceId, "Mới");
    expect(await pullChanges(spaceId, server)).toMatchObject({ resynced: true });

    expect(await db.items.get(hidden.id)).toBeUndefined();
    expect(await db.items.get(visible.id)).toMatchObject({ syncState: "SYNCED" });
    expect(await db.items.get(draft.id)).toMatchObject({ title: "Nháp chưa gửi", syncState: "PENDING" });
    expect(await db.outbox.count()).toBe(1);
    expect(await db.syncCursors.get(spaceId)).toMatchObject({ policyVersion: "2", cursor: String(server.head) });
  });

  it("RESYNC_REQUIRED takes a snapshot and keeps the outbox", async () => {
    const spaceId = await sharedSpace();
    remoteItem(spaceId, "Một");
    await pullChanges(spaceId, server);
    await saveResource("item", makeItem({ spaceId, title: "Chờ gửi" }), "create");
    server.failChanges.push(new ApiRequestError("RESYNC_REQUIRED", 409));
    expect(await pullChanges(spaceId, server)).toMatchObject({ resynced: true });
    expect(server.snapshotCalls).toBe(2);
    expect(await db.outbox.where("state").equals("QUEUED").count()).toBe(1);
  });

  it("does nothing for a LOCAL_ONLY space", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Riêng" });
    expect(await pullChanges(spaceId, server)).toEqual({ applied: 0, resynced: false });
    expect(server.snapshotCalls).toBe(0);
  });
});

describe("applySnapshot", () => {
  it("replaces the projection, keeps pending rows and local-only fields of the space", async () => {
    const spaceId = await sharedSpace();
    const stale = await saveResource("item", makeItem({ spaceId, title: "Cũ" }), "create");
    await db.outbox.clear();
    await db.items.update(stale.id, { syncState: "SYNCED", revision: "3" });
    const pending = await saveResource("item", makeItem({ spaceId, title: "Đang chờ" }), "create");
    const fresh = { ...makeItem({ spaceId, title: "Từ máy chủ" }), revision: "7" };
    const wire: Partial<typeof fresh> = { ...fresh };
    delete wire.syncState;

    const result = await applySnapshot(spaceId, {
      watermark: "42",
      policy_version: "9",
      space: { id: spaceId, spaceId, name: "Nhà mình (máy chủ)", sharingState: "SHARED", revision: "4" },
      records: { item: [wire] },
      memberships: [{ id: "m", actorId: "a", roleId: "r" }],
      access: { actorId: "a", roleKey: "ADULT", matrix: {}, restrictions: {}, representedMemberIds: [], guardianOfMemberIds: [] },
    });

    expect(result).toEqual({ removed: 1, upserted: 1 });
    expect(await db.items.get(stale.id)).toBeUndefined();
    expect(await db.items.get(pending.id)).toMatchObject({ syncState: "PENDING" });
    expect(await db.items.get(fresh.id)).toMatchObject({ title: "Từ máy chủ", revision: "7", syncState: "SYNCED" });
    expect(await db.spaces.get(spaceId)).toMatchObject({ name: "Nhà mình (máy chủ)", sharingState: "SHARED", kind: "FAMILY", revision: "4" });
    expect(await db.syncCursors.get(spaceId)).toMatchObject({ cursor: "42", policyVersion: "9", access: { roleKey: "ADULT" } });
  });
});
