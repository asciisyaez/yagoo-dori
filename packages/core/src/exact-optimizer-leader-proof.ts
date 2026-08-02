import { createHash } from "node:crypto";

import { mechanicsData } from "./mechanics";
import { compileExactOptimizerTeam, evaluateExactOptimizerTeamLeader } from "./exact-optimizer-kernel";
import { compileNativeLeaderEquivalence } from "./native-leader-equivalence";
import { songContextData } from "./song-contexts";

export const EXACT_OPTIMIZER_LEADER_PROOF_VERSION =
  "yd-exact-leader-equivalence-coverage-1.0.0" as const;

export type ExactLeaderProofInput = Readonly<{
  eligibleLeaderOutfitCardIds: readonly string[];
  seed: number;
  accountState: Readonly<{
    board: Readonly<{
      mode: "declared-neutral";
      evidenceGrade: "verified" | "corroborated";
      evidenceRef: string;
    }>;
  }>;
}>;

export type ExactLeaderProofReport = Readonly<{
  kind: "exact-leader-equivalence-coverage-proof";
  methodologyVersion: typeof EXACT_OPTIMIZER_LEADER_PROOF_VERSION;
  caseCount: number;
  classCount: number;
  comparedOutfitPairs: number;
  mismatchCount: number;
  mismatchExamples: readonly Readonly<{
    representativeCardId: string;
    candidateCardId: string;
    chartKey: string;
  }>[];
  singletonFallback: boolean;
  corpusHash: string;
}>;

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function canonicalFiveMemberTeam(): readonly [string, string, string, string, string] {
  const byTalent = new Map<string, string>();
  for (const card of mechanicsData.cards) {
    if (!byTalent.has(card.talentId)) byTalent.set(card.talentId, card.cardId);
    if (byTalent.size === 5) break;
  }
  const members = [...byTalent.values()].sort((left, right) => left.localeCompare(right));
  if (members.length !== 5) throw new Error("Pinned mechanics catalog cannot form a five-talent proof team");
  return members as [string, string, string, string, string];
}

/**
 * A deliberately stratified, non-Cartesian corpus.  Every aggregate chart is
 * checked once; the three investment layers and Bloom 0--5 appear in separate
 * deterministic representatives rather than multiplying each axis together.
 */
function corpusCases(): readonly Readonly<{
  chartKey: string;
  investmentLayer: "low-investment" | "one-copy-maximum" | "duplicate-enabled-ceiling";
  bloomStageByCardId?: Readonly<Record<string, 0 | 1 | 2 | 3 | 4 | 5>>;
}>[] {
  const members = canonicalFiveMemberTeam();
  const charts = songContextData.charts
    .filter((chart) => chart.fidelity === "aggregate")
    .map((chart) => chart.key)
    .sort((left, right) => left.localeCompare(right));
  const layers = ["low-investment", "one-copy-maximum", "duplicate-enabled-ceiling"] as const;
  return charts.map((chartKey, index) => {
    const investmentLayer = layers[index % layers.length]!;
    if (index % 3 !== 1) return { chartKey, investmentLayer };
    const bloomStageByCardId = Object.fromEntries(
      members.map((cardId, memberIndex) => [cardId, ((index + memberIndex) % 6) as 0 | 1 | 2 | 3 | 4 | 5]),
    );
    return { chartKey, investmentLayer, bloomStageByCardId };
  });
}

/**
 * Prove any non-singleton class against the native-reference fallback over
 * the whole declared coverage corpus.  A mismatch is an error at the caller's
 * gate; callers may retain singleton classes without a pair comparison.
 */
export function proveNativeLeaderEquivalenceCoverage(
  input: ExactLeaderProofInput,
): ExactLeaderProofReport {
  const equivalence = compileNativeLeaderEquivalence({
    eligibleLeaderOutfitCardIds: input.eligibleLeaderOutfitCardIds,
  });
  const cases = corpusCases();
  const members = canonicalFiveMemberTeam();
  const mismatches: Array<{
    representativeCardId: string;
    candidateCardId: string;
    chartKey: string;
  }> = [];
  let comparedOutfitPairs = 0;
  for (const proofCase of cases) {
    const team = compileExactOptimizerTeam({
      memberCardIds: members,
      investmentLayer: proofCase.investmentLayer,
      ...(proofCase.bloomStageByCardId
        ? { bloomStageByCardId: proofCase.bloomStageByCardId }
        : {}),
    });
    for (const leaderClass of equivalence.classes) {
      if (leaderClass.multiplicity === 1) continue;
      const reference = evaluateExactOptimizerTeamLeader({
        team,
        leaderOutfitCardId: leaderClass.representativeCardId,
        chartKey: proofCase.chartKey,
        seed: input.seed,
        accountState: input.accountState,
      }).canonicalUtility;
      for (const candidateCardId of leaderClass.eligibleCardIds) {
        const candidate = evaluateExactOptimizerTeamLeader({
          team,
          leaderOutfitCardId: candidateCardId,
          chartKey: proofCase.chartKey,
          seed: input.seed,
          accountState: input.accountState,
        }).canonicalUtility;
        comparedOutfitPairs += 1;
        if (
          candidate.lower !== reference.lower ||
          candidate.central !== reference.central ||
          candidate.upper !== reference.upper
        ) {
          mismatches.push({
            representativeCardId: leaderClass.representativeCardId,
            candidateCardId,
            chartKey: proofCase.chartKey,
          });
        }
      }
    }
  }
  return {
    kind: "exact-leader-equivalence-coverage-proof",
    methodologyVersion: EXACT_OPTIMIZER_LEADER_PROOF_VERSION,
    caseCount: cases.length,
    classCount: equivalence.classes.length,
    comparedOutfitPairs,
    mismatchCount: mismatches.length,
    mismatchExamples: Object.freeze(mismatches.slice(0, 20)),
    singletonFallback: equivalence.classes.every((leaderClass) => leaderClass.multiplicity === 1),
    corpusHash: sha256({
      cases,
      eligibleLeaderOutfitCardIds: [...input.eligibleLeaderOutfitCardIds].sort(),
    }),
  };
}
