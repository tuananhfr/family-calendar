// The only module allowed to read build-time env, so configuration has one audit point.

/** "" at the domain root, "/lich-gia-dinh" when served under a sub-path (fixed at build time). */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");

export const appConfig = {
  basePath,
  apiBase: `${basePath}/api/v1`,
  appName: "Lịch Gia Đình",
  defaultTimeZone: "Asia/Ho_Chi_Minh",
  buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
} as const;

/** Next only prefixes `<Link>`/router URLs; raw URLs (image src, icons, location.replace, notification targets) need this. */
export function withBase(path: string): string {
  return `${basePath}${path}`;
}
