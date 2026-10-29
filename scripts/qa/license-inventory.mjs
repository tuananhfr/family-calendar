import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = resolve(root, "qa-output/implementation/2026-10-13-v1-01");
const packages = [];
const locks = [];
for (const app of ["frontend", "backend", "e2e"]) {
  const bytes = await readFile(resolve(root, app, "package-lock.json"));
  const lock = JSON.parse(bytes.toString("utf8"));
  locks.push({ path: app + "/package-lock.json", sha256: createHash("sha256").update(bytes).digest("hex") });
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path) continue;
    const name = entry.name ?? path.slice(path.lastIndexOf("node_modules/") + 13);
    packages.push({ app, path, name, version: entry.version, licenseDeclared: entry.license ?? null, developmentOnly: entry.dev === true, optional: entry.optional === true, integrity: entry.integrity ?? null, purl: `pkg:npm/${name.replace("@", "%40")}@${entry.version}` });
  }
}
const inventory = { generatedAt: new Date().toISOString(), provenance: "package-lock metadata; includes development and optional dependencies", legalApproval: "NOT_RUN", limitations: "Declared licenses are an inventory, not proof of source ownership, notices compliance or trademark clearance. Review deployed artifacts and static assets separately.", locks, packages, missingDeclaredLicense: packages.filter((entry) => !entry.licenseDeclared).map(({ app, name, version }) => ({ app, name, version })) };
await mkdir(output, { recursive: true });
await writeFile(resolve(output, "license-inventory.json"), JSON.stringify(inventory, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ packages: packages.length, missingDeclaredLicense: inventory.missingDeclaredLicense.length, legalApproval: inventory.legalApproval }));
