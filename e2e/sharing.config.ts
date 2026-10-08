import { defineConfig } from "@playwright/test";
const base = "/lich-gia-dinh";
export default defineConfig({
  testDir: "./sharing", testMatch: "*.spec.ts", workers: 1, timeout: 120_000,
  outputDir: "./test-results/sharing", reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3006", locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
    viewport: { width: 1440, height: 900 }, channel: process.env.E2E_CHANNEL || "chrome",
    trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    { name: "sharing-api", cwd: "../backend", command: "npm run start:e2e",
      url: "http://127.0.0.1:3007/api/v1/health", reuseExistingServer: false, timeout: 120_000,
      env: { PORT: "3007", HOST: "127.0.0.1", FRONTEND_ORIGIN: "http://127.0.0.1:3006",
        PUBLIC_BASE_PATH: base, MAIL_TRANSPORT: "file", MAIL_DIR: "var/e2e-mail", RUN_WORKER_IN_PROCESS: "false" } },
    { name: "sharing-ui", cwd: "../frontend", command: "npm run preview",
      url: "http://127.0.0.1:3006" + base + "/", reuseExistingServer: false, timeout: 30_000,
      env: { PORT: "3006", HOST: "127.0.0.1", API_TARGET: "http://127.0.0.1:3007", BASE_PATH: base } },
  ],
});
