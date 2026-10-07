import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { db, type LocalIdentityRow } from "../db/db";
import { getLocalIdentity } from "../db/local-identity";
import { createLocalSpace, saveResource } from "../repo/write";
import { seedBackupSpace, snapshotDb } from "../test-support/backup-seed";
import { makeItem } from "../test-support/items";
import { baseFields } from "../test-support/records";
import { RESOURCE_STORE } from "../sync/resource-types";
import { exportBackup } from "./export";
import { restoreBackup } from "./restore";
import { validateBackup } from "./validate";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function fixture(name: string): Blob {
  const b64 = readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
  return new Blob([Buffer.from(b64.trim(), "base64")], { type: "application/zip" });
}

const BACKED_UP = [...Object.values(RESOURCE_STORE), "blobs", "emergencyContacts", "settings"];

function pick(snapshot: Record<string, unknown[]>, stores: string[]) {
  return Object.fromEntries(stores.map((s) => [s, snapshot[s]]));
}

async function freshDevice(keep?: LocalIdentityRow) {
  await db.delete();
  await db.open();
  if (keep) await db.localIdentity.put(keep);
}

async function exportAll() {
  const s = await seedBackupSpace();
  const zip = await exportBackup(s.spaceId, { includeAudio: true, includeFiles: true, actor: s.actor });
  return { s, zip };
}

describe("restoreBackup REPLACE", () => {
  it("round-trips members, items, exceptions, states, rules, settings, audio and files (BKP-001)", async () => {
    const { s, zip } = await exportAll();
    const before = await snapshotDb();
    before.items = before.items.filter((i) => (i as { id: string }).id !== s.ids.privateOther);
    before.settings = before.settings.filter((r) => (r as { key: string }).key !== "auth.sessionToken");
    const identity = (await db.localIdentity.get("self"))!;

    await freshDevice(identity);
    const report = await restoreBackup(zip, "REPLACE");
    expect(report).toMatchObject({ ok: true, status: "RESTORED" });

    expect(pick(await snapshotDb(), BACKED_UP)).toEqual(pick(before, BACKED_UP));
  });

  it("on a new device the restoring actor takes over the exporter's records, PRIVATE ones included", async () => {
    const { s, zip } = await exportAll();
    await freshDevice();
    const { actorId } = await getLocalIdentity();
    await restoreBackup(zip, "REPLACE");

    const mine = await db.items.get(s.ids.privateMine);
    expect(mine?.createdByActorId).toBe(actorId);
    expect((await db.members.toArray()).find((m) => m.displayName === "Bố")?.linkedActorId).toBe(actorId);
    expect(await db.items.filter((i) => i.createdByActorId === s.actorId).count()).toBe(0);
  });

  it("creates no outbox, keeps the Space LOCAL and drops server revisions", async () => {
    const s = await seedBackupSpace();
    await db.spaces.update(s.spaceId, { sharingState: "SHARED", revision: "r9", syncState: "SYNCED" });
    await db.items.update(s.ids.recurring, { revision: "r3", syncState: "SYNCED" });
    const zip = await exportBackup(s.spaceId, { includeAudio: true, includeFiles: true, actor: s.actor });

    await freshDevice();
    await restoreBackup(zip, "REPLACE");
    expect(await db.outbox.count()).toBe(0);
    expect(await db.spaces.get(s.spaceId)).toMatchObject({ sharingState: "LOCAL", revision: null, syncState: "LOCAL" });
    expect(await db.items.get(s.ids.recurring)).toMatchObject({ revision: null, syncState: "LOCAL" });
  });

  it("never replays an old SOS: ACTIVE events come back CLOSED_ENDED with reason RESTORED", async () => {
    const { s, zip } = await exportAll();
    await freshDevice();
    await restoreBackup(zip, "REPLACE", undefined, { now: new Date("2026-10-07T03:00:00.000Z") });
    expect(await db.emergencyEvents.get(s.ids.activeSos)).toMatchObject({
      status: "CLOSED_ENDED",
      closeReason: "RESTORED",
      closedAt: "2026-10-07T03:00:00.000Z",
    });
  });

  it("replaces the whole Space but leaves other Spaces alone", async () => {
    const { s, zip } = await exportAll();
    const extra = await saveResource("item", makeItem({ ...baseFields({ spaceId: s.spaceId, createdByActorId: s.actorId }), title: "Thêm sau sao lưu" }), "create");
    const otherSpace = await createLocalSpace({ kind: "GROUP", name: "Lớp 3A" });
    const otherItem = await saveResource("item", makeItem({ ...baseFields({ spaceId: otherSpace, sharingScope: "GROUP_MEMBERS", createdByActorId: s.actorId }), title: "Họp lớp" }), "create");

    await restoreBackup(zip, "REPLACE");
    expect(await db.items.get(extra.id)).toBeUndefined();
    expect(await db.items.get(otherItem.id)).toBeDefined();
    expect(await db.spaces.get(otherSpace)).toBeDefined();
    expect(await db.outbox.where("spaceId").equals(s.spaceId).count()).toBe(0);
  });

  it("restores the committed v1 fixture into an empty database", async () => {
    const file = fixture("v1-valid.zip.b64");
    const v = await validateBackup(file);
    if (!v.ok) throw new Error(v.message);
    const report = await restoreBackup(file, "REPLACE");
    expect(report.ok).toBe(true);
    expect(await db.items.count()).toBe(v.manifest.counts.items);
    expect(await db.members.count()).toBe(v.manifest.counts.members);
  });
});

describe("restoreBackup leaves the database untouched on a bad file (Review Focus #5)", () => {
  it.each([
    ["v99-future.zip.b64", "NEWER_VERSION"],
    ["truncated.zip.b64", "CORRUPTED"],
  ])("%s → %s", async (name, code) => {
    await seedBackupSpace();
    const before = await snapshotDb();
    expect(await restoreBackup(fixture(name), "REPLACE")).toMatchObject({ ok: false, code });
    expect(await snapshotDb()).toEqual(before);
  });

  it("a checksum mismatch writes nothing", async () => {
    const { zip } = await exportAll();
    const bytes = new Uint8Array(await zip.arrayBuffer());
    // Flip one byte inside a stored (uncompressed) blob; the zip itself stays readable.
    const marker = new TextEncoder().encode("%PDF-1.4 hello");
    const at = bytes.findIndex((_, i) => marker.every((b, j) => bytes[i + j] === b));
    expect(at).toBeGreaterThan(0);
    bytes[at + 1] ^= 0xff;
    const before = await snapshotDb();
    expect(await restoreBackup(new Blob([bytes]), "REPLACE")).toMatchObject({ ok: false, code: "CHECKSUM_MISMATCH" });
    expect(await snapshotDb()).toEqual(before);
  });
});

describe("restoreBackup MERGE", () => {
  async function diverged() {
    const { s, zip } = await exportAll();
    await db.items.update(s.ids.recurring, { title: "Đưa bé đi học (đổi giờ)" });
    const son = (await db.members.toArray()).find((m) => m.displayName === "Bin")!;
    await db.members.delete(son.id);
    const localOnly = await saveResource("item", makeItem({ ...baseFields({ spaceId: s.spaceId, createdByActorId: s.actorId }), title: "Chỉ có trên máy" }), "create");
    return { s, zip, sonId: son.id, localOnlyId: localOnly.id };
  }

  it("lists same-id/different-content records as conflicts and writes nothing without resolutions", async () => {
    const { s, zip } = await diverged();
    const v = await validateBackup(zip);
    if (!v.ok) throw new Error(v.message);
    expect(v.preview.conflicts).toEqual([{ key: `items/${s.ids.recurring}`, store: "items", id: s.ids.recurring, label: "Đưa bé đi học" }]);

    const before = await snapshotDb();
    const report = await restoreBackup(zip, "MERGE");
    expect(report).toMatchObject({ ok: true, status: "NEEDS_RESOLUTION", conflicts: v.preview.conflicts });
    expect(await snapshotDb()).toEqual(before);
  });

  it("KEEP_LOCAL keeps the local version, adds what is missing and keeps local-only records", async () => {
    const { s, zip, sonId, localOnlyId } = await diverged();
    const report = await restoreBackup(zip, "MERGE", { [`items/${s.ids.recurring}`]: "KEEP_LOCAL" });
    expect(report).toMatchObject({ ok: true, status: "RESTORED" });
    expect((await db.items.get(s.ids.recurring))?.title).toBe("Đưa bé đi học (đổi giờ)");
    expect(await db.members.get(sonId)).toBeDefined();
    expect(await db.items.get(localOnlyId)).toBeDefined();
    expect(await db.outbox.where("spaceId").equals(s.spaceId).count()).toBe(1);
  });

  it("USE_BACKUP takes the backup version", async () => {
    const { s, zip } = await diverged();
    await restoreBackup(zip, "MERGE", { [`items/${s.ids.recurring}`]: "USE_BACKUP" });
    expect((await db.items.get(s.ids.recurring))?.title).toBe("Đưa bé đi học");
  });
});
