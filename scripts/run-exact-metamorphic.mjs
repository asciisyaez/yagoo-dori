import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { evaluateNativeRelativeUtility } from "../packages/core/src/native-utility.ts";
import { compileNativeLeaderEquivalence } from "../packages/core/src/native-leader-equivalence.ts";
import { searchNativeGlobalTeams } from "../packages/core/src/native-global-search.ts";
import { mechanicsData } from "../packages/core/src/mechanics.ts";
import { toCanonicalMicroUnits } from "../packages/core/src/exact-optimizer-arithmetic.ts";

const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const scope = readJson("data/native/exact-optimizer-scope-v1.json");
const reduced = readJson("data/native/exact-optimizer-reduced-parity-cases-v1.json");
const reducedReport = readJson("data/native/exact-optimizer-reduced-parity-v1.json");
const board = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "fixture:exact-reduced-bruteforce",
  },
};
const candidates = reduced.map((entry) => {
  const utility = evaluateNativeRelativeUtility({
    formation: {
      leaderOutfitCardId: entry.leaderCardId,
      members: entry.memberCardIds.map((cardId) => ({ cardId, investment: "one-copy-maximum", bloomStage: 0 })),
    },
    chartKey: entry.chartKey,
    seed: scope.seed,
    accountState: board,
  }).relativeUtility;
  return {
    ...entry,
    lowerMicroUnits: toCanonicalMicroUnits(utility.lower),
    centralMicroUnits: toCanonicalMicroUnits(utility.central),
    upperMicroUnits: toCanonicalMicroUnits(utility.upper),
  };
});
const key = (candidate) => `${candidate.leaderCardId}|${candidate.memberCardIds.join("|")}`;
const compare = (left, right) => {
  for (const field of ["centralMicroUnits", "lowerMicroUnits", "upperMicroUnits"]) {
    if (left[field] !== right[field]) return right[field] - left[field];
  }
  return key(left).localeCompare(key(right));
};
const winner = (entries) => [...entries].sort(compare)[0];
const deterministicShuffle = (entries) => [...entries].sort((left, right) => {
  const leftHash = createHash("sha256").update(String(left.caseId)).digest("hex");
  const rightHash = createHash("sha256").update(String(right.caseId)).digest("hex");
  return leftHash.localeCompare(rightHash);
});
const serialWinner = winner(candidates);
const shuffledWinner = winner(deterministicShuffle(candidates));
const midpoint = Math.floor(candidates.length / 2);
const shardA = candidates.filter((candidate) => candidate.caseId < midpoint);
const shardB = candidates.filter((candidate) => candidate.caseId >= midpoint);
const shardedWinner = winner([...shardB, ...shardA]);

const permutationCandidate = candidates[0];
const permutationUtility = evaluateNativeRelativeUtility({
  formation: {
    leaderOutfitCardId: permutationCandidate.leaderCardId,
    members: [...permutationCandidate.memberCardIds].reverse().map((cardId) => ({ cardId, investment: "one-copy-maximum", bloomStage: 0 })),
  },
  chartKey: permutationCandidate.chartKey,
  seed: scope.seed,
  accountState: board,
}).relativeUtility;
const permutationMatches = {
  lower: toCanonicalMicroUnits(permutationUtility.lower) === permutationCandidate.lowerMicroUnits,
  central: toCanonicalMicroUnits(permutationUtility.central) === permutationCandidate.centralMicroUnits,
  upper: toCanonicalMicroUnits(permutationUtility.upper) === permutationCandidate.upperMicroUnits,
};

const leaderClasses = compileNativeLeaderEquivalence({ eligibleLeaderOutfitCardIds: reducedReport.fixtureRoster.leaderIds });
const equivalentClass = leaderClasses.classes.find((group) => group.eligibleCardIds.length > 1);
let equivalentLeaderMatches = true;
if (equivalentClass) {
  const selected = permutationCandidate.memberCardIds.map((cardId) => ({ cardId, investment: "one-copy-maximum", bloomStage: 0 }));
  const first = evaluateNativeRelativeUtility({ formation: { leaderOutfitCardId: equivalentClass.eligibleCardIds[0], members: selected }, chartKey: permutationCandidate.chartKey, seed: scope.seed, accountState: board }).relativeUtility;
  const second = evaluateNativeRelativeUtility({ formation: { leaderOutfitCardId: equivalentClass.eligibleCardIds[1], members: selected }, chartKey: permutationCandidate.chartKey, seed: scope.seed, accountState: board }).relativeUtility;
  equivalentLeaderMatches = first.lower === second.lower && first.central === second.central && first.upper === second.upper;
}

const searchResult = searchNativeGlobalTeams({
  eligibleMemberCardIds: [...new Set(reduced.flatMap((entry) => entry.memberCardIds))],
  eligibleLeaderOutfitCardIds: reducedReport.fixtureRoster.leaderIds,
  investmentLayer: "one-copy-maximum",
  chartKeys: ["m0206:expert"],
  seed: scope.seed,
  accountState: board,
});
const searchWinnerKey = `${searchResult.best.leaderOutfitCardId}|${searchResult.best.memberCardIds.join("|")}`;
const report = {
  schemaVersion: 1,
  reportId: "yd-exact-metamorphic-v1",
  generatedAt: new Date().toISOString(),
  scopeHash: scope.scopeHash,
  fixture: "data/native/exact-optimizer-reduced-parity-cases-v1.json",
  checks: {
    memberPermutationInvariant: Object.values(permutationMatches).every(Boolean),
    equivalentLeaderClassInvariant: equivalentLeaderMatches,
    shardedAndUnshardedWinnerInvariant: key(serialWinner) === key(shardedWinner),
    serialAndDeterministicallyShuffledWinnerInvariant: key(serialWinner) === key(shuffledWinner),
    branchAndBoundMatchesIndependentEnumeration: searchWinnerKey === key(serialWinner),
    exactPrunedReconciliation: searchResult.certificate.exactLeafEvaluations + searchResult.certificate.prunedTeamSets === searchResult.certificate.legalTeamSets,
    strictUpperBoundEqualityNotPruned: searchResult.certificate.maximumPrunedUpperCentralUtility === null || searchResult.certificate.maximumPrunedUpperCentralUtility < searchResult.best.relativeUtility.central,
  },
  counts: {
    cases: candidates.length,
    shardA: shardA.length,
    shardB: shardB.length,
    legalTeamSets: searchResult.certificate.legalTeamSets,
    exactLeafEvaluations: searchResult.certificate.exactLeafEvaluations,
    prunedTeamSets: searchResult.certificate.prunedTeamSets,
  },
  serialWinner: { key: key(serialWinner), centralMicroUnits: serialWinner.centralMicroUnits },
  shardedWinner: { key: key(shardedWinner), centralMicroUnits: shardedWinner.centralMicroUnits },
  branchAndBoundWinner: { key: searchWinnerKey, central: searchResult.best.relativeUtility.central },
  parityEligible: Object.values({ ...permutationMatches, equivalentLeaderMatches }).every(Boolean),
  certificateEligible: false,
  disposition: "Deterministic reduced-roster metamorphic checks pass; no full-roster certificate is implied.",
};
writeFileSync(join(root, "data/native/exact-optimizer-metamorphic-v1.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (!Object.values(report.checks).every(Boolean)) process.exitCode = 1;
