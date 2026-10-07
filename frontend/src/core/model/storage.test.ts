import { describe, expect, it } from "vitest";
import { newId } from "../ids";
import { fileKindFromMime, fileSchema, folderSchema, MAX_FILE_BYTES } from "./storage";
import { baseFields, issueCodes } from "../test-support/records";

describe("storage schemas", () => {
  it("derives the file kind from the mime type", () => {
    expect(fileKindFromMime("image/webp")).toBe("IMAGE");
    expect(fileKindFromMime("video/mp4")).toBe("VIDEO");
    expect(fileKindFromMime("audio/webm")).toBe("AUDIO");
    expect(fileKindFromMime("application/pdf")).toBe("DOCUMENT");
    expect(fileKindFromMime("application/x-unknown")).toBe("OTHER");
  });

  it("enforces size limits per kind (25 MB documents/images, 200 MB video)", () => {
    const f = {
      ...baseFields(),
      folderId: newId(),
      name: "bao-cao.pdf",
      mime: "application/pdf",
      size: MAX_FILE_BYTES.DOCUMENT,
      sha256: "a".repeat(64),
      kind: "DOCUMENT",
      blobState: "LOCAL_ONLY",
    };
    expect(fileSchema.safeParse(f).success).toBe(true);
    expect(issueCodes(fileSchema.safeParse({ ...f, size: MAX_FILE_BYTES.DOCUMENT + 1 }))).toContain("FILE_TOO_LARGE");
    expect(fileSchema.safeParse({ ...f, kind: "VIDEO", mime: "video/mp4", size: 150 * 1024 * 1024 }).success).toBe(true);
    expect(issueCodes(fileSchema.safeParse({ ...f, sha256: "xyz" }))).toContain("INVALID_SHA256");
  });

  it("accepts system folders", () => {
    expect(folderSchema.safeParse({ ...baseFields(), name: "Ảnh", parentId: null, systemKey: "PHOTOS" }).success).toBe(true);
    expect(issueCodes(folderSchema.safeParse({ ...baseFields(), name: "", parentId: null }))).toContain("NAME_REQUIRED");
  });
});
