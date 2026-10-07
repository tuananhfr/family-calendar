import { describe, expect, it } from "vitest";
import type { Folder, StoredFile } from "@/core/model/storage";
import { filterFiles, folderCounts, uploadTarget } from "./storage-view";

const base = { spaceId: "s", createdByActorId: "a", dataClass: "NORMAL", sharingScope: "FAMILY_ALL", revision: null, deletedAt: null, syncState: "LOCAL" } as const;

function folder(id: string, systemKey: Folder["systemKey"], parentId: string | null = null, name = id): Folder {
  return { ...base, id, name, parentId, systemKey, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" };
}

function file(id: string, folderId: string, kind: StoredFile["kind"], name: string, createdAt: string, size = 100): StoredFile {
  return { ...base, id, folderId, kind, name, createdAt, updatedAt: createdAt, mime: "x/y", size, sha256: "0".repeat(64), blobState: "LOCAL_ONLY" };
}

const folders = [
  folder("photos", "PHOTOS"),
  folder("docs", "DOCUMENTS"),
  folder("study", "STUDY"),
  folder("health", "HEALTH"),
  folder("videos", "VIDEOS"),
  folder("other", "OTHER"),
  folder("trip", null, "photos", "Du lịch Đà Lạt"),
  folder("mine", null, null, "Hồ sơ nhà"),
];

const files = [
  file("f1", "photos", "IMAGE", "Sinh nhật Bố.jpg", "2026-10-12T10:00:00Z", 300),
  file("f2", "health", "DOCUMENT", "Kết quả khám sức khỏe.pdf", "2026-10-10T10:00:00Z", 900),
  file("f3", "study", "DOCUMENT", "Thời khóa biểu An.pdf", "2026-10-06T10:00:00Z", 50),
  file("f4", "trip", "IMAGE", "Hồ Xuân Hương.jpg", "2026-10-02T10:00:00Z", 700),
  file("f5", "videos", "VIDEO", "Video dã ngoại.mp4", "2026-10-03T10:00:00Z", 5000),
  file("f6", "mine", "OTHER", "so-do.dwg", "2026-10-01T10:00:00Z", 10),
];

const ids = (list: StoredFile[]) => list.map((f) => f.id);

describe("filterFiles", () => {
  it("ALL lists newest first", () => {
    expect(ids(filterFiles(files, folders, { tab: "ALL", query: "", sort: "NEWEST" }))).toEqual(["f1", "f2", "f3", "f5", "f4", "f6"]);
  });

  it("kind tabs filter by file kind, folder tabs by system folder and its sub-folders", () => {
    expect(ids(filterFiles(files, folders, { tab: "IMAGE", query: "", sort: "NEWEST" }))).toEqual(["f1", "f4"]);
    expect(ids(filterFiles(files, folders, { tab: "HEALTH", query: "", sort: "NEWEST" }))).toEqual(["f2"]);
    // Gia đình = Ảnh gia đình + Video kỷ niệm, including the "Du lịch" sub-folder.
    expect(ids(filterFiles(files, folders, { tab: "FAMILY", query: "", sort: "NEWEST" }))).toEqual(["f1", "f5", "f4"]);
    // Khác = the Khác folder plus folders the family made themselves.
    expect(ids(filterFiles(files, folders, { tab: "OTHER", query: "", sort: "NEWEST" }))).toEqual(["f6"]);
  });

  it("search ignores accents and case, and matches the folder name too", () => {
    expect(ids(filterFiles(files, folders, { tab: "ALL", query: "ket qua kham", sort: "NEWEST" }))).toEqual(["f2"]);
    expect(ids(filterFiles(files, folders, { tab: "ALL", query: "DA LAT", sort: "NEWEST" }))).toEqual(["f4"]);
  });

  it("inside a folder only that folder's files show", () => {
    expect(ids(filterFiles(files, folders, { tab: "ALL", query: "", sort: "NEWEST", folderId: "photos" }))).toEqual(["f1"]);
  });

  it("sorts by name (Vietnamese order) and by size", () => {
    expect(ids(filterFiles(files, folders, { tab: "DOCUMENT", query: "", sort: "NAME" }))).toEqual(["f2", "f3"]);
    expect(ids(filterFiles(files, folders, { tab: "ALL", query: "", sort: "SIZE" })).slice(0, 2)).toEqual(["f5", "f2"]);
    expect(ids(filterFiles(files, folders, { tab: "ALL", query: "", sort: "OLDEST" }))[0]).toBe("f6");
  });
});

describe("folderCounts", () => {
  it("a top folder counts the files of its sub-folders too", () => {
    const counts = folderCounts(files, folders);
    expect(counts.get("photos")).toBe(2);
    expect(counts.get("trip")).toBe(1);
    expect(counts.get("docs") ?? 0).toBe(0);
  });
});

describe("uploadTarget", () => {
  it("an open folder always wins", () => {
    expect(uploadTarget(folders, { kind: "VIDEO", folderId: "health" })).toBe("health");
  });

  it("a folder tab or an item category picks its folder", () => {
    expect(uploadTarget(folders, { kind: "IMAGE", tab: "HEALTH" })).toBe("health");
    expect(uploadTarget(folders, { kind: "IMAGE", category: "STUDY" })).toBe("study");
    expect(uploadTarget(folders, { kind: "IMAGE", category: "DOCUMENT" })).toBe("docs");
  });

  it("otherwise the file kind decides", () => {
    expect(uploadTarget(folders, { kind: "IMAGE" })).toBe("photos");
    expect(uploadTarget(folders, { kind: "VIDEO" })).toBe("videos");
    expect(uploadTarget(folders, { kind: "DOCUMENT" })).toBe("docs");
    expect(uploadTarget(folders, { kind: "AUDIO" })).toBe("other");
  });
});
