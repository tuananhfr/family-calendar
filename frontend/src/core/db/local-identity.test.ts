import { beforeEach, describe, expect, it } from "vitest";
import { isUuid } from "../ids";
import { db } from "./db";
import { getLocalIdentity } from "./local-identity";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("getLocalIdentity", () => {
  it("creates the actor/device ids once and returns the same ids afterwards", async () => {
    const first = await getLocalIdentity();
    expect(isUuid(first.actorId)).toBe(true);
    expect(isUuid(first.deviceId)).toBe(true);
    expect(first.actorId).not.toBe(first.deviceId);
    expect(await getLocalIdentity()).toEqual(first);

    db.close();
    await db.open();
    expect(await getLocalIdentity()).toEqual(first);
  });

  it("concurrent first calls agree on one identity", async () => {
    const results = await Promise.all([getLocalIdentity(), getLocalIdentity(), getLocalIdentity()]);
    expect(new Set(results.map((r) => r.actorId)).size).toBe(1);
    expect(await db.localIdentity.count()).toBe(1);
  });
});
