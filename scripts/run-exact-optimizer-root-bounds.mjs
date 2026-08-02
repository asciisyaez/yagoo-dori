import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { canPruneByStrictCentralUpperBound } from "../packages/core/src/exact-optimizer-arithmetic.ts";
import { buildExactOptimizerDeterministicIncumbent } from "../packages/core/src/exact-optimizer-incumbent.ts";
import { compileNativeLeaderRootBounds } from "../packages/core/src/native-global-bound.ts";
import { compileNativeLeaderEquivalence } from "../packages/core/src/native-leader-equivalence.ts";
import { exactOptimizerScope } from "../packages/core/src/exact-optimizer-scope.ts";

const ROOT = process.cwd();
const OUTPUT = join(ROOT, "data/native/exact-optimizer-leader-root-bounds-v1.json");
const METHODOLOGY_VERSION = "yd-exact-optimizer-full-root-bounds-1.0.0";

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

const memberCardIds = exactOptimizerScope.eligibility.eligibleMemberCardIds;
const leaderOutfitCardIds = exactOptimizerScope.eligibility.eligibleLeaderOutfitCardIds;
const chartKeys = exactOptimizerScope.chartCorpus.entries.map((entry) => entry.chartKey);
const sharedInput = {
  eligibleMemberCardIds: memberCardIds,
  eligibleLeaderOutfitCardIds: leaderOutfitCardIds,
  investmentLayer: exactOptimizerScope.investment.layer,
  bloomStageByCardId: exactOptimizerScope.investment.bloomStageByCardId,
  maxFiveStarMembers: exactOptimizerScope.eligibility.maximumFiveStarMembers,
  chartKeys,
};
const methodology = {
  methodologyVersion: METHODOLOGY_VERSION,
  scopeHash: exactOptimizerScope.scopeHash,
  rootBoundMethodologyVersion: "yd-native-leader-root-bounds-1.0.0",
  leaderEquivalenceMethodology: "yd-native-leader-equivalence-1.0.0",
  incumbentMethodology: "yd-exact-incumbent-1.0.0",
  memberCardCount: memberCardIds.length,
  leaderOutfitCount: leaderOutfitCardIds.length,
  chartCount: chartKeys.length,
  boundScope: "full-declared-roster-and-30-aggregate-charts",
  pruningRule: "strict canonical upper-central micro-unit less than incumbent central; equality survives",
  incumbent: {
    maximumCandidateTeams: 4,
    includeTwoMemberNeighborhood: false,
    boundedSearchOnly: true,
  },
};
const methodologyHash = sha256(methodology);
const started = performance.now();

const incumbentStarted = performance.now();
const incumbent = buildExactOptimizerDeterministicIncumbent({
  ...sharedInput,
  seed: exactOptimizerScope.seed,
  accountState: exactOptimizerScope.account,
  maximumCandidateTeams: 4,
  includeTwoMemberNeighborhood: false,
});
const incumbentElapsedMilliseconds = performance.now() - incumbentStarted;

const boundsStarted = performance.now();
const rootBounds = compileNativeLeaderRootBounds({
  ...sharedInput,
  partialMemberCardIds: [],
});
const boundsElapsedMilliseconds = performance.now() - boundsStarted;
const equivalence = compileNativeLeaderEquivalence({ eligibleLeaderOutfitCardIds: leaderOutfitCardIds });
if (rootBounds.b1.length !== equivalence.classes.length) {
  throw new Error("Full root-bound records do not reconcile with Leader equivalence classes");
}

const records = rootBounds.b1.map((entry) => {
  const incumbentGapMicroUnits = entry.upperCentralMicroUnits - incumbent.winner.canonicalUtility.central;
  return {
    representativeCardId: entry.representativeCardId,
    multiplicity: entry.multiplicity,
    methodologyHash,
    upperCentralUtility: entry.upperCentralUtility,
    upperCentralMicroUnits: entry.upperCentralMicroUnits,
    incumbentGapMicroUnits,
    prunedAtRoot: canPruneByStrictCentralUpperBound(
      entry.upperCentralMicroUnits,
      incumbent.winner.canonicalUtility.central,
    ),
  };
});
const prunedAtRootCount = records.filter((record) => record.prunedAtRoot).length;
const allSingletonSafe = equivalence.classes.every((entry) => entry.multiplicity === 1);
const coverageAuthorized =
  allSingletonSafe &&
  records.length === leaderOutfitCardIds.length &&
  chartKeys.length === 30 &&
  records.every((record) => Number.isSafeInteger(record.upperCentralMicroUnits));
const reportWithoutHash = {
  schemaVersion: 2,
  kind: "exact-optimizer-leader-root-bounds-full-scope",
  methodologyVersion: METHODOLOGY_VERSION,
  methodologyHash,
  scopeHash: exactOptimizerScope.scopeHash,
  scope: {
    memberCardCount: memberCardIds.length,
    leaderOutfitCount: leaderOutfitCardIds.length,
    chartCount: chartKeys.length,
    investmentLayer: exactOptimizerScope.investment.layer,
    maxFiveStarMembers: exactOptimizerScope.eligibility.maximumFiveStarMembers,
  },
  leaderClasses: {
    classCount: equivalence.classes.length,
    singletonSafeClassCount: equivalence.classes.filter((entry) => entry.multiplicity === 1).length,
    allSingletonSafe,
    collapsedLeaderOutfits: equivalence.counts.collapsedLeaderOutfits,
  },
  incumbent: {
    methodology: "bounded deterministic incumbent; not an optimality claim",
    leaderOutfitCardId: incumbent.winner.leaderOutfitCardId,
    memberCardIds: incumbent.winner.memberCardIds,
    centralMicroUnits: incumbent.winner.canonicalUtility.central,
    canonicalUtility: incumbent.winner.canonicalUtility,
    frozenHash: incumbent.frozenHash,
  },
  b0: rootBounds.b0,
  fixedLeaderRecords: records,
  rootPruning: {
    strictRule: "upperCentralMicroUnits < incumbentCentralMicroUnits",
    entrants: records.length,
    pruned: prunedAtRootCount,
    survivors: records.length - prunedAtRootCount,
  },
  timing: {
    incumbentMilliseconds: Math.round(incumbentElapsedMilliseconds * 1_000) / 1_000,
    fixedLeaderBoundsMilliseconds: Math.round(boundsElapsedMilliseconds * 1_000) / 1_000,
    totalMilliseconds: Math.round((performance.now() - started) * 1_000) / 1_000,
  },
  coverageGate: {
    authorized: coverageAuthorized,
    reason: coverageAuthorized
      ? "All 113 singleton-safe fixed-Leader classes have a whole-Leader B1 record over the declared 113-member/30-chart scope."
      : "The full current fixed-Leader root-bound coverage did not reconcile; it cannot authorize coverage.",
    certificateEligible: false,
    limitation: "Root bounds are evidence only. They do not replace complete B2/B3 traversal or independent replay.",
  },
  certificateEligible: false,
};
const report = { ...reportWithoutHash, reportHash: sha256(reportWithoutHash) };
writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
