import { writeFileSync } from "node:fs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, it } from "vitest";
import { db } from "../db/db";
import { seedBackupSpace } from "../test-support/backup-seed";
import { exportBackup } from "./export";

// Regenerates fixtures/*.zip.b64: UPDATE_BACKUP_FIXTURES=1 npx vitest run src/core/backup/fixtures.gen.test.ts
describe.skipIf(!process.env.UPDATE_BACKUP_FIXTURES)("backup fixtures", () => {
  it("writes v1-valid, v99-future and truncated", async () => {
    await db.delete();
    await db.open();
    const s = await seedBackupSpace();
    const valid = new Uint8Array(await (await exportBackup(s.spaceId, { includeAudio: true, includeFiles: true, actor: s.actor, now: new Date("2026-10-07T00:00:00.000Z") })).arrayBuffer());

    const files = unzipSync(valid);
    const manifest = JSON.parse(strFromU8(files["manifest.json"])) as Record<string, unknown>;
    files["manifest.json"] = strToU8(JSON.stringify({ ...manifest, formatVersion: 99, futureField: { anything: true } }, null, 2));
    const future = zipSync(files);

    const write = (name: string, bytes: Uint8Array) =>
      writeFileSync(new URL(`./fixtures/${name}`, import.meta.url), `${Buffer.from(bytes).toString("base64")}\n`);
    write("v1-valid.zip.b64", valid);
    write("v99-future.zip.b64", future);
    // Cut inside the central directory area: the local headers still look like a zip, the archive is incomplete.
    write("truncated.zip.b64", valid.slice(0, Math.floor(valid.length * 0.6)));
  });
});
