import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

const DIGEST = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function filesUnder(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`Fingerprint refuses symlink: ${path}`);
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) out.push(...await filesUnder(child));
    else if (entry.isFile()) out.push(child);
  }
  return out;
}

export async function fingerprint(root, mode = "source") {
  const paths = mode === "build" ? ["frontend/out", "backend/dist"] : ["frontend/src", "frontend/scripts", "frontend/public", "backend/src", "backend/test", "e2e/tests", "e2e/sharing", "e2e/helpers", "scripts/qa"];
  const files = (await Promise.all(paths.map((path) => filesUnder(resolve(root, path))))).flat();
  if (mode === "source") for (const path of ["frontend/package.json", "frontend/package-lock.json", "frontend/next.config.ts", "frontend/vitest.config.ts", "backend/package.json", "backend/package-lock.json", "backend/jest.int.config.ts", "e2e/package.json", "e2e/package-lock.json", "e2e/playwright.config.ts", "e2e/sharing.config.ts"]) files.push(resolve(root, path));
  const entries = await Promise.all([...new Set(files)].sort().map(async (path) => ({ path: relative(root, path).replaceAll("\\", "/"), sha256: DIGEST(await readFile(path)) })));
  return { hash: DIGEST(entries.map((entry) => `${entry.path}\0${entry.sha256}\n`).join("")), files: entries };
}
