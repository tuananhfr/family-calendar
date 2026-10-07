import { strFromU8, unzipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";
import { accessContextFor } from "../access/evaluate";
import { db } from "../db/db";
import { newId } from "../ids";
import { OUTBOX_MARKER, SECRET_SETTING_VALUE, seedBackupSpace } from "../test-support/backup-seed";
import { BackupError, exportBackup } from "./export";
import { BACKUP_FORMAT, sha256Hex, type BackupManifest } from "./format";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function unzip(blob: Blob) {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}

function manifestOf(files: Record<string, Uint8Array>): BackupManifest {
  return JSON.parse(strFromU8(files["manifest.json"])) as BackupManifest;
}

function rows(files: Record<string, Uint8Array>, store: string): Array<Record<string, unknown>> {
  return JSON.parse(strFromU8(files[`data/${store}.json`])) as Array<Record<string, unknown>>;
}

describe("exportBackup", () => {
  it("writes a manifest, one JSON file per store and the selected blobs", async () => {
    const s = await seedBackupSpace();
    const zip = await exportBackup(s.spaceId, { includeAudio: true, includeFiles: true, actor: s.actor });
    const files = await unzip(zip);
    const m = manifestOf(files);

    expect(m).toMatchObject({
      format: BACKUP_FORMAT,
      formatVersion: 1,
      dbSchemaVersion: 1,
      spaceIds: [s.spaceId],
      timeZone: "Asia/Ho_Chi_Minh",
      includesAudio: true,
      includesFiles: true,
    });
    expect(m.counts).toMatchObject({ spaces: 1, members: 2, items: 4, reminderRules: 1, itemExceptions: 1, occurrenceStates: 1, files: 1, folders: 1 });
    expect(rows(files, "items")).toHaveLength(4);
    expect(m.blobs.map((b) => b.id).sort()).toEqual([s.ids.audioBlob, s.ids.fileBlob].sort());
    for (const b of m.blobs) {
      expect(files[`blobs/${b.id}`]).toBeDefined();
      expect(b.sha256).toBe(await sha256Hex(files[`blobs/${b.id}`]));
      expect(b.size).toBe(files[`blobs/${b.id}`].length);
    }
  });

  it("never contains the local identity, outbox, session secrets or another actor's PRIVATE data", async () => {
    const s = await seedBackupSpace();
    const files = await unzip(await exportBackup(s.spaceId, { includeAudio: true, includeFiles: true, actor: s.actor }));
    const text = Object.entries(files)
      .filter(([path]) => !path.startsWith("blobs/"))
      .map(([, bytes]) => strFromU8(bytes))
      .join("\n");

    expect(Object.keys(files).filter((p) => /localIdentity|outbox|syncCursors|firedReminders|notifications/.test(p))).toEqual([]);
    expect(text).not.toContain(s.deviceId);
    expect(text).not.toContain(OUTBOX_MARKER);
    expect(text).not.toContain(SECRET_SETTING_VALUE);
    expect(text).not.toMatch(/recovery|cookie/i);
    expect(text).not.toContain(s.ids.privateOther);
    expect(text).not.toContain("Bí mật của người khác");
    expect(text).toContain("Quà sinh nhật vợ");
    expect(rows(files, "settings")).toEqual([{ key: "notifications.showDetails", value: false }]);
  });

  it("leaves audio and file contents out when not selected, and says so in the manifest", async () => {
    const s = await seedBackupSpace();
    const files = await unzip(await exportBackup(s.spaceId, { includeAudio: false, includeFiles: false, actor: s.actor }));
    const m = manifestOf(files);
    expect(m.includesAudio).toBe(false);
    expect(m.includesFiles).toBe(false);
    expect(m.blobs).toEqual([]);
    expect(Object.keys(files).some((p) => p.startsWith("blobs/"))).toBe(false);
    // The records stay so the preview can say which audio/files are missing.
    expect(rows(files, "items").map((i) => i.id)).toContain(s.ids.voice);
    expect(rows(files, "files").map((f) => f.id)).toEqual([s.ids.file]);
  });

  it("exports only what the actor may see", async () => {
    const s = await seedBackupSpace();
    const other = accessContextFor("OWNER", { actorId: newId(), representedMemberIds: [], representedProfiles: ["PARENT"], spaceKind: "FAMILY" });
    const files = await unzip(await exportBackup(s.spaceId, { includeAudio: true, includeFiles: true, actor: other }));
    const ids = rows(files, "items").map((i) => i.id);
    expect(ids).not.toContain(s.ids.privateMine);
    expect(ids).not.toContain(s.ids.privateOther);
    expect(ids).toContain(s.ids.recurring);
  });

  it("refuses an actor without the backup capability", async () => {
    const s = await seedBackupSpace();
    const guest = accessContextFor("GUEST", { actorId: s.actorId, representedMemberIds: [], representedProfiles: [], spaceKind: "FAMILY" });
    await expect(exportBackup(s.spaceId, { includeAudio: true, includeFiles: true, actor: guest })).rejects.toBeInstanceOf(BackupError);
    await expect(exportBackup(newId(), { includeAudio: true, includeFiles: true, actor: s.actor })).rejects.toMatchObject({ code: "SPACE_NOT_FOUND" });
  });
});
