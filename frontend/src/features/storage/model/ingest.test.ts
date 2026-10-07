import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/core/db/db";
import { StorageFullError } from "@/core/db/errors";
import { createLocalSpace } from "@/core/repo/write";
import { readExif } from "./exif-strip";
import { FileTooLargeError, ingestFile } from "./ingest";
import { ensureSystemFolders, SYSTEM_FOLDERS } from "./system-folders";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function setup() {
  const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà Minh" });
  const folders = await ensureSystemFolders(spaceId);
  const byKey = (k: string) => folders.find((f) => f.systemKey === k)!;
  return { spaceId, photos: byKey("PHOTOS"), health: byKey("HEALTH") };
}

async function photo(name = "IMG_0001.jpg"): Promise<File> {
  const buf = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#09c" } })
    .jpeg()
    .withExif({ IFD2: { DateTimeOriginal: "2026:10:05 07:15:30" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "10/1 46/1 30/1" } })
    .toBuffer();
  return new File([new Uint8Array(buf)], name, { type: "image/jpeg" });
}

const noThumb = { makeThumbnail: async () => null, estimate: async () => null };
const quotaError = () => Object.assign(new Error("full"), { name: "QuotaExceededError" });

describe("system folders", () => {
  it("creates the six folders once; Sức khỏe is SENSITIVE", async () => {
    const { spaceId } = await setup();
    await ensureSystemFolders(spaceId);
    const all = await db.folders.where("spaceId").equals(spaceId).toArray();
    expect(all.map((f) => f.systemKey).sort()).toEqual(SYSTEM_FOLDERS.map((f) => f.key).sort());
    expect(all.find((f) => f.systemKey === "HEALTH")?.dataClass).toBe("SENSITIVE");
    expect(all.filter((f) => f.systemKey !== "HEALTH").every((f) => f.dataClass === "NORMAL")).toBe(true);
  });

  it("two tabs opening Kho at once still end with six folders", async () => {
    const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà Minh" });
    await Promise.all([ensureSystemFolders(spaceId), ensureSystemFolders(spaceId), ensureSystemFolders(spaceId)]);
    expect(await db.folders.where("spaceId").equals(spaceId).count()).toBe(SYSTEM_FOLDERS.length);
  });
});

describe("ingestFile", () => {
  it("stores the blob and the record together, without GPS", async () => {
    const { spaceId, photos } = await setup();
    const thumb = new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });
    const { file, warnLowSpace } = await ingestFile(spaceId, photos.id, await photo(), { makeThumbnail: async () => thumb, estimate: async () => ({ usage: 0, quota: 1e9 }) });

    expect(warnLowSpace).toBe(false);
    expect(file).toMatchObject({ name: "IMG_0001.jpg", kind: "IMAGE", mime: "image/jpeg", folderId: photos.id, blobState: "LOCAL_ONLY", takenAt: "2026-10-05T07:15", dataClass: "NORMAL" });
    const blobs = await db.blobs.where("fileId").equals(file.id).toArray();
    expect(blobs.map((b) => b.kind).sort()).toEqual(["FILE", "THUMBNAIL"]);
    expect(file.thumbnailBlobId).toBe(blobs.find((b) => b.kind === "THUMBNAIL")!.id);

    const stored = await blobs.find((b) => b.kind === "FILE")!.data.arrayBuffer();
    expect(readExif(stored).hasGps).toBe(false);
    const digest = Buffer.from(await crypto.subtle.digest("SHA-256", stored)).toString("hex");
    expect(file.sha256).toBe(digest);
    expect(file.size).toBe(stored.byteLength);
  });

  it("a file in Sức khỏe is SENSITIVE", async () => {
    const { spaceId, health } = await setup();
    const pdf = new File([new TextEncoder().encode("%PDF-1.4")], "ket-qua-xet-nghiem.pdf", { type: "application/pdf" });
    const { file } = await ingestFile(spaceId, health.id, pdf, noThumb);
    expect(file).toMatchObject({ dataClass: "SENSITIVE", kind: "DOCUMENT" });
  });

  it("QuotaExceeded on blobs.add → StorageFullError, no record and no orphan blob (Review Focus #4)", async () => {
    const { spaceId, photos } = await setup();
    vi.spyOn(db.blobs, "add").mockRejectedValueOnce(quotaError());
    await expect(ingestFile(spaceId, photos.id, await photo(), noThumb)).rejects.toBeInstanceOf(StorageFullError);
    expect(await db.files.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
  });

  it("a failure after the first blob rolls the first one back too", async () => {
    const { spaceId, photos } = await setup();
    const real = db.blobs.add.bind(db.blobs);
    let calls = 0;
    vi.spyOn(db.blobs, "add").mockImplementation(((row: Parameters<typeof real>[0]) => (++calls === 2 ? Promise.reject(quotaError()) : real(row))) as typeof real);
    const thumb = new Blob([new Uint8Array([1])], { type: "image/webp" });
    await expect(ingestFile(spaceId, photos.id, await photo(), { makeThumbnail: async () => thumb, estimate: async () => null })).rejects.toBeInstanceOf(StorageFullError);
    expect(await db.files.count()).toBe(0);
    expect(await db.blobs.count()).toBe(0);
  });

  it("checks limits before reading the file", async () => {
    const { spaceId, photos } = await setup();
    const big = new File([new Uint8Array(1)], "phim.mp4", { type: "video/mp4" });
    Object.defineProperty(big, "size", { value: 201 * 1024 * 1024 });
    await expect(ingestFile(spaceId, photos.id, big, noThumb)).rejects.toBeInstanceOf(FileTooLargeError);
    await expect(ingestFile(spaceId, photos.id, await photo(), { ...noThumb, estimate: async () => ({ usage: 100, quota: 100 }) })).rejects.toBeInstanceOf(StorageFullError);
    expect(await db.blobs.count()).toBe(0);
  });

  it("refuses a folder of another Space", async () => {
    const { photos } = await setup();
    const other = await createLocalSpace({ kind: "FAMILY", name: "Nhà ngoại" });
    await expect(ingestFile(other, photos.id, await photo(), noThumb)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
