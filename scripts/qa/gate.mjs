import { existsSync, readFileSync, statSync, realpathSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv.mjs";

export const RESULT_STATUSES = new Set(["PASS", "FAIL", "NOT_RUN", "BLOCKED", "DEFERRED_BY_OWNER"]);
export function evaluateGate({ requirements, results, scope, manifest, approvals = [], evidenceRoot, requireApprovals = true }) {
  const errors = [];
  const expected = new Map(requirements.map((row) => [row.id, row]));
  const seen = new Set();
  const deferred = new Set(scope.deferredRequirements);
  const currentManifest = manifest ?? {};
  if (expected.size !== requirements.length || !expected.size) errors.push("REQUIREMENT_IDS_INVALID");
  if (!/^[a-f0-9]{64}$/.test(manifest?.sourceHash ?? "") || !/^[a-f0-9]{64}$/.test(manifest?.buildHash ?? "")) errors.push("BUILD_FINGERPRINT_REQUIRED");
  const steps = Array.isArray(currentManifest.steps) ? currentManifest.steps : [];
  if (!steps.length) errors.push("EXECUTION_MANIFEST_REQUIRED");
  for (const step of steps) {
    if (step.status !== "PASS" || step.exitCode !== 0) errors.push(`EXECUTION_NOT_PASSED:${step.name}`);
    if (step.sourceChangedDuringStep !== false || step.sourceHash !== currentManifest.sourceHash || step.sourceAfterHash !== currentManifest.sourceHash) errors.push(`EXECUTION_SOURCE_MISMATCH:${step.name}`);
    if (/^(root|sharing|emergency|modules|settings|pwa)-.*e2e/.test(step.name) && !(currentManifest.buildArtifacts ?? []).some((build) => build.buildHash === step.buildHash)) errors.push(`EXECUTION_BUILD_MISMATCH:${step.name}`);
  }
  for (const id of deferred) if (!expected.has(id)) errors.push(`UNKNOWN_DEFERRED_ID:${id}`);
  const evidence = (entry, id) => {
    if (!entry || typeof entry.path !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? "")) { errors.push(`EVIDENCE_REQUIRED:${id}`); return; }
    const path = resolve(evidenceRoot, entry.path);
    const within = relative(resolve(evidenceRoot), path);
    if (within === ".." || within.startsWith("../") || within.startsWith("..\\") || isAbsolute(within)) { errors.push(`EVIDENCE_OUTSIDE_ROOT:${id}`); return; }
    if (!existsSync(path) || !statSync(path).isFile()) { errors.push(`EVIDENCE_MISSING:${id}`); return; }
    const real = relative(realpathSync(evidenceRoot), realpathSync(path));
    if (real === ".." || real.startsWith("../") || real.startsWith("..\\") || isAbsolute(real)) { errors.push(`EVIDENCE_OUTSIDE_ROOT:${id}`); return; }
    if (createHash("sha256").update(readFileSync(path)).digest("hex") !== entry.sha256) errors.push(`EVIDENCE_HASH_MISMATCH:${id}`);
  };
  for (const row of results) {
    if (!expected.has(row.id)) errors.push(`UNKNOWN_RESULT_ID:${row.id}`);
    if (seen.has(row.id)) errors.push(`DUPLICATE_RESULT_ID:${row.id}`);
    seen.add(row.id);
    if (!RESULT_STATUSES.has(row.status)) errors.push(`UNKNOWN_STATUS:${row.id}`);
    if (deferred.has(row.id)) {
      if (row.status !== "DEFERRED_BY_OWNER") errors.push(`DEFERRED_STATUS_REQUIRED:${row.id}`);
      continue;
    }
    if (row.status !== "PASS") errors.push(`REQUIREMENT_NOT_PASSED:${row.id}:${row.status}`);
    if (row.status === "PASS") {
      if (row.sourceHash !== currentManifest.sourceHash || row.buildHash !== currentManifest.buildHash) errors.push(`RESULT_BUILD_MISMATCH:${row.id}`);
      if (!row.environment || !row.assertion || !row.testName) errors.push(`RESULT_CONTEXT_REQUIRED:${row.id}`);
      if (!Array.isArray(row.stepNames) || !row.stepNames.length || row.stepNames.some((name) => !steps.some((step) => step.name === name))) errors.push(`RESULT_EXECUTION_REQUIRED:${row.id}`);
      if (!Array.isArray(row.evidence) || !row.evidence.length) errors.push(`EVIDENCE_REQUIRED:${row.id}`);
      else for (const entry of row.evidence) evidence(entry, row.id);
      if (row.environment === "physical-device" && (!row.device?.model || !row.device?.os || !row.device?.testedAt || !row.device?.tester)) errors.push(`PHYSICAL_DEVICE_CONTEXT_REQUIRED:${row.id}`);
    }
  }
  for (const id of expected.keys()) if (!seen.has(id)) errors.push(`MISSING_RESULT_ID:${id}`);
  if (requireApprovals) {
    for (const kind of ["product", "technical", "privacy", "legal", "release"]) {
      const approval = approvals.find((row) => row.kind === kind && row.decision === "APPROVED");
      if (!approval || !approval.approver || !approval.approvedAt || approval.buildHash !== currentManifest.buildHash) errors.push(`APPROVAL_REQUIRED:${kind}`);
      else evidence(approval.evidence, "approval:" + kind);
    }
  }
  return { status: errors.length ? "FAIL" : "PASS", errors, counts: { expected: expected.size, supplied: results.length, deferred: deferred.size, passed: results.filter((row) => row.status === "PASS").length } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = resolve(process.argv[2] ?? "");
  const read = (name) => JSON.parse(readFileSync(resolve(folder, name), "utf8"));
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const report = evaluateGate({ requirements: parseCsv(readFileSync(resolve(root, "docs/qa/audit-pack-v1/requirements.csv"), "utf8")).records, results: read("requirements-results.json"), scope: JSON.parse(readFileSync(resolve(root, "scripts/qa/scope.json"), "utf8")), manifest: read("manifest.json"), approvals: read("approvals.json"), evidenceRoot: folder });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === "PASS" ? 0 : 1;
}
