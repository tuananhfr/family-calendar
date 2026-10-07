import { afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { isUuid, newId } from "./ids";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 10,000 distinct UUID v4 values", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const id = newId();
      expect(id).toMatch(UUID_V4);
      ids.add(id);
    }
    expect(ids.size).toBe(10_000);
  });

  it("falls back to getRandomValues when randomUUID is missing (plain http on a LAN IP)", () => {
    const getRandomValues = vi.fn((a: Uint8Array) => webcrypto.getRandomValues(a));
    vi.stubGlobal("crypto", { getRandomValues });
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = newId();
      expect(id).toMatch(UUID_V4);
      ids.add(id);
    }
    expect(ids.size).toBe(1000);
    expect(getRandomValues).toHaveBeenCalled();
  });

  it("isUuid accepts any RFC 4122 uuid and rejects junk", () => {
    expect(isUuid(newId())).toBe(true);
    expect(isUuid("6F9619FF-8B86-1011-B42D-00C04FC964FF")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});
