import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // Pin the zone so date tests behave the same on every machine; tests that need another zone spawn a child process.
    env: { TZ: "Asia/Ho_Chi_Minh" },
  },
});
