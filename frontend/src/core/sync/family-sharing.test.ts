import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/db";
import { setOnlineIdentity } from "../db/online-identity";
import { getLocalIdentity } from "../db/local-identity";
import { createLocalSpace, saveResource } from "../repo/write";
import { makeItem } from "../test-support/items";
import { FakeSyncServer } from "../test-support/fake-sync-server";
import { applySnapshot } from "./snapshot-apply";
import { purgeSharedProjection } from "./purge";
import { rememberSession, SESSION_KEY } from "@/features/identity/model/session";
import { enableSharing } from "./bootstrap-client";
import { api } from "../api/client";
import { ensureLocalSession } from "@/features/identity/model/session";
vi.mock("../api/client", () => ({ api: vi.fn(), clearApiSession: vi.fn() }));
vi.mock("@/features/identity/model/session", async (original) => {
  const actual = await original<typeof import("@/features/identity/model/session")>();
  return { ...actual, ensureLocalSession: vi.fn() };
});
beforeEach(async () => { await db.delete(); await db.open(); setOnlineIdentity(null); vi.clearAllMocks(); });
describe("family sharing recovery", () => {
  it("archives unsent edits and their audio when a snapshot revokes the record", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Family" });
    await db.spaces.update(spaceId, { sharingState: "SHARED" });
    const server = new FakeSyncServer();
    const item = await saveResource("item", makeItem({ spaceId, audioAssetId: crypto.randomUUID() }), "create");
    await db.outbox.clear(); await db.items.update(item.id, { revision: "4", syncState: "SYNCED" });
    const bytes = new Blob(["private recording"]);
    await db.blobs.put({ id: item.audioAssetId!, kind: "AUDIO", mime: "audio/webm", data: bytes, size: bytes.size, createdAt: item.createdAt });
    await saveResource("item", { ...item, title: "Offline draft" }, "update");
    await applySnapshot(spaceId, await server.getSnapshot(spaceId));
    expect(await db.items.get(item.id)).toBeUndefined();
    expect(await db.outbox.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
    const [draft] = await db.sharedDrafts.toArray();
    expect(draft.record).toMatchObject({ title: "Offline draft" });
    expect(await draft.media![0].data.text()).toBe("private recording");
  });
  it("purges shared copies but preserves drafts and local families", async () => {
    const local = await createLocalSpace({ kind: "FAMILY", name: "Local" });
    const shared = await createLocalSpace({ kind: "GROUP", name: "Shared" });
    await db.spaces.update(shared, { sharingState: "SHARED" });
    const item = await saveResource("item", makeItem({ spaceId: shared }), "create");
    await purgeSharedProjection(shared);
    expect(await db.items.get(item.id)).toBeUndefined();
    expect((await db.spaces.get(local))?.deletedAt).toBeNull();
    expect((await db.spaces.get(shared))?.deletedAt).not.toBeNull();
    expect(await db.sharedDrafts.count()).toBe(1);
    expect(await db.outbox.count()).toBe(0);
  });
  it("a new authorized snapshot clears a stale revoke flag after logging back in", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Family" });
    await db.spaces.update(spaceId, { sharingState: "SHARED" });
    await purgeSharedProjection(spaceId, "LOCAL_SIGN_OUT");
    await db.spaces.update(spaceId, { deletedAt: null });
    await applySnapshot(spaceId, await new FakeSyncServer().getSnapshot(spaceId));
    expect((await db.syncCursors.get(spaceId))?.halt).toBeNull();
  });
  it("stores only non-secret identity fields, never the CSRF token", async () => {
    await rememberSession({ actorId: crypto.randomUUID(), deviceId: crypto.randomUUID(), accountId: null, csrfToken: "secret" } as never);
    expect(Object.keys((await db.settings.get(SESSION_KEY))!.value as object).sort()).toEqual(["accountId", "actorId", "deviceId"]);
  });
  it("resumes a journal after activation failure and queues edits made during upload", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Family" });
    const identity = await getLocalIdentity();
    const item = await saveResource("item", makeItem({ spaceId, createdByActorId: identity.actorId, title: "Original" }), "create");
    vi.mocked(ensureLocalSession).mockResolvedValue({ ...identity, accountId: crypto.randomUUID() });
    let records: Array<{ resource_type: string; payload: Record<string, unknown> }> = [];
    let activation = 0;
    vi.mocked(api).mockImplementation(async (method, path, body) => {
      if (path === "/account") return { linked: true };
      if (path === "/spaces/bootstrap") return { state: "BOOTSTRAPPING" };
      if (path.endsWith("/bootstrap/chunks")) { records = (body as { records: typeof records }).records; return {}; }
      if (path.endsWith("/bootstrap/activate")) { if (++activation === 1) throw new Error("Offline"); return {}; }
      if (method === "GET" && path.endsWith("/sync/snapshot")) {
        const space = (await db.spaces.get(spaceId))!;
        const byType: Record<string, unknown[]> = {};
        for (const record of records) (byType[record.resource_type] ??= []).push({ ...record.payload, revision: "1" });
        return { space: { ...space, revision: "1", sharingState: "SHARED" }, records: byType, watermark: "1", policy_version: "1", memberships: [], access: {} };
      }
      throw new Error("Unexpected API");
    });
    const options = { selfMemberId: crypto.randomUUID(), includeFiles: false, includeAudio: false };
    await expect(enableSharing(spaceId, options, () => {})).rejects.toThrow("Offline");
    expect((await db.spaces.get(spaceId))?.sharingState).toBe("LOCAL");
    await saveResource("item", { ...item, title: "Edited during upload" }, "update");
    await enableSharing(spaceId, { ...options, includeFiles: true }, () => {});
    expect(vi.mocked(api).mock.calls.filter((c) => c[1].endsWith("/bootstrap/chunks"))).toHaveLength(1);
    expect(await db.items.get(item.id)).toMatchObject({ title: "Edited during upload", revision: "1", syncState: "PENDING" });
    expect(await db.outbox.toArray()).toEqual([expect.objectContaining({ action: "update", baseRevision: "1", payload: expect.objectContaining({ title: "Edited during upload" }) })]);
    expect((await db.settings.get("media-options:" + spaceId))?.value).toMatchObject({ includeFiles: false });
    expect(await db.settings.get("bootstrap:" + spaceId)).toBeUndefined();
  });
});
