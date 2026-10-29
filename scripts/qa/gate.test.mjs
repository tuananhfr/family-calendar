import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { evaluateGate } from "./gate.mjs";

const evidenceRoot = mkdtempSync(join(tmpdir(), "family-calendar-gate-"));
writeFileSync(join(evidenceRoot, "test.log"), "actual test evidence\n");
const hash = createHash("sha256").update("actual test evidence\n").digest("hex");
const sourceHash = "a".repeat(64), buildHash = "b".repeat(64);
const evidence = [{ path: "test.log", sha256: hash }];
const baseline = () => ({ requirements: [{ id: "SOS-001" }, { id: "AI-001" }], results: [{ id: "SOS-001", status: "PASS", sourceHash, buildHash, environment: "test-browser", testName: "durable SOS", assertion: "local commit before request", stepNames: ["sos-test"], evidence }, { id: "AI-001", status: "DEFERRED_BY_OWNER" }], scope: { deferredRequirements: ["AI-001"] }, manifest: { sourceHash, buildHash, steps: [{ name: "sos-test", status: "PASS", exitCode: 0, sourceChangedDuringStep: false, sourceHash, sourceAfterHash: sourceHash }] }, approvals: ["product", "technical", "privacy", "legal", "release"].map((kind) => ({ kind, decision: "APPROVED", approver: "Test-only fixture approver", approvedAt: "2026-10-14", buildHash, evidence: evidence[0] })), evidenceRoot });
test("valid complete test-only fixture passes", () => assert.equal(evaluateGate(baseline()).status, "PASS"));
test("missing, duplicate, unknown ids and unrecognized statuses fail closed", () => {
  for (const mutate of [
    (input) => input.results.pop(), (input) => input.results.push(input.results[0]), (input) => input.results.push({ id: "UNKNOWN", status: "PASS" }), (input) => input.results[0].status = "OK",
  ]) { const input = baseline(); mutate(input); assert.equal(evaluateGate(input).status, "FAIL"); }
});
test("wrong build, absent approval, missing and forged evidence fail", () => {
  for (const mutate of [
    (input) => input.results[0].buildHash = "c".repeat(64), (input) => input.approvals = [], (input) => input.results[0].evidence = [], (input) => input.results[0].evidence = [{ path: "../outside", sha256: hash }], (input) => input.results[0].evidence = [{ path: "test.log", sha256: "f".repeat(64) }], (input) => input.results[0].status = "BLOCKED", (input) => input.results[1].status = "PASS",
  ]) { const input = baseline(); mutate(input); assert.equal(evaluateGate(input).status, "FAIL"); }
});
test("a physical-device pass requires actual device and tester context", () => {
  const input = baseline(); input.results[0].environment = "physical-device";
  assert.ok(evaluateGate(input).errors.some((error) => error.startsWith("PHYSICAL_DEVICE_CONTEXT_REQUIRED")));
});
test("changed source, stale executions and unbound results cannot pass", () => {
  for (const mutate of [
    (input) => input.manifest.steps[0].sourceChangedDuringStep = true,
    (input) => input.manifest.steps[0].sourceHash = "c".repeat(64),
    (input) => input.manifest.steps[0].exitCode = 1,
    (input) => input.manifest.steps = [],
    (input) => input.results[0].stepNames = ["invented-test"],
    (input) => input.manifest = null,
  ]) { const input = baseline(); mutate(input); assert.equal(evaluateGate(input).status, "FAIL"); }
});
