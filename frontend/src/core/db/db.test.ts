import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { RESOURCE_STORE } from "../sync/resource-types";
import { DB_SCHEMA_V1, FamilyDb } from "./db";

const opened: Dexie[] = [];

afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close();
    await Dexie.delete(d.name);
  }
});

describe("FamilyDb", () => {
  it("declares every resource store plus the local-only stores", async () => {
    const fdb = new FamilyDb("fc-test-stores");
    opened.push(fdb);
    await fdb.open();
    const names = fdb.tables.map((t) => t.name).sort();
    for (const store of new Set(Object.values(RESOURCE_STORE))) expect(names).toContain(store);
    for (const store of [
      "localIdentity",
      "spaces",
      "blobs",
      "outbox",
      "syncCursors",
      "settings",
      "notifications",
      "firedReminders",
      "emergencyEvents",
      "emergencyContacts",
    ]) {
      expect(names).toContain(store);
    }
  });

  it("keeps data when upgrading to a newer schema version", async () => {
    const name = "fc-test-upgrade";
    const v1 = new FamilyDb(name);
    await v1.open();
    await v1.table("items").put({ id: "i1", spaceId: "s1", title: "Họp phụ huynh", deletedAt: null });
    await v1.outbox.put({ operationId: "op1", spaceId: "s1", state: "QUEUED" } as never);
    v1.close();

    // Simulates a future release that only adds an index (no data migration).
    class FamilyDbV3 extends FamilyDb {
      constructor() {
        super(name);
        this.version(3).stores({ items: `${DB_SCHEMA_V1.items}, title` });
      }
    }
    const v2 = new FamilyDbV3();
    opened.push(v2);
    await v2.open();
    expect(v2.verno).toBe(3);
    expect(await v2.table("items").get("i1")).toMatchObject({ title: "Họp phụ huynh" });
    expect(await v2.table("items").where("title").equals("Họp phụ huynh").count()).toBe(1);
    expect(await v2.outbox.get("op1")).toMatchObject({ state: "QUEUED" });
  });
});
