// The only module allowed to read build-time env, so configuration has one audit point.

/** "" at the domain root, "/lich-gia-dinh" when served under a sub-path (fixed at build time). */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");

const siteOrigin = new URL(process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://lpc.vn");
if (!["http:", "https:"].includes(siteOrigin.protocol) || siteOrigin.pathname !== "/" || siteOrigin.search || siteOrigin.hash || siteOrigin.username || siteOrigin.password) {
  throw new Error("NEXT_PUBLIC_SITE_ORIGIN must be an HTTP(S) origin without a path, query, or credentials");
}

export const appConfig = {
  basePath,
  siteOrigin: siteOrigin.origin,
  apiBase: `${basePath}/api/v1`,
  appName: "Lịch Gia Đình",
  defaultTimeZone: "Asia/Ho_Chi_Minh",
  buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
} as const;

/** Next only prefixes `<Link>`/router URLs; raw URLs (image src, icons, location.replace, notification targets) need this. */
export function withBase(path: string): string {
  return `${basePath}${path}`;
}

/** Public metadata URLs include the deployment sub-path exactly once. */
export function siteUrl(path: string): string {
  return new URL(withBase(path), appConfig.siteOrigin).href;
}
