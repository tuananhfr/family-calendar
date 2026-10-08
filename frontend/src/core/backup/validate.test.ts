import { readFileSync } from "node:fs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/db";
import { seedBackupSpace } from "../test-support/backup-seed";
import { exportBackup } from "./export";
import { sha256Hex, type BackupManifest } from "./format";
import { validateBackup } from "./validate";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function fixture(name: string): Blob {
  const b64 = readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
  return new Blob([Buffer.from(b64.trim(), "base64")], { type: "application/zip" });
}

/** Rewrites a backup; with `fixChecksums` the manifest is updated so only the content change is tested. */
async function rewrite(
  zip: Blob,
  mutate: (files: Record<string, Uint8Array>, manifest: BackupManifest) => void,
  fixChecksums = true,
): Promise<Blob> {
  const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  const manifest = JSON.parse(strFromU8(files["manifest.json"])) as BackupManifest;
  mutate(files, manifest);
  if (fixChecksums) {
    for (const path of Object.keys(manifest.dataSha256)) manifest.dataSha256[path] = await sha256Hex(files[path]);
  }
  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  return new Blob([zipSync(files)]);
}

async function seededZip() {
  const s = await seedBackupSpace();
  return { s, zip: await exportBackup(s.spaceId, { includeAudio: true, includeFiles: true, actor: s.actor }) };
}

describe("validateBackup", () => {
  it("accepts its own export and previews counts and privacy", async () => {
    const { s, zip } = await seededZip();
    const result = await validateBackup(zip);
    if (!result.ok) throw new Error(result.message);
    expect(result.manifest.spaceIds).toEqual([s.spaceId]);
    expect(result.preview).toMatchObject({
      spaceNames: ["Nhà Minh"],
      counts: expect.objectContaining({ items: 4, members: 2 }),
      privateCount: 1,
      sensitiveCount: 1,
      includesAudio: true,
      includesFiles: true,
      missingBlobCount: 0,
      existingSpaceIds: [s.spaceId],
      conflicts: [],
    });
  });

  it("previews missing audio and files when they were left out", async () => {
    const s = await seedBackupSpace();
    const zip = await exportBackup(s.spaceId, { includeAudio: false, includeFiles: false, actor: s.actor });
    const result = await validateBackup(zip);
    expect(result.ok && result.preview.missingBlobCount).toBe(2);
  });

  it("rejects files that are not backups", async () => {
    expect(await validateBackup(new Blob(["hello"]))).toMatchObject({ ok: false, code: "NOT_A_BACKUP" });
    expect(await validateBackup(new Blob([zipSync({ "readme.txt": strToU8("x") })]))).toMatchObject({ ok: false, code: "NOT_A_BACKUP" });
    const other = new Blob([zipSync({ "manifest.json": strToU8(JSON.stringify({ format: "something-else" })) })]);
    expect(await validateBackup(other)).toMatchObject({ ok: false, code: "NOT_A_BACKUP" });
  });

  it("v1-valid fixture is accepted", async () => {
    const result = await validateBackup(fixture("v1-valid.zip.b64"));
    expect(result.ok).toBe(true);
  });

  it("a backup from a newer app version → NEWER_VERSION (Review Focus #5)", async () => {
    expect(await validateBackup(fixture("v99-future.zip.b64"))).toMatchObject({ ok: false, code: "NEWER_VERSION" });
    const { zip } = await seededZip();
    const newerDb = await rewrite(zip, (_f, m) => {
      m.dbSchemaVersion = 3;
    });
    expect(await validateBackup(newerDb)).toMatchObject({ ok: false, code: "NEWER_VERSION" });
  });

  it("a truncated file → CORRUPTED", async () => {
    expect(await validateBackup(fixture("truncated.zip.b64"))).toMatchObject({ ok: false, code: "CORRUPTED" });
  });

  it("a blob or data file that changed → CHECKSUM_MISMATCH", async () => {
    const { s, zip } = await seededZip();
    const badBlob = await rewrite(zip, (files) => {
      files[`blobs/${s.ids.audioBlob}`] = new Uint8Array([9, 9, 9, 9]);
    });
    expect(await validateBackup(badBlob)).toMatchObject({ ok: false, code: "CHECKSUM_MISMATCH" });

    const badData = await rewrite(
      zip,
      (files) => {
        files["data/items.json"] = strToU8(strFromU8(files["data/items.json"]).replace("Đưa bé đi học", "Đưa bé đi chơi"));
      },
      false,
    );
    expect(await validateBackup(badData)).toMatchObject({ ok: false, code: "CHECKSUM_MISMATCH" });

    const missingBlob = await rewrite(zip, (files) => {
      delete files[`blobs/${s.ids.fileBlob}`];
    });
    expect(await validateBackup(missingBlob)).toMatchObject({ ok: false, code: "CHECKSUM_MISMATCH" });
  });

  it("broken relations or invalid records → CORRUPTED", async () => {
    const { zip } = await seededZip();
    const orphanRule = await rewrite(zip, (files) => {
      const rules = JSON.parse(strFromU8(files["data/reminderRules.json"])) as Array<Record<string, unknown>>;
      rules[0].itemId = "00000000-0000-4000-8000-000000000000";
      files["data/reminderRules.json"] = strToU8(JSON.stringify(rules));
    });
    expect(await validateBackup(orphanRule)).toMatchObject({ ok: false, code: "CORRUPTED" });

    const invalidItem = await rewrite(zip, (files) => {
      const items = JSON.parse(strFromU8(files["data/items.json"])) as Array<Record<string, unknown>>;
      items[0].title = "";
      files["data/items.json"] = strToU8(JSON.stringify(items));
    });
    expect(await validateBackup(invalidItem)).toMatchObject({ ok: false, code: "CORRUPTED" });

    const wrongCount = await rewrite(zip, (_f, m) => {
      m.counts.items = 99;
    });
    expect(await validateBackup(wrongCount)).toMatchObject({ ok: false, code: "CORRUPTED" });
  });

  it("refuses files over the size limit before unzipping", async () => {
    const { zip } = await seededZip();
    expect(await validateBackup(zip, { maxBytes: 100 })).toMatchObject({ ok: false, code: "TOO_LARGE" });
  });
});
