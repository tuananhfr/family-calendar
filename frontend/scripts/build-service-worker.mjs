import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative } from "node:path";
import { pwaVi } from "../src/i18n/sections/pwa.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "out");
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (/\.(?:html|txt|js|css|woff2?|png|webp|svg|ico|webmanifest)$/.test(entry.name) && !["sw.js", "404.html"].includes(entry.name)) files.push(path);
  }
}
await walk(output);
const digest = createHash("sha256");
const urls = [];
for (const path of files.sort()) {
  const name = relative(output, path).replaceAll("\\", "/");
  digest.update(name).update(await readFile(path));
  const url = basePath + "/" + name.split("/").map(encodeURIComponent).join("/");
  urls.push(url);
  if (name.endsWith("index.html")) urls.push(url.slice(0, -"index.html".length));
}
const worker = await readFile(resolve(root, "src/core/pwa/worker.js"), "utf8");
digest.update(worker);
const version = digest.digest("hex").slice(0, 20);
const config = { basePath, version, assets: [...new Set(urls)].sort(), messages: { title: pwaVi.notificationTitle, body: pwaVi.notificationBody, sosBody: pwaVi.sosNotificationBody } };
await writeFile(resolve(output, "sw.js"), "self.__FC_PWA__ = " + JSON.stringify(config) + ";\n" + worker, "utf8");
await writeFile(resolve(output, "pwa-build.json"), JSON.stringify({ basePath, version, assets: config.assets.length }) + "\n", "utf8");
console.log(`PWA shell ${version}: ${config.assets.length} static URLs, scope ${basePath || "/"}`);
