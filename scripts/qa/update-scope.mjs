import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, formatCsv } from "./csv.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const scope = JSON.parse(await readFile(resolve(root, "scripts/qa/scope.json"), "utf8"));
const path = resolve(root, "docs/qa/audit-pack-v1/requirements.csv");
const { headers, records } = parseCsv(await readFile(path, "utf8"));
if (records.length !== 478 || new Set(records.map(({ id }) => id)).size !== 478) throw new Error("Requirement catalog identity changed");
for (const id of scope.deferredRequirements) if (!records.some((row) => row.id === id)) throw new Error(`Unknown deferred requirement: ${id}`);
for (const key of ["applicability", "scope_explanation"]) if (!headers.includes(key)) headers.push(key);
for (const record of records) {
  const deferred = scope.deferredRequirements.includes(record.id);
  record.applicability = deferred ? "DEFERRED_BY_OWNER" : "APPLICABLE";
  record.scope_explanation = deferred ? scope.deferredReason : "Approved remaining V1 scope on 2026-10-13";
}
await writeFile(path, formatCsv(headers, records), "utf8");
console.log(JSON.stringify({ requirements: records.length, deferred: scope.deferredRequirements, applicable: records.length - scope.deferredRequirements.length }));
