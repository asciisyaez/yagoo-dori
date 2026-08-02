import { type BloomStage, type InvestmentLayer } from "./formation-evaluator";
import {
  canonicalCandidateKey,
  canonicalUtilityTie,
  compareCanonicalCandidates,
  fromCanonicalMicroUnits,
  toCanonicalMicroUnits,
  upperBoundToCanonicalMicroUnits,
  type CanonicalCandidate,
  type CanonicalUtilityTuple,
} from "./exact-optimizer-arithmetic";
import { mechanicsCardById } from "./mechanics";
import {
  compileNativeGlobalBoundContext,
  type NativeGlobalBoundResult,
} from "./native-global-bound";
import {
  evaluateNativeCentralUtility,
  evaluateNativeRelativeUtility,
  type NeutralBoardAccountState,
  type UtilityInterval,
} from "./native-utility";
import { searchNativeCanonicalCandidates } from "./native-search";
import { publicCardById } from "./public-data";

type TalentGroup = Readonly<{
  talentId: string;
  cardIds: readonly string[];
}>;

type Candidate = Readonly<{
  leaderOutfitCardId: string;
  memberCardIds: readonly [string, string, string, string, string];
  relativeUtility: UtilityInterval;
}>;

type SearchCandidate = Candidate & Readonly<{
  canonicalUtility: CanonicalUtilityTuple;
}>;

export type NativeGlobalSearchInput = Readonly<{
  eligibleMemberCardIds: readonly string[];
  eligibleLeaderOutfitCardIds: readonly string[];
  /**
   * Optional exact incumbent seed. It only raises the starting lower bound;
   * the certifying traversal still visits or soundly prunes every legal team.
   * This lets an offline heuristic hand a strong candidate to the proof pass
   * without allowing heuristic output to become a certificate. Equivalent
   * Leader/Outfit cards may still be collapsed by the exact equivalence pass.
   */
  initialCandidate?: Readonly<{
    leaderOutfitCardId: string;
    memberCardIds: readonly string[];
  }>;
  fixedMemberCardIds?: readonly string[];
  investmentLayer: InvestmentLayer;
  bloomStageByCardId?: Readonly<Record<string, BloomStage>>;
  maxFiveStarMembers?: number;
  chartKeys: readonly string[];
  seed: number;
  accountState: NeutralBoardAccountState;
  maximumRuntimeMilliseconds?: number;
  progressIntervalNodes?: number;
  onProgress?: (snapshot: NativeGlobalSearchProgress) => void;
  /**
   * Reduced-proof audit only: retain every exact candidate so a small fixture
   * can compare the reducer's complete canonical output with an independent
   * exhaustive evaluator. It deliberately disables subtree pruning, never
   * changes the default certifying traversal, and must not be used for the
   * declared full roster.
   */
  collectCompleteCanonicalOutput?: boolean;
}>;

export type NativeGlobalSearchProgress = Readonly<{
  elapsedMilliseconds: number;
  nodesVisited: number;
  exactLeafEvaluations: number;
  prunedTeamSets: number;
  boundEvaluations: number;
  utilityEvaluations: number;
  intervalUtilityEvaluations: number;
  bestCentralUtility: number | null;
}>;

export class NativeGlobalSearchTimeoutError extends Error {
  readonly progress: NativeGlobalSearchProgress;

  constructor(progress: NativeGlobalSearchProgress) {
    super("Native global search exceeded its declared runtime budget without a certificate");
    this.name = "NativeGlobalSearchTimeoutError";
    this.progress = progress;
  }
}

export type NativeGlobalCanonicalCandidate = Readonly<{
  leaderOutfitCardId: string;
  memberCardIds: readonly [string, string, string, string, string];
  canonicalUtility: CanonicalUtilityTuple;
}>;

export type NativeGlobalCompleteCanonicalOutput = Readonly<{
  evaluatedLeaderOutfitTeamPairs: number;
  winner: NativeGlobalCanonicalCandidate;
  completeTieSet: readonly string[];
  runnerUp: NativeGlobalCanonicalCandidate | null;
}>;

export type NativeGlobalLeaderPairReconciliation = Readonly<{
  leaderClassTeamPairs: number;
  leaderOutfitTeamPairs: number;
  exactLeaderClassTeamPairs: number;
  prunedLeaderClassTeamPairs: number;
  exactLeaderOutfitTeamPairs: number;
  prunedLeaderOutfitTeamPairs: number;
  leaderClassPairCountsReconciled: true;
  leaderOutfitPairCountsReconciled: true;
  leaderPairCountsReconciled: true;
}>;

/**
 * Reconcile only certifying traversal work. Incumbent-seed evaluations are
 * deliberately absent: they raise the lower bound but cannot account for a
 * legal pair in the proof partition.
 */
export function reconcileNativeGlobalLeaderPairCounts(input: Readonly<{
  legalTeamSets: number;
  exactLeafEvaluations: number;
  prunedTeamSets: number;
  leaderEquivalenceClasses: number;
  eligibleLeaderOutfits: number;
}>): NativeGlobalLeaderPairReconciliation {
  const leaderClassTeamPairs = input.legalTeamSets * input.leaderEquivalenceClasses;
  const leaderOutfitTeamPairs = input.legalTeamSets * input.eligibleLeaderOutfits;
  const exactLeaderClassTeamPairs = input.exactLeafEvaluations * input.leaderEquivalenceClasses;
  const prunedLeaderClassTeamPairs = input.prunedTeamSets * input.leaderEquivalenceClasses;
  const exactLeaderOutfitTeamPairs = input.exactLeafEvaluations * input.eligibleLeaderOutfits;
  const prunedLeaderOutfitTeamPairs = input.prunedTeamSets * input.eligibleLeaderOutfits;
  const leaderClassPairCountsReconciled =
    exactLeaderClassTeamPairs + prunedLeaderClassTeamPairs === leaderClassTeamPairs;
  const leaderOutfitPairCountsReconciled =
    exactLeaderOutfitTeamPairs + prunedLeaderOutfitTeamPairs === leaderOutfitTeamPairs;
  const leaderPairCountsReconciled =
    leaderClassPairCountsReconciled && leaderOutfitPairCountsReconciled;
  if (!leaderPairCountsReconciled) {
    throw new Error(
      `Global-search Leader pair counts did not reconcile: ` +
        `class ${exactLeaderClassTeamPairs}+${prunedLeaderClassTeamPairs} != ${leaderClassTeamPairs}; ` +
        `Outfit ${exactLeaderOutfitTeamPairs}+${prunedLeaderOutfitTeamPairs} != ${leaderOutfitTeamPairs}`,
    );
  }
  return {
    leaderClassTeamPairs,
    leaderOutfitTeamPairs,
    exactLeaderClassTeamPairs,
    prunedLeaderClassTeamPairs,
    exactLeaderOutfitTeamPairs,
    prunedLeaderOutfitTeamPairs,
    leaderClassPairCountsReconciled,
    leaderOutfitPairCountsReconciled,
    leaderPairCountsReconciled,
  };
}

export type NativeGlobalSearchResult = Readonly<{
  kind: "native-global-team-search";
  methodologyVersion: "yd-native-global-search-1.0.0";
  best: Candidate;
  certificate: Readonly<{
    kind: "certified";
    optimalityClaim: "global-central-optimum-under-current-aggregate-model";
    legalTeamSets: number;
    exactLeafEvaluations: number;
    prunedTeamSets: number;
    countsReconciled: true;
    nodesVisited: number;
    nodesPruned: number;
    boundEvaluations: number;
    utilityEvaluations: number;
    intervalUtilityEvaluations: number;
    leaderTeamCandidates: number;
    exactLeaderTeamEvaluations: number;
    prunedLeaderTeamCandidates: number;
    maximumPrunedUpperCentralUtility: number | null;
    optimalityGap: 0;
    eligibleLeaderOutfits: number;
    leaderEquivalenceClasses: number;
    collapsedLeaderOutfits: number;
    incumbentSource: "provided-seed" | "canonical-beam-seed" | "first-exact-leaf";
    incumbentSeedTeamSets: number;
    /** Accelerator work is explicitly outside exact/pruned proof accounting. */
    incumbentSeedLeaderTeamEvaluations: number;
    incumbentSearchUtilityEvaluations: number;
    /** Pair-space accounting includes all Outfit multiplicities, not just teams. */
    leaderClassTeamPairs: number;
    leaderOutfitTeamPairs: number;
    exactLeaderClassTeamPairs: number;
    prunedLeaderClassTeamPairs: number;
    exactLeaderOutfitTeamPairs: number;
    prunedLeaderOutfitTeamPairs: number;
    leaderClassPairCountsReconciled: true;
    leaderOutfitPairCountsReconciled: true;
    leaderPairCountsReconciled: true;
    proofCascade: Readonly<{
      b0RootBounds: number;
      b1FixedLeaderBounds: number;
      b2PartialBounds: number;
      b3ExactLeafTeamSets: number;
      strictPrunes: number;
      equalitySurvivors: number;
      boundElapsedMilliseconds: number;
      minimumSurvivingUpperCentralUtility: number | null;
    }>;
  }>;
  completeCanonicalOutput?: NativeGlobalCompleteCanonicalOutput;
}>;

function compareCandidates(left: SearchCandidate, right: SearchCandidate): number {
  const leftCanonical: CanonicalCandidate = {
    leaderCardId: left.leaderOutfitCardId,
    memberCardIds: left.memberCardIds,
    utility: left.canonicalUtility,
  };
  const rightCanonical: CanonicalCandidate = {
    leaderCardId: right.leaderOutfitCardId,
    memberCardIds: right.memberCardIds,
    utility: right.canonicalUtility,
  };
  // compareCanonicalCandidates is positive when the left candidate wins.
  return -compareCanonicalCandidates(leftCanonical, rightCanonical);
}

function asTeam(ids: readonly string[]): readonly [string, string, string, string, string] {
  if (ids.length !== 5) throw new Error(`Expected five Members; received ${ids.length}`);
  return [...ids].sort() as [string, string, string, string, string];
}

function countCompletions(
  groups: readonly TalentGroup[],
  groupIndex: number,
  slots: number,
  fiveStarBudget: number,
  cache: Map<string, number>,
): number {
  if (fiveStarBudget < 0) return 0;
  if (slots === 0) return 1;
  if (groups.length - groupIndex < slots) return 0;
  const key = `${groupIndex}:${slots}:${fiveStarBudget}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  let total = countCompletions(groups, groupIndex + 1, slots, fiveStarBudget, cache);
  for (const cardId of groups[groupIndex]!.cardIds) {
    const rarity = mechanicsCardById.get(cardId)!.rarity;
    total += countCompletions(
      groups,
      groupIndex + 1,
      slots - 1,
      fiveStarBudget - (rarity === 5 ? 1 : 0),
      cache,
    );
  }
  cache.set(key, total);
  return total;
}

/**
 * Count legal unordered five-Member card sets without evaluating utility. This
 * is the independent accounting primitive used by the v0.2 flat-enumeration
 * benchmark and certificate reducer.
 */
export function countNativeLegalTeamSets(input: Readonly<{
  eligibleMemberCardIds: readonly string[];
  fixedMemberCardIds?: readonly string[];
  maxFiveStarMembers?: number;
}>): number {
  const eligible = [...new Set(input.eligibleMemberCardIds)].sort();
  if (eligible.length !== input.eligibleMemberCardIds.length) {
    throw new Error("Eligible Member IDs must be unique");
  }
  const fixed = [...new Set(input.fixedMemberCardIds ?? [])].sort();
  if (fixed.length !== (input.fixedMemberCardIds ?? []).length) {
    throw new Error("Fixed Member IDs must be unique");
  }
  const maxFiveStarMembers = input.maxFiveStarMembers ?? 5;
  const fixedTalents = new Set<string>();
  let fixedFiveStars = 0;
  for (const cardId of fixed) {
    if (!eligible.includes(cardId)) throw new Error(`Fixed Member is not eligible: ${cardId}`);
    const card = mechanicsCardById.get(cardId);
    if (!card) throw new Error(`Unknown fixed Member: ${cardId}`);
    if (fixedTalents.has(card.talentId)) throw new Error("Fixed Members must have unique talents");
    fixedTalents.add(card.talentId);
    if (card.rarity === 5) fixedFiveStars += 1;
  }
  if (fixed.length > 5 || fixedFiveStars > maxFiveStarMembers) return 0;
  const grouped = new Map<string, string[]>();
  for (const cardId of eligible) {
    const card = mechanicsCardById.get(cardId);
    if (!card) throw new Error(`Unknown eligible Member: ${cardId}`);
    if (fixedTalents.has(card.talentId)) continue;
    const group = grouped.get(card.talentId) ?? [];
    group.push(cardId);
    grouped.set(card.talentId, group);
  }
  const groups: TalentGroup[] = [...grouped.entries()]
    .map(([talentId, cardIds]) => ({ talentId, cardIds: [...cardIds].sort() }))
    .sort((left, right) => left.talentId.localeCompare(right.talentId));
  return countCompletions(
    groups,
    0,
    5 - fixed.length,
    maxFiveStarMembers - fixedFiveStars,
    new Map<string, number>(),
  );
}

/**
 * Certifies the best central aggregate utility in the declared roster by
 * reconciling every legal team set as either an exact leaf or a subtree pruned
 * by `boundNativeAggregateCentralUtility`. This first implementation favors a
 * compact independently testable proof path over full-roster throughput.
 */
export function searchNativeGlobalTeams(input: NativeGlobalSearchInput): NativeGlobalSearchResult {
  if (!Number.isSafeInteger(input.seed)) throw new Error("Global search seed must be a safe integer");
  if (
    input.maximumRuntimeMilliseconds !== undefined &&
    (!Number.isFinite(input.maximumRuntimeMilliseconds) || input.maximumRuntimeMilliseconds <= 0)
  ) {
    throw new Error("maximumRuntimeMilliseconds must be positive and finite");
  }
  const progressIntervalNodes = input.progressIntervalNodes ?? 10_000;
  if (!Number.isSafeInteger(progressIntervalNodes) || progressIntervalNodes <= 0) {
    throw new Error("progressIntervalNodes must be a positive safe integer");
  }
  const startedAt = performance.now();
  const eligibleMemberCardIds = [...new Set(input.eligibleMemberCardIds)].sort();
  if (eligibleMemberCardIds.length !== input.eligibleMemberCardIds.length) {
    throw new Error("Eligible Member IDs must be unique");
  }
  const eligibleLeaderOutfitCardIds = [...new Set(input.eligibleLeaderOutfitCardIds)].sort();
  if (eligibleLeaderOutfitCardIds.length !== input.eligibleLeaderOutfitCardIds.length) {
    throw new Error("Eligible Leader/Outfit IDs must be unique");
  }
  const fixedMemberCardIds = [...new Set(input.fixedMemberCardIds ?? [])].sort();
  if (fixedMemberCardIds.length !== (input.fixedMemberCardIds ?? []).length) {
    throw new Error("Fixed Member IDs must be unique");
  }
  const maxFiveStarMembers = input.maxFiveStarMembers ?? 5;
  const fixedTalents = new Set<string>();
  let fixedFiveStars = 0;
  for (const cardId of fixedMemberCardIds) {
    if (!eligibleMemberCardIds.includes(cardId)) throw new Error("Every fixed Member must be eligible");
    const card = mechanicsCardById.get(cardId);
    if (!card) throw new Error(`Unknown fixed Member: ${cardId}`);
    if (fixedTalents.has(card.talentId)) throw new Error("Fixed Members must have unique talents");
    fixedTalents.add(card.talentId);
    if (card.rarity === 5) fixedFiveStars += 1;
  }
  if (fixedMemberCardIds.length > 5 || fixedFiveStars > maxFiveStarMembers) {
    throw new Error("Fixed Members violate the five-Member constraints");
  }
  const initialCandidate = input.initialCandidate;
  if (initialCandidate) {
    if (!eligibleLeaderOutfitCardIds.includes(initialCandidate.leaderOutfitCardId)) {
      throw new Error("Initial incumbent Leader/Outfit must be eligible");
    }
    const initialMembers = [...new Set(initialCandidate.memberCardIds)].sort();
    if (
      initialMembers.length !== 5 ||
      initialMembers.length !== initialCandidate.memberCardIds.length
    ) {
      throw new Error("Initial incumbent must contain five unique Members");
    }
    const initialTalents = new Set<string>();
    let initialFiveStars = 0;
    for (const cardId of initialMembers) {
      if (!eligibleMemberCardIds.includes(cardId)) {
        throw new Error("Every initial incumbent Member must be eligible");
      }
      const card = mechanicsCardById.get(cardId);
      if (!card) throw new Error(`Unknown initial incumbent Member: ${cardId}`);
      if (initialTalents.has(card.talentId)) {
        throw new Error("Initial incumbent Members must have unique talents");
      }
      initialTalents.add(card.talentId);
      if (card.rarity === 5) initialFiveStars += 1;
    }
    if (initialFiveStars > maxFiveStarMembers) {
      throw new Error("Initial incumbent exceeds maxFiveStarMembers");
    }
    for (const fixedCardId of fixedMemberCardIds) {
      if (!initialMembers.includes(fixedCardId)) {
        throw new Error("Initial incumbent must include every fixed Member");
      }
    }
  }

  const grouped = new Map<string, string[]>();
  for (const cardId of eligibleMemberCardIds) {
    const card = mechanicsCardById.get(cardId);
    if (!card) throw new Error(`Unknown eligible Member: ${cardId}`);
    if (fixedTalents.has(card.talentId)) continue;
    const ids = grouped.get(card.talentId) ?? [];
    ids.push(cardId);
    grouped.set(card.talentId, ids);
  }
  const groups: TalentGroup[] = [...grouped.entries()]
    .map(([talentId, cardIds]) => ({ talentId, cardIds: [...cardIds].sort() }))
    .sort((left, right) => {
      const groupPriority = (group: TalentGroup): number => Math.max(
        ...group.cardIds.map((cardId) => {
          const card = mechanicsCardById.get(cardId);
          if (!card) throw new Error(`Unknown eligible Member: ${cardId}`);
          const publicCard = publicCardById.get(cardId);
          if (!publicCard) throw new Error(`Unknown public Member: ${cardId}`);
          const state = card.progression.oneCopy;
          const active = card.skills.active.find((skill) => skill.level === state.activeSkillLevel);
          const special = card.skills.special.find((skill) => skill.level === state.specialSkillLevel);
          const scoreUp = Math.max(
            0,
            ...(active?.applications ?? []).map((application) =>
              application.effect?.kind === "score-up" ? application.effect.value ?? 0 : 0,
            ),
          );
          const activeCoverage =
            active?.activationProbabilityPermil !== null &&
            active?.activationProbabilityPermil !== undefined &&
            active?.cooldownMilliseconds !== null &&
            active?.cooldownMilliseconds !== undefined &&
            active?.durationMilliseconds !== null &&
            active?.durationMilliseconds !== undefined
              ? (active.activationProbabilityPermil / 1_000) *
                Math.min(1, active.durationMilliseconds / active.cooldownMilliseconds)
              : 0;
          const specialSupport = (special?.applications ?? []).reduce(
            (total, application) =>
              total +
              (application.effect?.kind === "score-support"
                ? application.effect.value ?? 0
                : 0),
            0,
          );
          const parameters = publicCard.parameters.maxPotential;
          return (
            scoreUp * (1 + activeCoverage) +
            specialSupport * 0.2 +
            (parameters.performance + parameters.technique + parameters.sense) / 10_000
          );
        }),
      );
      const leftMax = groupPriority(left);
      const rightMax = groupPriority(right);
      return rightMax - leftMax || left.talentId.localeCompare(right.talentId);
    });
  const suffixCardIds: string[][] = Array.from({ length: groups.length + 1 }, () => []);
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    suffixCardIds[index] = [...groups[index]!.cardIds, ...suffixCardIds[index + 1]!];
  }
  const countCache = new Map<string, number>();
  const legalTeamSets = countCompletions(
    groups,
    0,
    5 - fixedMemberCardIds.length,
    maxFiveStarMembers - fixedFiveStars,
    countCache,
  );
  if (legalTeamSets === 0) throw new Error("No legal five-Member completion exists");

  const boundContext = compileNativeGlobalBoundContext({
    eligibleMemberCardIds,
    eligibleLeaderOutfitCardIds,
    investmentLayer: input.investmentLayer,
    ...(input.bloomStageByCardId
      ? { bloomStageByCardId: input.bloomStageByCardId }
      : {}),
    maxFiveStarMembers,
    chartKeys: input.chartKeys,
  });
  const leaderRepresentatives = boundContext.leaderRepresentativeCardIds;
  let best: SearchCandidate | null = null;
  let exactLeafEvaluations = 0;
  let prunedTeamSets = 0;
  let nodesVisited = 0;
  let nodesPruned = 0;
  let boundEvaluations = 0;
  let utilityEvaluations = 0;
  let intervalUtilityEvaluations = 0;
  let leaderTeamCandidates = 0;
  let exactLeaderTeamEvaluations = 0;
  let prunedLeaderTeamCandidates = 0;
  let maximumPrunedUpperCentralUtility: number | null = null;
  let minimumSurvivingUpperCentralUtility: number | null = null;
  let equalitySurvivors = 0;
  let boundElapsedMilliseconds = 0;
  let incumbentSource: "provided-seed" | "canonical-beam-seed" | "first-exact-leaf" = "first-exact-leaf";
  let incumbentSeedTeamSets = 0;
  let incumbentSeedLeaderTeamEvaluations = 0;
  let incumbentSearchUtilityEvaluations = 0;
  const completeCanonicalOutputCandidates: SearchCandidate[] | null =
    input.collectCompleteCanonicalOutput ? [] : null;

  const progress = (): NativeGlobalSearchProgress => ({
    elapsedMilliseconds: performance.now() - startedAt,
    nodesVisited,
    exactLeafEvaluations,
    prunedTeamSets,
    boundEvaluations,
    utilityEvaluations,
    intervalUtilityEvaluations,
    bestCentralUtility: best?.relativeUtility.central ?? null,
  });

  const checkRuntime = (): void => {
    const snapshot = progress();
    if (
      input.maximumRuntimeMilliseconds !== undefined &&
      snapshot.elapsedMilliseconds >= input.maximumRuntimeMilliseconds
    ) {
      input.onProgress?.(snapshot);
      throw new NativeGlobalSearchTimeoutError(snapshot);
    }
  };

  const exactCandidate = (
    memberCardIds: readonly string[],
    countLeaf = true,
    preferredLeaderOutfitCardId?: string,
  ): void => {
    const members = asTeam(memberCardIds);
    if (countLeaf) exactLeafEvaluations += 1;
    // Class representatives are valid only for bounds and beam seeding.  B3
    // evaluates every actual Outfit/team pair, retaining multiplicity and the
    // canonical tie break even when a class has a safe representative.
    const candidateLeaderIds = preferredLeaderOutfitCardId
      ? [preferredLeaderOutfitCardId, ...eligibleLeaderOutfitCardIds]
      : eligibleLeaderOutfitCardIds;
    const allLeaderIds = [...new Set(candidateLeaderIds)];
    leaderTeamCandidates += allLeaderIds.length;
    if (!countLeaf) incumbentSeedLeaderTeamEvaluations += allLeaderIds.length;
    // Complete teams are already legal. Incumbent seeds are an accelerator,
    // not part of the certificate, so compare every equivalent Leader with
    // the exact central evaluator instead of paying for a full optimistic
    // bound for each seed/Leader pair. Counted leaves still use this same
    // direct path; exhaustive pruning happens only at member subtrees.
    const leaderIds = allLeaderIds;
    for (const leaderOutfitCardId of leaderIds) {
      exactLeaderTeamEvaluations += 1;
      const centralUtilities = input.chartKeys.map((chartKey) => {
        checkRuntime();
        utilityEvaluations += 1;
        return evaluateNativeCentralUtility({
          formation: {
            leaderOutfitCardId,
            members: members.map((cardId) => {
              const bloomStage = input.bloomStageByCardId?.[cardId];
              return bloomStage === undefined
                ? { cardId, investment: input.investmentLayer }
                : { cardId, investment: input.investmentLayer, bloomStage };
            }),
          },
          chartKey,
          seed: input.seed,
          accountState: input.accountState,
        });
      });
      const central = centralUtilities.reduce((sum, utility) => sum + utility, 0) / centralUtilities.length;
      const canonicalCentral = toCanonicalMicroUnits(central);
      if (
        best &&
        canonicalCentral < best.canonicalUtility.central &&
        completeCanonicalOutputCandidates === null
      ) {
        prunedLeaderTeamCandidates += 1;
        continue;
      }
      const utilities = input.chartKeys.map((chartKey) => {
        checkRuntime();
        intervalUtilityEvaluations += 1;
        return evaluateNativeRelativeUtility({
          formation: {
            leaderOutfitCardId,
            members: members.map((cardId) => {
              const bloomStage = input.bloomStageByCardId?.[cardId];
              return bloomStage === undefined
                ? { cardId, investment: input.investmentLayer }
                : { cardId, investment: input.investmentLayer, bloomStage };
            }),
          },
          chartKey,
          seed: input.seed,
          accountState: input.accountState,
        }).relativeUtility;
      });
      const candidate: SearchCandidate = {
        leaderOutfitCardId,
        memberCardIds: members,
        relativeUtility: {
          lower: fromCanonicalMicroUnits(
            toCanonicalMicroUnits(
              utilities.reduce((sum, utility) => sum + utility.lower, 0) / utilities.length,
            ),
          ),
          central: fromCanonicalMicroUnits(
            toCanonicalMicroUnits(
              utilities.reduce((sum, utility) => sum + utility.central, 0) / utilities.length,
            ),
          ),
          upper: fromCanonicalMicroUnits(
            toCanonicalMicroUnits(
              utilities.reduce((sum, utility) => sum + utility.upper, 0) / utilities.length,
            ),
          ),
        },
        canonicalUtility: {
          lower: toCanonicalMicroUnits(
            utilities.reduce((sum, utility) => sum + utility.lower, 0) / utilities.length,
          ),
          central: toCanonicalMicroUnits(
            utilities.reduce((sum, utility) => sum + utility.central, 0) / utilities.length,
          ),
          upper: toCanonicalMicroUnits(
            utilities.reduce((sum, utility) => sum + utility.upper, 0) / utilities.length,
          ),
        },
      };
      if (countLeaf && completeCanonicalOutputCandidates !== null) {
        completeCanonicalOutputCandidates.push(candidate);
      }
      if (!best || compareCandidates(candidate, best) < 0) best = candidate;
    }
  };

  if (initialCandidate) {
    exactCandidate(
      asTeam(initialCandidate.memberCardIds),
      false,
      initialCandidate.leaderOutfitCardId,
    );
    incumbentSeedTeamSets += 1;
    if (best) incumbentSource = "provided-seed";
  }

  if (fixedMemberCardIds.length <= 1) {
    try {
      const seedSearch = searchNativeCanonicalCandidates({
        chartKey: input.chartKeys[0]!,
        seed: input.seed,
        investmentLayer: input.investmentLayer,
        ...(input.bloomStageByCardId
          ? { bloomStageByCardId: input.bloomStageByCardId }
          : {}),
        accountState: input.accountState,
        constraints: {
          memberCardIds: eligibleMemberCardIds,
          leaderOutfitCardIds: leaderRepresentatives,
          ...(fixedMemberCardIds[0] ? { anchorCardId: fixedMemberCardIds[0] } : {}),
          maxFiveStarMembers,
        },
        strategy: {
          mode: "beam",
          beamWidth: 64,
          finalistTeamCount: 16,
          leadersPerTeam: 1,
        },
      });
      incumbentSearchUtilityEvaluations += seedSearch.counts.utilityEvaluations;
      const seedTeams = [
        ...new Map(
          seedSearch.candidates.map((candidate) => [
            [...candidate.memberCardIds].sort().join("|"),
            candidate.memberCardIds,
          ]),
        ).values(),
      ];
      for (const team of seedTeams) {
        checkRuntime();
        exactCandidate(team, false);
        incumbentSeedTeamSets += 1;
      }
      if (best && incumbentSource === "first-exact-leaf") incumbentSource = "canonical-beam-seed";
    } catch (error) {
      if (error instanceof NativeGlobalSearchTimeoutError) throw error;
      // Candidate generation is only an incumbent accelerator. The certifying
      // traversal remains complete if a future proxy cannot produce a seed.
    }
  }

  type Branch = Readonly<{
    groupIndex: number;
    selected: readonly string[];
    fiveStars: number;
    teamSets: number;
    bound: NativeGlobalBoundResult;
  }>;

  const makeBranch = (
    groupIndex: number,
    selected: readonly string[],
    fiveStars: number,
  ): Branch | null => {
    const slots = 5 - selected.length;
    const teamSets = countCompletions(
      groups,
      groupIndex,
      slots,
      maxFiveStarMembers - fiveStars,
      countCache,
    );
    if (teamSets === 0) return null;
    const futureIds = suffixCardIds[groupIndex]!;
    boundEvaluations += 1;
    let bound: NativeGlobalBoundResult;
    const boundStartedAt = performance.now();
    try {
      bound = boundContext.bound({
        partialMemberCardIds: selected,
        eligibleMemberCardIds: [...selected, ...futureIds],
      });
    } catch (error) {
      throw new Error(
        `Global bound rejected a counted subtree at group ${groupIndex} with Members ${selected.join(",")}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    boundElapsedMilliseconds += performance.now() - boundStartedAt;
    return { groupIndex, selected, fiveStars, teamSets, bound };
  };

  const visit = (branch: Branch): void => {
    checkRuntime();
    nodesVisited += 1;
    if (nodesVisited % progressIntervalNodes === 0) input.onProgress?.(progress());
    if (
      completeCanonicalOutputCandidates === null &&
      best &&
      upperBoundToCanonicalMicroUnits(branch.bound.upperCentralUtility) < best.canonicalUtility.central
    ) {
      nodesPruned += 1;
      prunedTeamSets += branch.teamSets;
      maximumPrunedUpperCentralUtility = Math.max(
        maximumPrunedUpperCentralUtility ?? Number.NEGATIVE_INFINITY,
        branch.bound.upperCentralUtility,
      );
      return;
    }
    if (best) {
      const upperCentral = upperBoundToCanonicalMicroUnits(branch.bound.upperCentralUtility);
      minimumSurvivingUpperCentralUtility = Math.min(
        minimumSurvivingUpperCentralUtility ?? Number.POSITIVE_INFINITY,
        branch.bound.upperCentralUtility,
      );
      if (upperCentral === best.canonicalUtility.central) equalitySurvivors += 1;
    }
    if (branch.selected.length === 5) {
      exactCandidate(branch.selected);
      return;
    }
    const group = groups[branch.groupIndex];
    if (!group) throw new Error("Global-search traversal exhausted its talent groups");
    // Do not pre-compute every child bound just to sort the children. On the
    // full roster that turns one branch into dozens of expensive bound calls
    // before any child can be visited. Traversal order is an optimization only;
    // visiting children lazily preserves the exhaustive certificate while
    // allowing the incumbent to prune each child after its own bound is ready.
    for (const cardId of group.cardIds) {
      const rarity = mechanicsCardById.get(cardId)!.rarity;
      if (rarity === 5 && branch.fiveStars >= maxFiveStarMembers) continue;
      const child = makeBranch(
        branch.groupIndex + 1,
        [...branch.selected, cardId],
        branch.fiveStars + (rarity === 5 ? 1 : 0),
      );
      if (child) visit(child);
    }
    const skipped = makeBranch(branch.groupIndex + 1, branch.selected, branch.fiveStars);
    if (skipped) visit(skipped);
  };

  const root = makeBranch(0, fixedMemberCardIds, fixedFiveStars);
  if (!root) throw new Error("No legal five-Member completion exists");
  visit(root);
  if (!best) throw new Error("Global search did not exact-evaluate a finalist");
  const countsReconciled = exactLeafEvaluations + prunedTeamSets === legalTeamSets;
  if (!countsReconciled) {
    throw new Error("Global-search certificate counts did not reconcile");
  }

  const pairReconciliation = reconcileNativeGlobalLeaderPairCounts({
    legalTeamSets,
    exactLeafEvaluations,
    prunedTeamSets,
    leaderEquivalenceClasses: boundContext.leaderEquivalenceCounts.equivalenceClasses,
    eligibleLeaderOutfits: eligibleLeaderOutfitCardIds.length,
  });

  let completeCanonicalOutput: NativeGlobalCompleteCanonicalOutput | undefined;
  if (completeCanonicalOutputCandidates !== null) {
    if (completeCanonicalOutputCandidates.length !== pairReconciliation.leaderOutfitTeamPairs) {
      throw new Error(
        `Complete canonical reducer audit evaluated ${completeCanonicalOutputCandidates.length} Outfit/team pairs; expected ${pairReconciliation.leaderOutfitTeamPairs}`,
      );
    }
    const orderedCandidates = [...completeCanonicalOutputCandidates].sort(compareCandidates);
    const winner = orderedCandidates[0];
    if (!winner) throw new Error("Complete canonical reducer audit found no candidate");
    const winnerKey = canonicalCandidateKey({
      leaderCardId: winner.leaderOutfitCardId,
      memberCardIds: winner.memberCardIds,
    });
    const canonicalCandidate = (candidate: SearchCandidate): NativeGlobalCanonicalCandidate => ({
      leaderOutfitCardId: candidate.leaderOutfitCardId,
      memberCardIds: candidate.memberCardIds,
      canonicalUtility: candidate.canonicalUtility,
    });
    completeCanonicalOutput = {
      evaluatedLeaderOutfitTeamPairs: completeCanonicalOutputCandidates.length,
      winner: canonicalCandidate(winner),
      completeTieSet: orderedCandidates
        .filter((candidate) => canonicalUtilityTie(candidate.canonicalUtility, winner.canonicalUtility))
        .map((candidate) => canonicalCandidateKey({
          leaderCardId: candidate.leaderOutfitCardId,
          memberCardIds: candidate.memberCardIds,
        }))
        .sort(),
      runnerUp: (() => {
        const candidate = orderedCandidates.find((entry) =>
          canonicalCandidateKey({
            leaderCardId: entry.leaderOutfitCardId,
            memberCardIds: entry.memberCardIds,
          }) !== winnerKey,
        );
        return candidate ? canonicalCandidate(candidate) : null;
      })(),
    };
  }

  const completedBest = best as SearchCandidate;
  const publicBest: Candidate = {
    leaderOutfitCardId: completedBest.leaderOutfitCardId,
    memberCardIds: completedBest.memberCardIds,
    relativeUtility: completedBest.relativeUtility,
  };

  return {
    kind: "native-global-team-search",
    methodologyVersion: "yd-native-global-search-1.0.0",
    best: publicBest,
    certificate: {
      kind: "certified",
      optimalityClaim: "global-central-optimum-under-current-aggregate-model",
      legalTeamSets,
      exactLeafEvaluations,
      prunedTeamSets,
      countsReconciled,
      nodesVisited,
      nodesPruned,
      boundEvaluations,
      utilityEvaluations,
      intervalUtilityEvaluations,
      leaderTeamCandidates,
      exactLeaderTeamEvaluations,
      prunedLeaderTeamCandidates,
      maximumPrunedUpperCentralUtility,
      optimalityGap: 0,
      eligibleLeaderOutfits: boundContext.leaderEquivalenceCounts.eligibleLeaderOutfits,
      leaderEquivalenceClasses: boundContext.leaderEquivalenceCounts.equivalenceClasses,
      collapsedLeaderOutfits: boundContext.leaderEquivalenceCounts.collapsedLeaderOutfits,
      incumbentSource,
      incumbentSeedTeamSets,
      incumbentSeedLeaderTeamEvaluations,
      incumbentSearchUtilityEvaluations,
      ...pairReconciliation,
      proofCascade: {
        b0RootBounds: 1,
        b1FixedLeaderBounds: boundContext.leaderEquivalenceCounts.equivalenceClasses,
        b2PartialBounds: boundEvaluations,
        b3ExactLeafTeamSets: exactLeafEvaluations,
        strictPrunes: nodesPruned,
        equalitySurvivors,
        boundElapsedMilliseconds,
        minimumSurvivingUpperCentralUtility,
      },
    },
    ...(completeCanonicalOutput ? { completeCanonicalOutput } : {}),
  };
}
