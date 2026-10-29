import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(resolve(root, "frontend/package.json"))("typescript");
const paths = ["frontend/src/core/lunar", "backend/src/modules/calendar/lunar"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const entries = paths.map((path) => {
  const source = readFileSync(resolve(root, path, "lunar.ts"), "utf8");
  const fixture = readFileSync(resolve(root, path, "lunar.fixtures.json"));
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source.replace(/^import .*;\r?\n/gm, ""));
  const tokens = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) tokens.push([token, token === ts.SyntaxKind.StringLiteral ? scanner.getTokenValue() : scanner.getTokenText()]);
  return { path, sourceHash: hash(source), fixtureHash: hash(fixture), algorithmHash: hash(JSON.stringify(tokens)) };
});
assert.equal(entries[0].fixtureHash, entries[1].fixtureHash, "Lunar fixtures differ");
assert.equal(entries[0].algorithmHash, entries[1].algorithmHash, "Lunar algorithm tokens differ");
writeFileSync(resolve(root, "qa-output/implementation/2026-10-13-v1-01/lunar-parity.json"), JSON.stringify({ status: "PASS", method: "TypeScript tokens excluding comments and environment-specific import; fixture bytes", entries }, null, 2) + "\n", "utf8");
console.log("Lunar source token and fixture byte parity: PASS");
