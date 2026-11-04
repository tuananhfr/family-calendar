import { defineConfig } from "@playwright/test";
const basePath = (process.env.E2E_SCREEN_TIME_BASE_PATH ?? "/lich-gia-dinh").replace(/\/+$/, "");

// Browser behavior uses scoped API fixtures. Real authorization/ingest is covered by backend integration tests.
export default defineConfig({
  testDir: "./sharing",
  testMatch: "screen-time.spec.ts",
  workers: 1,
  timeout: 120_000,
  outputDir: "./test-results/screen-time",
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3008",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1440, height: 900 },
    channel: process.env.E2E_CHANNEL || "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    cwd: "../frontend",
    command: "node scripts/serve-prod.mjs",
    url: `http://127.0.0.1:3008${basePath}/`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: "3008",
      HOST: "127.0.0.1",
      API_TARGET: "http://127.0.0.1:3007",
      BASE_PATH: basePath,
    },
  },
});
