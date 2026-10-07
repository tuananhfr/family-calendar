import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const devApiTarget = process.env.DEV_API_TARGET ?? "http://127.0.0.1:3005";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");

if (basePath && !/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+$/.test(basePath)) {
  throw new Error("NEXT_PUBLIC_BASE_PATH must be empty or an absolute path without a trailing slash");
}

const nextConfig: NextConfig = {
  // Family data is private and lives in IndexedDB, so SSR adds nothing; a static SPA keeps offline/deep links simple.
  output: isProd ? "export" : undefined,
  basePath: basePath || undefined,
  trailingSlash: true,
  agentRules: false,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID ?? String(Date.now()),
  },
  // Rewrites are unsupported with static export; production relies on the reverse proxy for /api.
  ...(isProd
    ? {}
    : {
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${devApiTarget}/api/:path*` }];
        },
      }),
};

export default nextConfig;
