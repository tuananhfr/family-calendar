import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint } from "./fingerprint.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const runId = "2026-10-13-v1-01";
const output = resolve(root, "qa-output/implementation", runId);
mkdirSync(output, { recursive: true });
const name = process.argv[2];
const definitions = {
  "qa-tools": { cwd: ".", command: "node --test scripts/qa/csv.test.mjs scripts/qa/gate.test.mjs" },
  "lunar-parity": { cwd: ".", command: "node scripts/qa/lunar-parity.mjs" },
  "frontend-lint": { cwd: "frontend", command: "npm run lint" },
  "backend-lint": { cwd: "backend", command: "npm run lint" },
  "backend-build": { cwd: "backend", command: "npm run build" },
  "emergency-unit": { cwd: "frontend", command: `npm test -- src/core/emergency src/core/db/db.test.ts src/core/backup src/core/sync/family-sharing.test.ts --reporter=default --reporter=json --outputFile=${resolve(output, name + ".raw.json")}` },
  "emergency-int": { cwd: "backend", command: "npm run test:int -- emergency.int-spec.ts --json --outputFile=" + resolve(output, name + ".raw.json") },
  "emergency-e2e": { cwd: "e2e", command: "npm test -- tests/emergency.spec.ts tests/emergency-shared.spec.ts tests/emergency-privacy.spec.ts --workers=1 --reporter=list,json" },
  "emergency-privacy": { cwd: "e2e", command: "npm test -- tests/emergency-privacy.spec.ts --project=desktop --workers=1 --reporter=list,json" },
  "emergency-sharing": { cwd: "e2e", command: "npm run test:sharing -- emergency.spec.ts --workers=1 --reporter=list,json" },
  "modules-unit": { cwd: "frontend", command: `npm test -- src/features/groups src/features/reports src/core/search src/core/emergency src/core/pwa/worker.test.ts src/core/backup src/core/db --reporter=default --reporter=json --outputFile=${resolve(output, name + ".raw.json")}` },
  "modules-e2e": { cwd: "e2e", command: "npm test -- tests/groups.spec.ts tests/search-reports.spec.ts --workers=1 --reporter=list,json" },
  "settings-e2e": { cwd: "e2e", command: "npm test -- tests/settings-extra.spec.ts tests/pwa-update.spec.ts --workers=1 --reporter=list,json" },
  "performance-local": { cwd: "e2e", command: "npm test -- tests/performance-local.spec.ts --project=desktop --workers=1 --reporter=list,json" },
  "performance-api": { cwd: "backend", command: "npm run test:int -- performance.int-spec.ts --json --outputFile=" + resolve(output, name + ".raw.json"), env: { QA_API_PERFORMANCE_OUTPUT: resolve(output, name + ".metrics.json") } },
  "frontend-unit": { cwd: "frontend", command: `npm test -- --reporter=default --reporter=json --outputFile=${resolve(output, name + ".raw.json")}` },
  "backend-unit": { cwd: "backend", command: "npm test -- --runInBand --json --outputFile=" + resolve(output, name + ".raw.json") },
  "backend-int": { cwd: "backend", command: "npm run test:int -- --json --outputFile=" + resolve(output, name + ".raw.json") },
  "root-e2e": { cwd: "e2e", command: "npm test -- --workers=1 --reporter=list,json", env: { QA_INCLUDE_PERFORMANCE: "0" } },
  "sharing-e2e": { cwd: "e2e", command: "npm run test:sharing -- --workers=1 --reporter=list,json" },
  "e2e-typecheck": { cwd: "e2e", command: "npx --no-install tsc --noEmit" },
  "build-root": { cwd: "frontend", command: "npm run build", env: { NEXT_PUBLIC_BASE_PATH: "", NEXT_PUBLIC_BUILD_ID: runId + "-root" } },
  "build-sharing": { cwd: "frontend", command: "npm run build", env: { NEXT_PUBLIC_BASE_PATH: "/lich-gia-dinh", NEXT_PUBLIC_BUILD_ID: runId + "-sharing" } },
  "pwa-unit": { cwd: "frontend", command: `npm test -- src/core/pwa --reporter=default --reporter=json --outputFile=${resolve(output, name + ".raw.json")}` },
  "pwa-root": { cwd: "e2e", command: "npm test -- tests/pwa.spec.ts tests/smoke.spec.ts --project=desktop --workers=1 --reporter=list,json" },
  "pwa-visual": { cwd: "e2e", command: "npm test -- tests/pwa-responsive.spec.ts --project=desktop --workers=1 --reporter=list,json" },
  "pwa-sharing": { cwd: "e2e", command: "npm run test:sharing -- offline-shell.spec.ts --workers=1 --reporter=list,json" },
};
const baseName = name?.replace(/-v\d+$/, "");
const step = definitions[baseName];
if (!step) throw new Error(`Unknown QA step: ${name}`);
if (existsSync(resolve(output, name + ".log"))) throw new Error(`Step already recorded: ${name}`);
const env = {
  ...process.env,
  DB_HOST: "127.0.0.1", DB_PORT: "3307", DB_USER: "root", DB_PASSWORD: "", DB_NAME: "family_calendar_test",
  E2E_DB_HOST: "127.0.0.1", E2E_DB_PORT: "3307", E2E_DB_USER: "root", E2E_DB_PASSWORD: "", E2E_DB_NAME: "family_calendar_test",
  MAIL_TRANSPORT: "file", SMTP_URL: "", ANTHROPIC_API_KEY: "", AI_PROVIDER: "fake", UPDATE_BACKUP_FIXTURES: "",
  NEXT_PUBLIC_BASE_PATH: "", NEXT_PUBLIC_SITE_ORIGIN: "https://lpc.vn", E2E_SKIP_BUILD: "1",
  PLAYWRIGHT_JSON_OUTPUT_NAME: resolve(output, name + ".raw.json"),
  ...step.env,
};
const startedAt = new Date().toISOString();
const inputsBefore = await fingerprint(root);
const log = resolve(output, name + ".log");
const stream = createWriteStream(log, { flags: "wx" });
stream.write(`run_id=${runId}\nstep=${name}\ncommand=${step.command}\nstarted_at=${startedAt}\n`);
console.log(`Started ${name}; output: ${log}`);
const child = spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", step.command], { cwd: resolve(root, step.cwd), env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let tail = "";
for (const channel of [child.stdout, child.stderr]) channel.on("data", (chunk) => { stream.write(chunk); tail = (tail + chunk.toString("utf8")).slice(-6000); });
const result = await new Promise((done) => { child.on("error", (error) => done({ exitCode: null, error: error.message })); child.on("exit", (exitCode, signal) => done({ exitCode, signal })); });
await new Promise((done) => stream.end(done));
const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true }).stdout.trim();
const build = existsSync(resolve(root, "frontend/out/pwa-build.json")) ? JSON.parse(readFileSync(resolve(root, "frontend/out/pwa-build.json"), "utf8")) : null;
const swHash = existsSync(resolve(root, "frontend/out/sw.js")) ? createHash("sha256").update(readFileSync(resolve(root, "frontend/out/sw.js"))).digest("hex") : null;
const inputsAfter = await fingerprint(root);
const artifacts = await fingerprint(root, "build");
if (result.exitCode === 0 && baseName.startsWith("build-")) {
  await cp(resolve(root, "frontend/out"), resolve(output, name + "-build/frontend"), { recursive: true, errorOnExist: true, force: false });
  await cp(resolve(root, "backend/dist"), resolve(output, name + "-build/backend"), { recursive: true, errorOnExist: true, force: false });
}
if (step.cwd === "e2e" && /npm (test|run test:sharing)/.test(step.command)) await cp(resolve(root, "e2e/test-results"), resolve(output, name + "-artifacts"), { recursive: true, errorOnExist: true, force: false });
writeFileSync(resolve(output, name + ".step.json"), JSON.stringify({ runId, name, startedAt, finishedAt: new Date().toISOString(), commit, command: step.command, ...result, status: result.exitCode === 0 ? "PASS" : "FAIL", log, build, swHash, sourceHash: inputsBefore.hash, sourceAfterHash: inputsAfter.hash, sourceChangedDuringStep: inputsBefore.hash !== inputsAfter.hash, buildHash: artifacts.hash, inputs: inputsBefore.files }, null, 2) + "\n", "utf8");
console.log(tail);
console.log(JSON.stringify({ name, ...result, build }));
process.exitCode = result.exitCode ?? 1;
