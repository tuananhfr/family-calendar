// Requires a completed frontend production build. Uses a real static server and a fixture health API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { checkDeployment } from "./check-deployment.mjs";
import { verifyAndroidDownload } from "../frontend/scripts/verify-android-download.mjs";

for (const basePath of ["", "/lich-gia-dinh"]) {
test(
  `checks a real APK download at ${basePath || "/"} and catches an unhealthy backend`,
  { timeout: 30_000 },
  async () => {
    let healthy = true;
    const api = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", db: healthy ? "ok" : "down" }));
    });
    await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
    const processHandle = spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL("../frontend/scripts/serve-prod.mjs", import.meta.url),
        ),
      ],
      {
        env: {
          ...process.env,
          HOST: "127.0.0.1",
          PORT: "0",
          BASE_PATH: basePath,
          API_TARGET: `http://127.0.0.1:${api.address().port}`,
        },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    try {
      const url = await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Static test server did not start")),
          10_000,
        );
        let output = "";
        processHandle.stdout.on("data", (chunk) => {
          output += chunk;
          const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
          if (match) {
            clearTimeout(timer);
            resolve(match[0] + basePath + "/");
          }
        });
        processHandle.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        processHandle.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Static test server exited with ${code}`));
        });
      });
      const result = await checkDeployment(url, true);
      const release = await verifyAndroidDownload();
      assert.equal(result.version, release.versionName);
      assert.equal(result.bytes, release.bytes);
      healthy = false;
      await assert.rejects(
        checkDeployment(url, true),
        /Backend\/database health check failed/,
      );
    } finally {
      if (processHandle.exitCode === null) {
        const exited = once(processHandle, "exit");
        processHandle.kill();
        await exited;
      }
      api.closeAllConnections();
      await new Promise((resolve) => api.close(resolve));
    }
  },
);
}

test("rejects public HTTP endpoints before attempting a connection", async () => {
  await assert.rejects(
    checkDeployment("http://calendar.test/lich-gia-dinh"),
    /must use HTTPS/,
  );
  await assert.rejects(
    checkDeployment("http://calendar.test/lich-gia-dinh", true),
    /must use HTTPS/,
  );
});
