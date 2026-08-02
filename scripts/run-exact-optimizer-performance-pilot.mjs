import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, totalmem } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import {
  canPruneByStrictCentralUpperBound,
  compareCanonicalCandidates,
  toCanonicalMicroUnits,
  upperBoundToCanonicalMicroUnits,
} from "../packages/core/src/exact-optimizer-arithmetic.ts";
import { compileExactOptimizerTeam, evaluateExactOptimizerTeamLeader } from "../packages/core/src/exact-optimizer-kernel.ts";
import { compileNativeGlobalBoundContext, compileNativeLeaderRootBounds } from "../packages/core/src/native-global-bound.ts";
import { searchNativeGlobalTeams } from "../packages/core/src/native-global-search.ts";
import { mechanicsData } from "../packages/core/src/mechanics.ts";
import { publicCardById } from "../packages/core/src/public-data.ts";
import { exactOptimizerScope } from "../packages/core/src/exact-optimizer-scope.ts";
import { songContextData } from "../packages/core/src/song-contexts.ts";

const ROOT = process.cwd();
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const OUTPUTS = {
  pilot: join(ROOT, "data/native/exact-optimizer-performance-pilot-v1.json"),
  costModel: join(ROOT, "data/native/exact-optimizer-cost-model-v2.json"),
};
const PILOT_VERSION = "yd-exact-optimizer-stratified-pilot-2.0.0";
const COST_MODEL_VERSION = "yd-exact-optimizer-cost-model-3.0.0";
const SELECTED_ARCHITECTURE = "C-hybrid-team-sieve-fixed-leader-bound-compressed-exact";
const BOARD = exactOptimizerScope.account;

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

function rounded(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function percentile(values, quantile) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))];
}

function averageCanonical(values) {
  if (values.length === 0) throw new Error("A candidate requires at least one chart value");
  const average = (field) =>
    toCanonicalMicroUnits(values.reduce((total, value) => total + value[field] / 1_000_000, 0) / values.length);
  return { lower: average("lower"), central: average("central"), upper: average("upper") };
}

function candidateFrom(team, leaderCardId, utilities) {
  return {
    leaderCardId,
    memberCardIds: [...team].sort((left, right) => left.localeCompare(right)),
    utility: averageCanonical(utilities),
  };
}

function candidateKey(candidate) {
  return `${candidate.leaderCardId}|${candidate.memberCardIds.join("|")}`;
}

function preferred(left, right) {
  return right === null || compareCanonicalCandidates(left, right) > 0 ? left : right;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), "utf8"));
}

function commandVersion(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unavailable";
  }
}

function buildResearchProfile() {
  const started = performance.now();
  try {
    execFileSync(
      "cargo",
      ["build", "--profile", "certification", "--manifest-path", "tools/exact-global-solver/Cargo.toml"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return {
      status: "built",
      profile: "certification",
      elapsedMilliseconds: rounded(performance.now() - started),
      semanticUse: "research-only; not selected as the certifying evaluator",
      fastMathOrReassociation: false,
    };
  } catch (error) {
    return {
      status: "build-unavailable",
      profile: "certification",
      elapsedMilliseconds: rounded(performance.now() - started),
      semanticUse: "research-only; not selected as the certifying evaluator",
      fastMathOrReassociation: false,
      failure: error instanceof Error ? error.message.split("\n")[0] : String(error),
    };
  }
}

function aggregateCharts() {
  const songs = new Map(songContextData.songs.map((song) => [song.id, song]));
  return songContextData.charts
    .filter((chart) => chart.fidelity === "aggregate")
    .map((chart) => ({ chart, song: songs.get(chart.songId) }))
    .filter((entry) => entry.song)
    .sort((left, right) => left.chart.key.localeCompare(right.chart.key));
}

function talentGroups() {
  const eligible = new Set(exactOptimizerScope.eligibility.eligibleMemberCardIds);
  const groups = new Map();
  for (const card of mechanicsData.cards) {
    if (!eligible.has(card.cardId)) continue;
    const cardIds = groups.get(card.talentId) ?? [];
    cardIds.push(card.cardId);
    groups.set(card.talentId, cardIds);
  }
  return [...groups.entries()]
    .map(([talentId, cardIds]) => ({ talentId, cardIds: [...cardIds].sort((left, right) => left.localeCompare(right)) }))
    .sort((left, right) => left.talentId.localeCompare(right.talentId));
}

function enumerateLegalTeams(groups) {
  const teams = [];
  const selected = [];
  const visit = (groupIndex, fiveStars) => {
    if (selected.length === 5) {
      teams.push([...selected].sort((left, right) => left.localeCompare(right)));
      return;
    }
    if (groups.length - groupIndex < 5 - selected.length) return;
    if (groupIndex >= groups.length) return;
    visit(groupIndex + 1, fiveStars);
    for (const cardId of groups[groupIndex].cardIds) {
      const rarity = mechanicsData.cards.find((card) => card.cardId === cardId)?.rarity;
      if (rarity === 5 && fiveStars >= exactOptimizerScope.eligibility.maximumFiveStarMembers) continue;
      selected.push(cardId);
      visit(groupIndex + 1, fiveStars + (rarity === 5 ? 1 : 0));
      selected.pop();
    }
  };
  visit(0, 0);
  return teams;
}

function leaderComplexity(cardId) {
  const card = mechanicsData.cards.find((candidate) => candidate.cardId === cardId);
  if (!card) throw new Error(`Unknown Leader ${cardId}`);
  return card.leaderOutfit.applications.reduce((total, application) =>
    total + 1 + (application.trigger ? 2 : 0) + (application.target ? 1 : 0) +
      (application.combination.startsWith("conditional") ? 1 : 0), 0);
}

function nearestUnused(sorted, quantile, used) {
  const start = Math.round((sorted.length - 1) * quantile);
  for (let offset = 0; offset < sorted.length; offset += 1) {
    for (const index of [start + offset, start - offset]) {
      const candidate = sorted[index];
      if (candidate && !used.has(candidate.cardId)) return candidate;
    }
  }
  throw new Error("Cannot select a unique leader quantile");
}

function chooseLeaderAnchors() {
  const rootEvidence = readJson("data/native/exact-optimizer-leader-root-bounds-v1.json");
  const rootByCardId = new Map(rootEvidence.fixedLeaderRecords.map((entry) => [
    entry.representativeCardId,
    entry.upperCentralMicroUnits,
  ]));
  const charts = aggregateCharts();
  const candidates = exactOptimizerScope.eligibility.eligibleLeaderOutfitCardIds
    .map((cardId) => {
      const card = mechanicsData.cards.find((entry) => entry.cardId === cardId);
      const matched = charts.filter((entry) => entry.song.singerTalentIds.includes(card.talentId));
      const unmatched = charts.filter((entry) => !entry.song.singerTalentIds.includes(card.talentId));
      return {
        cardId,
        triggerComplexity: leaderComplexity(cardId),
        rootUpperCentralMicroUnits: rootByCardId.get(cardId),
        matchedChartKey: matched[0]?.chart.key ?? null,
        unmatchedChartKey: unmatched[0]?.chart.key ?? null,
      };
    })
    .filter((entry) =>
      entry.rootUpperCentralMicroUnits !== undefined &&
      entry.matchedChartKey !== null &&
      entry.unmatchedChartKey !== null,
    );
  if (candidates.length < 4) throw new Error("Pilot needs four Leaders with matched and unmatched charts");
  const byTrigger = [...candidates].sort((left, right) =>
    left.triggerComplexity - right.triggerComplexity || left.cardId.localeCompare(right.cardId));
  const byRootBound = [...candidates].sort((left, right) =>
    left.rootUpperCentralMicroUnits - right.rootUpperCentralMicroUnits || left.cardId.localeCompare(right.cardId));
  const used = new Set();
  const selections = [
    { label: "trigger-q25", source: "leader-trigger-complexity", candidate: nearestUnused(byTrigger, 0.25, used) },
    { label: "trigger-q75", source: "leader-trigger-complexity", candidate: nearestUnused(byTrigger, 0.75, used) },
    { label: "root-bound-q25", source: "full-root-bound", candidate: nearestUnused(byRootBound, 0.25, used) },
    { label: "root-bound-q75", source: "full-root-bound", candidate: nearestUnused(byRootBound, 0.75, used) },
  ];
  return selections.map((selection) => {
    used.add(selection.candidate.cardId);
    return {
      label: selection.label,
      source: selection.source,
      cardId: selection.candidate.cardId,
      triggerComplexity: selection.candidate.triggerComplexity,
      rootUpperCentralMicroUnits: selection.candidate.rootUpperCentralMicroUnits,
      chartKeys: [selection.candidate.matchedChartKey, selection.candidate.unmatchedChartKey],
    };
  });
}

function teamParameterScore(team) {
  return team.reduce((total, cardId) => {
    const card = publicCardById.get(cardId);
    if (!card) throw new Error(`Missing public card for pilot seed: ${cardId}`);
    const parameters = card.parameters.maxPotential;
    return total + parameters.performance + parameters.technique + parameters.sense;
  }, 0);
}

function makeStratifiedShards() {
  const groups = talentGroups();
  const anchors = chooseLeaderAnchors();
  const ranges = [
    { id: "prefix-00", start: 0 },
    { id: "prefix-14", start: 14 },
    { id: "prefix-28", start: 28 },
    { id: "prefix-42", start: 42 },
  ];
  const sizes = [
    { id: "small-7-talents", count: 7 },
    { id: "medium-8-talents", count: 8 },
  ];
  const shards = [];
  for (const [rangeIndex, range] of ranges.entries()) {
    for (const [sizeIndex, size] of sizes.entries()) {
      const selectedGroups = groups.slice(range.start, range.start + size.count);
      if (selectedGroups.length !== size.count) throw new Error(`Pilot prefix ${range.id} lacks ${size.count} groups`);
      const memberCardIds = selectedGroups.flatMap((group) => group.cardIds);
      const teams = enumerateLegalTeams(selectedGroups);
      if (teams.length === 0) throw new Error(`Pilot prefix ${range.id}/${size.id} has no legal team`);
      const byParameter = [...teams].sort((left, right) =>
        teamParameterScore(left) - teamParameterScore(right) || left.join("|").localeCompare(right.join("|")));
      for (const [leaderIndex, leader] of anchors.entries()) {
        const easy = (rangeIndex + sizeIndex + leaderIndex) % 2 === 0;
        const seedTeam = easy ? byParameter[byParameter.length - 1] : byParameter[0];
        const seedProfile = easy
          ? "easy-high-parameter-deterministic-seed"
          : "hard-low-parameter-deterministic-seed";
        shards.push({
          id: `${range.id}-${size.id}-${leader.label}-${easy ? "easy" : "hard"}`,
          prefix: {
            startGroupIndex: range.start,
            endGroupExclusive: range.start + size.count,
            firstTalentId: selectedGroups[0].talentId,
            lastTalentId: selectedGroups[selectedGroups.length - 1].talentId,
            talentCount: size.count,
          },
          shardSize: size.id,
          memberCardIds,
          legalTeams: teams,
          leader,
          chartKeys: leader.chartKeys,
          seedTeam,
          seedProfile,
        });
      }
    }
  }
  return { anchors, shards };
}

function newMetrics() {
  return {
    teamCompilations: 0,
    teamCompilationMilliseconds: 0,
    leaderTeamPairs: 0,
    leaderTeamChartStates: 0,
    traceSegments: 0,
    traceFallbacks: 0,
    exactCentralEvaluations: 0,
    exactIntervalEvaluations: 0,
    exactKernelMilliseconds: 0,
    b0Entrants: 0,
    b0Pruned: 0,
    b0Milliseconds: 0,
    b1Entrants: 0,
    b1Pruned: 0,
    b1Milliseconds: 0,
    b2Entrants: 0,
    b2Pruned: 0,
  };
}

function compiledTeamFor(shard, memberCardIds, cache, metrics) {
  const key = memberCardIds.join("|");
  const cached = cache.get(key);
  if (cached) return cached;
  const bloomStageByCardId = Object.fromEntries(memberCardIds.map((cardId) => [
    cardId,
    exactOptimizerScope.investment.bloomStageByCardId[cardId],
  ]));
  const started = performance.now();
  const team = compileExactOptimizerTeam({
    memberCardIds,
    investmentLayer: exactOptimizerScope.investment.layer,
    bloomStageByCardId,
  });
  metrics.teamCompilationMilliseconds += performance.now() - started;
  metrics.teamCompilations += 1;
  cache.set(key, team);
  return team;
}

function evaluateCompiledAggregate(shard, memberCardIds, leaderCardId, cache, metrics) {
  const team = compiledTeamFor(shard, memberCardIds, cache, metrics);
  const utilities = [];
  metrics.leaderTeamPairs += 1;
  for (const chartKey of shard.chartKeys) {
    const started = performance.now();
    const evaluation = evaluateExactOptimizerTeamLeader({
      team,
      leaderOutfitCardId: leaderCardId,
      chartKey,
      seed: exactOptimizerScope.seed,
      accountState: BOARD,
    });
    metrics.exactKernelMilliseconds += performance.now() - started;
    metrics.leaderTeamChartStates += 1;
    metrics.exactCentralEvaluations += 1;
    metrics.exactIntervalEvaluations += 1;
    metrics.traceSegments +=
      evaluation.execution.activeTrace.baseStateRuns +
      evaluation.execution.activeTrace.specialSupportStateRuns +
      evaluation.execution.activeTrace.specialStateRuns;
    if (evaluation.execution.mode !== "trace-preserving-state-runs") metrics.traceFallbacks += 1;
    utilities.push(evaluation.canonicalUtility);
  }
  return candidateFrom(team.memberCardIds, leaderCardId, utilities);
}

function baseOutcome(shard, architecture, started, best, metrics, stages, extra = {}) {
  const elapsedMilliseconds = performance.now() - started;
  const rssAfterBytes = process.memoryUsage().rss;
  return {
    shardId: shard.id,
    architecture,
    prefix: shard.prefix,
    shardSize: shard.shardSize,
    leader: {
      cardId: shard.leader.cardId,
      selection: shard.leader.label,
      selectionSource: shard.leader.source,
      triggerComplexity: shard.leader.triggerComplexity,
      rootUpperCentralMicroUnits: shard.leader.rootUpperCentralMicroUnits,
    },
    chartKeys: shard.chartKeys,
    singerCoverage: { matched: shard.chartKeys[0], unmatched: shard.chartKeys[1] },
    seedProfile: shard.seedProfile,
    legalTeamSets: shard.legalTeams.length,
    winner: best,
    elapsedMilliseconds: rounded(elapsedMilliseconds),
    rssAfterBytes,
    metrics,
    stages,
    ...extra,
  };
}

function runArchitectureA(shard) {
  const started = performance.now();
  const rssBeforeBytes = process.memoryUsage().rss;
  const metrics = newMetrics();
  const cache = new Map();
  let best = null;
  for (const team of shard.legalTeams) {
    const candidate = evaluateCompiledAggregate(shard, team, shard.leader.cardId, cache, metrics);
    best = preferred(candidate, best);
  }
  return baseOutcome(shard, "A-compressed-team-first-enumeration", started, best, metrics, {
    B0: { meaning: "not-employed-by-flat-enumeration", entrants: 0, pruned: 0, survivors: 0 },
    B1: { meaning: "not-employed-by-flat-enumeration", entrants: 0, pruned: 0, survivors: 0 },
    B2: { meaning: "not-employed-by-flat-enumeration", entrants: 0, pruned: 0, survivors: 0 },
  }, { rssBeforeBytes });
}

function rootPreflight(shard, leaderIds, seedCentral) {
  const started = performance.now();
  const bounds = compileNativeLeaderRootBounds({
    partialMemberCardIds: [],
    eligibleMemberCardIds: shard.memberCardIds,
    eligibleLeaderOutfitCardIds: leaderIds,
    investmentLayer: exactOptimizerScope.investment.layer,
    bloomStageByCardId: exactOptimizerScope.investment.bloomStageByCardId,
    maxFiveStarMembers: exactOptimizerScope.eligibility.maximumFiveStarMembers,
    chartKeys: shard.chartKeys,
  });
  const b0Pruned = canPruneByStrictCentralUpperBound(bounds.b0.upperCentralMicroUnits, seedCentral);
  const b1Pruned = bounds.b1.filter((entry) =>
    canPruneByStrictCentralUpperBound(entry.upperCentralMicroUnits, seedCentral)).length;
  return {
    bounds,
    elapsedMilliseconds: performance.now() - started,
    B0: { entrants: 1, pruned: b0Pruned ? 1 : 0, survivors: b0Pruned ? 0 : 1 },
    B1: { entrants: bounds.b1.length, pruned: b1Pruned, survivors: bounds.b1.length - b1Pruned },
  };
}

function runArchitectureB(shard) {
  const started = performance.now();
  const rssBeforeBytes = process.memoryUsage().rss;
  const seedMetrics = newMetrics();
  const seed = evaluateCompiledAggregate(shard, shard.seedTeam, shard.leader.cardId, new Map(), seedMetrics);
  const preflight = rootPreflight(shard, [shard.leader.cardId], seed.utility.central);
  const result = searchNativeGlobalTeams({
    eligibleMemberCardIds: shard.memberCardIds,
    eligibleLeaderOutfitCardIds: [shard.leader.cardId],
    initialCandidate: { leaderOutfitCardId: shard.leader.cardId, memberCardIds: shard.seedTeam },
    investmentLayer: exactOptimizerScope.investment.layer,
    bloomStageByCardId: exactOptimizerScope.investment.bloomStageByCardId,
    maxFiveStarMembers: exactOptimizerScope.eligibility.maximumFiveStarMembers,
    chartKeys: shard.chartKeys,
    seed: exactOptimizerScope.seed,
    accountState: BOARD,
  });
  const certificate = result.certificate;
  const metrics = {
    ...seedMetrics,
    leaderTeamPairs: seedMetrics.leaderTeamPairs + certificate.exactLeaderTeamEvaluations,
    leaderTeamChartStates:
      seedMetrics.leaderTeamChartStates + certificate.utilityEvaluations + certificate.intervalUtilityEvaluations,
    exactCentralEvaluations: seedMetrics.exactCentralEvaluations + certificate.utilityEvaluations,
    exactIntervalEvaluations: seedMetrics.exactIntervalEvaluations + certificate.intervalUtilityEvaluations,
    traceSegments: null,
    exactKernelMilliseconds: null,
    b0Entrants: preflight.B0.entrants,
    b0Pruned: preflight.B0.pruned,
    b0Milliseconds: preflight.elapsedMilliseconds,
    b1Entrants: preflight.B1.entrants,
    b1Pruned: preflight.B1.pruned,
    b1Milliseconds: null,
    b2Entrants: certificate.boundEvaluations,
    b2Pruned: certificate.nodesPruned,
  };
  const winner = {
    leaderCardId: result.best.leaderOutfitCardId,
    memberCardIds: result.best.memberCardIds,
    utility: {
      lower: toCanonicalMicroUnits(result.best.relativeUtility.lower),
      central: toCanonicalMicroUnits(result.best.relativeUtility.central),
      upper: toCanonicalMicroUnits(result.best.relativeUtility.upper),
    },
  };
  return baseOutcome(shard, "B-fixed-leader-first-branch-and-bound", started, winner, metrics, {
    B0: { meaning: "fixed-Leader root preflight", ...preflight.B0 },
    B1: { meaning: "fixed-Leader root class preflight", ...preflight.B1 },
    B2: {
      meaning: "actual fixed-Leader partial-member bounds",
      entrants: certificate.boundEvaluations,
      pruned: certificate.nodesPruned,
      survivors: certificate.boundEvaluations - certificate.nodesPruned,
    },
  }, {
    rssBeforeBytes,
    nativeSearch: {
      exactLeafEvaluations: certificate.exactLeafEvaluations,
      prunedTeamSets: certificate.prunedTeamSets,
      utilityEvaluations: certificate.utilityEvaluations,
      intervalUtilityEvaluations: certificate.intervalUtilityEvaluations,
      proofCascade: certificate.proofCascade,
      traceSegmentMetric: "unavailable: native global search does not expose per-state trace segments",
    },
  });
}

function runArchitectureC(shard, b0LeaderIds) {
  const started = performance.now();
  const rssBeforeBytes = process.memoryUsage().rss;
  const metrics = newMetrics();
  const cache = new Map();
  let best = evaluateCompiledAggregate(shard, shard.seedTeam, shard.leader.cardId, cache, metrics);
  const b0ContextStarted = performance.now();
  const b0Context = compileNativeGlobalBoundContext({
    eligibleMemberCardIds: shard.memberCardIds,
    eligibleLeaderOutfitCardIds: b0LeaderIds,
    investmentLayer: exactOptimizerScope.investment.layer,
    bloomStageByCardId: exactOptimizerScope.investment.bloomStageByCardId,
    maxFiveStarMembers: exactOptimizerScope.eligibility.maximumFiveStarMembers,
    chartKeys: shard.chartKeys,
  });
  const b1Context = compileNativeGlobalBoundContext({
    eligibleMemberCardIds: shard.memberCardIds,
    eligibleLeaderOutfitCardIds: [shard.leader.cardId],
    investmentLayer: exactOptimizerScope.investment.layer,
    bloomStageByCardId: exactOptimizerScope.investment.bloomStageByCardId,
    maxFiveStarMembers: exactOptimizerScope.eligibility.maximumFiveStarMembers,
    chartKeys: shard.chartKeys,
  });
  const boundContextBuildMilliseconds = performance.now() - b0ContextStarted;
  for (const memberCardIds of shard.legalTeams) {
    metrics.b0Entrants += 1;
    const b0Started = performance.now();
    const b0 = b0Context.bound({ partialMemberCardIds: memberCardIds });
    metrics.b0Milliseconds += performance.now() - b0Started;
    const b0MicroUnits = upperBoundToCanonicalMicroUnits(b0.upperCentralUtility);
    if (canPruneByStrictCentralUpperBound(b0MicroUnits, best.utility.central)) {
      metrics.b0Pruned += 1;
      continue;
    }
    metrics.b1Entrants += 1;
    const b1Started = performance.now();
    const b1 = b1Context.bound({ partialMemberCardIds: memberCardIds });
    metrics.b1Milliseconds += performance.now() - b1Started;
    const b1MicroUnits = upperBoundToCanonicalMicroUnits(b1.upperCentralUtility);
    if (canPruneByStrictCentralUpperBound(b1MicroUnits, best.utility.central)) {
      metrics.b1Pruned += 1;
      continue;
    }
    metrics.b2Entrants += 1;
    const candidate = evaluateCompiledAggregate(shard, memberCardIds, shard.leader.cardId, cache, metrics);
    if (candidate.utility.central < best.utility.central) {
      metrics.b2Pruned += 1;
      continue;
    }
    best = preferred(candidate, best);
  }
  return baseOutcome(shard, SELECTED_ARCHITECTURE, started, best, metrics, {
    B0: {
      meaning: "four-anchor whole-Leader team sieve; max remains a safe upper bound for the selected Leader",
      entrants: metrics.b0Entrants,
      pruned: metrics.b0Pruned,
      survivors: metrics.b0Entrants - metrics.b0Pruned,
    },
    B1: {
      meaning: "selected fixed-Leader whole-team upper bound",
      entrants: metrics.b1Entrants,
      pruned: metrics.b1Pruned,
      survivors: metrics.b1Entrants - metrics.b1Pruned,
    },
    B2: {
      meaning: "compressed exact central comparison; full interval is materialized by the same trace call",
      entrants: metrics.b2Entrants,
      pruned: metrics.b2Pruned,
      survivors: metrics.b2Entrants - metrics.b2Pruned,
    },
  }, { rssBeforeBytes, boundContextBuildMilliseconds, b0LeaderBundleSize: b0LeaderIds.length });
}

function runArchitecture(architecture, shards, b0LeaderIds) {
  return shards.map((shard) => {
    if (architecture === "A") return runArchitectureA(shard);
    if (architecture === "B") return runArchitectureB(shard);
    if (architecture === "C") return runArchitectureC(shard, b0LeaderIds);
    throw new Error(`Unknown pilot architecture ${architecture}`);
  });
}

function throughput(outcome) {
  const seconds = outcome.elapsedMilliseconds / 1_000;
  const rate = (value) => seconds > 0 && Number.isFinite(value) ? value / seconds : null;
  return {
    teamsPerSecond: rate(outcome.legalTeamSets),
    leaderTeamPairsPerSecond: rate(outcome.metrics.leaderTeamPairs),
    leaderTeamChartStatesPerSecond: rate(outcome.metrics.leaderTeamChartStates),
    segmentsPerSecond: rate(outcome.metrics.traceSegments),
  };
}

function perUnit(value, count) {
  return Number.isFinite(value) && Number.isFinite(count) && count > 0 ? value / count : null;
}

function summarizeArchitecture(id, description, outcomes) {
  const totalElapsedMilliseconds = outcomes.reduce((total, outcome) => total + outcome.elapsedMilliseconds, 0);
  const totals = outcomes.reduce((total, outcome) => ({
    legalTeamSets: total.legalTeamSets + outcome.legalTeamSets,
    leaderTeamPairs: total.leaderTeamPairs + outcome.metrics.leaderTeamPairs,
    leaderTeamChartStates: total.leaderTeamChartStates + outcome.metrics.leaderTeamChartStates,
    traceSegments: total.traceSegments + (Number.isFinite(outcome.metrics.traceSegments) ? outcome.metrics.traceSegments : 0),
    exactCentralEvaluations: total.exactCentralEvaluations + outcome.metrics.exactCentralEvaluations,
    exactIntervalEvaluations: total.exactIntervalEvaluations + outcome.metrics.exactIntervalEvaluations,
    traceFallbacks: total.traceFallbacks + outcome.metrics.traceFallbacks,
    b0Entrants: total.b0Entrants + outcome.metrics.b0Entrants,
    b0Pruned: total.b0Pruned + outcome.metrics.b0Pruned,
    b1Entrants: total.b1Entrants + outcome.metrics.b1Entrants,
    b1Pruned: total.b1Pruned + outcome.metrics.b1Pruned,
    b2Entrants: total.b2Entrants + outcome.metrics.b2Entrants,
    b2Pruned: total.b2Pruned + outcome.metrics.b2Pruned,
  }), {
    legalTeamSets: 0,
    leaderTeamPairs: 0,
    leaderTeamChartStates: 0,
    traceSegments: 0,
    exactCentralEvaluations: 0,
    exactIntervalEvaluations: 0,
    traceFallbacks: 0,
    b0Entrants: 0,
    b0Pruned: 0,
    b1Entrants: 0,
    b1Pruned: 0,
    b2Entrants: 0,
    b2Pruned: 0,
  });
  const rates = outcomes.map(throughput);
  const stageRates = {
    teamOnceMillisecondsPerTeam: outcomes.map((outcome) =>
      perUnit(outcome.metrics.teamCompilationMilliseconds, outcome.metrics.teamCompilations)),
    b0MillisecondsPerEntrant: outcomes.map((outcome) =>
      perUnit(outcome.metrics.b0Milliseconds, outcome.metrics.b0Entrants)),
    b1MillisecondsPerEntrant: outcomes.map((outcome) =>
      perUnit(outcome.metrics.b1Milliseconds, outcome.metrics.b1Entrants)),
    exactKernelMillisecondsPerState: outcomes.map((outcome) =>
      perUnit(outcome.metrics.exactKernelMilliseconds, outcome.metrics.leaderTeamChartStates)),
  };
  const outputDigest = sha256(outcomes.map((outcome) => ({ shardId: outcome.shardId, winner: outcome.winner }))
    .sort((left, right) => left.shardId.localeCompare(right.shardId)));
  return {
    id,
    description,
    outputDigest,
    singleThread: {
      shardCount: outcomes.length,
      totalElapsedMilliseconds: rounded(totalElapsedMilliseconds),
      p50ShardElapsedMilliseconds: percentile(outcomes.map((outcome) => outcome.elapsedMilliseconds), 0.5),
      p95ShardElapsedMilliseconds: percentile(outcomes.map((outcome) => outcome.elapsedMilliseconds), 0.95),
      totals,
      shardThroughput: {
        teamsPerSecond: { p50: percentile(rates.map((rate) => rate.teamsPerSecond), 0.5), p95: percentile(rates.map((rate) => rate.teamsPerSecond), 0.95) },
        leaderTeamPairsPerSecond: { p50: percentile(rates.map((rate) => rate.leaderTeamPairsPerSecond), 0.5), p95: percentile(rates.map((rate) => rate.leaderTeamPairsPerSecond), 0.95) },
        leaderTeamChartStatesPerSecond: { p50: percentile(rates.map((rate) => rate.leaderTeamChartStatesPerSecond), 0.5), p95: percentile(rates.map((rate) => rate.leaderTeamChartStatesPerSecond), 0.95) },
        segmentsPerSecond: { p50: percentile(rates.map((rate) => rate.segmentsPerSecond), 0.5), p95: percentile(rates.map((rate) => rate.segmentsPerSecond), 0.95) },
      },
      stageP95: Object.fromEntries(Object.entries(stageRates).map(([key, values]) => [key, percentile(values, 0.95)])),
      maximumRssBytes: Math.max(...outcomes.map((outcome) => outcome.rssAfterBytes)),
      maximumRssDeltaBytes: Math.max(...outcomes.map((outcome) => outcome.rssAfterBytes - outcome.rssBeforeBytes)),
    },
    shards: outcomes.map((outcome) => ({
      shardId: outcome.shardId,
      prefix: outcome.prefix,
      shardSize: outcome.shardSize,
      leader: outcome.leader,
      chartKeys: outcome.chartKeys,
      singerCoverage: outcome.singerCoverage,
      seedProfile: outcome.seedProfile,
      legalTeamSets: outcome.legalTeamSets,
      elapsedMilliseconds: outcome.elapsedMilliseconds,
      rssBeforeBytes: outcome.rssBeforeBytes,
      rssAfterBytes: outcome.rssAfterBytes,
      throughput: throughput(outcome),
      metrics: outcome.metrics,
      stages: outcome.stages,
      winner: outcome.winner,
      ...(outcome.nativeSearch ? { nativeSearch: outcome.nativeSearch } : {}),
      ...(outcome.boundContextBuildMilliseconds !== undefined
        ? { boundContextBuildMilliseconds: rounded(outcome.boundContextBuildMilliseconds), b0LeaderBundleSize: outcome.b0LeaderBundleSize }
        : {}),
    })),
  };
}

function verifyWinnerParity(reference, candidate, label) {
  const byShard = new Map(reference.map((outcome) => [outcome.shardId, outcome.winner]));
  const mismatches = candidate.filter((outcome) => canonicalize(byShard.get(outcome.shardId)) !== canonicalize(outcome.winner));
  if (mismatches.length > 0) {
    throw new Error(`${label} diverged from compressed team-first enumeration for ${mismatches.length} shard winners`);
  }
  return { matched: true, mismatchCount: 0, canonicalWinnerDigest: sha256(reference.map((outcome) => ({ shardId: outcome.shardId, winner: outcome.winner }))) };
}

function workerArgument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function runWorker(shardId) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx/esm", SCRIPT_PATH, "--worker=hybrid", `--shard=${shardId}`], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Hybrid worker ${shardId} failed (${code}): ${stderr.trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Hybrid worker ${shardId} returned invalid JSON: ${String(error)}`));
      }
    });
  });
}

async function runParallelHybrid(shards, workerCount) {
  const started = performance.now();
  const outcomes = [];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < shards.length) {
      const shard = shards[nextIndex];
      nextIndex += 1;
      outcomes.push(await runWorker(shard.id));
    }
  };
  await Promise.all(Array.from({ length: Math.min(workerCount, shards.length) }, worker));
  const elapsedMilliseconds = performance.now() - started;
  return { elapsedMilliseconds: rounded(elapsedMilliseconds), outcomes };
}

function buildCostModel(pilot, researchBinary) {
  const selected = pilot.architectures.find((architecture) => architecture.id === SELECTED_ARCHITECTURE);
  if (!selected) throw new Error("Selected hybrid architecture is absent from pilot");
  const stageP95 = selected.singleThread.stageP95;
  const legalMemberTeamSets = 126_445_821;
  const eligibleLeaderOutfits = 113;
  const aggregateCharts = 30;
  const leaderTeamPairs = legalMemberTeamSets * eligibleLeaderOutfits;
  const leaderTeamChartStates = leaderTeamPairs * aggregateCharts;
  const teamOnceMilliseconds = stageP95.teamOnceMillisecondsPerTeam;
  const b1Milliseconds = stageP95.b1MillisecondsPerEntrant;
  const exactStateMilliseconds = stageP95.exactKernelMillisecondsPerState;
  if (![teamOnceMilliseconds, b1Milliseconds, exactStateMilliseconds].every(Number.isFinite)) {
    throw new Error("Selected stratified pilot did not measure all projectable C stages");
  }
  const projectedComponents = [
    {
      id: "team-once-compilation",
      unit: "legal-member-team",
      count: legalMemberTeamSets,
      p95MillisecondsPerUnit: teamOnceMilliseconds,
      projectedMilliseconds: legalMemberTeamSets * teamOnceMilliseconds,
      status: "measured-and-projectable",
    },
    {
      id: "B1-fixed-leader-bound",
      unit: "leader-team-pair",
      count: leaderTeamPairs,
      p95MillisecondsPerUnit: b1Milliseconds,
      projectedMilliseconds: leaderTeamPairs * b1Milliseconds,
      status: "measured-and-projectable",
    },
    {
      id: "compressed-exact-leader-team-chart",
      unit: "leader-team-chart-state",
      count: leaderTeamChartStates,
      p95MillisecondsPerUnit: exactStateMilliseconds,
      projectedMilliseconds: leaderTeamChartStates * exactStateMilliseconds,
      status: "measured-and-projectable",
    },
  ];
  const measuredMinimumSerialCoreHours = projectedComponents.reduce(
    (total, component) => total + component.projectedMilliseconds, 0) / 3_600_000;
  const parallelByWorkers = new Map(pilot.parallel.selectedArchitecture.measurements.map((entry) => [entry.workers, entry]));
  const actualWorkers = pilot.parallel.selectedArchitecture.actualCandidateWorkers;
  const wallProjection = (workers, source) => {
    const measured = parallelByWorkers.get(workers);
    const speedup = workers === 1 ? 1 : measured?.speedupVersusSingleThread ?? null;
    return {
      workers,
      source,
      measuredSpeedup: speedup,
      contingencyMultiplier: 1.25,
      wallHours: speedup === null ? null : (measuredMinimumSerialCoreHours * 1.25) / speedup,
    };
  };
  const projection = [
    wallProjection(1, "single-thread baseline"),
    wallProjection(8, "measured candidate-parallel pilot"),
    wallProjection(16, "measured candidate-parallel pilot"),
    wallProjection(32, "measured candidate-parallel pilot"),
    wallProjection(actualWorkers, `actual candidate-worker count (${actualWorkers})`),
  ];
  const cTotals = selected.singleThread.totals;
  const reportWithoutHash = {
    schemaVersion: 3,
    kind: "exact-optimizer-cost-model",
    methodologyVersion: COST_MODEL_VERSION,
    scopeHash: exactOptimizerScope.scopeHash,
    selectedArchitecture: SELECTED_ARCHITECTURE,
    pilotReportHash: pilot.reportHash,
    hardwareAndProfile: {
      researchBinary,
      cpuLogicalCount: cpus().length,
      actualCandidateWorkers: actualWorkers,
    },
    stratifiedP95Measurements: {
      teamOnceMillisecondsPerTeam: teamOnceMilliseconds,
      B0MillisecondsPerFourLeaderTeamSieve: stageP95.b0MillisecondsPerEntrant,
      B1MillisecondsPerFixedLeaderPair: b1Milliseconds,
      compressedExactMillisecondsPerLeaderTeamChartState: exactStateMilliseconds,
      leaderConditioningSeparateTiming: {
        status: "unavailable",
        reason: "Leader application resolution and trace evaluation occur in one exact kernel call; the model does not invent a sub-call split.",
      },
      compression: {
        status: "measured",
        source: "selected architecture exact-kernel p95 state timing; full 100k parity separately confirms zero fallback",
      },
      observedPilotPruning: {
        B0: { entrants: cTotals.b0Entrants, pruned: cTotals.b0Pruned, survivors: cTotals.b0Entrants - cTotals.b0Pruned },
        B1: { entrants: cTotals.b1Entrants, pruned: cTotals.b1Pruned, survivors: cTotals.b1Entrants - cTotals.b1Pruned },
        B2: { entrants: cTotals.b2Entrants, pruned: cTotals.b2Pruned, survivors: cTotals.b2Entrants - cTotals.b2Pruned },
        projectionCredit: "zero; stratified pilot pruning is not extrapolated to the full scope",
      },
    },
    declaredWork: {
      legalMemberTeamSets,
      eligibleLeaderOutfits,
      aggregateCharts,
      leaderTeamPairs,
      leaderTeamChartStates,
    },
    measuredMinimumNoPruningProjection: {
      components: projectedComponents,
      B0Full113LeaderProjection: {
        status: "unavailable",
        reason: "The measured B0 sieve uses a four-Leader anchor bundle; scaling its whole-Leader maximum to 113 Leaders has not been measured and is excluded rather than fabricated.",
      },
      serialCoreHours: measuredMinimumSerialCoreHours,
      interpretation: "Minimum measured cost before any unmeasured B0 full-class scaling, I/O, retries, aggregation, or independent replay. It intentionally grants zero pruning credit.",
    },
    parallelism: {
      candidateParallelismOnly: true,
      traceArithmeticRemainsSerial: true,
      measurements: pilot.parallel.selectedArchitecture.measurements,
      wallHoursWith25PercentContingency: projection,
    },
    decision: {
      fullRunAuthorized: false,
      thresholds: { maximumWallHours: 72, maximumCoreHours: 1_000 },
      reasons: [
        "The p95 no-pruning minimum already exceeds the declared offline budget before unmeasured B0 full-class work and independent replay.",
        "The full 113-class root ledger produced zero root prunes against its bounded incumbent, so no root-pruning credit is asserted.",
        "No full shard execution was launched.",
      ],
    },
    certificateEligible: false,
  };
  return { ...reportWithoutHash, reportHash: sha256(reportWithoutHash) };
}

async function main() {
  const workload = makeStratifiedShards();
  const b0LeaderIds = workload.anchors.map((anchor) => anchor.cardId);
  const worker = workerArgument("worker");
  if (worker !== null) {
    if (worker !== "hybrid") throw new Error(`Unknown pilot worker ${worker}`);
    const shardId = workerArgument("shard");
    const shard = workload.shards.find((entry) => entry.id === shardId);
    if (!shard) throw new Error(`Unknown pilot shard ${shardId}`);
    process.stdout.write(`${JSON.stringify(runArchitectureC(shard, b0LeaderIds))}\n`);
    return;
  }

  const researchBinary = buildResearchProfile();
  const architectureA = runArchitecture("A", workload.shards, b0LeaderIds);
  const architectureB = runArchitecture("B", workload.shards, b0LeaderIds);
  const architectureC = runArchitecture("C", workload.shards, b0LeaderIds);
  const bParity = verifyWinnerParity(architectureA, architectureB, "Architecture B");
  const cParity = verifyWinnerParity(architectureA, architectureC, "Architecture C");
  const architectureSummaries = [
    summarizeArchitecture(
      "A-compressed-team-first-enumeration",
      "Compile each legal Member team once, then evaluate its fixed Leader/chart states with trace-preserving replay.",
      architectureA,
    ),
    summarizeArchitecture(
      "B-fixed-leader-first-branch-and-bound",
      "Use the actual fixed-Leader native branch-and-bound traversal over the identical shard roster and chart pair.",
      architectureB,
    ),
    summarizeArchitecture(
      SELECTED_ARCHITECTURE,
      "Whole-Leader B0 team sieve, fixed-Leader B1 bound, then compressed exact central/interval evaluation for survivors.",
      architectureC,
    ),
  ];
  const selectedSingleThread = architectureSummaries.find((architecture) => architecture.id === SELECTED_ARCHITECTURE);
  const requestedWorkers = [8, 16, 32];
  const parallelMeasurements = [];
  for (const workers of requestedWorkers) {
    const parallel = await runParallelHybrid(workload.shards, workers);
    const parity = verifyWinnerParity(architectureC, parallel.outcomes, `Hybrid ${workers}-worker replay`);
    parallelMeasurements.push({
      workers,
      elapsedMilliseconds: parallel.elapsedMilliseconds,
      speedupVersusSingleThread: selectedSingleThread.singleThread.totalElapsedMilliseconds / parallel.elapsedMilliseconds,
      parallelEfficiency: selectedSingleThread.singleThread.totalElapsedMilliseconds / (parallel.elapsedMilliseconds * workers),
      canonicalWinnerDigest: parity.canonicalWinnerDigest,
      workerShardElapsedP50Milliseconds: percentile(parallel.outcomes.map((outcome) => outcome.elapsedMilliseconds), 0.5),
      workerShardElapsedP95Milliseconds: percentile(parallel.outcomes.map((outcome) => outcome.elapsedMilliseconds), 0.95),
      maximumWorkerRssBytes: Math.max(...parallel.outcomes.map((outcome) => outcome.rssAfterBytes)),
    });
  }
  const workloadSummary = {
    shardCount: workload.shards.length,
    legalTeamSets: workload.shards.reduce((total, shard) => total + shard.legalTeams.length, 0),
    leaderTeamChartStatesForFlatA: workload.shards.reduce(
      (total, shard) => total + shard.legalTeams.length * shard.chartKeys.length,
      0,
    ),
    talentPrefixRanges: [...new Set(workload.shards.map((shard) => `${shard.prefix.firstTalentId}:${shard.prefix.lastTalentId}`))],
    shardSizes: [...new Set(workload.shards.map((shard) => shard.shardSize))],
    seedProfiles: [...new Set(workload.shards.map((shard) => shard.seedProfile))],
    leaderAnchors: workload.anchors,
    singerCoverage: "Every shard uses chartKeys[0] matched to its selected Leader talent and chartKeys[1] unmatched.",
    workloadHash: sha256(workload.shards.map((shard) => ({
      id: shard.id,
      prefix: shard.prefix,
      memberCardIds: shard.memberCardIds,
      leader: shard.leader,
      chartKeys: shard.chartKeys,
      seedTeam: shard.seedTeam,
      seedProfile: shard.seedProfile,
      legalTeamCount: shard.legalTeams.length,
    }))),
  };
  const pilotWithoutHash = {
    schemaVersion: 2,
    kind: "exact-optimizer-performance-pilot",
    methodologyVersion: PILOT_VERSION,
    scopeHash: exactOptimizerScope.scopeHash,
    hardware: {
      platform: process.platform,
      arch: process.arch,
      cpuLogicalCount: cpus().length,
      cpuModel: cpus()[0]?.model ?? "unknown",
      totalMemoryBytes: totalmem(),
      node: process.version,
      rustc: commandVersion("rustc", ["--version"]),
      cargo: commandVersion("cargo", ["--version"]),
      researchBinary,
    },
    workload: workloadSummary,
    architectures: architectureSummaries,
    exactOutputParity: {
      AtoB: bParity,
      AtoC: cParity,
      allShardWinnersMatch: true,
      traceFallbackCountA: architectureSummaries[0].singleThread.totals.traceFallbacks,
      traceFallbackCountC: architectureSummaries[2].singleThread.totals.traceFallbacks,
    },
    incrementalSpeedups: {
      BversusA: architectureSummaries[0].singleThread.totalElapsedMilliseconds / architectureSummaries[1].singleThread.totalElapsedMilliseconds,
      CversusA: architectureSummaries[0].singleThread.totalElapsedMilliseconds / architectureSummaries[2].singleThread.totalElapsedMilliseconds,
      CversusB: architectureSummaries[1].singleThread.totalElapsedMilliseconds / architectureSummaries[2].singleThread.totalElapsedMilliseconds,
      qualification: "Whole-workload elapsed ratios; pruning changes work volume, so they are not per-state kernel speed claims.",
    },
    parallel: {
      selectedArchitecture: {
        id: SELECTED_ARCHITECTURE,
        actualCandidateWorkers: Math.min(cpus().length, workload.shards.length),
        measurements: parallelMeasurements,
        arithmetic: "candidate processes run independently; each exact trace retains serial source-order arithmetic",
      },
      nonSelectedArchitectures: "unavailable: candidate-parallel measurements were reserved for the selected hybrid architecture to avoid presenting cross-architecture contention as an algorithm result.",
    },
    certificateEligible: false,
    disposition: "Stratified architecture/performance evidence only. It does not execute the full 864-shard plan or certify a global result.",
  };
  const pilot = { ...pilotWithoutHash, reportHash: sha256(pilotWithoutHash) };
  const costModel = buildCostModel(pilot, researchBinary);
  writeFileSync(OUTPUTS.pilot, `${JSON.stringify(pilot, null, 2)}\n`, "utf8");
  writeFileSync(OUTPUTS.costModel, `${JSON.stringify(costModel, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    pilot: {
      reportHash: pilot.reportHash,
      workload: workloadSummary,
      exactOutputParity: pilot.exactOutputParity,
      parallel: pilot.parallel,
    },
    costModel: {
      reportHash: costModel.reportHash,
      measuredMinimumNoPruningProjection: costModel.measuredMinimumNoPruningProjection,
      parallelism: costModel.parallelism,
      decision: costModel.decision,
    },
  }, null, 2)}\n`);
}

await main();
