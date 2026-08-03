import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BULK_PARITY_PATH = "data/native/exact-optimizer-bulk-parity-v1.json";
const ARCHITECTURE_PATH = "data/native/exact-optimizer-architecture-rebaseline-v1.json";
const SCOPE_PATH = "data/native/exact-optimizer-scope-v1.json";
const PERFORMANCE_PATH = "data/native/exact-optimizer-bulk-performance-v1.json";
const COST_MODEL_PATH = "data/native/exact-optimizer-cost-model-v3.json";
const PREDECESSOR_COST_MODEL_PATH = "data/native/exact-optimizer-cost-model-v2.json";
const FAST_PATH_TARGET = 0.999;
const B2_SPEEDUP_TARGET = 15;
const END_TO_END_SPEEDUP_TARGET = 8;
const CONTINGENCY_MULTIPLIER = 1.25;
const ACCEPTED_PRIMARY_RUNTIME_OBSERVATION = {
  legacyVolatileReportHash: "be71471f245bf33e8aa6394441fba264507b3cb863b3c422303e9ef6fda971c5",
  orderedStateRunMilliseconds: 52_363.324,
  fullBulkB3Milliseconds: 36_345.890,
  centralB2Milliseconds: 24_154.840,
  qualification: "Accepted primary full-run runtime observation. It is corroborated by the stable corpus evidence digest but is not used for the p95 full-scope projection.",
};
const MILLIS_PER_CORE_HOUR = 3_600_000;

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), "utf8"));
}

// Must serialize exactly what JSON.stringify writes to the artifact file:
// undefined object values are dropped and undefined array items become null,
// otherwise the recorded digest is not reproducible from the file bytes.
function canonicalize(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function requireNumber(value, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
  return value;
}

function rounded(value, digits = 6) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function architectureById(report, id) {
  const found = report.architectures.find((entry) => entry.id === id);
  if (!found) throw new Error(`Architecture rebaseline has no ${id} record`);
  return found;
}

function main() {
  const bulk = readJson(BULK_PARITY_PATH);
  const architecture = readJson(ARCHITECTURE_PATH);
  const scope = readJson(SCOPE_PATH);
  const predecessorCostModel = readJson(PREDECESSOR_COST_MODEL_PATH);
  const real = bulk.realCorpus;
  const synthetic = bulk.synthetic;
  if (!bulk.passed || !real?.passed || !synthetic?.passed) {
    throw new Error("Bulk performance evidence requires a passing complete synthetic and real parity report");
  }
  const evaluatedCases = requireNonNegativeInteger(real.input?.evaluatedCases, "real evaluated cases");
  const expectedCases = requireNonNegativeInteger(real.input?.expectedCorpusCases, "real expected cases");
  if (evaluatedCases !== 100_000 || expectedCases !== 100_000 || real.input?.reducedByDebugLimit) {
    throw new Error("Bulk performance evidence requires the complete 100000-case real corpus");
  }
  if (synthetic.caseCount !== 1_000_000) {
    throw new Error("Bulk performance evidence requires the complete 1000000-case synthetic boundary corpus");
  }
  const mismatches = real.comparisonMismatches;
  if (Object.values(mismatches).some((value) => value !== 0)) {
    throw new Error("Bulk performance evidence cannot be generated from a parity report with mismatches");
  }

  const bulkCertified = requireNonNegativeInteger(
    real.bulk?.finalCanonicalModes?.["bulk-certified-reference-equivalent"],
    "full bulk certificate count",
  );
  const bulkFallbacks = requireNonNegativeInteger(
    real.bulk?.finalCanonicalModes?.["not-attempted"],
    "full bulk fallback count",
  );
  const centralCertified = requireNonNegativeInteger(
    real.centralB2?.kinds?.["bulk-certified-reference-equivalent"],
    "central certificate count",
  );
  const centralFallbacks = requireNonNegativeInteger(
    real.centralB2?.kinds?.["ordered-replay-required"],
    "central fallback count",
  );
  if (bulkCertified + bulkFallbacks !== evaluatedCases || centralCertified + centralFallbacks !== evaluatedCases) {
    throw new Error("Bulk certificate counters do not reconcile with the complete real corpus");
  }

  const duplicateTiming = real.timing;
  const orderedMilliseconds = requireNumber(
    ACCEPTED_PRIMARY_RUNTIME_OBSERVATION.orderedStateRunMilliseconds,
    "accepted primary ordered state-run milliseconds",
  );
  const fullBulkMilliseconds = requireNumber(
    ACCEPTED_PRIMARY_RUNTIME_OBSERVATION.fullBulkB3Milliseconds,
    "accepted primary full bulk milliseconds",
  );
  const centralMilliseconds = requireNumber(
    ACCEPTED_PRIMARY_RUNTIME_OBSERVATION.centralB2Milliseconds,
    "accepted primary central B2 milliseconds",
  );
  const orderedPerState = orderedMilliseconds / evaluatedCases;
  const fullBulkPerState = fullBulkMilliseconds / evaluatedCases;
  const centralPerState = centralMilliseconds / evaluatedCases;

  const orderedReference = architecture.orderedB3Reference;
  const architectureA = architectureById(architecture, "A-flat-bulk-B2-then-B3");
  const architectureB = architectureById(architecture, "B-fixed-leader-B1-then-B2-B3");
  const architectureC = architectureById(architecture, "C-whole-leader-bounds-B2-B3");
  const orderedReferenceMilliseconds = requireNumber(orderedReference.elapsedMilliseconds, "ordered B3 reference elapsed");
  const aMilliseconds = requireNumber(architectureA.elapsedMilliseconds, "A elapsed");
  const bMilliseconds = requireNumber(architectureB.elapsedMilliseconds, "B elapsed");
  const cMilliseconds = requireNumber(architectureC.elapsedMilliseconds, "C elapsed");
  const b2VsOrdered = orderedMilliseconds / centralMilliseconds;
  const fullBulkVsOrdered = orderedMilliseconds / fullBulkMilliseconds;
  const aVsOrderedReference = orderedReferenceMilliseconds / aMilliseconds;
  const parallel = Array.isArray(architecture.parallel)
    ? {
        timingStatus: "legacy-unqualified",
        timingUse: "not used for throughput, p95, cost, or scale projection",
        measurements: architecture.parallel,
      }
    : architecture.parallel;

  const fullRate = bulkCertified / evaluatedCases;
  const centralRate = centralCertified / evaluatedCases;
  const fullTargetPassed = fullRate >= FAST_PATH_TARGET;
  const centralTargetPassed = centralRate >= FAST_PATH_TARGET;
  const sourceArtifacts = {
    bulkParityPath: BULK_PARITY_PATH,
    bulkParityEvidenceDigest: bulk.deterministicEvidenceDigest,
    architectureRebaselinePath: ARCHITECTURE_PATH,
    architectureRebaselineDeterministicReportHash: architecture.deterministicReportHash,
    scopePath: SCOPE_PATH,
    scopeHash: scope.scopeHash,
    retainedP95CostModelPath: PREDECESSOR_COST_MODEL_PATH,
    retainedP95CostModelReportHash: predecessorCostModel.reportHash,
  };
  if (!bulk.deterministicEvidenceDigest || bulk.evidenceDigestMethodologyVersion !== "yd-exact-optimizer-bulk-evidence-digest-1") {
    throw new Error("Bulk performance requires the stable evidence digest; migrate the complete parity artifact with --rehash-existing");
  }

  const performanceWithoutHash = {
    schemaVersion: 1,
    reportId: "yd-exact-optimizer-bulk-performance-v1",
    methodologyVersion: "yd-exact-optimizer-bulk-performance-1.0.0",
    sourceArtifacts,
    evidence: {
      syntheticBoundaryCorpus: {
        cases: synthetic.caseCount,
        containmentFailures: synthetic.containmentFailures,
        falseCertificates: synthetic.falseCertificates,
        expectedFallbackFailures: synthetic.expectedFallbackFailures,
        passed: synthetic.passed,
      },
      realCorpus: {
        cases: evaluatedCases,
        allFourWayParityComparisonsPassed: Object.values(mismatches).every((value) => value === 0),
        comparisons: mismatches,
      },
    },
    fastPathCoverage: {
      target: {
        minimumRate: FAST_PATH_TARGET,
        label: "99.9% of complete real-corpus inputs",
      },
      fullB3: {
        certified: bulkCertified,
        orderedReplayRequired: bulkFallbacks,
        certificationRate: fullRate,
        percentage: rounded(fullRate * 100, 3),
        fallbackReasons: real.bulk.fallbackReasons,
        targetPassed: fullTargetPassed,
      },
      centralB2: {
        certified: centralCertified,
        orderedReplayRequired: centralFallbacks,
        certificationRate: centralRate,
        percentage: rounded(centralRate * 100, 3),
        fallbackReasons: real.centralB2.fallbackReasons,
        targetPassed: centralTargetPassed,
      },
    },
    observedCorpusTiming: {
      scope: "100000 complete real inputs; elapsed totals include each named implementation only",
      acceptedPrimaryRuntimeObservation: ACCEPTED_PRIMARY_RUNTIME_OBSERVATION,
      orderedStateRun: { milliseconds: orderedMilliseconds, millisecondsPerState: orderedPerState },
      fullBulkB3: { milliseconds: fullBulkMilliseconds, millisecondsPerState: fullBulkPerState },
      centralB2: { milliseconds: centralMilliseconds, millisecondsPerState: centralPerState },
      corroboratingDuplicateRuntimeObservation: {
        legacyVolatileReportHash: bulk.legacyVolatileReportHash,
        orderedStateRunMilliseconds: duplicateTiming.orderedStateRunMilliseconds,
        fullBulkB3Milliseconds: duplicateTiming.bulkMilliseconds,
        centralB2Milliseconds: duplicateTiming.centralB2Milliseconds,
        qualification: "Same stable corpus evidence digest; distinct runtime observation retained for traceability only and not substituted for the accepted primary runtime observation.",
      },
      speedups: {
        centralB2VersusOrderedStateRun: b2VsOrdered,
        fullBulkB3VersusOrderedStateRun: fullBulkVsOrdered,
      },
    },
    experimentTargets: {
      fastPathCoverage: {
        targetRate: FAST_PATH_TARGET,
        fullB3Passed: fullTargetPassed,
        centralB2Passed: centralTargetPassed,
      },
      centralB2VersusOrderedStateRun: {
        targetSpeedup: B2_SPEEDUP_TARGET,
        actualSpeedup: b2VsOrdered,
        passed: b2VsOrdered >= B2_SPEEDUP_TARGET,
      },
      endToEndFlatAVersusOrderedB3Reference: {
        targetSpeedup: END_TO_END_SPEEDUP_TARGET,
        actualSpeedup: aVsOrderedReference,
        passed: aVsOrderedReference >= END_TO_END_SPEEDUP_TARGET,
        scope: "identical 32 candidate-pair x 30 chart workload; p50 wall-clock ratio",
      },
    },
    identicalScopeArchitectureRebaseline: {
      workload: architecture.workload,
      measurementProtocol: architecture.measurementProtocol,
      orderedB3Reference: {
        elapsedMilliseconds: orderedReferenceMilliseconds,
        timing: orderedReference.timing,
        winnerDigest: orderedReference.winnerDigest,
      },
      A: {
        elapsedMilliseconds: aMilliseconds,
        timing: architectureA.timing,
        winnerDigest: architectureA.winnerDigest,
        versusOrderedB3Reference: aVsOrderedReference,
        centralStatesAttempted: architectureA.metrics.centralB2ChartStates,
      },
      B: {
        elapsedMilliseconds: bMilliseconds,
        timing: architectureB.timing,
        winnerDigest: architectureB.winnerDigest,
        versusA: aMilliseconds / bMilliseconds,
      },
      C: {
        elapsedMilliseconds: cMilliseconds,
        timing: architectureC.timing,
        winnerDigest: architectureC.winnerDigest,
        versusA: aMilliseconds / cMilliseconds,
        note: "C prunes more candidates on this compact workload but its whole-Leader bound construction is slower; no C selection claim is made.",
      },
      allWinnerParityPassed: architecture.parity?.allPassed === true,
      candidateWorkerReplay: {
        timingStatus: parallel.timingStatus,
        timingUse: parallel.timingUse,
        measurements: parallel.measurements.map((entry) => ({
        workers: entry.workers,
        elapsedMilliseconds: entry.elapsedMilliseconds,
        speedupVersusSerialC: entry.speedupVersusSerialC,
        outputParityPassed: entry.outputParity.passed,
        })),
      },
      supersededSinglePassReference: {
        status: "superseded-by-normalized-repeated-measurement",
        orderedB3ReferenceMilliseconds: 485.331,
        flatABulkB2ThenB3Milliseconds: 309.113,
        flatAVersusOrderedB3Reference: 485.331 / 309.113,
        note: "This corrected one-pass fair-scope result is retained for traceability only. The normalized warm-up plus five-repeat p50/p95/worst data above is the current architecture evidence.",
      },
    },
    conditionalDominanceDecision: {
      status: "conditional-not-authorized",
      positiveEvidence: [
        "The one-million boundary corpus and complete real corpus have zero false certificates and zero endpoint/parity mismatches.",
        "Central B2 is faster than ordered state-run evaluation on the complete real corpus, but only its individually certified inputs may be screened.",
        "The corrected identical-scope A/B/C workload preserves the ordered B3 winner and shows flat B2/B3 faster than the ordered B3 reference.",
      ],
      blockingEvidence: [
        `Full B3 fast-path coverage is ${rounded(fullRate * 100, 3)}%, below the declared 99.9% target.`,
        `Central B2 fast-path coverage is ${rounded(centralRate * 100, 3)}%, below the declared 99.9% target.`,
        `Central B2 is ${rounded(b2VsOrdered, 3)}x versus the ordered state-run path, below the declared ${B2_SPEEDUP_TARGET}x experiment target.`,
        `Flat A is ${rounded(aVsOrderedReference, 3)}x versus the ordered B3 reference, below the declared ${END_TO_END_SPEEDUP_TARGET}x end-to-end experiment target.`,
        "The compact C bound benchmark is slower than flat A, and its negative process-scaling ratios are not extrapolated.",
      ],
      permittedUse: [
        "For an individual complete chart evaluation, use bulk output only when its final proof is certified; otherwise replay the affected Active component in source order.",
        "Use B2 only for a certified strict central loss. Equality, finalist, and fallback cases must materialize B3.",
      ],
      prohibitedUse: [
        "Do not call the bulk path a universally dominant replacement for ordered replay.",
        "Do not authorize a full shard run or claim a global certificate from this evidence.",
      ],
      nextUnblockedResearchAction: "Reduce canonical-boundary fallback coverage with a narrower safe proof or state partition, then repeat the full 100000-case corpus before revisiting the 99.9% target.",
    },
    certificateEligible: false,
  };
  const performance = {
    ...performanceWithoutHash,
    deterministicReportHash: sha256(performanceWithoutHash),
  };

  const declaredWork = {
    legalMemberTeamSets: 126_445_821,
    eligibleLeaderOutfits: 113,
    aggregateCharts: 30,
  };
  declaredWork.leaderTeamPairs = declaredWork.legalMemberTeamSets * declaredWork.eligibleLeaderOutfits;
  declaredWork.leaderTeamChartStates = declaredWork.leaderTeamPairs * declaredWork.aggregateCharts;
  const fullB3NoPruningMilliseconds = declaredWork.leaderTeamChartStates * fullBulkPerState;
  const b2PlusB3NoPruningMilliseconds = declaredWork.leaderTeamChartStates * (centralPerState + fullBulkPerState);
  const retainedP95Projection = predecessorCostModel.measuredMinimumNoPruningProjection;
  const retainedParallel = predecessorCostModel.parallelism;
  if (
    predecessorCostModel.scopeHash !== scope.scopeHash ||
    !Number.isFinite(retainedP95Projection?.serialCoreHours) ||
    !Array.isArray(retainedParallel?.wallHoursWith25PercentContingency)
  ) {
    throw new Error("The retained p95 no-pruning cost bound is missing, malformed, or scope-incompatible");
  }
  const rawCoreHours = retainedP95Projection.serialCoreHours;
  const contingencyCoreHours = rawCoreHours * CONTINGENCY_MULTIPLIER;
  const p95WallByWorkers = retainedParallel.wallHoursWith25PercentContingency.map((entry) => ({
    workers: entry.workers,
    source: entry.source,
    measuredSpeedup: entry.measuredSpeedup,
    p95WallHoursWith25PercentContingency: entry.wallHours,
  }));
  const costWithoutHash = {
    schemaVersion: 1,
    kind: "exact-optimizer-cost-model",
    reportId: "yd-exact-optimizer-cost-model-v3",
    methodologyVersion: "yd-exact-optimizer-cost-model-4.0.0",
    sourceArtifacts: {
      ...sourceArtifacts,
      bulkPerformancePath: PERFORMANCE_PATH,
      bulkPerformanceDeterministicReportHash: performance.deterministicReportHash,
      predecessorCostModelPath: PREDECESSOR_COST_MODEL_PATH,
      predecessorCostModelReportHash: predecessorCostModel.reportHash,
    },
    declaredWork,
    observedPerStateTiming: {
      source: "complete 100000-case real parity corpus; observed means, not p95 estimates",
      orderedStateRunMilliseconds: orderedPerState,
      fullBulkB3Milliseconds: fullBulkPerState,
      centralB2Milliseconds: centralPerState,
    },
    diagnosticObservedMeanNoPruningCalculation: {
      fullB3Only: {
        stateCount: declaredWork.leaderTeamChartStates,
        observedMeanMillisecondsPerState: fullBulkPerState,
        projectedMilliseconds: fullB3NoPruningMilliseconds,
        serialCoreHours: fullB3NoPruningMilliseconds / MILLIS_PER_CORE_HOUR,
        qualification: "Diagnostic lower-bound calculation only: observed mean rather than p95, and excludes team compilation, B0/B1, I/O, retry, merge, independent replay, and contingency. It is not the requested conservative projection.",
      },
      B2ThenB3WithZeroPruningCredit: {
        stateCount: declaredWork.leaderTeamChartStates,
        observedMeanMillisecondsPerState: centralPerState + fullBulkPerState,
        projectedMilliseconds: b2PlusB3NoPruningMilliseconds,
        serialCoreHours: b2PlusB3NoPruningMilliseconds / MILLIS_PER_CORE_HOUR,
        qualification: "No central-loss pruning credit is assumed. This intentionally charges B2 and B3 for every state, so it cannot be mistaken for a savings claim.",
      },
      B0AndB1: {
        status: "not-projected",
        reason: "The new compact 30-chart C measurement is slower than A and its bound-context/process costs are not representative of full-scope throughput. No extrapolated pruning or parallelism credit is asserted.",
      },
      parallelism: {
        status: "not-projected",
        reason: "The 2/4/8/16/32 worker rebaseline preserves winner parity but is startup/context dominated and slower than serial C at every tested count; it is correctness evidence, not a scale model.",
      },
    },
    conservativeP95ProjectionWith25PercentContingency: {
      status: "retained-conservative-bound",
      source: {
        path: PREDECESSOR_COST_MODEL_PATH,
        reportHash: predecessorCostModel.reportHash,
        methodology: predecessorCostModel.methodologyVersion,
      },
      reason: "The complete 100000-case bulk corpus exposes aggregate elapsed totals, not per-state p95 samples, and the normalized 960-state rebaseline is intentionally not extrapolated. The prior scope-identical stratified-p95 no-pruning bound is retained without any bulk, dominance, pruning, or newer-worker speedup credit.",
      contingencyMultiplier: CONTINGENCY_MULTIPLIER,
      rawCoreHours,
      contingencyCoreHours,
      p95WallHoursByCandidateWorkers: p95WallByWorkers,
      unavailableFields: {
        currentBulkPerStateP95Milliseconds: "unavailable: only aggregate complete-corpus elapsed totals exist",
        currentBulkCandidateWorkerP95Throughput: "unavailable: 2/4/8/16/32 replays are single-run deterministic-parity evidence only",
        full113LeaderB0Cost: "unavailable: the retained B0 measurement covers only a four-Leader bundle",
      },
      fullRunAuthorized: false,
    },
    fastPathTarget: {
      targetRate: FAST_PATH_TARGET,
      fullB3ObservedRate: fullRate,
      centralB2ObservedRate: centralRate,
      fullB3TargetPassed: fullTargetPassed,
      centralB2TargetPassed: centralTargetPassed,
    },
    decision: {
      fullRunAuthorized: false,
      thresholds: { maximumP95WallHoursWithContingency: 72, maximumRawCoreHours: 800 },
      reasons: [
        "Both fast-path rates miss the declared 99.9% target, so bulk cannot be selected as a universal dominance replacement.",
        `Central B2 misses the ${B2_SPEEDUP_TARGET}x experiment target and flat A misses the ${END_TO_END_SPEEDUP_TARGET}x end-to-end experiment target.`,
        `The retained scope-identical stratified-p95 no-pruning bound is ${rounded(rawCoreHours, 3)} raw core-hours and ${rounded(contingencyCoreHours, 3)} core-hours with 25% contingency, both far above the 800 raw-core-hour gate.`,
        "The retained p95 candidate-worker wall bounds are all above 72 hours with contingency; no newer worker replay receives scale credit.",
        "No full shard execution was launched.",
      ],
    },
    certificateEligible: false,
  };
  const costModel = {
    ...costWithoutHash,
    deterministicReportHash: sha256(costWithoutHash),
  };

  writeFileSync(join(ROOT, PERFORMANCE_PATH), `${JSON.stringify(performance, null, 2)}\n`, "utf8");
  writeFileSync(join(ROOT, COST_MODEL_PATH), `${JSON.stringify(costModel, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    bulkPerformance: {
      path: PERFORMANCE_PATH,
      deterministicReportHash: performance.deterministicReportHash,
      fullB3CoveragePercent: performance.fastPathCoverage.fullB3.percentage,
      centralB2CoveragePercent: performance.fastPathCoverage.centralB2.percentage,
      centralB2VsOrderedSpeedup: performance.observedCorpusTiming.speedups.centralB2VersusOrderedStateRun,
      flatAVsOrderedSpeedup: performance.identicalScopeArchitectureRebaseline.A.versusOrderedB3Reference,
    },
    costModel: {
      path: COST_MODEL_PATH,
      deterministicReportHash: costModel.deterministicReportHash,
      retainedP95RawCoreHours: costModel.conservativeP95ProjectionWith25PercentContingency.rawCoreHours,
      retainedP95ContingencyCoreHours:
        costModel.conservativeP95ProjectionWith25PercentContingency.contingencyCoreHours,
      fullRunAuthorized: false,
    },
  }, null, 2)}\n`);
}

main();
