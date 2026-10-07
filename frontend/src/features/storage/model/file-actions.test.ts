import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/core/db/db";
import { createLocalSpace } from "@/core/repo/write";
import { createFolder, deleteFolder, deleteStoredFile, FolderError } from "./file-actions";
import { ingestFile } from "./ingest";
import { ensureSystemFolders } from "./system-folders";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const opts = { makeThumbnail: async () => new Blob([new Uint8Array([1])], { type: "image/webp" }), estimate: async () => null };

async function setup() {
  const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà Minh" });
  const folders = await ensureSystemFolders(spaceId);
  return { spaceId, byKey: (k: string) => folders.find((f) => f.systemKey === k)! };
}

describe("createFolder", () => {
  it("a sub-folder inherits the parent's data class; names are trimmed and unique among siblings", async () => {
    const { spaceId, byKey } = await setup();
    const sub = await createFolder(spaceId, "  Xét nghiệm  ", byKey("HEALTH").id);
    expect(sub).toMatchObject({ name: "Xét nghiệm", parentId: byKey("HEALTH").id, dataClass: "SENSITIVE", systemKey: null });
    await expect(createFolder(spaceId, "xet nghiem", byKey("HEALTH").id)).rejects.toMatchObject({ code: "DUPLICATE" });
    // Same name under another parent is fine.
    await expect(createFolder(spaceId, "Xét nghiệm", byKey("OTHER").id)).resolves.toBeTruthy();
  });

  it("rejects empty names and a third level", async () => {
    const { spaceId, byKey } = await setup();
    await expect(createFolder(spaceId, "   ", null)).rejects.toBeInstanceOf(FolderError);
    const sub = await createFolder(spaceId, "Du lịch", byKey("PHOTOS").id);
    await expect(createFolder(spaceId, "Ngày 1", sub.id)).rejects.toMatchObject({ code: "TOO_DEEP" });
  });
});

describe("deleteFolder", () => {
  it("system folders and folders with files stay; an empty user folder goes", async () => {
    const { spaceId, byKey } = await setup();
    await expect(deleteFolder(byKey("OTHER").id)).rejects.toMatchObject({ code: "SYSTEM" });
    const full = await createFolder(spaceId, "Hồ sơ nhà", null);
    await ingestFile(spaceId, full.id, new File([new Uint8Array([1, 2])], "so-do.txt", { type: "text/plain" }), opts);
    await expect(deleteFolder(full.id)).rejects.toMatchObject({ code: "NOT_EMPTY" });
    const empty = await createFolder(spaceId, "Trống", null);
    await deleteFolder(empty.id);
    expect((await db.folders.get(empty.id))?.deletedAt).not.toBeNull();
  });
});

describe("deleteStoredFile", () => {
  it("tombstones the record and frees its blobs (file + thumbnail)", async () => {
    const { spaceId, byKey } = await setup();
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "a.png", { type: "image/png" });
    const { file } = await ingestFile(spaceId, byKey("PHOTOS").id, png, opts);
    expect(await db.blobs.where("fileId").equals(file.id).count()).toBe(2);
    await deleteStoredFile(file.id);
    expect((await db.files.get(file.id))?.deletedAt).not.toBeNull();
    expect(await db.blobs.where("fileId").equals(file.id).count()).toBe(0);
  });
});
