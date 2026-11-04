import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { verifyAndroidDownload } from "../frontend/scripts/verify-android-download.mjs";

test("checks actual release download integrity", async () => {
  const release = await verifyAndroidDownload();
  assert.equal(release.buildType, "release");
  assert.ok(release.bytes > 1000);
});

test("rejects stale APK bytes and debug metadata before a frontend build", async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, "calendar-apk-test-"));
  const bytes = Buffer.from("PK\x03\x04example");
  const metadata = {
    applicationId: "vn.lichgiadinh.screentime",
    buildType: "release",
    fileName: "lich-gia-dinh-screen-time.apk",
    minAndroid: "10",
    versionName: "0.1.0",
    versionCode: 1,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    signingCertificateSha256: "a".repeat(64),
  };
  try {
    await writeFile(join(directory, metadata.fileName), bytes);
    await writeFile(
      join(directory, "android-release.json"),
      JSON.stringify(metadata),
    );
    await verifyAndroidDownload(directory);
    await writeFile(
      join(directory, metadata.fileName),
      Buffer.from("PK\x03\x04changed"),
    );
    await assert.rejects(verifyAndroidDownload(directory), /stale or corrupt/);
    await writeFile(
      join(directory, "android-release.json"),
      JSON.stringify({ ...metadata, buildType: "debug" }),
    );
    await assert.rejects(
      verifyAndroidDownload(directory),
      /Invalid Android release/,
    );
  } finally {
    const target = resolve(directory);
    assert.equal(dirname(target), temporaryRoot);
    assert.ok(basename(target).startsWith("calendar-apk-test-"));
    await rm(target, { recursive: true, force: true });
  }
});
