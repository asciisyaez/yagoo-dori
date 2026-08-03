import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import {
  compareCanonicalCandidates,
  toCanonicalMicroUnits,
  upperBoundToCanonicalMicroUnits,
} from "../packages/core/src/exact-optimizer-arithmetic.ts";
import {
  compileExactOptimizerTeam,
  evaluateExactOptimizerTeamLeader,
  evaluateExactOptimizerTeamLeaderCentral,
} from "../packages/core/src/exact-optimizer-kernel.ts";
import { compileNativeGlobalBoundContext } from "../packages/core/src/native-global-bound.ts";
import { evaluateNativeRelativeUtilityWithOrderedStateRuns } from "../packages/core/src/native-utility.ts";
import { exactOptimizerScope } from "../packages/core/src/exact-optimizer-scope.ts";

const ROOT = process.cwd();
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SAMPLE_PATH = "data/native/exact-optimizer-parity-sample-v1.json";
const OUTPUT_PATH = "data/native/exact-optimizer-architecture-rebaseline-v1.json";
const REPORT_ID = "yd-exact-optimizer-architecture-rebaseline-v1";
const RUNNER_VERSION = "yd-exact-optimizer-bulk-rebaseline-runner-1.0.0";
const TEAM_COUNT = 8;
const LEADER_COUNT = 4;
const MAX_MISMATCHES = 20;
const SERIAL_WARM_UP_RUNS = 1;
const SERIAL_MEASURED_REPEATS = 5;

const args = process.argv.slice(2);
const hasArgument = (name) => args.includes(name);
const argumentValue = (name) => {
  const prefix = `--${name}=`;
  const argument = args.find((entry) => entry.startsWith(prefix));
  return argument === undefined ? null : argument.slice(prefix.length);
};
const workerIndexArgument = argumentValue("worker-index");
const workerCountArgument = argumentValue("worker-count");
const isWorker = workerIndexArgument !== null || workerCountArgument !== null;
if ((workerIndexArgument === null) !== (workerCountArgument === null)) {
  throw new Error("worker-index and worker-count must be provided together");
}
const workerIndex = workerIndexArgument === null ? null : Number.parseInt(workerIndexArgument, 10);
const workerCount = workerCountArgument === null ? null : Number.parseInt(workerCountArgument, 10);
if (
  isWorker &&
  (!Number.isSafeInteger(workerIndex) || !Number.isSafeInteger(workerCount) || workerIndex < 0 || workerCount <= 0 || workerIndex >= workerCount)
) {
  throw new Error("worker-index must be in [0, worker-count)");
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

function rounded(value) {
  return Math.round(value * 1_000) / 1_000;
}

/** Nearest-rank percentile, deliberately deterministic for the five-repeat sample. */
function percentile(values, quantile) {
  const sorted = [...values].filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1));
  return sorted[index];
}

function processMemorySnapshot() {
  const memory = process.memoryUsage();
  return {
    rssBytes: memory.rss,
    heapTotalBytes: memory.heapTotal,
    heapUsedBytes: memory.heapUsed,
    externalBytes: memory.external,
    arrayBuffersBytes: memory.arrayBuffers,
  };
}

function runMeasured(run) {
  const memoryBefore = processMemorySnapshot();
  const cpuBefore = process.cpuUsage();
  const started = performance.now();
  const outcome = run();
  const wallElapsedMilliseconds = performance.now() - started;
  const cpu = process.cpuUsage(cpuBefore);
  const memoryAfter = processMemorySnapshot();
  return {
    outcome,
    telemetry: {
      wallElapsedMilliseconds,
      cpuUserMilliseconds: cpu.user / 1_000,
      cpuSystemMilliseconds: cpu.system / 1_000,
      memoryBefore,
      memoryAfter,
      memoryDeltaBytes: {
        rss: memoryAfter.rssBytes - memoryBefore.rssBytes,
        heapUsed: memoryAfter.heapUsedBytes - memoryBefore.heapUsedBytes,
        external: memoryAfter.externalBytes - memoryBefore.externalBytes,
        arrayBuffers: memoryAfter.arrayBuffersBytes - memoryBefore.arrayBuffersBytes,
      },
      allocationMeasurement: {
        status: "unavailable",
        reason: "Node exposes process heap snapshots, not exact allocation counters, without an instrumentation build. Heap deltas are diagnostic only.",
      },
    },
  };
}

function measurementSummary(measurements) {
  const wall = measurements.map((entry) => entry.telemetry.wallElapsedMilliseconds);
  const cpuUser = measurements.map((entry) => entry.telemetry.cpuUserMilliseconds);
  const cpuSystem = measurements.map((entry) => entry.telemetry.cpuSystemMilliseconds);
  const rssObserved = measurements.flatMap((entry) => [
    entry.telemetry.memoryBefore.rssBytes,
    entry.telemetry.memoryAfter.rssBytes,
  ]);
  const heapObserved = measurements.flatMap((entry) => [
    entry.telemetry.memoryBefore.heapUsedBytes,
    entry.telemetry.memoryAfter.heapUsedBytes,
  ]);
  return {
    measuredRepeats: measurements.length,
    percentileMethod: "nearest-rank",
    wallMilliseconds: {
      p50: percentile(wall, 0.5),
      p95: percentile(wall, 0.95),
      worst: Math.max(...wall),
      best: Math.min(...wall),
      mean: wall.reduce((total, value) => total + value, 0) / wall.length,
      values: wall,
    },
    cpuMilliseconds: {
      user: { p50: percentile(cpuUser, 0.5), p95: percentile(cpuUser, 0.95), worst: Math.max(...cpuUser) },
      system: { p50: percentile(cpuSystem, 0.5), p95: percentile(cpuSystem, 0.95), worst: Math.max(...cpuSystem) },
    },
    memory: {
      maximumObservedRssBytes: Math.max(...rssObserved),
      maximumObservedHeapUsedBytes: Math.max(...heapObserved),
      perRepeatDeltaBytes: measurements.map((entry) => entry.telemetry.memoryDeltaBytes),
      allocationMeasurement: measurements[0]?.telemetry.allocationMeasurement ?? null,
    },
  };
}

function averageMicroUnits(values) {
  if (values.length === 0) throw new Error("Cannot aggregate an empty 30-chart result");
  return toCanonicalMicroUnits(values.reduce((total, value) => total + value / 1_000_000, 0) / values.length);
}

function candidateKey(candidate) {
  return `${candidate.leaderCardId}|${candidate.memberCardIds.join("|")}`;
}

function preferred(left, right) {
  return right === null || compareCanonicalCandidates(left, right) > 0 ? left : right;
}

function canonicalUtility(relativeUtility) {
  return {
    lower: toCanonicalMicroUnits(relativeUtility.lower),
    central: toCanonicalMicroUnits(relativeUtility.central),
    upper: toCanonicalMicroUnits(relativeUtility.upper),
  };
}

function buildWorkload() {
  const sample = JSON.parse(readFileSync(join(ROOT, SAMPLE_PATH), "utf8"));
  const leaders = [...new Set(sample.map((entry) => entry.leaderCardId))]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, LEADER_COUNT);
  const teams = [];
  const seen = new Set();
  for (const entry of sample) {
    const memberCardIds = [...entry.memberCardIds].sort((left, right) => left.localeCompare(right));
    const key = memberCardIds.join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    teams.push(memberCardIds);
    if (teams.length === TEAM_COUNT) break;
  }
  if (leaders.length !== LEADER_COUNT || teams.length !== TEAM_COUNT) {
    throw new Error("Pinned parity corpus does not contain enough deterministic rebaseline seeds");
  }
  const chartKeys = exactOptimizerScope.chartCorpus.entries
    .map((entry) => entry.chartKey)
    .sort((left, right) => left.localeCompare(right));
  const pairs = leaders.flatMap((leaderCardId) => teams.map((memberCardIds) => ({
    leaderCardId,
    memberCardIds,
  })));
  pairs.sort((left, right) => candidateKey(left).localeCompare(candidateKey(right)));
  const initial = pairs[0];
  const nonInitial = pairs.slice(1);
  return {
    leaders,
    teams,
    pairs,
    initial,
    nonInitial,
    chartKeys,
    workloadHash: sha256({
      scopeHash: exactOptimizerScope.scopeHash,
      chartKeys,
      leaders,
      teams,
      initial,
    }),
  };
}

function newMetrics() {
  return {
    teamCompilations: 0,
    fullB3Candidates: 0,
    fullB3ChartStates: 0,
    orderedB3ChartStates: 0,
    bulkB3ChartStates: 0,
    centralB2Candidates: 0,
    centralB2ChartStates: 0,
    centralB2Certificates: 0,
    centralB2Fallbacks: 0,
    centralStrictLossPrunes: 0,
    centralEqualityOrFinalistPromotions: 0,
    centralCertificateMismatches: 0,
    b0Entrants: 0,
    b0Pruned: 0,
    b1Entrants: 0,
    b1Pruned: 0,
    bulkFinalModes: {},
    bulkFallbackReasons: {},
    centralFallbackReasons: {},
    traceFallbacks: 0,
    teamCompilationMilliseconds: 0,
    b0Milliseconds: 0,
    b1Milliseconds: 0,
    centralB2Milliseconds: 0,
    fullB3Milliseconds: 0,
  };
}

function addReason(target, reason) {
  const key = reason ?? "none";
  target[key] = (target[key] ?? 0) + 1;
}

function buildTeam(pair, cache, metrics) {
  const key = pair.memberCardIds.join("|");
  const cached = cache.get(key);
  if (cached) return cached;
  const started = performance.now();
  const bloomStageByCardId = Object.fromEntries(pair.memberCardIds.map((cardId) => [
    cardId,
    exactOptimizerScope.investment.bloomStageByCardId[cardId],
  ]));
  const team = compileExactOptimizerTeam({
    memberCardIds: pair.memberCardIds,
    investmentLayer: exactOptimizerScope.investment.layer,
    bloomStageByCardId,
  });
  metrics.teamCompilations += 1;
  metrics.teamCompilationMilliseconds += performance.now() - started;
  cache.set(key, team);
  return team;
}

function utilityInput(pair, team, chartKey) {
  return {
    formation: { leaderOutfitCardId: pair.leaderCardId, members: team.members },
    chartKey,
    seed: exactOptimizerScope.seed,
    accountState: exactOptimizerScope.account,
  };
}

/** A is the source-order reference over the compiled state scheduler. */
function evaluateOrderedB3(pair, workload, cache, metrics) {
  const team = buildTeam(pair, cache, metrics);
  const utilities = [];
  const started = performance.now();
  for (const chartKey of workload.chartKeys) {
    const evaluation = evaluateNativeRelativeUtilityWithOrderedStateRuns(
      utilityInput(pair, team, chartKey),
    );
    utilities.push(canonicalUtility(evaluation.result.relativeUtility));
    metrics.fullB3ChartStates += 1;
    metrics.orderedB3ChartStates += 1;
    if (evaluation.activeTrace.mode !== "trace-preserving-state-runs") metrics.traceFallbacks += 1;
  }
  metrics.fullB3Candidates += 1;
  metrics.fullB3Milliseconds += performance.now() - started;
  return {
    leaderCardId: pair.leaderCardId,
    memberCardIds: team.memberCardIds,
    utility: {
      lower: averageMicroUnits(utilities.map((utility) => utility.lower)),
      central: averageMicroUnits(utilities.map((utility) => utility.central)),
      upper: averageMicroUnits(utilities.map((utility) => utility.upper)),
    },
  };
}

/** B3 materializes the complete tuple through the proof-carrying bulk path. */
function evaluateBulkB3(pair, workload, cache, metrics) {
  const team = buildTeam(pair, cache, metrics);
  const utilities = [];
  const started = performance.now();
  for (const chartKey of workload.chartKeys) {
    const evaluation = evaluateExactOptimizerTeamLeader({
      team,
      leaderOutfitCardId: pair.leaderCardId,
      chartKey,
      seed: exactOptimizerScope.seed,
      accountState: exactOptimizerScope.account,
    });
    utilities.push(evaluation.canonicalUtility);
    metrics.fullB3ChartStates += 1;
    metrics.bulkB3ChartStates += 1;
    const telemetry = evaluation.execution.activeTrace.bulk;
    addReason(metrics.bulkFinalModes, telemetry.finalCanonical);
    addReason(metrics.bulkFallbackReasons, telemetry.fallbackReason);
    if (evaluation.execution.mode !== "trace-preserving-state-runs") metrics.traceFallbacks += 1;
  }
  metrics.fullB3Candidates += 1;
  metrics.fullB3Milliseconds += performance.now() - started;
  return {
    leaderCardId: pair.leaderCardId,
    memberCardIds: team.memberCardIds,
    utility: {
      lower: averageMicroUnits(utilities.map((utility) => utility.lower)),
      central: averageMicroUnits(utilities.map((utility) => utility.central)),
      upper: averageMicroUnits(utilities.map((utility) => utility.upper)),
    },
  };
}

/** B2 computes no tuple. A fallback/equality/finalist always promotes to B3. */
function evaluateCentralB2(pair, workload, cache, metrics) {
  const team = buildTeam(pair, cache, metrics);
  const centralValues = [];
  const started = performance.now();
  let fallbackReason = null;
  metrics.centralB2Candidates += 1;
  for (const chartKey of workload.chartKeys) {
    const evaluation = evaluateExactOptimizerTeamLeaderCentral({
      team,
      leaderOutfitCardId: pair.leaderCardId,
      chartKey,
      seed: exactOptimizerScope.seed,
      accountState: exactOptimizerScope.account,
    });
    metrics.centralB2ChartStates += 1;
    if (evaluation.kind === "ordered-replay-required") {
      metrics.centralB2Fallbacks += 1;
      addReason(metrics.centralFallbackReasons, evaluation.fallbackReason);
      // Do not short-circuit the benchmark. A's declared 960-state central
      // workload must exercise the identical B2 evaluator at every chart;
      // the candidate still promotes to B3 after this loop.
      fallbackReason ??= evaluation.fallbackReason;
      continue;
    }
    metrics.centralB2Certificates += 1;
    centralValues.push(evaluation.centralMicroUnits);
  }
  metrics.centralB2Milliseconds += performance.now() - started;
  if (fallbackReason !== null) {
    return { kind: "ordered-replay-required", fallbackReason };
  }
  return {
    kind: "bulk-certified-reference-equivalent",
    centralMicroUnits: averageMicroUnits(centralValues),
  };
}

function completeBoundContexts(workload) {
  const common = {
    eligibleMemberCardIds: exactOptimizerScope.eligibility.eligibleMemberCardIds,
    investmentLayer: exactOptimizerScope.investment.layer,
    bloomStageByCardId: exactOptimizerScope.investment.bloomStageByCardId,
    maxFiveStarMembers: exactOptimizerScope.eligibility.maximumFiveStarMembers,
    chartKeys: workload.chartKeys,
  };
  return {
    b0: compileNativeGlobalBoundContext({
      ...common,
      eligibleLeaderOutfitCardIds: workload.leaders,
    }),
    b1: new Map(workload.leaders.map((leaderCardId) => [
      leaderCardId,
      compileNativeGlobalBoundContext({ ...common, eligibleLeaderOutfitCardIds: [leaderCardId] }),
    ])),
  };
}

function boundMicroUnits(context, pair, metrics, stage) {
  const started = performance.now();
  const result = context.bound({
    partialMemberCardIds: pair.memberCardIds,
    ...(stage === "B1" ? { eligibleLeaderOutfitCardIds: [pair.leaderCardId] } : {}),
  });
  const elapsed = performance.now() - started;
  if (stage === "B0") metrics.b0Milliseconds += elapsed;
  else metrics.b1Milliseconds += elapsed;
  return upperBoundToCanonicalMicroUnits(result.upperCentralUtility);
}

function combineMetrics(parts) {
  const aggregate = newMetrics();
  for (const metrics of parts) {
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === "number") aggregate[key] += value;
      else if (value && typeof value === "object") {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          aggregate[key][nestedKey] = (aggregate[key][nestedKey] ?? 0) + nestedValue;
        }
      }
    }
  }
  return aggregate;
}

/** Independent source-order B3 reference; not one of the A/B/C comparisons. */
function runOrderedB3Reference(workload, pairs = workload.pairs) {
  const started = performance.now();
  const metrics = newMetrics();
  const cache = new Map();
  let winner = null;
  for (const pair of pairs) winner = preferred(evaluateOrderedB3(pair, workload, cache, metrics), winner);
  return {
    id: "ordered-state-run-B3-reference",
    winner,
    metrics,
    elapsedMilliseconds: rounded(performance.now() - started),
  };
}

/**
 * Every A/B/C architecture starts with this exact sequence.  B2 is attempted
 * for the initial candidate as well, so A measures the same 960 central chart
 * states as the declared flat workload; B3 then establishes the incumbent.
 */
function establishInitialIncumbent(workload, cache, metrics) {
  const central = evaluateCentralB2(workload.initial, workload, cache, metrics);
  const full = evaluateBulkB3(workload.initial, workload, cache, metrics);
  if (
    central.kind === "bulk-certified-reference-equivalent" &&
    central.centralMicroUnits !== full.utility.central
  ) {
    metrics.centralCertificateMismatches += 1;
  }
  return full;
}

function runB2ThenB3(workload, pairs, cache, metrics, winner) {
  for (const pair of pairs) {
    const central = evaluateCentralB2(pair, workload, cache, metrics);
    if (
      central.kind === "bulk-certified-reference-equivalent" &&
      central.centralMicroUnits < winner.utility.central
    ) {
      metrics.centralStrictLossPrunes += 1;
      continue;
    }
    metrics.centralEqualityOrFinalistPromotions += 1;
    const full = evaluateBulkB3(pair, workload, cache, metrics);
    if (
      central.kind === "bulk-certified-reference-equivalent" &&
      central.centralMicroUnits !== full.utility.central
    ) {
      metrics.centralCertificateMismatches += 1;
    }
    winner = preferred(full, winner);
  }
  return winner;
}

/** A: no global bounds; identical certified B2 central evaluator for all states. */
function runArchitectureA(workload, pairs = workload.nonInitial) {
  const started = performance.now();
  const metrics = newMetrics();
  const cache = new Map();
  const winner = runB2ThenB3(
    workload,
    pairs,
    cache,
    metrics,
    establishInitialIncumbent(workload, cache, metrics),
  );
  return {
    id: "A-flat-bulk-B2-then-B3",
    winner,
    metrics,
    elapsedMilliseconds: rounded(performance.now() - started),
  };
}

/** B: fixed-Leader B1 bound, then the same B2/B3 policy as A. */
function runArchitectureB(workload, pairs = workload.nonInitial) {
  const started = performance.now();
  const metrics = newMetrics();
  const cache = new Map();
  const common = {
    eligibleMemberCardIds: exactOptimizerScope.eligibility.eligibleMemberCardIds,
    investmentLayer: exactOptimizerScope.investment.layer,
    bloomStageByCardId: exactOptimizerScope.investment.bloomStageByCardId,
    maxFiveStarMembers: exactOptimizerScope.eligibility.maximumFiveStarMembers,
    chartKeys: workload.chartKeys,
  };
  const b1Contexts = new Map(workload.leaders.map((leaderCardId) => [
    leaderCardId,
    compileNativeGlobalBoundContext({ ...common, eligibleLeaderOutfitCardIds: [leaderCardId] }),
  ]));
  let winner = establishInitialIncumbent(workload, cache, metrics);
  for (const pair of pairs) {
    metrics.b1Entrants += 1;
    const b1Context = b1Contexts.get(pair.leaderCardId);
    if (!b1Context) throw new Error(`Missing fixed-Leader B1 context for ${pair.leaderCardId}`);
    const b1 = boundMicroUnits(b1Context, pair, metrics, "B1");
    if (b1 < winner.utility.central) {
      metrics.b1Pruned += 1;
      continue;
    }
    winner = runB2ThenB3(workload, [pair], cache, metrics, winner);
  }
  return { id: "B-fixed-leader-B1-then-B2-B3", winner, metrics, elapsedMilliseconds: rounded(performance.now() - started) };
}

function runArchitectureC(workload, pairs = workload.nonInitial) {
  const started = performance.now();
  const metrics = newMetrics();
  const cache = new Map();
  const contexts = completeBoundContexts(workload);
  let winner = establishInitialIncumbent(workload, cache, metrics);
  for (const pair of pairs) {
    metrics.b0Entrants += 1;
    const b0 = boundMicroUnits(contexts.b0, pair, metrics, "B0");
    if (b0 < winner.utility.central) {
      metrics.b0Pruned += 1;
      continue;
    }
    metrics.b1Entrants += 1;
    const b1Context = contexts.b1.get(pair.leaderCardId);
    if (!b1Context) throw new Error(`Missing fixed-Leader B1 context for ${pair.leaderCardId}`);
    const b1 = boundMicroUnits(b1Context, pair, metrics, "B1");
    if (b1 < winner.utility.central) {
      metrics.b1Pruned += 1;
      continue;
    }
    winner = runB2ThenB3(workload, [pair], cache, metrics, winner);
  }
  return { id: "C-whole-leader-bounds-B2-B3", winner, metrics, elapsedMilliseconds: rounded(performance.now() - started) };
}

function summarizeArchitecture(outcome, workload) {
  const metrics = outcome.metrics;
  return {
    id: outcome.id,
    elapsedMilliseconds: outcome.elapsedMilliseconds,
    candidatePairs: workload.pairs.length,
    declaredChartStates: workload.pairs.length * workload.chartKeys.length,
    winner: outcome.winner,
    winnerDigest: sha256(outcome.winner),
    metrics: {
      ...metrics,
      b0Survivors: metrics.b0Entrants - metrics.b0Pruned,
      b1Survivors: metrics.b1Entrants - metrics.b1Pruned,
      centralB2Survivors: metrics.centralB2Candidates - metrics.centralStrictLossPrunes,
    },
    ...(outcome.timing ? { timing: outcome.timing } : {}),
    ...(outcome.repeatDeterminism ? { repeatDeterminism: outcome.repeatDeterminism } : {}),
  };
}

function hasNormalizedTiming(architecture) {
  const timing = architecture.timing;
  return timing?.measuredRepeats >= SERIAL_MEASURED_REPEATS &&
    Number.isFinite(timing?.wallMilliseconds?.p50) &&
    Number.isFinite(timing?.wallMilliseconds?.p95) &&
    Number.isFinite(timing?.wallMilliseconds?.worst) &&
    Number.isFinite(timing?.cpuMilliseconds?.user?.p50) &&
    Number.isFinite(timing?.cpuMilliseconds?.system?.p50) &&
    Number.isFinite(timing?.memory?.maximumObservedRssBytes);
}

function summarizeRepeatedArchitecture(measurements, workload) {
  if (measurements.length === 0) throw new Error("A repeated architecture summary needs at least one measurement");
  const outcomes = measurements.map((entry) => entry.outcome);
  const representative = summarizeArchitecture(outcomes[0], workload);
  const expectedDigest = sha256(outcomes[0].winner);
  const repeatWinnerDigests = outcomes.map((outcome) => sha256(outcome.winner));
  // Per-run elapsed/component timing is intentionally variable. Determinism
  // here means the discrete work accounting, prune counts, and proof modes.
  const stableMetrics = (metrics) => Object.fromEntries(
    Object.entries(metrics).filter(([key]) => !key.endsWith("Milliseconds")),
  );
  const repeatMetricsDigests = outcomes.map((outcome) => sha256(stableMetrics(outcome.metrics)));
  const timing = measurementSummary(measurements);
  return {
    ...representative,
    // The p50 is the reported serial elapsed value. Raw repeat values, p95,
    // worst, CPU, RSS, and diagnostic heap deltas remain below for review.
    elapsedMilliseconds: rounded(timing.wallMilliseconds.p50),
    timing,
    repeatDeterminism: {
      expectedWinnerDigest: expectedDigest,
      repeatWinnerDigests,
      repeatMetricsDigests,
      winnersIdentical: repeatWinnerDigests.every((digest) => digest === expectedDigest),
      metricsIdentical: repeatMetricsDigests.every((digest) => digest === repeatMetricsDigests[0]),
    },
  };
}

function assertArchitectureSetParity(orderedB3Reference, a, b, c) {
  const orderedReferenceToA = assertWinnerParity(orderedB3Reference, a);
  const AtoB = assertWinnerParity(a, b);
  const AtoC = assertWinnerParity(a, c);
  return {
    orderedReferenceToA,
    AtoB,
    AtoC,
    passed: orderedReferenceToA.passed && AtoB.passed && AtoC.passed,
  };
}

function runSerialCampaign(workload) {
  const jobs = {
    orderedB3Reference: () => runOrderedB3Reference(workload),
    A: () => runArchitectureA(workload),
    B: () => runArchitectureB(workload),
    C: () => runArchitectureC(workload),
  };
  const warmupParity = [];
  for (let index = 0; index < SERIAL_WARM_UP_RUNS; index += 1) {
    const orderedB3Reference = jobs.orderedB3Reference();
    const a = jobs.A();
    const b = jobs.B();
    const c = jobs.C();
    const parity = assertArchitectureSetParity(orderedB3Reference, a, b, c);
    if (!parity.passed) throw new Error(`Serial warm-up ${index + 1} diverged`);
    warmupParity.push({
      orderedReferenceToA: parity.orderedReferenceToA.passed,
      AtoB: parity.AtoB.passed,
      AtoC: parity.AtoC.passed,
    });
  }
  const measurements = { orderedB3Reference: [], A: [], B: [], C: [] };
  const repeatParity = [];
  for (let index = 0; index < SERIAL_MEASURED_REPEATS; index += 1) {
    const orderedB3Reference = runMeasured(jobs.orderedB3Reference);
    const a = runMeasured(jobs.A);
    const b = runMeasured(jobs.B);
    const c = runMeasured(jobs.C);
    const parity = assertArchitectureSetParity(
      orderedB3Reference.outcome,
      a.outcome,
      b.outcome,
      c.outcome,
    );
    if (!parity.passed) throw new Error(`Serial measured repeat ${index + 1} diverged`);
    measurements.orderedB3Reference.push(orderedB3Reference);
    measurements.A.push(a);
    measurements.B.push(b);
    measurements.C.push(c);
    repeatParity.push({
      orderedReferenceToA: parity.orderedReferenceToA.passed,
      AtoB: parity.AtoB.passed,
      AtoC: parity.AtoC.passed,
    });
  }
  return { warmupParity, repeatParity, measurements };
}

function assertWinnerParity(reference, candidate) {
  const equal = canonicalize(reference.winner) === canonicalize(candidate.winner);
  return {
    expectedWinnerDigest: sha256(reference.winner),
    actualWinnerDigest: sha256(candidate.winner),
    passed: equal,
    expected: reference.winner,
    actual: candidate.winner,
  };
}

function runWorker(workerCountValue, workerIndexValue) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      "--import",
      "tsx/esm",
      SCRIPT_PATH,
      `--worker-count=${workerCountValue}`,
      `--worker-index=${workerIndexValue}`,
    ], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Rebaseline worker ${workerIndexValue}/${workerCountValue} failed (${code}): ${stderr.trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Rebaseline worker ${workerIndexValue}/${workerCountValue} returned invalid JSON: ${String(error)}`));
      }
    });
  });
}

async function runParallelC(workload, workers) {
  const started = performance.now();
  const workerResults = await Promise.all(Array.from({ length: workers }, (_, index) => runWorker(workers, index)));
  const winner = workerResults.reduce((best, result) => preferred(result.winner, best), null);
  return {
    workers,
    elapsedMilliseconds: rounded(performance.now() - started),
    winner,
    metrics: combineMetrics(workerResults.map((result) => result.metrics)),
    workerElapsedMilliseconds: workerResults.map((result) => result.elapsedMilliseconds),
  };
}

async function main() {
  const workload = buildWorkload();
  if (isWorker) {
    const pairs = workload.nonInitial.filter((_, index) => index % workerCount === workerIndex);
    process.stdout.write(`${JSON.stringify(runArchitectureC(workload, pairs))}\n`);
    return;
  }
  const started = performance.now();
  const serialCampaign = runSerialCampaign(workload);
  const orderedB3Reference = summarizeRepeatedArchitecture(
    serialCampaign.measurements.orderedB3Reference,
    workload,
  );
  const a = summarizeRepeatedArchitecture(serialCampaign.measurements.A, workload);
  const b = summarizeRepeatedArchitecture(serialCampaign.measurements.B, workload);
  const c = summarizeRepeatedArchitecture(serialCampaign.measurements.C, workload);
  const serialParity = assertArchitectureSetParity(orderedB3Reference, a, b, c);
  const parallelMeasurements = [];
  if (!hasArgument("--skip-parallel")) {
    for (const workers of [2, 4, 8, 16, 32]) {
      const measurement = await runParallelC(workload, workers);
      parallelMeasurements.push({
        ...measurement,
        outputParity: assertWinnerParity(c, measurement),
        speedupVersusSerialC: c.elapsedMilliseconds / measurement.elapsedMilliseconds,
        efficiencyVersusSerialC: c.elapsedMilliseconds / (measurement.elapsedMilliseconds * workers),
      });
    }
  }
  const parallel = {
    timingStatus: parallelMeasurements.length === 0 ? "serial-only-repeated" : "mixed-serial-timing-and-parity-only-replay",
    timingUse: "not used for throughput, p95, cost, or scale projection",
    reason: parallelMeasurements.length === 0
      ? "The one-worker serial C record has normalized repeated timing; no independent worker replay was requested."
      : "The one-worker serial C record has normalized repeated timing. Each 2/4/8/16/32-worker run was performed once only to independently replay the winner, so those values are not timing samples and are not used for p95, throughput, cost, or scale projection.",
    measurements: [
      {
        workers: 1,
        measurementKind: "serial-repeated-timing",
        timingUse: "normalized serial architecture timing only; not used for full-scope scale projection",
        elapsedMilliseconds: c.elapsedMilliseconds,
        timing: c.timing,
        outputParity: { passed: true, source: "serial C winner" },
      },
      ...parallelMeasurements.map((entry) => ({
        ...entry,
        measurementKind: "deterministic-parity-only-unrepeated",
        timingUse: "not timing evidence; not used for p50/p95/worst, throughput, cost, or scale projection",
      })),
    ],
  };
  const allParityPassed =
    serialParity.passed &&
    parallelMeasurements.every((entry) => entry.outputParity.passed);
  const checks = [
    {
      id: "identical-30-chart-input-scope",
      target: "A, B, and C must use the same fixed 8-team × 4-Leader candidate pool, same incumbent, and all 30 scope charts.",
      actual: {
        candidatePairs: workload.pairs.length,
        chartCount: workload.chartKeys.length,
        declaredChartStates: workload.pairs.length * workload.chartKeys.length,
        workloadHash: workload.workloadHash,
      },
      passed: workload.chartKeys.length === 30 && workload.pairs.length === TEAM_COUNT * LEADER_COUNT,
    },
    {
      id: "A-B-C-canonical-winner-parity",
      target: "B and C winner tuple must equal source-order A exactly at lower/central/upper micro-units and tie key.",
      actual: { AtoB: serialParity.AtoB.passed, AtoC: serialParity.AtoC.passed },
      passed: serialParity.AtoB.passed && serialParity.AtoC.passed,
    },
    {
      id: "ordered-B3-reference-parity",
      target: "The independent ordered-state B3 reference winner must equal the flat bulk-B2/B3 A winner.",
      actual: { orderedReferenceToA: serialParity.orderedReferenceToA.passed },
      passed: serialParity.orderedReferenceToA.passed,
    },
    {
      id: "A-identical-central-workload",
      target: "A must attempt the bulk-certified B2 central evaluator for all 32 × 30 declared chart states before B3 promotion policy applies.",
      actual: {
        declaredChartStates: workload.pairs.length * workload.chartKeys.length,
        attemptedCentralB2ChartStates: a.metrics.centralB2ChartStates,
      },
      passed: a.metrics.centralB2ChartStates === workload.pairs.length * workload.chartKeys.length,
    },
    {
      id: "B2-equality-and-fallback-promotion",
      target: "No equality, finalist, or B2 fallback may be pruned without B3 materialization.",
      actual: {
        A: {
          fallbackCount: a.metrics.centralB2Fallbacks,
          equalityOrFinalistPromotions: a.metrics.centralEqualityOrFinalistPromotions,
          centralCertificateMismatches: a.metrics.centralCertificateMismatches,
        },
        B: {
          fallbackCount: b.metrics.centralB2Fallbacks,
          equalityOrFinalistPromotions: b.metrics.centralEqualityOrFinalistPromotions,
          centralCertificateMismatches: b.metrics.centralCertificateMismatches,
        },
        C: {
          fallbackCount: c.metrics.centralB2Fallbacks,
          equalityOrFinalistPromotions: c.metrics.centralEqualityOrFinalistPromotions,
          centralCertificateMismatches: c.metrics.centralCertificateMismatches,
        },
      },
      passed:
        a.metrics.centralCertificateMismatches === 0 &&
        b.metrics.centralCertificateMismatches === 0 &&
        c.metrics.centralCertificateMismatches === 0,
    },
    {
      id: "strict-bound-pruning-only",
      target: "B0/B1/B2 pruning comparisons must be strict less-than on canonical central micro-units.",
      actual: {
        implementation: "Each branch is `boundOrCentral < incumbent.central`; equality is recorded as a B3 promotion.",
        winnerParityAgainstA: serialParity.AtoC.passed,
      },
      passed: serialParity.AtoC.passed,
    },
    {
      id: "serial-repeat-determinism-and-normalization",
      target: "One deterministic warm-up and five measured serial repeats per ordered reference/A/B/C path must preserve winner and metric digests; p50/p95/worst/CPU/RSS are recorded in a common workload unit.",
      actual: {
        warmupRunsPerPath: SERIAL_WARM_UP_RUNS,
        measuredRepeatsPerPath: SERIAL_MEASURED_REPEATS,
        warmupParity: serialCampaign.warmupParity,
        measuredParity: serialCampaign.repeatParity,
        commonUnit: "one fixed 32 candidate-pair × 30 chart workload (960 declared chart states)",
        winnersIdentical: [
          orderedB3Reference.repeatDeterminism.winnersIdentical,
          a.repeatDeterminism.winnersIdentical,
          b.repeatDeterminism.winnersIdentical,
          c.repeatDeterminism.winnersIdentical,
        ].every(Boolean),
        metricsIdentical: [
          orderedB3Reference.repeatDeterminism.metricsIdentical,
          a.repeatDeterminism.metricsIdentical,
          b.repeatDeterminism.metricsIdentical,
          c.repeatDeterminism.metricsIdentical,
        ].every(Boolean),
        normalizedTimingPresent: [orderedB3Reference, a, b, c].every(hasNormalizedTiming),
      },
      passed: [
        orderedB3Reference.repeatDeterminism.winnersIdentical,
        a.repeatDeterminism.winnersIdentical,
        b.repeatDeterminism.winnersIdentical,
        c.repeatDeterminism.winnersIdentical,
        orderedB3Reference.repeatDeterminism.metricsIdentical,
        a.repeatDeterminism.metricsIdentical,
        b.repeatDeterminism.metricsIdentical,
        c.repeatDeterminism.metricsIdentical,
      ].every(Boolean) && [orderedB3Reference, a, b, c].every(hasNormalizedTiming),
    },
    {
      id: "candidate-worker-replay",
      target: "Each observed worker count must reduce independently computed C outputs to the serial C winner. These are parity-only runs, not repeated timing measurements.",
      actual: parallel.timingStatus === "not-run"
        ? parallel.reason
        : parallel.measurements.map((entry) => ({ workers: entry.workers, passed: entry.outputParity.passed })),
      passed: parallel.timingStatus === "not-run"
        ? null
        : parallel.measurements.every((entry) => entry.outputParity.passed),
    },
  ];
  const passed = checks.every((check) => check.passed !== false);
  const reportWithoutHash = {
    schemaVersion: 1,
    reportId: REPORT_ID,
    runnerVersion: RUNNER_VERSION,
    generatedAt: new Date().toISOString(),
    scopeHash: exactOptimizerScope.scopeHash,
    workload: {
      candidateSelection: "first eight distinct canonical Member tuples and first four canonical Leader IDs from the pinned 100k parity corpus; cross-product sorted by canonical candidate key",
      teams: workload.teams,
      leaders: workload.leaders,
      incumbent: workload.initial,
      chartKeys: workload.chartKeys,
      chartCount: workload.chartKeys.length,
      candidatePairs: workload.pairs.length,
      declaredChartStates: workload.pairs.length * workload.chartKeys.length,
      workloadHash: workload.workloadHash,
    },
    measurementProtocol: {
      serialWarmupRunsPerPath: SERIAL_WARM_UP_RUNS,
      serialMeasuredRepeatsPerPath: SERIAL_MEASURED_REPEATS,
      commonUnit: "one fixed 32 candidate-pair × 30 chart workload (960 declared chart states)",
      serialOrderPerRepeat: ["ordered-state B3 reference", "A", "B", "C"],
      percentileMethod: "nearest-rank",
      allocationTelemetry: "Exact allocation counters are unavailable without an instrumentation build; process heap/RSS snapshots are recorded as diagnostics.",
    },
    architectures: [
      summarizeArchitecture(a, workload),
      summarizeArchitecture(b, workload),
      summarizeArchitecture(c, workload),
    ],
    orderedB3Reference: summarizeArchitecture(orderedB3Reference, workload),
    parity: {
      orderedReferenceToA: serialParity.orderedReferenceToA,
      AtoB: serialParity.AtoB,
      AtoC: serialParity.AtoC,
      allPassed: allParityPassed,
    },
    parallel,
    checks,
    passed,
    certificateEligible: false,
    disposition: passed
      ? "Identical-scope rebaseline passed. It is a compact architecture measurement only; it neither executes the full shard plan nor certifies a global result."
      : "Rebaseline parity failed; no performance conclusion may be used to select or authorize an exact-search architecture.",
    elapsedMilliseconds: rounded(performance.now() - started),
  };
  const report = {
    ...reportWithoutHash,
    deterministicReportHash: sha256({ ...reportWithoutHash, generatedAt: "omitted-for-deterministic-hash" }),
  };
  writeFileSync(join(ROOT, OUTPUT_PATH), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

await main();
