import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/db";
import type { BaseRecord } from "../sync/resource-types";
import { getActive, listActive, listActiveByItem, listSpaces } from "./read";

function rec(id: string, spaceId: string, extra: Record<string, unknown> = {}): BaseRecord & Record<string, unknown> {
  return {
    id,
    spaceId,
    createdByActorId: "a",
    dataClass: "NORMAL",
    sharingScope: "FAMILY_ALL",
    revision: null,
    createdAt: "2026-10-06T00:00:00.000Z",
    updatedAt: "2026-10-06T00:00:00.000Z",
    deletedAt: null,
    syncState: "LOCAL",
    ...extra,
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("read", () => {
  it("lists only live records of one space", async () => {
    await db.items.bulkPut([
      rec("a", "s1"),
      rec("b", "s1", { deletedAt: "2026-10-06T01:00:00.000Z" }),
      rec("c", "s2"),
    ] as never);
    expect((await listActive("item", "s1")).map((r) => r.id)).toEqual(["a"]);
    expect(await getActive("item", "a")).toMatchObject({ id: "a" });
    expect(await getActive("item", "b")).toBeUndefined();
    expect(await getActive("item", "zzz")).toBeUndefined();
  });

  it("lists child records of an item", async () => {
    await db.itemExceptions.bulkPut([
      rec("e1", "s1", { itemId: "i1" }),
      rec("e2", "s1", { itemId: "i2" }),
      rec("e3", "s1", { itemId: "i1", deletedAt: "2026-10-06T01:00:00.000Z" }),
    ] as never);
    expect((await listActiveByItem("item_exception", "i1")).map((r) => r.id)).toEqual(["e1"]);
  });

  it("lists spaces that are not deleted", async () => {
    await db.spaces.bulkPut([
      rec("s1", "s1", { kind: "FAMILY", name: "A", sharingState: "LOCAL", timeZone: "Asia/Ho_Chi_Minh" }),
      rec("s2", "s2", { kind: "GROUP", name: "B", sharingState: "LOCAL", timeZone: "Asia/Ho_Chi_Minh", deletedAt: "x" }),
    ] as never);
    expect((await listSpaces()).map((s) => s.id)).toEqual(["s1"]);
  });
});
