import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function verifyAndroidDownload(
  directory = fileURLToPath(new URL("../public/downloads/", import.meta.url)),
) {
  const manifest = JSON.parse(
    await readFile(resolve(directory, "android-release.json"), "utf8"),
  );
  if (
    manifest.applicationId !== "vn.lichgiadinh.screentime" ||
    manifest.buildType !== "release" ||
    manifest.fileName !== "lich-gia-dinh-screen-time.apk" ||
    !Number.isSafeInteger(manifest.versionCode) ||
    manifest.versionCode < 1 ||
    !/^\d+\.\d+\.\d+(?:[-.][\w.-]+)?$/.test(manifest.versionName) ||
    manifest.minAndroid !== "10" ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
    !/^[a-f0-9]{64}$/.test(manifest.signingCertificateSha256)
  ) {
    throw new Error(
      "Invalid Android release metadata. Publish a signed release with scripts/publish-android-apk.ps1.",
    );
  }
  const apk = await readFile(resolve(directory, manifest.fileName));
  if (
    apk.length !== manifest.bytes ||
    apk[0] !== 0x50 ||
    apk[1] !== 0x4b ||
    createHash("sha256").update(apk).digest("hex") !== manifest.sha256
  ) {
    throw new Error(
      "Android APK is missing, stale or corrupt. Republish it before building the website.",
    );
  }
  return manifest;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const release = await verifyAndroidDownload();
    console.log(
      `Android release verified: ${release.versionName} (${release.bytes} bytes)`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
