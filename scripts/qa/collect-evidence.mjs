import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint } from "./fingerprint.mjs";
import { parseCsv, formatCsv } from "./csv.mjs";
import { evaluateGate } from "./gate.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const folder = resolve(root, "qa-output/implementation/2026-10-13-v1-01");
const scope = JSON.parse(await readFile(resolve(root, "scripts/qa/scope.json"), "utf8"));
const observedSource = await fingerprint(root);
const steps = [];
const recordedInputs = new Map();
for (const name of (await readdir(folder)).filter((name) => name.endsWith(".step.json"))) {
  const step = JSON.parse(await readFile(resolve(folder, name), "utf8"));
  if (step.inputs) recordedInputs.set(step.sourceHash, step.inputs);
  steps.push({ ...step, inputs: undefined });
}
let source = observedSource;
let postExecutionChanges = [];
if (!steps.some((step) => step.sourceHash === observedSource.hash && step.sourceAfterHash === observedSource.hash)) {
  const baseline = steps.filter((step) => /^build-sharing/.test(step.name) && step.status === "PASS" && step.sourceChangedDuringStep === false).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
  const inputs = recordedInputs.get(baseline?.sourceHash);
  if (!inputs) throw new Error("No verified execution snapshot");
  const before = new Map(inputs.map((file) => [file.path, file.sha256]));
  const after = new Map(observedSource.files.map((file) => [file.path, file.sha256]));
  postExecutionChanges = [...new Set([...before.keys(), ...after.keys()])].filter((path) => before.get(path) !== after.get(path)).map((path) => ({ path, beforeHash: before.get(path), afterHash: after.get(path) }));
  if (!postExecutionChanges.length || postExecutionChanges.some((file) => file.path !== "scripts/qa/collect-evidence.mjs")) throw new Error("Application, test or execution configuration changed after verification; rerun affected checks");
  source = { hash: baseline.sourceHash, files: inputs };
}
const current = steps.filter((step) => step.sourceHash === source.hash && step.sourceAfterHash === source.hash && step.sourceChangedDuringStep === false);
const buildArtifacts = [...new Map(current.filter((step) => /^build-(root|sharing)(-v\d+)?$/.test(step.name) && step.status === "PASS").sort((a, b) => a.finishedAt.localeCompare(b.finishedAt)).map((step) => [step.build.basePath, { stepName: step.name, basePath: step.build.basePath, version: step.build.version, buildHash: step.buildHash, swHash: step.swHash, path: step.name + "-build" }])).values()];
const build = { hash: createHash("sha256").update(JSON.stringify(buildArtifacts)).digest("hex") };
const evidence = async (path) => ({ path, sha256: createHash("sha256").update(await readFile(resolve(folder, path))).digest("hex") });
const executions = [];
const results = [];
for (const step of current) {
  let raw;
  try { raw = JSON.parse(await readFile(resolve(folder, step.name + ".raw.json"), "utf8")); } catch { continue; }
  const proof = await evidence(step.name + ".raw.json");
  if (raw.suites) {
    const directory = /^(sharing|pwa-sharing|emergency-sharing)/.test(step.name) ? "e2e/sharing/" : "e2e/tests/";
    const walk = (suites) => { for (const suite of suites) { for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) results.push({ title: spec.title, file: directory + spec.file.split(/[\\/]/).at(-1), recordedFile: spec.file, project: test.projectName, status: test.results.at(-1)?.status, step: step.name, evidence: proof }); walk(suite.suites ?? []); } };
    walk(raw.suites);
    executions.push({ name: step.name, passed: raw.stats.expected, failed: raw.stats.unexpected, skipped: raw.stats.skipped, durationMs: raw.stats.duration });
  } else {
    for (const suite of raw.testResults ?? []) for (const assertion of suite.assertionResults ?? []) results.push({ title: assertion.title, file: suite.name, status: assertion.status, step: step.name, evidence: proof });
    executions.push({ name: step.name, passed: raw.numPassedTests, failed: raw.numFailedTests, skipped: raw.numPendingTests });
  }
}
const matrixPath = resolve(root, "docs/qa/audit-pack-v1/requirements.csv");
const matrix = parseCsv(await readFile(matrixPath, "utf8"));
const references = matrix.records.map((row) => {
  const matches = row.test_refs.split(" | ").filter(Boolean).map((reference) => {
    const [path, title] = reference.split(" :: ");
    const file = path.replace(/:\d+$/, "");
    const found = results.filter((result) => result.title === title && result.file.replaceAll("\\", "/").endsWith(file.replace(/^e2e\//, "")));
    return { reference, status: found.some((result) => result.status === "failed" || result.status === "timedOut") ? "FAIL" : found.length && found.every((result) => result.status === "passed") ? "PASS" : "NOT_RUN", executions: found };
  });
  return { id: row.id, status: matches.length && matches.every((match) => match.status === "PASS") ? "PASS" : matches.some((match) => match.status === "FAIL") ? "FAIL" : "NOT_RUN", matches };
});
const manifest = { generatedAt: new Date().toISOString(), runId: "2026-10-13-v1-01", sourceHash: source.hash, workingTreeSourceHash: observedSource.hash, postExecutionChanges, sourceHashMeaning: "Exact recorded execution snapshot; postExecutionChanges may contain only the evidence collector, never application code, tests or execution configuration.", buildHash: build.hash, buildArtifacts, inputs: source.files, steps: current, historicalSteps: steps.filter((step) => !current.includes(step)), executions, environment: { browser: "Chromium / Chrome; mobile profiles are emulation", database: "MariaDB family_calendar_test only", mail: "file", ai: "fake; assistant deferred" } };
const requirements = matrix.records.map((row) => ({ id: row.id, status: scope.deferredRequirements.includes(row.id) ? "DEFERRED_BY_OWNER" : "NOT_RUN", reason: scope.deferredRequirements.includes(row.id) ? scope.deferredReason : "Reference-test results do not prove every requirement variant; complete acceptance oracle and required environment remain to be reviewed.", referenceStatus: references.find((reference) => reference.id === row.id)?.status }));
for (const id of ["GATE-SOS-001", "GATE-SOS-003"]) {
  const matches = results.filter((result) => result.title === "SHARED SOS persists before a real request and offline close sends no ACTIVE alert");
  if (matches.length !== 3 || !matches.every((result) => result.status === "passed")) continue;
  Object.assign(requirements.find((row) => row.id === id), { status: "PASS", reason: undefined, sourceHash: source.hash, buildHash: build.hash, environment: "test-browser", testName: matches[0].title, assertion: id === "GATE-SOS-001" ? "IndexedDB event and queue are asserted before continuing the real POST request." : "SHARED SOS retains the same event ID, trigger time and pending state across actual offline reload.", stepNames: [...new Set(matches.map((result) => result.step))], evidence: [...new Map(matches.map((result) => [result.evidence.path, result.evidence])).values()] });
}
const approvals = [];
for (const [name, data] of Object.entries({ "manifest.json": manifest, "reference-results.json": references, "requirements-results.json": requirements, "approvals.json": approvals })) await writeFile(resolve(folder, name), JSON.stringify(data, null, 2) + "\n", "utf8");
const gate = evaluateGate({ requirements: matrix.records, results: requirements, scope, manifest, approvals, evidenceRoot: folder });
await writeFile(resolve(folder, "gate-result.json"), JSON.stringify(gate, null, 2) + "\n", "utf8");
const headers = [...matrix.headers, ...["implementation_reference_status", "implementation_reference_evidence"].filter((header) => !matrix.headers.includes(header))];
for (const row of matrix.records) {
  const reference = references.find((entry) => entry.id === row.id);
  row.implementation_reference_status = reference.status;
  row.implementation_reference_evidence = [...new Set(reference.matches.flatMap((entry) => entry.executions.map((execution) => execution.evidence.path)))].join(" | ");
}
await writeFile(matrixPath, formatCsv(headers, matrix.records), "utf8");
console.log(JSON.stringify({ currentSteps: current.map((step) => step.name), executions, gate: gate.status, counts: gate.counts, referencePassed: references.filter((row) => row.status === "PASS").length }));
