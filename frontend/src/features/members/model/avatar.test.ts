import { describe, expect, it } from "vitest";
import { avatarValue, defaultPresetFor, MAX_AVATAR_BYTES, parseAvatar, validateAvatarFile } from "./avatar";

describe("avatar values", () => {
  it("round-trips preset and blob references", () => {
    expect(parseAvatar(avatarValue({ kind: "preset", preset: "girl" }))).toEqual({ kind: "preset", preset: "girl" });
    expect(parseAvatar(avatarValue({ kind: "blob", id: "abc" }))).toEqual({
      kind: "blob",
      id: "abc",
    });
  });

  it("treats unknown or empty values as no avatar", () => {
    expect(parseAvatar(undefined)).toBeNull();
    expect(parseAvatar("preset:dragon")).toBeNull();
    expect(parseAvatar("http://example.com/a.png")).toBeNull();
  });

  it("picks a default illustration per relationship", () => {
    expect(defaultPresetFor("FATHER")).toBe("father");
    expect(defaultPresetFor("DAUGHTER")).toBe("girl");
    expect(defaultPresetFor("GRANDMOTHER")).toBe("grandmother");
    expect(defaultPresetFor("OTHER")).toBeUndefined();
  });
});

describe("validateAvatarFile", () => {
  it("accepts JPG, PNG and WebP up to 5 MB", () => {
    expect(validateAvatarFile({ type: "image/png", size: MAX_AVATAR_BYTES })).toBeNull();
    expect(validateAvatarFile({ type: "image/webp", size: 10 })).toBeNull();
  });

  it("rejects other types and larger files", () => {
    expect(validateAvatarFile({ type: "image/gif", size: 10 })).toBe("FILE_TYPE");
    expect(validateAvatarFile({ type: "image/jpeg", size: MAX_AVATAR_BYTES + 1 })).toBe("FILE_TOO_LARGE");
  });
});
