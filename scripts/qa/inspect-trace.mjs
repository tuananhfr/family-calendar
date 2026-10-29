import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { unzipSync, strFromU8 } = require("fflate");
const files = unzipSync(readFileSync(process.argv[2]));
for (const [name, bytes] of Object.entries(files)) {
  if (!name.endsWith(".network")) continue;
  for (const line of strFromU8(bytes).trim().split("\n")) {
    if (!line.trim()) continue;
    const value = JSON.parse(line).snapshot;
    if (value?.response?.status < 400 || !value?.request?.url?.includes("/api/v1/")) continue;
    const hash = value.response.content?._sha1;
    console.log(JSON.stringify({ method: value.request.method, path: new URL(value.request.url).pathname, status: value.response.status, body: files["resources/" + hash] ? strFromU8(files["resources/" + hash]) : null }));
  }
}
