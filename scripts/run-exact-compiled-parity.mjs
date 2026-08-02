import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { toCanonicalMicroUnits } from "../packages/core/src/exact-optimizer-arithmetic.ts";
import {
  EXACT_OPTIMIZER_TRACE_PARITY_VERSION,
  isFullExactOptimizerTraceParity,
} from "../packages/core/src/exact-optimizer-parity.ts";
import {
  compileExactOptimizerTeam,
  evaluateExactOptimizerTeamLeader,
} from "../packages/core/src/exact-optimizer-kernel.ts";
import { evaluateNativeRelativeUtilityUncompressed } from "../packages/core/src/native-utility.ts";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const samplePath = "data/native/exact-optimizer-parity-sample-v1.json";
const sample = readJson(samplePath);
const scope = readJson("data/native/exact-optimizer-scope-v1.json");
const ir = readJson("data/native/exact-optimizer-parity-ir-v1.json");
const kernelPath = "tools/exact-global-solver/kernel.json";
const TRACE_TEAM_CACHE_CAPACITY = 4_096;
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

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function canonicalUtility(relativeUtility) {
  return {
    lower: toCanonicalMicroUnits(relativeUtility.lower),
    central: toCanonicalMicroUnits(relativeUtility.central),
    upper: toCanonicalMicroUnits(relativeUtility.upper),
  };
}

function exactTeamTuple(caseEntry) {
  const sortedIds = [...caseEntry.memberCardIds].sort((left, right) => left.localeCompare(right));
  return `${caseEntry.investmentLayer}|${sortedIds
    .map((cardId) => `${cardId}@${caseEntry.bloomStages[cardId]}`)
    .join("|")}`;
}

/**
 * The 100k fixture has canonical Member order, so a sorted compiled team is
 * the exact same formation as the independent reference. The bounded cache
 * is keyed by every Member/investment/Bloom input and therefore never reuses
 * a team across a different semantic tuple.
 */
function runTracePreservingParity() {
  const cache = new Map();
  const firstMismatches = [];
  const endpointMismatchCounts = { lower: 0, central: 0, upper: 0 };
  let sourceOrderCanonicalCaseCount = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let evictions = 0;
  let traceFallbackCount = 0;
  let referenceCorpusMismatchCount = 0;
  let caseMismatchCount = 0;
  let compiledEvaluationCount = 0;
  let uncompressedEvaluationCount = 0;
  let compileElapsedMilliseconds = 0;
  let compressedElapsedMilliseconds = 0;
  let uncompressedElapsedMilliseconds = 0;
  let totalStateRuns = 0;
  const started = performance.now();

  for (const caseEntry of sample) {
    const sortedIds = [...caseEntry.memberCardIds].sort((left, right) => left.localeCompare(right));
    if (sortedIds.join("|") !== caseEntry.memberCardIds.join("|")) {
      throw new Error(`Parity sample case ${caseEntry.caseId} is not in canonical Member order`);
    }
    sourceOrderCanonicalCaseCount += 1;
    const tuple = exactTeamTuple(caseEntry);
    let team = cache.get(tuple);
    if (team) {
      cacheHits += 1;
      // Make bounded FIFO reuse deterministic without pretending it is LRU.
      cache.delete(tuple);
      cache.set(tuple, team);
    } else {
      cacheMisses += 1;
      const compileStarted = performance.now();
      team = compileExactOptimizerTeam({
        memberCardIds: caseEntry.memberCardIds,
        investmentLayer: caseEntry.investmentLayer,
        bloomStageByCardId: caseEntry.bloomStages,
      });
      compileElapsedMilliseconds += performance.now() - compileStarted;
      cache.set(tuple, team);
      if (cache.size > TRACE_TEAM_CACHE_CAPACITY) {
        cache.delete(cache.keys().next().value);
        evictions += 1;
      }
    }

    const compressedStarted = performance.now();
    const compressed = evaluateExactOptimizerTeamLeader({
      team,
      leaderOutfitCardId: caseEntry.leaderCardId,
      chartKey: caseEntry.chartKey,
      seed: scope.seed,
      accountState: scope.account,
    });
    compressedElapsedMilliseconds += performance.now() - compressedStarted;
    compiledEvaluationCount += 1;
    if (compressed.execution.mode !== "trace-preserving-state-runs") traceFallbackCount += 1;
    totalStateRuns +=
      compressed.execution.activeTrace.baseStateRuns +
      compressed.execution.activeTrace.specialSupportStateRuns +
      compressed.execution.activeTrace.specialStateRuns;

    const uncompressedStarted = performance.now();
    const uncompressed = canonicalUtility(evaluateNativeRelativeUtilityUncompressed({
      formation: {
        leaderOutfitCardId: caseEntry.leaderCardId,
        members: team.members,
      },
      chartKey: caseEntry.chartKey,
      seed: scope.seed,
      accountState: scope.account,
    }).relativeUtility);
    uncompressedElapsedMilliseconds += performance.now() - uncompressedStarted;
    uncompressedEvaluationCount += 1;

    const expected = {
      lower: caseEntry.referenceLowerMicroUnits,
      central: caseEntry.referenceCentralMicroUnits,
      upper: caseEntry.referenceUpperMicroUnits,
    };
    if (
      uncompressed.lower !== expected.lower ||
      uncompressed.central !== expected.central ||
      uncompressed.upper !== expected.upper
    ) {
      referenceCorpusMismatchCount += 1;
    }
    const mismatch = {
      lower: compressed.canonicalUtility.lower !== uncompressed.lower,
      central: compressed.canonicalUtility.central !== uncompressed.central,
      upper: compressed.canonicalUtility.upper !== uncompressed.upper,
    };
    endpointMismatchCounts.lower += Number(mismatch.lower);
    endpointMismatchCounts.central += Number(mismatch.central);
    endpointMismatchCounts.upper += Number(mismatch.upper);
    if (mismatch.lower || mismatch.central || mismatch.upper) {
      caseMismatchCount += 1;
      if (firstMismatches.length < 20) {
        firstMismatches.push({
          caseId: caseEntry.caseId,
          compiled: compressed.canonicalUtility,
          uncompressed,
        });
      }
    }
  }

  return {
    methodologyVersion: EXACT_OPTIMIZER_TRACE_PARITY_VERSION,
    sampleCount: sample.length,
    compiledEvaluationCount,
    uncompressedEvaluationCount,
    sourceOrderCanonicalCaseCount,
    tupleCache: {
      capacity: TRACE_TEAM_CACHE_CAPACITY,
      uniqueInputTuples: cacheMisses - evictions,
      cacheHits,
      cacheMisses,
      evictions,
    },
    traceFallbackCount,
    referenceCorpusMismatchCount,
    compressedVsUncompressed: {
      caseMismatchCount,
      endpointMismatchCounts,
      firstMismatches,
    },
    traceStateRuns: totalStateRuns,
    timing: {
      teamCompilationMilliseconds: Math.round(compileElapsedMilliseconds * 1_000) / 1_000,
      compressedEvaluationMilliseconds: Math.round(compressedElapsedMilliseconds * 1_000) / 1_000,
      uncompressedEvaluationMilliseconds: Math.round(uncompressedElapsedMilliseconds * 1_000) / 1_000,
    },
    elapsedMilliseconds: Math.round((performance.now() - started) * 1_000) / 1_000,
  };
}

const tracePreservingParity = runTracePreservingParity();
// The bounded cache may evict a one-off tuple. Report the corpus-wide unique
// cardinality separately so a zero-hit random corpus cannot look under-tested.
tracePreservingParity.tupleCache.uniqueInputTuples = new Set(sample.map(exactTeamTuple)).size;
const traceParityPassed = isFullExactOptimizerTraceParity(tracePreservingParity, sample.length);
const rustReferencePassed = mismatchCount === 0 && compiled.length === sample.length;
const fullParityPassed = rustReferencePassed && traceParityPassed;
const reportWithoutHash = {
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
  tracePreservingParity,
  elapsedMilliseconds: Math.round((performance.now() - started) * 1_000) / 1_000,
  certificateEligible: false,
  disposition: fullParityPassed
    ? `Rust reference parity and trace-preserving versus uncompressed lower/central/upper parity passed for ${sample.length} deterministic cases; the complete certification gate remains open until full-scope proof replay passes.`
    : "Compiled prototype diverges from TypeScript reference; it remains disposable research code and cannot certify or publish a result.",
};
const report = { ...reportWithoutHash, reportHash: sha256(reportWithoutHash) };
console.log(JSON.stringify(report, null, 2));
if (fullParityPassed) {
  writeFileSync(join(root, "data/native/exact-optimizer-compiled-parity-v1.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
} else {
  process.exitCode = 1;
}
