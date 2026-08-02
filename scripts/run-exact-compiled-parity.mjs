import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const samplePath = "data/native/exact-optimizer-parity-sample-v1.json";
const sample = readJson(samplePath);
const scope = readJson("data/native/exact-optimizer-scope-v1.json");
const ir = readJson("data/native/exact-optimizer-parity-ir-v1.json");
const kernelPath = "tools/exact-global-solver/kernel.json";
const args = [
  "run",
  "--release",
  "--manifest-path",
  "tools/exact-global-solver/Cargo.toml",
  "--",
  kernelPath,
  samplePath,
];
const started = performance.now();
const result = spawnSync("cargo", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Compiled parity process failed (${result.status}): ${result.stderr}`);
}
const compiled = result.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const compiledById = new Map(compiled.map((entry) => [entry.caseId, entry]));
const mismatches = [];
let mismatchCount = 0;
const deltas = { lower: [], central: [], upper: [] };
for (const expected of sample) {
  const actual = compiledById.get(expected.caseId);
  if (actual) {
    deltas.lower.push(actual.lowerMicroUnits - expected.referenceLowerMicroUnits);
    deltas.central.push(actual.centralMicroUnits - expected.referenceCentralMicroUnits);
    deltas.upper.push(actual.upperMicroUnits - expected.referenceUpperMicroUnits);
  }
  const mismatch = !actual ||
    actual.lowerMicroUnits !== expected.referenceLowerMicroUnits ||
    actual.centralMicroUnits !== expected.referenceCentralMicroUnits ||
    actual.upperMicroUnits !== expected.referenceUpperMicroUnits;
  if (mismatch) {
    mismatchCount += 1;
    if (mismatches.length < 20) {
      mismatches.push({
        caseId: expected.caseId,
        expectedLowerMicroUnits: expected.referenceLowerMicroUnits,
        actualLowerMicroUnits: actual?.lowerMicroUnits ?? null,
        expectedCentralMicroUnits: expected.referenceCentralMicroUnits,
        actualCentralMicroUnits: actual?.centralMicroUnits ?? null,
        expectedUpperMicroUnits: expected.referenceUpperMicroUnits,
        actualUpperMicroUnits: actual?.upperMicroUnits ?? null,
      });
    }
  }
}
const summarize = (values) => values.length > 0
  ? {
      minimum: Math.min(...values),
      maximum: Math.max(...values),
      maximumAbsolute: Math.max(...values.map((delta) => Math.abs(delta))),
      meanAbsolute: values.reduce((total, delta) => total + Math.abs(delta), 0) / values.length,
    }
  : null;
const report = {
  schemaVersion: 1,
  reportId: "yd-exact-compiled-parity-v1",
  generatedAt: new Date().toISOString(),
  scopeHash: scope.scopeHash,
  irHash: ir.irHash,
  kernelPath,
  samplePath,
  sampleCount: sample.length,
  compiledOutputCount: compiled.length,
  mismatchCount,
  firstMismatches: mismatches,
  deltaMicroUnits: {
    lower: summarize(deltas.lower),
    central: summarize(deltas.central),
    upper: summarize(deltas.upper),
  },
  elapsedMilliseconds: Math.round((performance.now() - started) * 1_000) / 1_000,
  certificateEligible: false,
  disposition: mismatches.length === 0 && compiled.length === sample.length
    ? `Lower/central/upper parity passed for ${sample.length} deterministic cases; the complete certification gate remains open until compiled mechanic fixtures, shard replay, and full-scope proof pass.`
    : "Compiled prototype diverges from TypeScript reference; it remains disposable research code and cannot certify or publish a result.",
};
writeFileSync(join(root, "data/native/exact-optimizer-compiled-parity-v1.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
