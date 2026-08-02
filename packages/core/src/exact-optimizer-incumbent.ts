import { createHash } from "node:crypto";

import {
  canonicalCandidateKey,
  canonicalUtilityTie,
  compareCanonicalCandidates,
  fromCanonicalMicroUnits,
  toCanonicalMicroUnits,
  type CanonicalCandidate,
  type CanonicalUtilityTuple,
} from "./exact-optimizer-arithmetic";
import { type BloomStage, type InvestmentLayer } from "./formation-evaluator";
import { mechanicsCardById } from "./mechanics";
import { compileExactOptimizerTeam, crossCheckExactOptimizerTeamLeader } from "./exact-optimizer-kernel";
import { compileNativeLeaderEquivalence } from "./native-leader-equivalence";
import { searchNativeCanonicalCandidates } from "./native-search";
import { type NeutralBoardAccountState, type UtilityInterval } from "./native-utility";

export const EXACT_OPTIMIZER_INCUMBENT_VERSION = "yd-exact-incumbent-1.0.0" as const;

type Team = readonly [string, string, string, string, string];
type CandidateSource = "existing" | "beam" | "one-member-swap" | "two-member-swap" | "leader-swap";

type EvaluatedCandidate = Readonly<{
  leaderOutfitCardId: string;
  memberCardIds: Team;
  utility: CanonicalUtilityTuple;
  source: CandidateSource;
}>;

export type ExactOptimizerIncumbentResult = Readonly<{
  kind: "exact-optimizer-deterministic-incumbent";
  methodologyVersion: typeof EXACT_OPTIMIZER_INCUMBENT_VERSION;
  chartKeys: readonly string[];
  winner: Readonly<{
    leaderOutfitCardId: string;
    memberCardIds: Team;
    relativeUtility: UtilityInterval;
    canonicalUtility: CanonicalUtilityTuple;
  }>;
  completeTieSet: readonly string[];
  runnerUp: Readonly<{ key: string; centralMicroUnits: number }> | null;
  counts: Readonly<{
    existingTeams: number;
    beamTeams: number;
    oneMemberSwapTeams: number;
    twoMemberSwapTeams: number;
    leaderOutfitsEvaluated: number;
    chartEvaluations: number;
    fixedPointIterations: number;
  }>;
  frozenHash: string;
}>;

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function sortedTeam(memberCardIds: readonly string[]): Team | null {
  if (memberCardIds.length !== 5 || new Set(memberCardIds).size !== 5) return null;
  const sorted = [...memberCardIds].sort((left, right) => left.localeCompare(right));
  const cards = sorted.map((cardId) => mechanicsCardById.get(cardId));
  if (cards.some((card) => !card)) return null;
  if (new Set(cards.map((card) => card!.talentId)).size !== 5) return null;
  return sorted as unknown as Team;
}

function respectsFiveStarCap(team: Team, maxFiveStarMembers: number): boolean {
  return team.filter((cardId) => mechanicsCardById.get(cardId)!.rarity === 5).length <= maxFiveStarMembers;
}

function aggregate(values: readonly CanonicalUtilityTuple[]): CanonicalUtilityTuple {
  if (values.length === 0) throw new Error("An incumbent candidate needs at least one chart");
  return {
    lower: toCanonicalMicroUnits(
      values.reduce((total, value) => total + fromCanonicalMicroUnits(value.lower), 0) / values.length,
    ),
    central: toCanonicalMicroUnits(
      values.reduce((total, value) => total + fromCanonicalMicroUnits(value.central), 0) / values.length,
    ),
    upper: toCanonicalMicroUnits(
      values.reduce((total, value) => total + fromCanonicalMicroUnits(value.upper), 0) / values.length,
    ),
  };
}

function compare(left: EvaluatedCandidate, right: EvaluatedCandidate): number {
  return -compareCanonicalCandidates(
    { leaderCardId: left.leaderOutfitCardId, memberCardIds: left.memberCardIds, utility: left.utility },
    { leaderCardId: right.leaderOutfitCardId, memberCardIds: right.memberCardIds, utility: right.utility },
  );
}

function uniqueTeams(teams: readonly (Team | null)[]): Team[] {
  return [...new Map(
    teams.filter((team): team is Team => team !== null).map((team) => [team.join("|"), team]),
  ).values()].sort((left, right) => left.join("|").localeCompare(right.join("|")));
}

export function buildExactOptimizerDeterministicIncumbent(input: Readonly<{
  eligibleMemberCardIds: readonly string[];
  eligibleLeaderOutfitCardIds: readonly string[];
  chartKeys: readonly string[];
  investmentLayer: InvestmentLayer;
  bloomStageByCardId?: Readonly<Record<string, BloomStage>>;
  maxFiveStarMembers?: number;
  seed: number;
  accountState: NeutralBoardAccountState;
  existingMemberTeams?: readonly (readonly string[])[];
  /** Bounded by design: this builds an incumbent, not a certificate search. */
  maximumCandidateTeams?: number;
  includeTwoMemberNeighborhood?: boolean;
}>): ExactOptimizerIncumbentResult {
  const maxFiveStarMembers = input.maxFiveStarMembers ?? 5;
  const chartKeys = [...new Set(input.chartKeys)].sort((left, right) => left.localeCompare(right));
  if (chartKeys.length === 0) throw new Error("Incumbent construction requires at least one chart");
  const eligibleMembers = [...new Set(input.eligibleMemberCardIds)].sort((left, right) =>
    left.localeCompare(right),
  );
  const leaders = [...new Set(input.eligibleLeaderOutfitCardIds)].sort((left, right) =>
    left.localeCompare(right),
  );
  if (leaders.length === 0) throw new Error("Incumbent construction requires a Leader");
  const classes = compileNativeLeaderEquivalence({ eligibleLeaderOutfitCardIds: leaders });
  const maxTeams = input.maximumCandidateTeams ?? 12;
  if (!Number.isSafeInteger(maxTeams) || maxTeams < 1) {
    throw new Error("maximumCandidateTeams must be a positive safe integer");
  }

  const existingTeams = uniqueTeams((input.existingMemberTeams ?? []).map(sortedTeam))
    .filter((team) => respectsFiveStarCap(team, maxFiveStarMembers));
  const beam = searchNativeCanonicalCandidates({
    chartKey: chartKeys[0]!,
    seed: input.seed,
    investmentLayer: input.investmentLayer,
    ...(input.bloomStageByCardId ? { bloomStageByCardId: input.bloomStageByCardId } : {}),
    accountState: input.accountState,
    constraints: {
      memberCardIds: eligibleMembers,
      leaderOutfitCardIds: classes.classes.map((leaderClass) => leaderClass.representativeCardId),
      maxFiveStarMembers,
    },
    strategy: { mode: "beam", beamWidth: 32, finalistTeamCount: Math.min(8, maxTeams), leadersPerTeam: 1 },
  });
  const beamTeams = uniqueTeams(beam.candidates.map((candidate) => candidate.memberCardIds));
  const seedTeams = uniqueTeams([...existingTeams, ...beamTeams]).slice(0, maxTeams);
  if (seedTeams.length === 0) throw new Error("Incumbent construction found no legal seed team");

  let oneMemberSwapTeams: Team[] = [];
  let twoMemberSwapTeams: Team[] = [];
  let fixedPointIterations = 0;
  let pool = seedTeams;
  let evaluated: EvaluatedCandidate[] = [];

  const evaluatePool = (teams: readonly Team[], source: CandidateSource): EvaluatedCandidate[] => {
    const result: EvaluatedCandidate[] = [];
    for (const memberCardIds of teams) {
      const team = compileExactOptimizerTeam({
        memberCardIds,
        investmentLayer: input.investmentLayer,
        ...(input.bloomStageByCardId ? { bloomStageByCardId: input.bloomStageByCardId } : {}),
      });
      // All Outfit IDs are re-evaluated, even when B1 used a representative.
      // This reconciles the actual pair space and cannot inherit a different
      // Leader's components.
      for (const leaderOutfitCardId of leaders) {
        const utility = aggregate(chartKeys.map((chartKey) =>
          crossCheckExactOptimizerTeamLeader({
            team,
            leaderOutfitCardId,
            chartKey,
            seed: input.seed,
            accountState: input.accountState,
          }).canonicalUtility,
        ));
        result.push({ leaderOutfitCardId, memberCardIds, utility, source });
      }
    }
    return result;
  };

  for (let iteration = 0; iteration < 2; iteration += 1) {
    fixedPointIterations += 1;
    evaluated = [...evaluated, ...evaluatePool(pool, iteration === 0 ? "existing" : "one-member-swap")];
    const best = [...evaluated].sort(compare)[0]!;
    const swaps: Team[] = [];
    for (let slot = 0; slot < best.memberCardIds.length; slot += 1) {
      for (const replacement of eligibleMembers) {
        const next = [...best.memberCardIds];
        next[slot] = replacement;
        const team = sortedTeam(next);
        if (team && respectsFiveStarCap(team, maxFiveStarMembers)) swaps.push(team);
      }
    }
    oneMemberSwapTeams = uniqueTeams(swaps).slice(0, maxTeams);
    if (oneMemberSwapTeams.length === 0) break;
    const priorBestKey = canonicalCandidateKey({
      leaderCardId: best.leaderOutfitCardId,
      memberCardIds: best.memberCardIds,
    });
    pool = oneMemberSwapTeams;
    const preview = evaluatePool(pool, "one-member-swap");
    evaluated = [...evaluated, ...preview];
    const nextBest = [...evaluated].sort(compare)[0]!;
    const nextBestKey = canonicalCandidateKey({
      leaderCardId: nextBest.leaderOutfitCardId,
      memberCardIds: nextBest.memberCardIds,
    });
    if (nextBestKey === priorBestKey) break;
    pool = [nextBest.memberCardIds];
  }

  if (input.includeTwoMemberNeighborhood) {
    const best = [...evaluated].sort(compare)[0]!;
    const swaps: Team[] = [];
    for (let left = 0; left < 5; left += 1) {
      for (let right = left + 1; right < 5; right += 1) {
        for (const replacement of eligibleMembers.slice(0, 8)) {
          const next = [...best.memberCardIds];
          next[left] = replacement;
          for (const second of eligibleMembers.slice(0, 8)) {
            next[right] = second;
            const team = sortedTeam(next);
            if (team && respectsFiveStarCap(team, maxFiveStarMembers)) swaps.push(team);
          }
        }
      }
    }
    twoMemberSwapTeams = uniqueTeams(swaps).slice(0, maxTeams);
    evaluated = [...evaluated, ...evaluatePool(twoMemberSwapTeams, "two-member-swap")];
  }

  const sorted = [...evaluated].sort(compare);
  const winner = sorted[0]!;
  const canonicalWinner: CanonicalCandidate = {
    leaderCardId: winner.leaderOutfitCardId,
    memberCardIds: winner.memberCardIds,
    utility: winner.utility,
  };
  const completeTieSet = sorted
    .filter((candidate) => canonicalUtilityTie(candidate.utility, winner.utility))
    .map((candidate) => canonicalCandidateKey({
      leaderCardId: candidate.leaderOutfitCardId,
      memberCardIds: candidate.memberCardIds,
    }))
    .sort((left, right) => left.localeCompare(right));
  const runnerUp = sorted.find((candidate) =>
    canonicalCandidateKey({ leaderCardId: candidate.leaderOutfitCardId, memberCardIds: candidate.memberCardIds }) !==
    canonicalCandidateKey(canonicalWinner),
  );
  const resultWithoutHash = {
    kind: "exact-optimizer-deterministic-incumbent" as const,
    methodologyVersion: EXACT_OPTIMIZER_INCUMBENT_VERSION,
    chartKeys,
    winner: {
      leaderOutfitCardId: winner.leaderOutfitCardId,
      memberCardIds: winner.memberCardIds,
      relativeUtility: {
        lower: fromCanonicalMicroUnits(winner.utility.lower),
        central: fromCanonicalMicroUnits(winner.utility.central),
        upper: fromCanonicalMicroUnits(winner.utility.upper),
      },
      canonicalUtility: winner.utility,
    },
    completeTieSet,
    runnerUp: runnerUp
      ? {
          key: canonicalCandidateKey({
            leaderCardId: runnerUp.leaderOutfitCardId,
            memberCardIds: runnerUp.memberCardIds,
          }),
          centralMicroUnits: runnerUp.utility.central,
        }
      : null,
    counts: {
      existingTeams: existingTeams.length,
      beamTeams: beamTeams.length,
      oneMemberSwapTeams: oneMemberSwapTeams.length,
      twoMemberSwapTeams: twoMemberSwapTeams.length,
      leaderOutfitsEvaluated: leaders.length,
      chartEvaluations: evaluated.length * chartKeys.length,
      fixedPointIterations,
    },
  };
  return { ...resultWithoutHash, frozenHash: sha256(resultWithoutHash) };
}
