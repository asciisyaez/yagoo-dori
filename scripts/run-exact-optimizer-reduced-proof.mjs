import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  canonicalCandidateKey,
  canonicalUtilityTie,
  compareCanonicalCandidates,
  fromCanonicalMicroUnits,
  toCanonicalMicroUnits,
} from "../packages/core/src/exact-optimizer-arithmetic.ts";
import { buildExactOptimizerDeterministicIncumbent } from "../packages/core/src/exact-optimizer-incumbent.ts";
import {
  compileExactOptimizerTeam,
  crossCheckExactOptimizerTeamLeader,
} from "../packages/core/src/exact-optimizer-kernel.ts";
import { exactOptimizerScope } from "../packages/core/src/exact-optimizer-scope.ts";
import { mechanicsCardById } from "../packages/core/src/mechanics.ts";
import { compileNativeLeaderRootBounds } from "../packages/core/src/native-global-bound.ts";
import { countNativeLegalTeamSets, searchNativeGlobalTeams } from "../packages/core/src/native-global-search.ts";
import { compileNativeLeaderEquivalence } from "../packages/core/src/native-leader-equivalence.ts";

const MEMBER_IDS = [
  "card-00001-4-cmmn-0000-00",
  "card-00004-5-uniq-0005-00",
  "card-00005-5-uniq-0006-00",
  "card-00013-4-cmmn-0000-00",
  "card-00013-5-uniq-0002-00",
  "card-00016-5-uniq-0014-00",
  "card-00018-5-uniq-0004-00",
  "card-00019-5-uniq-0016-00",
];
const LEADER_IDS = [
  "card-00001-5-uniq-0000-00",
  "card-00013-5-uniq-0002-00",
  "card-00019-5-uniq-0016-00",
  "card-00039-5-uniq-0032-00",
];
const CHART_KEYS = ["m0206:expert", "m0309:expert"];
const BOARD = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "fixture:exact-optimizer-reduced-proof",
  },
};

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

function legalTeams(cardIds) {
  const groups = new Map();
  for (const cardId of [...cardIds].sort()) {
    const card = mechanicsCardById.get(cardId);
    if (!card) throw new Error(`Unknown reduced-proof card: ${cardId}`);
    const group = groups.get(card.talentId) ?? [];
    group.push(cardId);
    groups.set(card.talentId, group);
  }
  const orderedGroups = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, cardIdsForTalent]) => [...cardIdsForTalent].sort());
  const teams = [];
  const selected = [];
  const visit = (index, fiveStars) => {
    if (selected.length === 5) {
      teams.push([...selected].sort());
      return;
    }
    if (orderedGroups.length - index < 5 - selected.length) return;
    if (index >= orderedGroups.length) return;
    for (const cardId of orderedGroups[index]) {
      const rarity = mechanicsCardById.get(cardId).rarity;
      if (fiveStars + (rarity === 5 ? 1 : 0) > 5) continue;
      selected.push(cardId);
      visit(index + 1, fiveStars + (rarity === 5 ? 1 : 0));
      selected.pop();
    }
    visit(index + 1, fiveStars);
  };
  visit(0, 0);
  return teams;
}

function aggregate(values) {
  return {
    lower: toCanonicalMicroUnits(values.reduce((sum, value) => sum + fromCanonicalMicroUnits(value.lower), 0) / values.length),
    central: toCanonicalMicroUnits(values.reduce((sum, value) => sum + fromCanonicalMicroUnits(value.central), 0) / values.length),
    upper: toCanonicalMicroUnits(values.reduce((sum, value) => sum + fromCanonicalMicroUnits(value.upper), 0) / values.length),
  };
}

function evaluateFixture() {
  const candidates = [];
  let kernelEvaluations = 0;
  let lowerCentralUpperMismatchCount = 0;
  for (const memberCardIds of legalTeams(MEMBER_IDS)) {
    const team = compileExactOptimizerTeam({
      memberCardIds,
      investmentLayer: "one-copy-maximum",
    });
    for (const leaderCardId of LEADER_IDS) {
      const utility = aggregate(CHART_KEYS.map((chartKey) => {
        kernelEvaluations += 1;
        try {
          return crossCheckExactOptimizerTeamLeader({
            team,
            leaderOutfitCardId: leaderCardId,
            chartKey,
            seed: exactOptimizerScope.seed,
            accountState: BOARD,
          }).canonicalUtility;
        } catch (error) {
          lowerCentralUpperMismatchCount += 1;
          throw error;
        }
      }));
      candidates.push({ leaderCardId, memberCardIds: [...memberCardIds], utility });
    }
  }
  candidates.sort((left, right) => -compareCanonicalCandidates(left, right));
  const winner = candidates[0];
  const winnerKey = canonicalCandidateKey(winner);
  return {
    candidates,
    kernelEvaluations,
    lowerCentralUpperMismatchCount,
    winner: {
      leaderCardId: winner.leaderCardId,
      memberCardIds: winner.memberCardIds,
      canonicalUtility: winner.utility,
    },
    completeTieSet: candidates
      .filter((candidate) => canonicalUtilityTie(candidate.utility, winner.utility))
      .map((candidate) => canonicalCandidateKey(candidate))
      .sort(),
    runnerUp: candidates.find((candidate) => canonicalCandidateKey(candidate) !== winnerKey) ?? null,
  };
}

function canonicalCandidateOutput(candidate) {
  if (!candidate) return null;
  const leaderOutfitCardId = candidate.leaderOutfitCardId ?? candidate.leaderCardId;
  const canonicalUtility = candidate.canonicalUtility ?? candidate.utility;
  if (typeof leaderOutfitCardId !== "string" || !canonicalUtility) {
    throw new Error("Reduced proof received an invalid canonical candidate");
  }
  return {
    leaderOutfitCardId,
    memberCardIds: [...candidate.memberCardIds],
    canonicalUtility,
  };
}

function canonicalRunnerUpOutput(candidate) {
  const normalized = canonicalCandidateOutput(candidate);
  if (!normalized) return null;
  return {
    key: canonicalCandidateKey({
      leaderCardId: normalized.leaderOutfitCardId,
      memberCardIds: normalized.memberCardIds,
    }),
    canonicalUtility: normalized.canonicalUtility,
  };
}

function canonicalReducerWinner(candidate) {
  return {
    leaderOutfitCardId: candidate.leaderOutfitCardId,
    memberCardIds: [...candidate.memberCardIds],
    canonicalUtility: {
      lower: toCanonicalMicroUnits(candidate.relativeUtility.lower),
      central: toCanonicalMicroUnits(candidate.relativeUtility.central),
      upper: toCanonicalMicroUnits(candidate.relativeUtility.upper),
    },
  };
}

function canonicalAuditOutput(result) {
  const audit = result.completeCanonicalOutput;
  if (!audit) throw new Error("Reduced proof audit did not retain complete canonical output");
  return {
    evaluatedLeaderOutfitTeamPairs: audit.evaluatedLeaderOutfitTeamPairs,
    winner: canonicalCandidateOutput(audit.winner),
    completeTieSet: [...audit.completeTieSet].sort(),
    runnerUp: canonicalRunnerUpOutput(audit.runnerUp),
  };
}

function sameCanonicalOutput(left, right) {
  return canonicalize(left) === canonicalize(right);
}

const first = evaluateFixture();
const second = evaluateFixture();
const firstHash = sha256({
  winner: first.winner,
  completeTieSet: first.completeTieSet,
  runnerUp: first.runnerUp
    ? { key: canonicalCandidateKey(first.runnerUp), utility: first.runnerUp.utility }
    : null,
});
const secondHash = sha256({
  winner: second.winner,
  completeTieSet: second.completeTieSet,
  runnerUp: second.runnerUp
    ? { key: canonicalCandidateKey(second.runnerUp), utility: second.runnerUp.utility }
    : null,
});

const incumbent = buildExactOptimizerDeterministicIncumbent({
  eligibleMemberCardIds: MEMBER_IDS,
  eligibleLeaderOutfitCardIds: LEADER_IDS,
  chartKeys: CHART_KEYS,
  investmentLayer: "one-copy-maximum",
  seed: exactOptimizerScope.seed,
  accountState: BOARD,
  existingMemberTeams: [legalTeams(MEMBER_IDS)[0]],
  maximumCandidateTeams: 4,
  includeTwoMemberNeighborhood: true,
});
const root = compileNativeLeaderRootBounds({
  partialMemberCardIds: [],
  eligibleMemberCardIds: MEMBER_IDS,
  eligibleLeaderOutfitCardIds: LEADER_IDS,
  investmentLayer: "one-copy-maximum",
  chartKeys: CHART_KEYS,
});
const partial = compileNativeLeaderRootBounds({
  partialMemberCardIds: [MEMBER_IDS[0]],
  eligibleMemberCardIds: MEMBER_IDS,
  eligibleLeaderOutfitCardIds: LEADER_IDS,
  investmentLayer: "one-copy-maximum",
  chartKeys: CHART_KEYS,
});
const reducerInput = {
  eligibleMemberCardIds: MEMBER_IDS,
  eligibleLeaderOutfitCardIds: LEADER_IDS,
  initialCandidate: {
    leaderOutfitCardId: incumbent.winner.leaderOutfitCardId,
    memberCardIds: incumbent.winner.memberCardIds,
  },
  investmentLayer: "one-copy-maximum",
  chartKeys: CHART_KEYS,
  seed: exactOptimizerScope.seed,
  accountState: BOARD,
};
const reducer = searchNativeGlobalTeams(reducerInput);
const reducerAudit = searchNativeGlobalTeams({
  ...reducerInput,
  collectCompleteCanonicalOutput: true,
});

const exhaustiveReference = {
  winner: canonicalCandidateOutput(first.winner),
  completeTieSet: [...first.completeTieSet].sort(),
  runnerUp: canonicalRunnerUpOutput(first.runnerUp),
};
const reducedWinner = canonicalReducerWinner(reducer.best);
const completeCanonicalAudit = canonicalAuditOutput(reducerAudit);
const exhaustiveLeaderOutfitTeamPairs = first.candidates.length;
const expectedLegalTeamSets = countNativeLegalTeamSets({ eligibleMemberCardIds: MEMBER_IDS });
const expectedLeaderEquivalence = compileNativeLeaderEquivalence({
  eligibleLeaderOutfitCardIds: LEADER_IDS,
});
const expectedLeaderClassTeamPairs =
  expectedLegalTeamSets * expectedLeaderEquivalence.counts.equivalenceClasses;

function pairReconciliationAgainstExhaustive(certificate) {
  return {
    expectedLeaderEquivalenceClasses: expectedLeaderEquivalence.counts.equivalenceClasses,
    expectedEligibleLeaderOutfits: expectedLeaderEquivalence.counts.eligibleLeaderOutfits,
    expectedLeaderClassTeamPairs,
    expectedLeaderOutfitTeamPairs: exhaustiveLeaderOutfitTeamPairs,
    leaderEquivalenceClasses: certificate.leaderEquivalenceClasses,
    eligibleLeaderOutfits: certificate.eligibleLeaderOutfits,
    leaderClassTeamPairs: certificate.leaderClassTeamPairs,
    leaderOutfitTeamPairs: certificate.leaderOutfitTeamPairs,
    exactLeaderClassTeamPairs: certificate.exactLeaderClassTeamPairs,
    prunedLeaderClassTeamPairs: certificate.prunedLeaderClassTeamPairs,
    exactLeaderOutfitTeamPairs: certificate.exactLeaderOutfitTeamPairs,
    prunedLeaderOutfitTeamPairs: certificate.prunedLeaderOutfitTeamPairs,
    incumbentSeedLeaderTeamEvaluations: certificate.incumbentSeedLeaderTeamEvaluations,
    leaderClassPairCountsReconciled: certificate.leaderClassPairCountsReconciled,
    leaderOutfitPairCountsReconciled: certificate.leaderOutfitPairCountsReconciled,
    leaderPairCountsReconciled: certificate.leaderPairCountsReconciled,
    leaderEquivalenceClassesMatchExpected:
      certificate.leaderEquivalenceClasses === expectedLeaderEquivalence.counts.equivalenceClasses,
    eligibleLeaderOutfitsMatchExpected:
      certificate.eligibleLeaderOutfits === expectedLeaderEquivalence.counts.eligibleLeaderOutfits,
    declaredClassPairsMatchExhaustive:
      certificate.leaderClassTeamPairs === expectedLeaderClassTeamPairs,
    declaredOutfitPairsMatchExhaustive:
      certificate.leaderOutfitTeamPairs === exhaustiveLeaderOutfitTeamPairs,
    partitionedClassPairsMatchExhaustive:
      certificate.exactLeaderClassTeamPairs + certificate.prunedLeaderClassTeamPairs ===
      expectedLeaderClassTeamPairs,
    partitionedOutfitPairsMatchExhaustive:
      certificate.exactLeaderOutfitTeamPairs + certificate.prunedLeaderOutfitTeamPairs ===
      exhaustiveLeaderOutfitTeamPairs,
    seedWorkExcludedFromProofPairs:
      certificate.exactLeaderTeamEvaluations ===
      certificate.incumbentSeedLeaderTeamEvaluations + certificate.exactLeaderOutfitTeamPairs,
  };
}

const reducerPairReconciliation = pairReconciliationAgainstExhaustive(reducer.certificate);
const auditPairReconciliation = pairReconciliationAgainstExhaustive(reducerAudit.certificate);
const comparison = {
  fixtureLegalTeamSetsMatch: first.candidates.length === expectedLegalTeamSets * LEADER_IDS.length,
  reducerWinnerMatchesExhaustive: sameCanonicalOutput(reducedWinner, exhaustiveReference.winner),
  auditWinnerMatchesExhaustive: sameCanonicalOutput(
    completeCanonicalAudit.winner,
    exhaustiveReference.winner,
  ),
  completeTieSetMatchesExhaustive: sameCanonicalOutput(
    completeCanonicalAudit.completeTieSet,
    exhaustiveReference.completeTieSet,
  ),
  runnerUpMatchesExhaustive: sameCanonicalOutput(
    completeCanonicalAudit.runnerUp,
    exhaustiveReference.runnerUp,
  ),
  completeCanonicalOutputMatchesExhaustive: sameCanonicalOutput(
    {
      winner: completeCanonicalAudit.winner,
      completeTieSet: completeCanonicalAudit.completeTieSet,
      runnerUp: completeCanonicalAudit.runnerUp,
    },
    exhaustiveReference,
  ),
  reducerPairReconciliation,
  auditPairReconciliation,
};

const publicationFailures = [
  !firstHash || !secondHash || firstHash !== secondHash ? "serial exact trace result mismatch" : null,
  first.lowerCentralUpperMismatchCount !== 0
    ? "first exact trace lower/central/upper mismatch"
    : null,
  second.lowerCentralUpperMismatchCount !== 0
    ? "repeat exact trace lower/central/upper mismatch"
    : null,
  !comparison.fixtureLegalTeamSetsMatch ? "fixture legal-team accounting mismatch" : null,
  !comparison.reducerWinnerMatchesExhaustive ? "reducer winner mismatch" : null,
  !comparison.auditWinnerMatchesExhaustive ? "reducer audit winner mismatch" : null,
  !comparison.completeTieSetMatchesExhaustive ? "reducer audit complete tie-set mismatch" : null,
  !comparison.runnerUpMatchesExhaustive ? "reducer audit runner-up mismatch" : null,
  !comparison.completeCanonicalOutputMatchesExhaustive
    ? "reducer audit canonical output mismatch"
    : null,
  !reducer.certificate.countsReconciled ? "reducer team-set reconciliation failed" : null,
  !reducer.certificate.leaderPairCountsReconciled
    ? "reducer Leader pair reconciliation failed"
    : null,
  !reducerPairReconciliation.leaderClassPairCountsReconciled
    ? "reducer class-pair reconciliation failed"
    : null,
  !reducerPairReconciliation.leaderOutfitPairCountsReconciled
    ? "reducer Outfit-pair reconciliation failed"
    : null,
  !reducerPairReconciliation.declaredClassPairsMatchExhaustive
    ? "reducer declared class-pair count mismatch"
    : null,
  !reducerPairReconciliation.leaderEquivalenceClassesMatchExpected
    ? "reducer Leader equivalence-class count mismatch"
    : null,
  !reducerPairReconciliation.eligibleLeaderOutfitsMatchExpected
    ? "reducer eligible Leader/Outfit count mismatch"
    : null,
  !reducerPairReconciliation.declaredOutfitPairsMatchExhaustive
    ? "reducer declared Outfit-pair count mismatch"
    : null,
  !reducerPairReconciliation.partitionedClassPairsMatchExhaustive
    ? "reducer class-pair partition mismatch"
    : null,
  !reducerPairReconciliation.partitionedOutfitPairsMatchExhaustive
    ? "reducer Outfit-pair partition mismatch"
    : null,
  !reducerPairReconciliation.seedWorkExcludedFromProofPairs
    ? "reducer seed work leaked into proof pairs"
    : null,
  !reducerAudit.certificate.countsReconciled ? "reducer audit team-set reconciliation failed" : null,
  !reducerAudit.certificate.leaderPairCountsReconciled
    ? "reducer audit Leader pair reconciliation failed"
    : null,
  !auditPairReconciliation.leaderClassPairCountsReconciled
    ? "reducer audit class-pair reconciliation failed"
    : null,
  !auditPairReconciliation.leaderOutfitPairCountsReconciled
    ? "reducer audit Outfit-pair reconciliation failed"
    : null,
  !auditPairReconciliation.declaredClassPairsMatchExhaustive
    ? "reducer audit declared class-pair count mismatch"
    : null,
  !auditPairReconciliation.leaderEquivalenceClassesMatchExpected
    ? "reducer audit Leader equivalence-class count mismatch"
    : null,
  !auditPairReconciliation.eligibleLeaderOutfitsMatchExpected
    ? "reducer audit eligible Leader/Outfit count mismatch"
    : null,
  !auditPairReconciliation.declaredOutfitPairsMatchExhaustive
    ? "reducer audit declared Outfit-pair count mismatch"
    : null,
  !auditPairReconciliation.partitionedClassPairsMatchExhaustive
    ? "reducer audit class-pair partition mismatch"
    : null,
  !auditPairReconciliation.partitionedOutfitPairsMatchExhaustive
    ? "reducer audit Outfit-pair partition mismatch"
    : null,
  !auditPairReconciliation.seedWorkExcludedFromProofPairs
    ? "reducer audit seed work leaked into proof pairs"
    : null,
].filter(Boolean);

if (publicationFailures.length > 0) {
  throw new Error(
    `Refusing to publish reduced proof: ${publicationFailures.join("; ")}\n` +
      JSON.stringify(comparison, null, 2),
  );
}

const reportWithoutHash = {
  schemaVersion: 2,
  kind: "exact-optimizer-reduced-trace-proof",
  methodologyVersion: "yd-exact-optimizer-reduced-trace-proof-1.1.0",
  scopeHash: exactOptimizerScope.scopeHash,
  fixture: {
    memberCardIds: MEMBER_IDS,
    leaderOutfitCardIds: LEADER_IDS,
    chartKeys: CHART_KEYS,
    investmentLayer: "one-copy-maximum",
    legalTeamSets: countNativeLegalTeamSets({ eligibleMemberCardIds: MEMBER_IDS }),
  },
  exactTraceCrossCheck: {
    kernelEvaluations: first.kernelEvaluations,
    lowerCentralUpperMismatchCount: first.lowerCentralUpperMismatchCount,
    serialRepeatMatches: firstHash === secondHash,
    serialResultHash: firstHash,
    repeatResultHash: secondHash,
  },
  incumbent: {
    winner: incumbent.winner,
    completeTieSet: incumbent.completeTieSet,
    runnerUp: incumbent.runnerUp,
    fixedPointIterations: incumbent.counts.fixedPointIterations,
    frozenHash: incumbent.frozenHash,
  },
  exhaustiveReference,
  reducerResult: {
    winner: reducedWinner,
    proofCertificate: {
      legalTeamSets: reducer.certificate.legalTeamSets,
      exactLeafEvaluations: reducer.certificate.exactLeafEvaluations,
      prunedTeamSets: reducer.certificate.prunedTeamSets,
      exactLeaderTeamEvaluations: reducer.certificate.exactLeaderTeamEvaluations,
      incumbentSeedLeaderTeamEvaluations: reducer.certificate.incumbentSeedLeaderTeamEvaluations,
      ...reducerPairReconciliation,
    },
    completeCanonicalAudit,
  },
  comparison,
  proofCascade: {
    b0UpperCentralMicroUnits: root.b0.upperCentralMicroUnits,
    b1FixedLeaderBounds: root.b1.length,
    b2PartialLeaderBounds: partial.b1.length,
    b3ExactLeafTeamSets: reducer.certificate.proofCascade.b3ExactLeafTeamSets,
    strictPrunes: reducer.certificate.proofCascade.strictPrunes,
    equalitySurvivors: reducer.certificate.proofCascade.equalitySurvivors,
    countsReconciled: reducer.certificate.countsReconciled,
    leaderClassPairCountsReconciled: reducer.certificate.leaderClassPairCountsReconciled,
    leaderOutfitPairCountsReconciled: reducer.certificate.leaderOutfitPairCountsReconciled,
    leaderPairCountsReconciled: reducer.certificate.leaderPairCountsReconciled,
  },
  certificateEligible: false,
  disposition: "Reduced fixture cross-checks the compiled trace kernel against the independent uncompressed evaluator. It is not the declared 113-card, 30-chart full-scope certificate.",
};
const report = { ...reportWithoutHash, reportHash: sha256(reportWithoutHash) };
const outputPath = join(process.cwd(), "data/native/exact-optimizer-reduced-proof-v1.json");
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
