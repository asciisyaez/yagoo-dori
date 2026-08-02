import { cpus, totalmem } from "node:os";
import { performance } from "node:perf_hooks";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  compareCanonicalCandidates,
  toCanonicalMicroUnits,
} from "../packages/core/src/exact-optimizer-arithmetic.ts";
import { exactOptimizerScope } from "../packages/core/src/exact-optimizer-scope.ts";
import { mechanicsData } from "../packages/core/src/mechanics.ts";
import {
  groupNativeLeadersByResolvedApplications,
} from "../packages/core/src/native-leader-resolution-cache.ts";
import { evaluateNativeRelativeUtility } from "../packages/core/src/native-utility.ts";
import { songContextData } from "../packages/core/src/song-contexts.ts";

const root = process.cwd();
const outputPath = join(root, "data/native/exact-optimizer-leader-aggregation-benchmark-v1.json");
const teamLimit = Number(process.env.YD_AGGREGATION_TEAM_LIMIT ?? 128);
const chartLimit = Number(process.env.YD_AGGREGATION_CHART_LIMIT ?? 3);
const parityTeamLimit = Number(process.env.YD_AGGREGATION_PARITY_TEAM_LIMIT ?? Math.min(16, teamLimit));
const stratifiedParityCaseLimit = Number(process.env.YD_AGGREGATION_PARITY_CASE_LIMIT ?? 8);
const board = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "fixture:exact-leader-resolution-aggregation",
  },
};

if (![teamLimit, chartLimit, parityTeamLimit, stratifiedParityCaseLimit].every((value) => Number.isSafeInteger(value) && value > 0)) {
  throw new Error("Aggregation benchmark limits must be positive safe integers");
}

function enumerateLegalTeams(cardIds, limit = Number.POSITIVE_INFINITY) {
  const groupsByTalent = new Map();
  for (const cardId of cardIds) {
    const card = mechanicsData.cards.find((candidate) => candidate.cardId === cardId);
    if (!card) throw new Error(`Unknown card ${cardId}`);
    const group = groupsByTalent.get(card.talentId) ?? [];
    group.push(card);
    groupsByTalent.set(card.talentId, group);
  }
  const groups = [...groupsByTalent.values()]
    .map((group) => [...group].sort((left, right) => left.cardId.localeCompare(right.cardId)))
    .sort((left, right) => left[0].talentId.localeCompare(right[0].talentId));
  const teams = [];
  const selected = [];
  function visit(groupIndex, fiveStars) {
    if (teams.length >= limit) return;
    if (selected.length === 5) {
      teams.push([...selected].sort());
      return;
    }
    if (groups.length - groupIndex < 5 - selected.length) return;
    const group = groups[groupIndex];
    for (const card of group ?? []) {
      if (fiveStars + (card.rarity === 5 ? 1 : 0) > 5) continue;
      selected.push(card.cardId);
      visit(groupIndex + 1, fiveStars + (card.rarity === 5 ? 1 : 0));
      selected.pop();
      if (teams.length >= limit) return;
    }
    visit(groupIndex + 1, fiveStars);
  }
  visit(0, 0);
  return teams;
}

function averageUtility(utilities) {
  return {
    lower: toCanonicalMicroUnits(utilities.reduce((sum, utility) => sum + utility.lower, 0) / utilities.length),
    central: toCanonicalMicroUnits(utilities.reduce((sum, utility) => sum + utility.central, 0) / utilities.length),
    upper: toCanonicalMicroUnits(utilities.reduce((sum, utility) => sum + utility.upper, 0) / utilities.length),
  };
}

function candidateKey(candidate) {
  return `${candidate.leaderCardId}|${[...candidate.memberCardIds].sort().join("|")}`;
}

function compare(left, right) {
  return compareCanonicalCandidates(left, right);
}

function evaluateDirect(team, leaderIds, chartKeys, investmentLayer, bloomStages = {}) {
  const candidates = leaderIds.map((leaderCardId) => ({
    leaderCardId,
    memberCardIds: [...team].sort(),
    utility: averageUtility(chartKeys.map((chartKey) => evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId: leaderCardId,
        members: team.map((cardId) => ({
          cardId,
          investment: investmentLayer,
          ...(bloomStages[cardId] === undefined ? {} : { bloomStage: bloomStages[cardId] }),
        })),
      },
      chartKey,
      seed: exactOptimizerScope.seed,
      accountState: board,
    }).relativeUtility)),
  }));
  return candidates.sort((left, right) => -compare(left, right));
}

function evaluateGrouped(team, leaderIds, chartKeys, investmentLayer, bloomStages = {}) {
  const utilityByLeader = new Map(leaderIds.map((leaderCardId) => [leaderCardId, []]));
  let utilityCalls = 0;
  let resolvedGroups = 0;
  for (const chartKey of chartKeys) {
    const grouping = groupNativeLeadersByResolvedApplications({
      memberCardIds: team,
      leaderOutfitCardIds: leaderIds,
      chartKey,
      investmentLayer,
      ...(Object.keys(bloomStages).length === 0 ? {} : { bloomStageByCardId: bloomStages }),
    });
    resolvedGroups += grouping.groups.length;
    for (const group of grouping.groups) {
      utilityCalls += 1;
      const utility = evaluateNativeRelativeUtility({
        formation: {
          leaderOutfitCardId: group.representativeCardId,
          members: team.map((cardId) => ({
            cardId,
            investment: investmentLayer,
            ...(bloomStages[cardId] === undefined ? {} : { bloomStage: bloomStages[cardId] }),
          })),
        },
        chartKey,
        seed: exactOptimizerScope.seed,
        accountState: board,
      }).relativeUtility;
      for (const leaderCardId of group.eligibleCardIds) {
        utilityByLeader.get(leaderCardId).push(utility);
      }
    }
  }
  const candidates = leaderIds.map((leaderCardId) => ({
    leaderCardId,
    memberCardIds: [...team].sort(),
    utility: averageUtility(utilityByLeader.get(leaderCardId)),
  }));
  return {
    candidates: candidates.sort((left, right) => -compare(left, right)),
    utilityCalls,
    resolvedGroups,
  };
}

const cardIds = exactOptimizerScope.eligibility.eligibleMemberCardIds.slice(0, 20);
const leaderIds = [...exactOptimizerScope.eligibility.eligibleLeaderOutfitCardIds].sort();
const chartKeys = exactOptimizerScope.chartCorpus.entries.slice(0, chartLimit).map((entry) => entry.chartKey);
const teams = enumerateLegalTeams(cardIds, teamLimit);
if (teams.length === 0) throw new Error("No reduced teams available for aggregation benchmark");

const startedAt = performance.now();
let baselineCalls = 0;
let groupedCalls = 0;
let resolvedGroups = 0;
let parityCases = 0;
let parityMismatches = 0;
const reductionHistogram = new Map();
for (const [teamIndex, team] of teams.entries()) {
  const grouped = evaluateGrouped(team, leaderIds, chartKeys, "one-copy-maximum");
  baselineCalls += leaderIds.length * chartKeys.length;
  groupedCalls += grouped.utilityCalls;
  resolvedGroups += grouped.resolvedGroups;
  reductionHistogram.set(
    grouped.resolvedGroups,
    (reductionHistogram.get(grouped.resolvedGroups) ?? 0) + 1,
  );
  if (teamIndex >= parityTeamLimit) continue;
  const direct = evaluateDirect(team, leaderIds, chartKeys, "one-copy-maximum");
  parityCases += leaderIds.length;
  if (direct.length !== grouped.candidates.length) {
    parityMismatches += 1;
    continue;
  }
  for (const [index, expected] of direct.entries()) {
    const actual = grouped.candidates[index];
    if (
      !actual ||
      candidateKey(actual) !== candidateKey(expected) ||
      actual.utility.lower !== expected.utility.lower ||
      actual.utility.central !== expected.utility.central ||
      actual.utility.upper !== expected.utility.upper
    ) {
      parityMismatches += 1;
    }
  }
}

const mechanicsById = new Map(mechanicsData.cards.map((card) => [card.cardId, card]));
const songsById = new Map(songContextData.songs.map((song) => [song.id, song]));
const chartsByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));
const parityCorpus = JSON.parse(readFileSync(join(root, "data/native/exact-optimizer-parity-sample-v1.json"), "utf8"));
const selectedParityCases = [];
const seenCoverage = new Set();
for (const entry of parityCorpus) {
  const chart = chartsByKey.get(entry.chartKey);
  const song = chart ? songsById.get(chart.songId) : null;
  const memberTalents = new Set(entry.memberCardIds.map((cardId) => mechanicsById.get(cardId)?.talentId));
  const singerMatched = Boolean(song?.singerTalentIds.some((talentId) => memberTalents.has(talentId)));
  const bloomStages = Object.values(entry.bloomStages);
  const flags = [
    `investment:${entry.investmentLayer}`,
    `bloom:${Math.min(...bloomStages)}-${Math.max(...bloomStages)}`,
    ...new Set(bloomStages.map((stage) => `bloom-stage:${stage}`)),
    `singer:${singerMatched ? "matched" : "unmatched"}`,
    `five-star-members:${entry.memberCardIds.filter((cardId) => mechanicsById.get(cardId)?.rarity === 5).length}`,
    `leader-member-talent-collision:${memberTalents.has(mechanicsById.get(entry.leaderCardId)?.talentId)}`,
  ];
  if (flags.some((flag) => !seenCoverage.has(flag))) {
    selectedParityCases.push({ entry, singerMatched, coverageFlags: flags.filter((flag) => !seenCoverage.has(flag)) });
    for (const flag of flags) seenCoverage.add(flag);
    if (selectedParityCases.length >= stratifiedParityCaseLimit) break;
  }
}

let stratifiedBaselineCalls = 0;
let stratifiedGroupedCalls = 0;
let stratifiedMismatches = 0;
const stratifiedCoverage = new Set();
for (const { entry, coverageFlags } of selectedParityCases) {
  const grouped = evaluateGrouped(
    entry.memberCardIds,
    leaderIds,
    [entry.chartKey],
    entry.investmentLayer,
    entry.bloomStages,
  );
  const direct = evaluateDirect(
    entry.memberCardIds,
    leaderIds,
    [entry.chartKey],
    entry.investmentLayer,
    entry.bloomStages,
  );
  stratifiedBaselineCalls += leaderIds.length;
  stratifiedGroupedCalls += grouped.utilityCalls;
  for (const flag of coverageFlags) stratifiedCoverage.add(flag);
  if (direct.length !== grouped.candidates.length) {
    stratifiedMismatches += 1;
    continue;
  }
  for (const [index, expected] of direct.entries()) {
    const actual = grouped.candidates[index];
    if (
      !actual ||
      candidateKey(actual) !== candidateKey(expected) ||
      actual.utility.lower !== expected.utility.lower ||
      actual.utility.central !== expected.utility.central ||
      actual.utility.upper !== expected.utility.upper
    ) {
      stratifiedMismatches += 1;
    }
  }
}

const elapsedMilliseconds = performance.now() - startedAt;
const averageGroupsPerTeamChart = resolvedGroups / (teams.length * chartKeys.length);
const report = {
  schemaVersion: 1,
  reportId: "yd-exact-leader-resolution-aggregation-benchmark-v1",
  generatedAt: new Date().toISOString(),
  scopeHash: exactOptimizerScope.scopeHash,
  methodologyVersion: "yd-native-leader-resolution-cache-1.0.0",
  certificateEligible: false,
  parityEligible: parityMismatches === 0 && stratifiedMismatches === 0,
  hardware: {
    platform: process.platform,
    arch: process.arch,
    cpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    node: process.version,
  },
  input: {
    reducedEligibleMemberCards: cardIds.length,
    reducedLegalTeamsSampled: teams.length,
    leaderOutfits: leaderIds.length,
    chartKeys,
    investmentLayer: "one-copy-maximum",
    bloomStage: 0,
  },
  exactAggregationProbe: {
    baselineLeaderTeamChartUtilityCalls: baselineCalls,
    resolvedLeaderGroupChartUtilityCalls: groupedCalls,
    exactUtilityCallReductionFraction: baselineCalls === 0 ? 0 : 1 - groupedCalls / baselineCalls,
    averageResolvedGroupsPerTeamChart: averageGroupsPerTeamChart,
    resolutionGroupHistogram: Object.fromEntries([...reductionHistogram.entries()].sort((left, right) => left[0] - right[0]).map(([groups, count]) => [String(groups), count])),
    parityCases: parityCases * chartKeys.length,
    parityMismatches,
    elapsedMilliseconds: Math.round(elapsedMilliseconds * 1_000) / 1_000,
    note: "The grouped calls are exact native-evaluator calls for representatives whose structural class and chart-specific resolved Leader application graph are identical. Resolution itself is measured separately and remains part of the future compiled-kernel cost.",
  },
  stratifiedParityProbe: {
    casesSelected: selectedParityCases.length,
    baselineLeaderChartUtilityCalls: stratifiedBaselineCalls,
    groupedLeaderChartUtilityCalls: stratifiedGroupedCalls,
    exactUtilityCallReductionFraction: stratifiedBaselineCalls === 0 ? 0 : 1 - stratifiedGroupedCalls / stratifiedBaselineCalls,
    coverageFlags: [...stratifiedCoverage].sort(),
    parityMismatches: stratifiedMismatches,
    note: "Cases are selected deterministically from the 100000-case corpus to cover investment, Bloom, singer, five-star, and same-talent collision states. This remains a sampled gate, not complete mechanic proof.",
  },
  decision: parityMismatches === 0 && stratifiedMismatches === 0
    ? "Candidate exact aggregation is parity-valid on the declared reduced and stratified samples only. Measure resolution cost and repeat across the complete mechanic corpus before allowing it into a certifying full-scope worker."
    : "Reject this aggregation candidate for certification until the resolved-graph mismatch is identified and represented in the shared model.",
};
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
