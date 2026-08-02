import { execFileSync } from "node:child_process";
import { cpus, totalmem } from "node:os";
import { performance } from "node:perf_hooks";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { exactOptimizerScope } from "../packages/core/src/exact-optimizer-scope.ts";
import {
  countNativeLegalTeamSets,
  NativeGlobalSearchTimeoutError,
  searchNativeGlobalTeams,
} from "../packages/core/src/native-global-search.ts";
import { mechanicsData } from "../packages/core/src/mechanics.ts";

const BOARD = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "fixture:native-global-bound",
  },
};

function commandVersion(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unavailable";
  }
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8"));
  } catch {
    return null;
  }
}

function enumerateLegalTeams(cardIds) {
  const groups = new Map();
  for (const cardId of cardIds) {
    const card = mechanicsData.cards.find((candidate) => candidate.cardId === cardId);
    if (!card) throw new Error(`Unknown card ${cardId}`);
    const cards = groups.get(card.talentId) ?? [];
    cards.push(card);
    groups.set(card.talentId, cards);
  }
  const grouped = [...groups.values()];
  const teams = [];
  const selected = [];
  function visit(groupIndex, fiveStars) {
    if (selected.length === 5) {
      teams.push([...selected].sort());
      return;
    }
    if (grouped.length - groupIndex < 5 - selected.length) return;
    visit(groupIndex + 1, fiveStars);
    for (const card of grouped[groupIndex] ?? []) {
      if (fiveStars + (card.rarity === 5 ? 1 : 0) > 5) continue;
      selected.push(card.cardId);
      visit(groupIndex + 1, fiveStars + (card.rarity === 5 ? 1 : 0));
      selected.pop();
    }
  }
  visit(0, 0);
  return teams;
}

function measureFlat(cardIds) {
  const started = performance.now();
  const teams = enumerateLegalTeams(cardIds);
  const elapsed = performance.now() - started;
  return {
    eligibleCards: cardIds.length,
    legalTeamSets: teams.length,
    exactLeafEvaluations: 0,
    teamSetsPerSecond: elapsed === 0 ? null : teams.length / (elapsed / 1_000),
    elapsedMilliseconds: Math.round(elapsed * 1_000) / 1_000,
    note: "Flat baseline enumerated legal sets only; utility evaluation remains a separate measured cost.",
  };
}

function measureBranchAndBound({ memberCardIds, leaderCardIds, chartKeys, maximumRuntimeMilliseconds }) {
  const started = performance.now();
  try {
    const result = searchNativeGlobalTeams({
      eligibleMemberCardIds: memberCardIds,
      eligibleLeaderOutfitCardIds: leaderCardIds,
      investmentLayer: "one-copy-maximum",
      maxFiveStarMembers: 5,
      chartKeys,
      seed: exactOptimizerScope.seed,
      accountState: BOARD,
      maximumRuntimeMilliseconds,
      progressIntervalNodes: 100,
    });
    return {
      status: "completed",
      elapsedMilliseconds: Math.round((performance.now() - started) * 1_000) / 1_000,
      legalTeamSets: result.certificate.legalTeamSets,
      exactLeafEvaluations: result.certificate.exactLeafEvaluations,
      prunedTeamSets: result.certificate.prunedTeamSets,
      boundEvaluations: result.certificate.boundEvaluations,
      utilityEvaluations: result.certificate.utilityEvaluations,
      leaderTeamEvaluations: result.certificate.exactLeaderTeamEvaluations,
      certificateEligible: false,
      note: "Prototype result retained as a benchmark; it is not promoted to a v0.2 certificate.",
    };
  } catch (error) {
    if (!(error instanceof NativeGlobalSearchTimeoutError)) throw error;
    return {
      status: "timeout",
      elapsedMilliseconds: Math.round((performance.now() - started) * 1_000) / 1_000,
      ...error.progress,
      certificateEligible: false,
      note: "Timeout output is a bounded measurement and cannot be labelled optimal or certified.",
    };
  }
}

const allCardIds = exactOptimizerScope.eligibility.eligibleMemberCardIds;
const allLeaderIds = exactOptimizerScope.eligibility.eligibleLeaderOutfitCardIds;
const charts = exactOptimizerScope.chartCorpus.entries.map((entry) => entry.chartKey);
const reduced = allCardIds.slice(0, 20);
const reducedLeaders = allLeaderIds.slice(0, 10);
const compiledParity = readJson("data/native/exact-optimizer-compiled-parity-v1.json");
const aggregationProbe = readJson("data/native/exact-optimizer-leader-aggregation-benchmark-v1.json");
const declaredLegalTeamSets = countNativeLegalTeamSets({ eligibleMemberCardIds: allCardIds, maxFiveStarMembers: 5 });
const compiledCasesPerSecond = compiledParity?.elapsedMilliseconds > 0
  ? compiledParity.compiledOutputCount / (compiledParity.elapsedMilliseconds / 1_000)
  : null;
const declaredCompiledEvaluationCount = declaredLegalTeamSets * allLeaderIds.length * charts.length;
const report = {
  schemaVersion: 1,
  reportId: "yd-exact-formulation-benchmark-v1",
  generatedAt: new Date().toISOString(),
  scopeHash: exactOptimizerScope.scopeHash,
  certificateEligible: false,
  hardware: {
    platform: process.platform,
    arch: process.arch,
    cpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    node: process.version,
    rustc: commandVersion("rustc", ["--version"]),
    cargo: commandVersion("cargo", ["--version"]),
    compilerFlags: "default; fast-math/reassociation not enabled",
  },
  chartCountTested: charts.length,
  flatExhaustiveBaseline: {
    reduced20: measureFlat(reduced),
    declaredFullRosterLegalTeamSets: declaredLegalTeamSets,
    compiledParityThroughput: compiledParity
      ? {
          samplePath: compiledParity.samplePath,
          casesMeasured: compiledParity.compiledOutputCount,
          elapsedMilliseconds: compiledParity.elapsedMilliseconds,
          casesPerSecond: compiledCasesPerSecond,
          lowerCentralUpperMismatchCount: compiledParity.mismatchCount,
          estimatedLeaderTeamChartEvaluations: declaredCompiledEvaluationCount,
          estimatedSecondsAtMeasuredRate: compiledCasesPerSecond
            ? declaredCompiledEvaluationCount / compiledCasesPerSecond
            : null,
          estimatedHoursAtMeasuredRate: compiledCasesPerSecond
            ? declaredCompiledEvaluationCount / compiledCasesPerSecond / 3_600
            : null,
          note: "Projection treats each Leader/team/chart tuple as one parity-valid evaluator call; it excludes any future exact aggregation or cache optimization and is not a proof result.",
        }
      : { status: "not-measured", note: "Run optimizer:parity:compiled before using a compiled throughput projection." },
  },
  hybridBranchAndBound: {
    reduced20: measureBranchAndBound({ memberCardIds: reduced, leaderCardIds: reducedLeaders, chartKeys: charts.slice(0, 2), maximumRuntimeMilliseconds: 30_000 }),
    fullRosterBudgetProbe: measureBranchAndBound({ memberCardIds: allCardIds, leaderCardIds: allLeaderIds, chartKeys: charts, maximumRuntimeMilliseconds: 2_000 }),
  },
  meetInTheMiddle: {
    status: "rejected-for-certificate-spike",
    partition: "2-plus-3",
    crossPartitionInteractions: [
      "deck attribute/group trigger counts",
      "target caps and unresolved recipient subsets",
      "conditional base/additive/override channels",
      "Leader applications and singer-dependent chart facts",
      "expected Active maxima and Special support windows",
    ],
    reason: "No exact composable feature-state representation has been proven; an approximate join would not be a certificate.",
  },
  exactAggregationProbe: aggregationProbe
    ? {
        methodologyVersion: aggregationProbe.methodologyVersion,
        reducedTeams: aggregationProbe.input?.reducedLegalTeamsSampled ?? null,
        reducedCharts: aggregationProbe.input?.chartKeys?.length ?? null,
        reducedBaselineCalls: aggregationProbe.exactAggregationProbe?.baselineLeaderTeamChartUtilityCalls ?? null,
        reducedGroupedCalls: aggregationProbe.exactAggregationProbe?.resolvedLeaderGroupChartUtilityCalls ?? null,
        reducedCallReductionFraction: aggregationProbe.exactAggregationProbe?.exactUtilityCallReductionFraction ?? null,
        reducedParityMismatches: aggregationProbe.exactAggregationProbe?.parityMismatches ?? null,
        stratifiedCases: aggregationProbe.stratifiedParityProbe?.casesSelected ?? null,
        stratifiedParityMismatches: aggregationProbe.stratifiedParityProbe?.parityMismatches ?? null,
        certificateEligible: false,
        note: "A parity-valid reduced aggregation candidate is recorded separately; resolution cost and complete mechanic coverage remain open.",
      }
    : { status: "not-measured", note: "Run optimizer:aggregation:benchmark before selecting an exact aggregation." },
  decision: compiledParity?.mismatchCount === 0 && compiledCasesPerSecond
    ? aggregationProbe?.parityEligible === true
      ? "Keep flat enumeration as the mandatory proof baseline. The parity-valid compiled evaluator remains far beyond the current offline budget under the naive projection; the reduced Leader-resolution aggregation probe is a measured candidate only, so retain certificateEligible=false and expand its full mechanic gate before selecting production certification code."
      : "Keep flat enumeration as the mandatory proof baseline. The parity-valid compiled evaluator is exact on the 100000-case corpus, but the measured per-Leader/team/chart projection is far beyond the current offline budget; retain certificateEligible=false and benchmark a cache-safe exact aggregation before selecting production certification code."
    : "Keep flat enumeration as the mandatory proof baseline; do not select a production formulation until compiled parity and measured exact utility throughput exist.",
};

writeFileSync(join(process.cwd(), "data/native/exact-optimizer-formulation-benchmark-v1.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
