import { describe, expect, it } from "vitest";
import { extensionLabel, fileKindFromMime, kindOfFile, mimeOf } from "./file-kind";

describe("file kinds", () => {
  it("maps mime types to the five kinds", () => {
    expect(fileKindFromMime("image/jpeg")).toBe("IMAGE");
    expect(fileKindFromMime("IMAGE/HEIC")).toBe("IMAGE");
    expect(fileKindFromMime("application/pdf")).toBe("DOCUMENT");
    expect(fileKindFromMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("DOCUMENT");
    expect(fileKindFromMime("video/mp4")).toBe("VIDEO");
    expect(fileKindFromMime("audio/webm")).toBe("AUDIO");
    expect(fileKindFromMime("application/zip")).toBe("OTHER");
  });

  it("falls back to the extension when the browser gives no type", () => {
    expect(mimeOf({ type: "", name: "IMG_0001.HEIC" })).toBe("image/heic");
    expect(kindOfFile({ type: "", name: "hop-dong.docx" })).toBe("DOCUMENT");
    expect(kindOfFile({ type: "", name: "khong-duoi" })).toBe("OTHER");
    expect(mimeOf({ type: "image/png", name: "a.jpg" })).toBe("image/png");
  });

  it("labels the extension for thumbnails", () => {
    expect(extensionLabel("so-ho-khau.pdf")).toBe("PDF");
    expect(extensionLabel(".bashrc")).toBe("");
    expect(extensionLabel("anh")).toBe("");
  });
});
