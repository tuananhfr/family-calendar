import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadProductionConfig } from "./check-production-config.mjs";

export async function checkDeployment(input, allowLocal = false) {
  const root = new URL(input);
  if (root.search || root.hash || root.username || root.password)
    throw new Error(
      "Deployment URL must not contain credentials, a query or a fragment.",
    );
  if (
    root.protocol !== "https:" &&
    !(
      allowLocal &&
      root.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(root.hostname)
    )
  )
    throw new Error("The deployed website must use HTTPS.");
  const base = root.href.replace(/\/+$/, "");
  const get = async (path) => {
    const response = await fetch(base + path, {
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response;
  };
  const health = await (await get("/api/v1/health")).json();
  if (health.status !== "ok" || health.db !== "ok")
    throw new Error("Backend/database health check failed.");
  const guide = await get("/tai-ung-dung/");
  if (!(await guide.text()).includes("Tải ứng dụng Android"))
    throw new Error("Android installation guide is missing.");
  const release = await (await get("/downloads/android-release.json")).json();
  if (
    release.applicationId !== "vn.lichgiadinh.screentime" ||
    release.buildType !== "release" ||
    release.fileName !== "lich-gia-dinh-screen-time.apk"
  )
    throw new Error(
      "The deployed Android artifact must be the signed release package.",
    );
  const response = await get("/downloads/" + release.fileName);
  if (
    !response.headers
      .get("content-type")
      ?.startsWith("application/vnd.android.package-archive") ||
    !response.headers.get("content-disposition")?.startsWith("attachment;")
  )
    throw new Error("APK download headers are incorrect.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (
    bytes.length !== release.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== release.sha256
  )
    throw new Error(
      "Downloaded APK does not match its published size/SHA-256.",
    );
  return { url: base, version: release.versionName, bytes: bytes.length };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const input =
      process.argv.slice(2).find((arg) => !arg.startsWith("--")) ??
      (await loadProductionConfig()).url;
    const result = await checkDeployment(
      input,
      process.argv.includes("--allow-local"),
    );
    console.log(
      `Deployment checks passed: ${result.url}; signed Android ${result.version}, ${result.bytes} bytes.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
