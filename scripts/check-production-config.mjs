import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyAndroidDownload } from "../frontend/scripts/verify-android-download.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const placeholder = (value) =>
  !value || /CHANGE_ME|example\.invalid/i.test(value);
const publicOrigin = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      !placeholder(value)
      ? url.origin
      : null;
  } catch {
    return null;
  }
};

export function validateProductionConfig(backend, frontend) {
  const issues = [];
  const origin = publicOrigin(frontend.NEXT_PUBLIC_SITE_ORIGIN);
  if (!origin)
    issues.push(
      "frontend.NEXT_PUBLIC_SITE_ORIGIN must be the public HTTPS origin without a path.",
    );
  const basePath = (frontend.NEXT_PUBLIC_BASE_PATH ?? "")
    .trim()
    .replace(/\/+$/, "");
  if (!/^(?:\/[a-zA-Z0-9_-]+)*$/.test(basePath))
    issues.push("frontend.NEXT_PUBLIC_BASE_PATH is invalid.");
  if ((backend.PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "") !== basePath)
    issues.push("Backend and frontend base paths must match.");
  if (
    frontend.BASE_PATH !== undefined &&
    frontend.BASE_PATH.replace(/\/+$/, "") !== basePath
  )
    issues.push("frontend.BASE_PATH must match NEXT_PUBLIC_BASE_PATH.");
  if (backend.COOKIE_SECURE !== "true")
    issues.push("backend.COOKIE_SECURE must be true.");
  if (backend.HOST !== "127.0.0.1" || backend.PORT !== "3005")
    issues.push(
      "Bind backend to 127.0.0.1:3005 for the documented reverse proxy.",
    );
  if (!origin || publicOrigin(backend.API_ORIGIN) !== origin)
    issues.push("backend.API_ORIGIN must match the public website origin.");
  const origins = (backend.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (
    !origin ||
    !origins.some((v) => publicOrigin(v) === origin) ||
    origins.some((v) => !publicOrigin(v))
  )
    issues.push(
      "backend.FRONTEND_ORIGIN must include the website HTTPS origin and contain only public HTTPS origins.",
    );
  if (backend.NODE_ENV !== "production")
    issues.push("backend.NODE_ENV must be production.");
  for (const key of ["DB_HOST", "DB_NAME", "DB_USER"])
    if (placeholder(backend[key]))
      issues.push(`backend.${key} must be configured.`);
  if (backend.DB_USER?.toLowerCase() === "root")
    issues.push("Use a dedicated database user instead of root.");
  if (
    !/^\d+$/.test(backend.DB_PORT ?? "") ||
    Number(backend.DB_PORT) < 1 ||
    Number(backend.DB_PORT) > 65535
  )
    issues.push("backend.DB_PORT is invalid.");
  if (placeholder(backend.DB_PASSWORD) || backend.DB_PASSWORD.length < 12)
    issues.push(
      "backend.DB_PASSWORD must be a configured password of at least 12 characters.",
    );
  if (
    !/^[a-f\d]{64}$/i.test(backend.STORAGE_MASTER_KEY ?? "") ||
    /^([a-f\d])\1{63}$/i.test(backend.STORAGE_MASTER_KEY)
  )
    issues.push(
      "Configure the existing STORAGE_MASTER_KEY, or generate one only for a new installation.",
    );
  if (!backend.STORAGE_DIR?.startsWith("/") || placeholder(backend.STORAGE_DIR))
    issues.push("backend.STORAGE_DIR must be an absolute server path.");
  if (backend.RUN_WORKER_IN_PROCESS !== "false")
    issues.push(
      "backend.RUN_WORKER_IN_PROCESS must be false when using the separate worker service.",
    );
  if (backend.MAIL_TRANSPORT !== "smtp")
    issues.push(
      "Configure MAIL_TRANSPORT=smtp so account verification works on real devices.",
    );
  try {
    const smtp = new URL(backend.SMTP_URL);
    if (
      !["smtp:", "smtps:"].includes(smtp.protocol) ||
      !smtp.hostname ||
      placeholder(backend.SMTP_URL)
    )
      throw new Error();
  } catch {
    issues.push(
      "Configure a real SMTP_URL; its value is never printed by this check.",
    );
  }
  if (
    placeholder(backend.MAIL_FROM) ||
    !/@[^\s>]+\.[^\s>]+/.test(backend.MAIL_FROM) ||
    /\.local(?:>|$)/i.test(backend.MAIL_FROM)
  )
    issues.push("Configure MAIL_FROM with your verified sending address.");
  if (issues.length)
    throw new Error(
      "Production configuration is not ready:\n- " + issues.join("\n- "),
    );
  return { origin, basePath, url: origin + basePath };
}

export async function loadProductionConfig() {
  const backend = parseEnv(
    await readFile(resolve(repo, "backend/.env"), "utf8"),
  );
  const frontend = parseEnv(
    await readFile(resolve(repo, "frontend/.env.local"), "utf8"),
  );
  return validateProductionConfig(backend, frontend);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const [major, minor] = process.versions.node.split(".").map(Number);
    if (major !== 24 || minor < 14)
      throw new Error(
        "Use Node 24.14 or later within Node 24, as required by this repository.",
      );
    await verifyAndroidDownload();
    const config = await loadProductionConfig();
    console.log(
      `Production configuration and Android download verified for ${config.url}`,
    );
  } catch (error) {
    console.error(
      error.code === "ENOENT"
        ? "Missing backend/.env, frontend/.env.local or published Android APK. See deployment/README.md."
        : error.message,
    );
    process.exitCode = 1;
  }
}
