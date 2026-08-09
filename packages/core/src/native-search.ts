import { mechanicsData, type CardMechanics } from "./mechanics";
import {
  assertBloomStage,
  resolveCardInvestmentState,
  type BloomStage,
} from "./formation-evaluator";
import {
  evaluateNativeRelativeUtility,
  type NativeUtilityInput,
  type NativeUtilityResult,
  type NeutralBoardAccountState,
  type UtilityInterval,
} from "./native-utility";
import { songContextData, type SongContext } from "./song-contexts";

export type NativeSearchInvestmentLayer =
  NativeUtilityInput["formation"]["members"][number]["investment"];

export type NativeSearchConstraints = Readonly<{
  anchorCardId?: string;
  /** Exact Member cards that every candidate must include. */
  anchorCardIds?: readonly string[];
  fixedLeaderOutfitCardId?: string;
  memberCardIds?: readonly string[];
  leaderOutfitCardIds?: readonly string[];
  memberRarities?: readonly (4 | 5)[];
  leaderRarities?: readonly (4 | 5)[];
  maxFiveStarMembers?: number;
}>;

export type NativeSearchStrategy =
  | Readonly<{
      mode: "exact";
      maxTeamSets?: number;
      auditedFinalists?: number;
      alternativesPerSlot?: number;
    }>
  | Readonly<{
      mode: "beam";
      beamWidth?: number;
      finalistTeamCount?: number;
      auditedFinalists?: number;
      alternativesPerSlot?: number;
    }>;

export type NativeSearchInput = Readonly<{
  chartKey: string;
  seed: number;
  investmentLayer: NativeSearchInvestmentLayer;
  /** Exact per-card ownership progression. Entries override investmentLayer for that Member card. */
  bloomStageByCardId?: Readonly<Record<string, BloomStage>>;
  accountState: NeutralBoardAccountState;
  constraints?: NativeSearchConstraints;
  strategy: NativeSearchStrategy;
}>;

/**
 * Lightweight bounded candidate generation for callers that compare teams in a
 * fixed canonical order. Unlike `searchNativeLegalTeams`, this boundary never
 * audits the 120 formation permutations or performs chart-local replacement
 * work. The caller remains responsible for final scoring and any local search.
 */
export type NativeCanonicalCandidateSearchInput = Readonly<
  Omit<NativeSearchInput, "strategy"> & {
    strategy: Readonly<{
      mode: "beam";
      beamWidth?: number;
      finalistTeamCount?: number;
      leadersPerTeam?: number;
    }>;
  }
>;

export type NativeCanonicalCandidateSearchResult = Readonly<{
  kind: "native-canonical-candidate-search";
  methodologyVersion: "yd-native-canonical-candidates-1.0.0";
  candidates: ReadonlyArray<{
    leaderOutfitCardId: string;
    memberCardIds: readonly [string, string, string, string, string];
    relativeUtility: UtilityInterval;
  }>;
  counts: Readonly<{
    eligibleMemberCards: number;
    eligibleLeaderOutfits: number;
    legalTeamSetsInScope: number;
    teamSetsConsidered: number;
    unsearchedTeamSets: number;
    leaderTeamEvaluations: number;
    utilityEvaluations: number;
  }>;
}>;

type SearchCard = Readonly<{
  cardId: string;
  talentId: string;
  rarity: 4 | 5;
  mechanics: CardMechanics;
  bloomStage: BloomStage | null;
  baseParameterProxy: number;
  individualSkillProxy: number;
  diversitySignature: string;
}>;

type TeamSet = Readonly<{
  memberCardIds: readonly [string, string, string, string, string];
  proxy: number;
}>;

type ScoredCandidate = Readonly<{
  leaderOutfitCardId: string;
  memberCardIds: readonly [string, string, string, string, string];
  utility: NativeUtilityResult;
}>;

export type NativeOrderAudit = Readonly<{
  leaderOutfitCardId: string;
  memberCardIds: readonly [string, string, string, string, string];
  status: "indeterminate-aggregate-context";
  evaluatedOrders: 120;
  distinctOrders: 120;
  recommendedOrder: null;
  canonicalOrder: readonly [string, string, string, string, string];
  modeledBestOrder: readonly [string, string, string, string, string];
  modeledBestRelativeUtility: UtilityInterval;
  centralRange: Readonly<{ minimum: number; mean: number; maximum: number }>;
  intervalEnvelope: UtilityInterval;
}>;

export type NativeSearchCertificate =
  | Readonly<{
      kind: "certified";
      optimalityClaim: "exhaustive-within-canonical-aggregate-order-scope";
      teamSetsInScope: number;
      teamSetsConsidered: number;
      unsearchedTeamSets: 0;
      formationOrder: Readonly<{
        selection: "best-modeled-order-among-audited-finalists";
        auditedLeaderTeamCandidates: number;
        totalLeaderTeamCandidates: number;
        unauditedLeaderTeamCandidates: number;
        globalBestOrderCertified: boolean;
      }>;
      localRefinement: NativeLocalRefinementCertificate;
      caveat: string;
    }>
  | Readonly<{
      kind: "heuristic-bounded";
      optimalityClaim: "not-certified";
      teamSetsInScope: number;
      teamSetsConsidered: number;
      unsearchedTeamSets: number;
      beamWidth: number;
      formationOrder: Readonly<{
        selection: "best-modeled-order-among-audited-finalists";
        auditedLeaderTeamCandidates: number;
        totalLeaderTeamCandidates: number;
        unauditedLeaderTeamCandidates: number;
        globalBestOrderCertified: false;
      }>;
      localRefinement: NativeLocalRefinementCertificate;
      caveat: string;
    }>;

export type NativeLocalRefinementCertificate = Readonly<{
  status: "fixed-point" | "cycle-guard" | "globally-certified";
  scope: "one-member-swap-or-leader-change";
  selection: "strict-central-coordinate-ascent";
  iterations: number;
  candidatesScreened: number;
  improvingCandidatesAudited: number;
  formationOrdersAudited: number;
  visitedFormations: number;
  globalOptimalityClaim: boolean;
}>;

export type NativeSearchTimingSummary = Readonly<{
  formationOrderStatus: "indeterminate-aggregate-context";
  active: ReadonlyArray<{
    cardId: string;
    activationProbabilityPermil: number;
    cooldownMilliseconds: number;
    durationMilliseconds: number;
    modeledActiveNoteCoverage: NativeUtilityResult["components"]["active"]["byMember"][number]["modeledActiveNoteCoverage"];
    modeledActiveNoteCoverageInterval: NativeUtilityResult["components"]["active"]["byMember"][number]["modeledActiveNoteCoverageInterval"];
  }>;
  special: ReadonlyArray<{
    slot: number;
    cardId: string;
    durationMilliseconds: number;
    modeledStartsAtMilliseconds: null;
    modeledEndsAtMilliseconds: null;
    modeledNoteCoverage: number;
    scoreSupportPermil: number;
    activationRateUpPermil: number;
    modeledActivationRateCoveragePermil: UtilityInterval;
  }>;
  specialActivationRate: NativeUtilityResult["components"]["special"]["activationRate"];
}>;

export type NativeSearchRecipientSummary = ReadonlyArray<{
  source: "leader" | "passive";
  sourceCardId: string;
  effectGroupId: string;
  effectKind: "performance-up" | "technique-up" | "sense-up" | "all-parameters-up";
  valuePermil: number;
  alternatives: ReadonlyArray<readonly string[]>;
}>;

export type NativeSearchReplacement = Readonly<{
  cardId: string;
  talentId: string;
  rarity: 4 | 5;
  bloomStage: BloomStage | null;
  relativeUtility: UtilityInterval;
  intervalLoss: UtilityInterval;
}>;

export type NativeSearchResult = Readonly<{
  kind: "native-legal-team-search";
  methodologyVersion: "yd-native-search-1.0.0";
  status: "provisional";
  context: NativeUtilityResult["context"];
  certificate: NativeSearchCertificate;
  constraints: Readonly<{
    anchorCardId: string | null;
    anchorCardIds: readonly string[];
    fixedLeaderOutfitCardId: string | null;
    memberCardIds: readonly string[];
    leaderOutfitCardIds: readonly string[];
    memberRarities: readonly (4 | 5)[];
    leaderRarities: readonly (4 | 5)[];
    maxFiveStarMembers: number;
    investmentLayer: NativeSearchInvestmentLayer;
    bloomStageByCardId: Readonly<Record<string, BloomStage>>;
  }>;
  counts: Readonly<{
    eligibleMemberCards: number;
    eligibleLeaderOutfits: number;
    legalTeamSetsInScope: number;
    finalistTeamSets: number;
    leaderTeamEvaluations: number;
    auditedFinalists: number;
    formationOrdersAudited: number;
    localRefinementIterations: number;
    localCandidatesScreened: number;
    localImprovingCandidatesAudited: number;
    localFormationOrdersAudited: number;
    replacementEvaluations: number;
    utilityEvaluations: number;
  }>;
  leaderCoverageByFinalistTeam: ReadonlyArray<{
    memberCardIds: readonly [string, string, string, string, string];
    evaluatedLeaderOutfitCardIds: readonly string[];
  }>;
  best: Readonly<{
    leaderOutfitCardId: string;
    members: ReadonlyArray<{
      slot: number;
      cardId: string;
      talentId: string;
      rarity: 4 | 5;
      investment: NativeSearchInvestmentLayer;
      bloomStage: BloomStage | null;
    }>;
    relativeUtility: UtilityInterval;
    recipients: NativeSearchRecipientSummary;
    timing: NativeSearchTimingSummary;
    orderAudit: NativeOrderAudit;
  }>;
  auditedFinalists: readonly NativeOrderAudit[];
  replacementsBySlot: ReadonlyArray<{
    slot: number;
    replacedCardId: string;
    anchored: boolean;
    comparisonOrder: "same-slot-aggregate-model";
    alternatives: readonly NativeSearchReplacement[];
  }>;
}>;

const allCards: readonly SearchCard[] = [...mechanicsData.cards]
  .map((mechanics) => ({
    cardId: mechanics.cardId,
    talentId: mechanics.talentId,
    rarity: mechanics.rarity,
    mechanics,
    bloomStage: null,
    baseParameterProxy: 0,
    individualSkillProxy: 0,
    diversitySignature: "uncompiled",
  }))
  .sort((left, right) => left.cardId.localeCompare(right.cardId));

const cardById = new Map(allCards.map((card) => [card.cardId, card]));

const DEFAULT_MAX_EXACT_TEAM_SETS = 5_000;
const DEFAULT_BEAM_WIDTH = 128;
const DEFAULT_FINALIST_TEAM_COUNT = 8;
const DEFAULT_AUDITED_FINALISTS = 3;
const DEFAULT_ALTERNATIVES_PER_SLOT = 3;
const LOCAL_IMPROVEMENT_EPSILON = 0.000_001;

function emptyLocalRefinementCertificate(): NativeLocalRefinementCertificate {
  return {
    status: "fixed-point",
    scope: "one-member-swap-or-leader-change",
    selection: "strict-central-coordinate-ascent",
    iterations: 0,
    candidatesScreened: 0,
    improvingCandidatesAudited: 0,
    formationOrdersAudited: 0,
    visitedFormations: 0,
    globalOptimalityClaim: false,
  };
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function uniqueSorted<T extends string | number>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) =>
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right)),
  );
}

function assertNoEditorialBoundary(value: unknown, path = "input"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoEditorialBoundary(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (/appmedia|editorial|tier(?:label)?|ranking(?:label)?/i.test(key)) {
      throw new Error(`Editorial inputs are forbidden in native search: ${path}.${key}`);
    }
    assertNoEditorialBoundary(nested, `${path}.${key}`);
  }
}

function selectedInvestmentState(
  card: SearchCard,
  layer: NativeSearchInvestmentLayer,
): CardMechanics["progression"]["oneCopy"] {
  return resolveCardInvestmentState(card.mechanics, layer, card.bloomStage ?? undefined);
}

function baseParameterProxy(card: SearchCard, layer: NativeSearchInvestmentLayer): number {
  const state = selectedInvestmentState(card, layer);
  const curve = card.mechanics.progression.levelCurve.find((row) => row.level === state.level);
  if (!curve) throw new Error(`${card.cardId} has no level ${state.level} progression row`);
  const multiplierPermil = 1_000 + state.allParameterPermilUp;
  return (["performance", "technique", "sense"] as const).reduce(
    (total, parameter) =>
      total +
      Math.ceil(
        (curve.parameterBaseValue *
          card.mechanics.parameterDistributionPermil[parameter] *
          multiplierPermil) /
          1_000_000,
      ),
    0,
  );
}

function selectedSkill(
  card: SearchCard,
  layer: NativeSearchInvestmentLayer,
  kind: "active" | "passive" | "special",
): CardMechanics["skills"][typeof kind][number] {
  const state = selectedInvestmentState(card, layer);
  const selectedLevel =
    kind === "active"
      ? state.activeSkillLevel
      : kind === "passive"
        ? state.passiveSkillLevel
        : state.specialSkillLevel;
  const skill = card.mechanics.skills[kind].find((candidate) => candidate.level === selectedLevel);
  if (!skill) {
    throw new Error(`${card.cardId} has no ${kind} skill level ${selectedLevel}`);
  }
  return skill;
}

function maximumEffectValue(
  skill: CardMechanics["skills"]["active"][number],
  kinds: ReadonlySet<string>,
): number {
  return Math.max(
    0,
    ...skill.applications.map((application) =>
      application.effect && kinds.has(application.effect.kind) ? application.effect.value ?? 0 : 0,
    ),
  );
}

function cardDiversitySignature(card: SearchCard, layer: NativeSearchInvestmentLayer): string {
  const distribution = card.mechanics.parameterDistributionPermil;
  const focus = (["performance", "technique", "sense"] as Array<
    "performance" | "technique" | "sense"
  >)
    .sort((left, right) => distribution[right] - distribution[left] || left.localeCompare(right))[0]!;
  const passive = selectedSkill(card, layer, "passive");
  const targetKinds = uniqueSorted(
    passive.applications.map((application) => {
      const target = application.target;
      if (!target) return "none";
      return `${target.kind}:${target.attribute ?? target.characterGroupingId ?? "all"}`;
    }),
  );
  const triggerKinds = uniqueSorted(
    passive.applications.map((application) => application.trigger?.kind ?? "none"),
  );
  const active = selectedSkill(card, layer, "active");
  const cooldownBucket = Math.round((active.cooldownMilliseconds ?? 0) / 5_000);
  return `${focus[0]}|${targetKinds.join(",")}|${triggerKinds.join(",")}|c${cooldownBucket}`;
}

function individualSkillProxy(
  card: SearchCard,
  layer: NativeSearchInvestmentLayer,
  song: SongContext,
): number {
  const base = baseParameterProxy(card, layer);
  const active = selectedSkill(card, layer, "active");
  const activeUpPermil = maximumEffectValue(active, new Set(["score-up"]));
  const activeSupportPermil = maximumEffectValue(active, new Set(["score-support"]));
  const probability = (active.activationProbabilityPermil ?? 0) / 1_000;
  const uptime = Math.min(
    1,
    (active.durationMilliseconds ?? 0) / Math.max(1, active.cooldownMilliseconds ?? 1),
  );
  const activeDelta =
    base *
    (activeUpPermil / 1_000) *
    (1 + activeSupportPermil / 1_000) *
    probability *
    uptime;

  const special = selectedSkill(card, layer, "special");
  const specialSupportPermil = maximumEffectValue(
    special as CardMechanics["skills"]["active"][number],
    new Set(["score-support", "score-up"]),
  );
  const activationRatePermil = maximumEffectValue(
    special as CardMechanics["skills"]["active"][number],
    new Set(["activation-rate-up"]),
  );
  const specialCoverage = Math.min(
    1,
    (special.durationMilliseconds ?? 0) / Math.max(1, song.playingMilliseconds),
  );
  const specialDelta =
    base * specialCoverage * (specialSupportPermil / 1_000 + activationRatePermil / 2_000);
  return base + activeDelta + specialDelta;
}

function triggerConfidence(
  trigger: CardMechanics["skills"]["passive"][number]["applications"][number]["trigger"],
  song: SongContext,
): number {
  if (!trigger) return 1;
  if (["combo-at-least", "judgement-at-least", "life-at-least"].includes(trigger.kind)) return 1;
  if (trigger.kind === "life-at-most") return trigger.threshold === null || trigger.threshold >= 1_000 ? 1 : 0;
  if (trigger.kind === "music-character") {
    return trigger.characterIds.some((talentId) => song.singerTalentIds.includes(talentId)) ? 1 : 0;
  }
  if (trigger.kind === "deck-attribute-count" || trigger.kind === "deck-character-group-count") {
    return (trigger.threshold ?? 6) <= 5 ? 0.7 : 0;
  }
  return 0.5;
}

function teamMechanicsProxy(cards: readonly SearchCard[], layer: NativeSearchInvestmentLayer, song: SongContext): number {
  const baseTotal = cards.reduce((total, card) => total + card.baseParameterProxy, 0);
  let proxy = cards.reduce((total, card) => total + card.individualSkillProxy, 0);
  const averageParameter = baseTotal / Math.max(1, cards.length * 3);
  const interactionSignatureCounts = new Map<string, number>();
  for (const card of cards) {
    const passive = selectedSkill(card, layer, "passive");
    for (const application of passive.applications) {
      const effect = application.effect;
      if (!effect) continue;
      const confidence = triggerConfidence(application.trigger, song);
      const target = application.target;
      const recipientCount =
        target?.kind === "all"
          ? cards.length
          : target?.kind === "self"
            ? 1
            : Math.min(cards.length, target?.count ?? 2);
      const targetConfidence = target?.kind === "all" || target?.kind === "self" ? 1 : 0.6;
      if (
        ["performance-up", "technique-up", "sense-up", "all-parameters-up"].includes(effect.kind)
      ) {
        const parameterCount = effect.kind === "all-parameters-up" ? 3 : 1;
        proxy +=
          averageParameter *
          parameterCount *
          recipientCount *
          ((effect.value ?? 0) / 1_000) *
          confidence *
          targetConfidence;
      } else if (effect.kind === "active-skill-effect-up") {
        proxy +=
          (baseTotal / Math.max(1, cards.length)) *
          recipientCount *
          ((effect.value ?? 0) / 1_000) *
          confidence *
          targetConfidence *
          0.35;
      }
      if (target && target.kind !== "self" && target.kind !== "all") {
        const signature = `${target.kind}:${target.attribute ?? target.characterGroupingId ?? "unknown"}`;
        interactionSignatureCounts.set(signature, (interactionSignatureCounts.get(signature) ?? 0) + 1);
      }
    }
  }
  const repeatedArchetypeSignals = [...interactionSignatureCounts.values()].reduce(
    (total, count) => total + Math.max(0, count - 1),
    0,
  );
  return proxy + baseTotal * repeatedArchetypeSignals * 0.01;
}

function beamDiversityBucket(state: BeamState): string {
  const focusCounts = { p: 0, t: 0, s: 0 };
  const targetFamilies = new Set<string>();
  const cooldownBuckets: string[] = [];
  for (const card of state.cards) {
    const [focus, targets, , cooldown] = card.diversitySignature.split("|");
    if (focus === "p" || focus === "t" || focus === "s") focusCounts[focus] += 1;
    for (const target of targets?.split(",") ?? []) targetFamilies.add(target.split(":")[0]!);
    if (cooldown) cooldownBuckets.push(cooldown);
  }
  return `${state.cards.length}|${state.fiveStars}|${focusCounts.p}${focusCounts.t}${focusCounts.s}|${[
    ...targetFamilies,
  ].sort().join(",")}|${cooldownBuckets.sort().join(",")}`;
}

function selectDiverseBeam(states: readonly BeamState[], beamWidth: number): BeamState[] {
  const ordered = [...states].sort(compareBeamState);
  const bucketWinners = new Map<string, BeamState>();
  for (const state of ordered) {
    const bucket = beamDiversityBucket(state);
    if (!bucketWinners.has(bucket)) bucketWinners.set(bucket, state);
  }
  const diverseBudget = Math.min(beamWidth, Math.max(1, Math.ceil(beamWidth * 0.6)));
  const selected = [...bucketWinners.values()].sort(compareBeamState).slice(0, diverseBudget);
  const selectedKeys = new Set(
    selected.map((state) => `${state.nextIndex}|${state.cards.map((card) => card.cardId).join("|")}`),
  );
  for (const state of ordered) {
    if (selected.length >= beamWidth) break;
    const key = `${state.nextIndex}|${state.cards.map((card) => card.cardId).join("|")}`;
    if (selectedKeys.has(key)) continue;
    selected.push(state);
    selectedKeys.add(key);
  }
  return selected.sort(compareBeamState);
}

function normalizeInput(input: NativeSearchInput): {
  memberCards: SearchCard[];
  leaderCards: SearchCard[];
  anchors: SearchCard[];
  anchor: SearchCard | null;
  fixedLeader: SearchCard | null;
  memberRarities: (4 | 5)[];
  leaderRarities: (4 | 5)[];
  maxFiveStarMembers: number;
  bloomStageByCardId: Readonly<Record<string, BloomStage>>;
  song: SongContext;
} {
  assertNoEditorialBoundary(input);
  if (!Number.isSafeInteger(input.seed)) throw new Error("Native search seed must be a safe integer");
  if (
    !["low-investment", "one-copy-maximum", "duplicate-enabled-ceiling"].includes(
      input.investmentLayer,
    )
  ) {
    throw new Error(`Unknown investment layer: ${String(input.investmentLayer)}`);
  }
  const chart = songContextData.charts.find((candidate) => candidate.key === input.chartKey);
  if (!chart || chart.fidelity !== "aggregate") {
    throw new Error(`Native search requires an exact aggregate chart context: ${input.chartKey}`);
  }
  const song = songContextData.songs.find((candidate) => candidate.id === chart.songId);
  if (!song) throw new Error(`Chart ${input.chartKey} has no pinned song context`);
  const constraints = input.constraints ?? {};
  if (constraints.anchorCardId !== undefined && constraints.anchorCardIds !== undefined) {
    throw new Error("anchorCardId and anchorCardIds cannot be used together");
  }
  if (constraints.anchorCardIds !== undefined && !Array.isArray(constraints.anchorCardIds)) {
    throw new Error("anchorCardIds must be an array of Member card IDs");
  }
  const rawAnchorIds = constraints.anchorCardIds !== undefined
    ? [...constraints.anchorCardIds]
    : constraints.anchorCardId !== undefined
      ? [constraints.anchorCardId]
      : [];
  if (rawAnchorIds.length > 5) {
    throw new Error("anchorCardIds cannot contain more than five Member cards");
  }
  if (rawAnchorIds.some((cardId) => typeof cardId !== "string" || cardId.length === 0)) {
    throw new Error("anchorCardIds must contain non-empty card IDs");
  }
  const normalizedAnchorIds = uniqueSorted(rawAnchorIds);
  if (normalizedAnchorIds.length !== rawAnchorIds.length) {
    throw new Error("anchorCardIds cannot contain duplicate cards");
  }
  const memberRarities = uniqueSorted(constraints.memberRarities ?? [4, 5]);
  const leaderRarities = uniqueSorted(constraints.leaderRarities ?? [4, 5]);
  if (memberRarities.length === 0 || leaderRarities.length === 0) {
    throw new Error("Member and Leader/Outfit rarity filters cannot be empty");
  }
  const maxFiveStarMembers = constraints.maxFiveStarMembers ?? 5;
  if (!Number.isInteger(maxFiveStarMembers) || maxFiveStarMembers < 0 || maxFiveStarMembers > 5) {
    throw new Error("maxFiveStarMembers must be an integer from 0 through 5");
  }

  const rawBloomStages = input.bloomStageByCardId;
  if (
    rawBloomStages !== undefined &&
    (rawBloomStages === null || typeof rawBloomStages !== "object" || Array.isArray(rawBloomStages))
  ) {
    throw new Error("bloomStageByCardId must be a card-ID keyed object");
  }
  const bloomStageEntries = Object.entries(rawBloomStages ?? {}).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  for (const [cardId, bloomStage] of bloomStageEntries) {
    if (!cardById.has(cardId)) throw new Error(`Unknown Bloom-stage card: ${cardId}`);
    if (typeof bloomStage !== "number") {
      throw new Error(`Bloom stage for ${cardId} must be an integer from 0 through 5`);
    }
    assertBloomStage(bloomStage);
  }
  const bloomStageByCardId = Object.fromEntries(bloomStageEntries) as Readonly<
    Record<string, BloomStage>
  >;

  const resolveAllowlist = (ids: readonly string[] | undefined, label: string): SearchCard[] => {
    if (!ids) return [...allCards];
    const normalized = uniqueSorted(ids);
    for (const cardId of normalized) {
      if (!cardById.has(cardId)) throw new Error(`Unknown ${label} card: ${cardId}`);
    }
    return normalized.map((cardId) => cardById.get(cardId)!);
  };

  const memberCards = resolveAllowlist(constraints.memberCardIds, "Member")
    .filter((card) => memberRarities.includes(card.rarity))
    .map((card) => {
      const withBloom = {
        ...card,
        bloomStage: bloomStageByCardId[card.cardId] ?? null,
      };
      return {
        ...withBloom,
        baseParameterProxy: baseParameterProxy(withBloom, input.investmentLayer),
        individualSkillProxy: individualSkillProxy(withBloom, input.investmentLayer, song),
        diversitySignature: cardDiversitySignature(withBloom, input.investmentLayer),
      };
    });
  const leaderCards = resolveAllowlist(constraints.leaderOutfitCardIds, "Leader/Outfit").filter(
    (card) => leaderRarities.includes(card.rarity),
  );
  const rawAnchors = normalizedAnchorIds.map((cardId) => cardById.get(cardId) ?? null);
  const fixedLeader = constraints.fixedLeaderOutfitCardId
    ? cardById.get(constraints.fixedLeaderOutfitCardId) ?? null
    : null;
  const unknownAnchor = normalizedAnchorIds.find((cardId, index) => !rawAnchors[index]);
  if (unknownAnchor) {
    throw new Error(`Unknown anchor Member card: ${unknownAnchor}`);
  }
  if (constraints.fixedLeaderOutfitCardId && !fixedLeader) {
    throw new Error(`Unknown fixed Leader/Outfit: ${constraints.fixedLeaderOutfitCardId}`);
  }
  const anchors = rawAnchors.map((rawAnchor) => {
    const anchor = memberCards.find((card) => card.cardId === rawAnchor!.cardId) ?? null;
    if (!anchor) {
      throw new Error("An anchor Member is excluded by the Member allowlist or rarity filter");
    }
    return anchor;
  });
  if (new Set(anchors.map((card) => card.talentId)).size !== anchors.length) {
    throw new Error("anchorCardIds cannot contain duplicate Member talents");
  }
  if (anchors.filter((card) => card.rarity === 5).length > maxFiveStarMembers) {
    throw new Error("The anchor Members violate maxFiveStarMembers");
  }
  const anchor = anchors[0] ?? null;
  if (fixedLeader && !leaderCards.some((card) => card.cardId === fixedLeader.cardId)) {
    throw new Error("The fixed Leader/Outfit is excluded by the Leader allowlist or rarity filter");
  }
  const eligibleLeaders = fixedLeader ? [leaderCards.find((card) => card.cardId === fixedLeader.cardId)!] : leaderCards;
  if (eligibleLeaders.length === 0) throw new Error("No eligible Leader/Outfit remains");
  if (new Set(memberCards.map((card) => card.talentId)).size < 5) {
    throw new Error("At least five eligible Member talents are required");
  }
  return {
    memberCards,
    leaderCards: eligibleLeaders,
    anchors,
    anchor,
    fixedLeader,
    memberRarities,
    leaderRarities,
    maxFiveStarMembers,
    bloomStageByCardId,
    song,
  };
}

function checkedCount(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} exceeds Number.MAX_SAFE_INTEGER`);
  }
  return Number(value);
}

function countLegalTeamSets(
  cards: readonly SearchCard[],
  anchors: readonly SearchCard[],
  maxFiveStarMembers: number,
): number {
  const anchorTalents = new Set(anchors.map((card) => card.talentId));
  const remaining = anchors.length > 0
    ? cards.filter((card) => !anchorTalents.has(card.talentId))
    : cards;
  const variantsByTalent = new Map<string, SearchCard[]>();
  for (const card of remaining) {
    const variants = variantsByTalent.get(card.talentId) ?? [];
    variants.push(card);
    variantsByTalent.set(card.talentId, variants);
  }
  const groups = [...variantsByTalent.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const initialSelected = anchors.length;
  const initialFive = anchors.filter((card) => card.rarity === 5).length;
  let states = new Map<string, bigint>([[`${initialSelected}:${initialFive}`, 1n]]);
  for (const [, variants] of groups) {
    const next = new Map(states);
    for (const [key, ways] of states) {
      const [selectedText, fiveText] = key.split(":");
      const selected = Number(selectedText);
      const five = Number(fiveText);
      if (selected >= 5) continue;
      for (const card of variants) {
        const nextFive = five + (card.rarity === 5 ? 1 : 0);
        if (nextFive > maxFiveStarMembers) continue;
        const nextKey = `${selected + 1}:${nextFive}`;
        next.set(nextKey, (next.get(nextKey) ?? 0n) + ways);
      }
    }
    states = next;
  }
  let total = 0n;
  for (const [key, ways] of states) {
    if (Number(key.split(":")[0]) === 5) total += ways;
  }
  return checkedCount(total, "Legal team-set search space");
}

function asTeamTuple(ids: readonly string[]): readonly [string, string, string, string, string] {
  if (ids.length !== 5) throw new Error(`Expected five Member card IDs; received ${ids.length}`);
  return ids as unknown as readonly [string, string, string, string, string];
}

function teamSet(
  cards: readonly SearchCard[],
  layer: NativeSearchInvestmentLayer,
  song: SongContext,
): TeamSet {
  const ordered = [...cards].sort((left, right) => left.cardId.localeCompare(right.cardId));
  return {
    memberCardIds: asTeamTuple(ordered.map((card) => card.cardId)),
    proxy: teamMechanicsProxy(ordered, layer, song),
  };
}

function enumerateExactTeams(
  cards: readonly SearchCard[],
  anchors: readonly SearchCard[],
  maxFiveStarMembers: number,
  layer: NativeSearchInvestmentLayer,
  song: SongContext,
): TeamSet[] {
  const selected = [...anchors];
  const anchorTalents = new Set(anchors.map((card) => card.talentId));
  const remaining = anchors.length > 0
    ? cards.filter((card) => !anchorTalents.has(card.talentId))
    : [...cards];
  const result: TeamSet[] = [];
  const visit = (startIndex: number, members: SearchCard[], talents: Set<string>, fiveStars: number): void => {
    if (members.length === 5) {
      result.push(teamSet(members, layer, song));
      return;
    }
    const needed = 5 - members.length;
    for (let index = startIndex; index <= remaining.length - needed; index += 1) {
      const card = remaining[index]!;
      if (talents.has(card.talentId)) continue;
      const nextFive = fiveStars + (card.rarity === 5 ? 1 : 0);
      if (nextFive > maxFiveStarMembers) continue;
      talents.add(card.talentId);
      members.push(card);
      visit(index + 1, members, talents, nextFive);
      members.pop();
      talents.delete(card.talentId);
    }
  };
  visit(
    0,
    [...selected],
    new Set(selected.map((card) => card.talentId)),
    selected.filter((card) => card.rarity === 5).length,
  );
  return result.sort((left, right) =>
    left.memberCardIds.join("|").localeCompare(right.memberCardIds.join("|")),
  );
}

type BeamState = Readonly<{
  cards: readonly SearchCard[];
  talents: ReadonlySet<string>;
  fiveStars: number;
  nextIndex: number;
  proxy: number;
}>;

function compareBeamState(left: BeamState, right: BeamState): number {
  if (left.proxy !== right.proxy) return right.proxy - left.proxy;
  const leftKey = left.cards.map((card) => card.cardId).sort().join("|");
  const rightKey = right.cards.map((card) => card.cardId).sort().join("|");
  if (leftKey !== rightKey) return leftKey.localeCompare(rightKey);
  return left.nextIndex - right.nextIndex;
}

function enumerateBeamTeams(
  cards: readonly SearchCard[],
  anchors: readonly SearchCard[],
  maxFiveStarMembers: number,
  beamWidth: number,
  finalistCount: number,
  layer: NativeSearchInvestmentLayer,
  song: SongContext,
): TeamSet[] {
  const anchorTalents = new Set(anchors.map((card) => card.talentId));
  const remaining = anchors.length > 0
    ? cards.filter((card) => !anchorTalents.has(card.talentId))
    : [...cards];
  const initialCards = [...anchors];
  let states: BeamState[] = [
    {
      cards: initialCards,
      talents: new Set(initialCards.map((card) => card.talentId)),
      fiveStars: initialCards.filter((card) => card.rarity === 5).length,
      nextIndex: 0,
      proxy: teamMechanicsProxy(initialCards, layer, song),
    },
  ];
  const targetAdds = 5 - initialCards.length;
  for (let depth = 0; depth < targetAdds; depth += 1) {
    const expanded: BeamState[] = [];
    for (const state of states) {
      for (let index = state.nextIndex; index < remaining.length; index += 1) {
        const card = remaining[index]!;
        if (state.talents.has(card.talentId)) continue;
        const nextFive = state.fiveStars + (card.rarity === 5 ? 1 : 0);
        if (nextFive > maxFiveStarMembers) continue;
        const nextTalents = new Set(state.talents);
        nextTalents.add(card.talentId);
        const nextCards = [...state.cards, card];
        const remainingTalentCount = new Set(
          remaining.slice(index + 1).map((candidate) => candidate.talentId),
        ).size;
        if (remainingTalentCount < 5 - nextCards.length) continue;
        expanded.push({
          cards: nextCards,
          talents: nextTalents,
          fiveStars: nextFive,
          nextIndex: index + 1,
          proxy: teamMechanicsProxy(nextCards, layer, song),
        });
      }
    }
    states = selectDiverseBeam(expanded, beamWidth);
    if (states.length === 0) break;
  }
  const unique = new Map<string, TeamSet>();
  for (const state of states) {
    if (state.cards.length !== 5) continue;
    const team = teamSet(state.cards, layer, song);
    unique.set(team.memberCardIds.join("|"), team);
  }
  return [...unique.values()]
    .sort((left, right) => {
      if (left.proxy !== right.proxy) return right.proxy - left.proxy;
      return left.memberCardIds.join("|").localeCompare(right.memberCardIds.join("|"));
    })
    .slice(0, finalistCount);
}

function compareScoredCandidates(left: ScoredCandidate, right: ScoredCandidate): number {
  const leftInterval = left.utility.relativeUtility;
  const rightInterval = right.utility.relativeUtility;
  if (leftInterval.central !== rightInterval.central) return rightInterval.central - leftInterval.central;
  if (leftInterval.lower !== rightInterval.lower) return rightInterval.lower - leftInterval.lower;
  if (leftInterval.upper !== rightInterval.upper) return rightInterval.upper - leftInterval.upper;
  const leftKey = `${left.leaderOutfitCardId}|${left.memberCardIds.join("|")}`;
  const rightKey = `${right.leaderOutfitCardId}|${right.memberCardIds.join("|")}`;
  return leftKey.localeCompare(rightKey);
}

function permutations(values: readonly string[]): string[][] {
  if (values.length <= 1) return [[...values]];
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((tail) => [value, ...tail]),
  );
}

function subtractIntervals(selected: UtilityInterval, alternative: UtilityInterval): UtilityInterval {
  return {
    lower: round(selected.lower - alternative.upper),
    central: round(selected.central - alternative.central),
    upper: round(selected.upper - alternative.lower),
  };
}

function summarizeRecipients(candidate: ScoredCandidate): NativeSearchRecipientSummary {
  return candidate.utility.components.parameterEffects.contributions.map((contribution) => ({
    source: contribution.source,
    sourceCardId: contribution.sourceCardId,
    effectGroupId: contribution.effectGroupId,
    effectKind: contribution.effectKind,
    valuePermil: contribution.valuePermil,
    alternatives: contribution.recipientAlternatives.map((indexes) =>
      indexes.map((index) => candidate.memberCardIds[index]!).filter(Boolean),
    ),
  }));
}

function summarizeTiming(candidate: ScoredCandidate): NativeSearchTimingSummary {
  return {
    formationOrderStatus: "indeterminate-aggregate-context",
    active: candidate.utility.components.active.byMember.map((member) => ({
      cardId: member.cardId,
      activationProbabilityPermil: member.activationProbabilityPermil,
      cooldownMilliseconds: member.cooldownMilliseconds,
      durationMilliseconds: member.durationMilliseconds,
      modeledActiveNoteCoverage: member.modeledActiveNoteCoverage,
      modeledActiveNoteCoverageInterval: member.modeledActiveNoteCoverageInterval,
    })),
    special: candidate.utility.components.special.byFormationOrder.map((member) => ({
      slot: member.slot,
      cardId: member.cardId,
      durationMilliseconds: member.durationMilliseconds,
      modeledStartsAtMilliseconds: member.modeledStartsAtMilliseconds,
      modeledEndsAtMilliseconds: member.modeledEndsAtMilliseconds,
      modeledNoteCoverage: member.modeledNoteCoverage,
      scoreSupportPermil: member.scoreSupportPermil,
      activationRateUpPermil: member.activationRateUpPermil,
      modeledActivationRateCoveragePermil: member.modeledActivationRateCoveragePermil,
    })),
    specialActivationRate: candidate.utility.components.special.activationRate,
  };
}

export function searchNativeCanonicalCandidates(
  input: NativeCanonicalCandidateSearchInput,
): NativeCanonicalCandidateSearchResult {
  const beamWidth = requirePositiveInteger(
    input.strategy.beamWidth ?? DEFAULT_BEAM_WIDTH,
    "beamWidth",
  );
  const finalistTeamCount = requirePositiveInteger(
    input.strategy.finalistTeamCount ?? DEFAULT_FINALIST_TEAM_COUNT,
    "finalistTeamCount",
  );
  const leadersPerTeam = requirePositiveInteger(
    input.strategy.leadersPerTeam ?? 1,
    "leadersPerTeam",
  );
  const normalized = normalizeInput({
    ...input,
    strategy: {
      mode: "beam",
      beamWidth,
      finalistTeamCount,
    },
  });
  const legalTeamSetsInScope = countLegalTeamSets(
    normalized.memberCards,
    normalized.anchors,
    normalized.maxFiveStarMembers,
  );
  if (legalTeamSetsInScope === 0) {
    throw new Error("No legal five-Member team satisfies the constraints");
  }
  const teamSets = enumerateBeamTeams(
    normalized.memberCards,
    normalized.anchors,
    normalized.maxFiveStarMembers,
    beamWidth,
    finalistTeamCount,
    input.investmentLayer,
    normalized.song,
  );
  if (teamSets.length === 0) throw new Error("Search produced no legal finalist team sets");

  let utilityEvaluations = 0;
  const scoredByTeam = teamSets.map((team) => {
    const scored = normalized.leaderCards.map((leader): ScoredCandidate => {
      const utility = evaluateNativeRelativeUtility({
        formation: {
          leaderOutfitCardId: leader.cardId,
          members: team.memberCardIds.map((cardId) => {
            const bloomStage = normalized.bloomStageByCardId[cardId];
            return bloomStage === undefined
              ? { cardId, investment: input.investmentLayer }
              : { cardId, investment: input.investmentLayer, bloomStage };
          }),
        },
        chartKey: input.chartKey,
        seed: input.seed,
        accountState: input.accountState,
      });
      utilityEvaluations += 1;
      return {
        leaderOutfitCardId: leader.cardId,
        memberCardIds: team.memberCardIds,
        utility,
      };
    });
    return scored.sort(compareScoredCandidates).slice(0, leadersPerTeam);
  });
  const candidates = scoredByTeam
    .flat()
    .sort(compareScoredCandidates)
    .map((candidate) => ({
      leaderOutfitCardId: candidate.leaderOutfitCardId,
      memberCardIds: candidate.memberCardIds,
      relativeUtility: candidate.utility.relativeUtility,
    }));

  return {
    kind: "native-canonical-candidate-search",
    methodologyVersion: "yd-native-canonical-candidates-1.0.0",
    candidates,
    counts: {
      eligibleMemberCards: normalized.memberCards.length,
      eligibleLeaderOutfits: normalized.leaderCards.length,
      legalTeamSetsInScope,
      teamSetsConsidered: teamSets.length,
      unsearchedTeamSets: Math.max(0, legalTeamSetsInScope - teamSets.length),
      leaderTeamEvaluations: utilityEvaluations,
      utilityEvaluations,
    },
  };
}

export function searchNativeLegalTeams(input: NativeSearchInput): NativeSearchResult {
  const normalized = normalizeInput(input);
  const legalTeamSetsInScope = countLegalTeamSets(
    normalized.memberCards,
    normalized.anchors,
    normalized.maxFiveStarMembers,
  );
  if (legalTeamSetsInScope === 0) throw new Error("No legal five-Member team satisfies the constraints");

  const auditedFinalistCount = requirePositiveInteger(
    input.strategy.auditedFinalists ?? DEFAULT_AUDITED_FINALISTS,
    "auditedFinalists",
  );
  const alternativesPerSlot = requirePositiveInteger(
    input.strategy.alternativesPerSlot ?? DEFAULT_ALTERNATIVES_PER_SLOT,
    "alternativesPerSlot",
  );
  let teamSets: TeamSet[];
  let certificate: NativeSearchCertificate;
  if (input.strategy.mode === "exact") {
    const maxTeamSets = requirePositiveInteger(
      input.strategy.maxTeamSets ?? DEFAULT_MAX_EXACT_TEAM_SETS,
      "maxTeamSets",
    );
    if (legalTeamSetsInScope > maxTeamSets) {
      throw new Error(
        `Exact native search is limited to ${maxTeamSets} legal team sets; narrow the allowlist or use beam mode for ${legalTeamSetsInScope}`,
      );
    }
    teamSets = enumerateExactTeams(
      normalized.memberCards,
      normalized.anchors,
      normalized.maxFiveStarMembers,
      input.investmentLayer,
      normalized.song,
    );
    certificate = {
      kind: "certified",
      optimalityClaim: "exhaustive-within-canonical-aggregate-order-scope",
      teamSetsInScope: legalTeamSetsInScope,
      teamSetsConsidered: teamSets.length,
      unsearchedTeamSets: 0,
      formationOrder: {
        selection: "best-modeled-order-among-audited-finalists",
        auditedLeaderTeamCandidates: 0,
        totalLeaderTeamCandidates: 0,
        unauditedLeaderTeamCandidates: 0,
        globalBestOrderCertified: false,
      },
      localRefinement: emptyLocalRefinementCertificate(),
      caveat:
        "Certification covers every legal unordered Member set and eligible Leader/Outfit under the deterministic canonical aggregate screen. Formation-order optimality is global only when every screened candidate is audited; otherwise the selected result is refined only to a strict one-member-swap-or-Leader-change fixed point.",
    };
  } else {
    const beamWidth = requirePositiveInteger(input.strategy.beamWidth ?? DEFAULT_BEAM_WIDTH, "beamWidth");
    const finalistTeamCount = requirePositiveInteger(
      input.strategy.finalistTeamCount ?? DEFAULT_FINALIST_TEAM_COUNT,
      "finalistTeamCount",
    );
    teamSets = enumerateBeamTeams(
      normalized.memberCards,
      normalized.anchors,
      normalized.maxFiveStarMembers,
      beamWidth,
      finalistTeamCount,
      input.investmentLayer,
      normalized.song,
    );
    certificate = {
      kind: "heuristic-bounded",
      optimalityClaim: "not-certified",
      teamSetsInScope: legalTeamSetsInScope,
      teamSetsConsidered: teamSets.length,
      unsearchedTeamSets: Math.max(0, legalTeamSetsInScope - teamSets.length),
      beamWidth,
      formationOrder: {
        selection: "best-modeled-order-among-audited-finalists",
        auditedLeaderTeamCandidates: 0,
        totalLeaderTeamCandidates: 0,
        unauditedLeaderTeamCandidates: 0,
        globalBestOrderCertified: false,
      },
      localRefinement: emptyLocalRefinementCertificate(),
      caveat:
        "Beam search is deterministic and reports its evaluated coverage; its proxy is not an admissible utility bound. The selected result is refined to a strict one-member-swap-or-Leader-change fixed point, but that coordinate-local result is not a global optimum claim.",
    };
  }
  if (teamSets.length === 0) throw new Error("Search produced no legal finalist team sets");

  const evaluationCache = new Map<string, NativeUtilityResult>();
  let utilityEvaluations = 0;
  const evaluate = (leaderOutfitCardId: string, memberCardIds: readonly string[]): NativeUtilityResult => {
    const key = `${leaderOutfitCardId}|${memberCardIds.join("|")}`;
    const cached = evaluationCache.get(key);
    if (cached) return cached;
    const result = evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId,
        members: memberCardIds.map((cardId) => {
          const bloomStage = normalized.bloomStageByCardId[cardId];
          return bloomStage === undefined
            ? { cardId, investment: input.investmentLayer }
            : { cardId, investment: input.investmentLayer, bloomStage };
        }),
      },
      chartKey: input.chartKey,
      seed: input.seed,
      accountState: input.accountState,
    });
    utilityEvaluations += 1;
    evaluationCache.set(key, result);
    return result;
  };

  const scored: ScoredCandidate[] = teamSets.flatMap((team) =>
    normalized.leaderCards.map((leader) => ({
      leaderOutfitCardId: leader.cardId,
      memberCardIds: team.memberCardIds,
      utility: evaluate(leader.cardId, team.memberCardIds),
    })),
  );
  scored.sort(compareScoredCandidates);
  if (!scored[0]) throw new Error("Search produced no Leader/Outfit and Member candidate");

  type AuditedSelection = Readonly<{ audit: NativeOrderAudit; modeledBest: ScoredCandidate }>;
  const auditCache = new Map<string, AuditedSelection>();
  const auditCandidate = (candidate: ScoredCandidate): AuditedSelection => {
    const auditKey = `${candidate.leaderOutfitCardId}|${[...candidate.memberCardIds].sort().join("|")}`;
    const cached = auditCache.get(auditKey);
    if (cached) return cached;
    const orders = permutations(candidate.memberCardIds);
    const distinctOrders = new Set(orders.map((order) => order.join("|"))).size;
    if (orders.length !== 120 || distinctOrders !== 120) {
      throw new Error("Five unique Members must produce exactly 120 formation orders");
    }
    const orderedCandidates: ScoredCandidate[] = orders.map((order) => ({
      leaderOutfitCardId: candidate.leaderOutfitCardId,
      memberCardIds: asTeamTuple(order),
      utility: evaluate(candidate.leaderOutfitCardId, order),
    }));
    orderedCandidates.sort(compareScoredCandidates);
    const modeledBest = orderedCandidates[0]!;
    const utilities = orderedCandidates.map((ordered) => ordered.utility.relativeUtility);
    const centralValues = utilities.map((utility) => utility.central);
    const audit: NativeOrderAudit = {
      leaderOutfitCardId: candidate.leaderOutfitCardId,
      memberCardIds: candidate.memberCardIds,
      status: "indeterminate-aggregate-context",
      evaluatedOrders: 120,
      distinctOrders: 120,
      recommendedOrder: null,
      canonicalOrder: candidate.memberCardIds,
      modeledBestOrder: modeledBest.memberCardIds,
      modeledBestRelativeUtility: modeledBest.utility.relativeUtility,
      centralRange: {
        minimum: Math.min(...centralValues),
        mean: round(centralValues.reduce((sum, value) => sum + value, 0) / centralValues.length),
        maximum: Math.max(...centralValues),
      },
      intervalEnvelope: {
        lower: Math.min(...utilities.map((utility) => utility.lower)),
        central: round(centralValues.reduce((sum, value) => sum + value, 0) / centralValues.length),
        upper: Math.max(...utilities.map((utility) => utility.upper)),
      },
    };
    const selection = { audit, modeledBest };
    auditCache.set(auditKey, selection);
    return selection;
  };

  const auditedCandidates = scored.slice(0, Math.min(auditedFinalistCount, scored.length));
  const auditedSelections = auditedCandidates.map(auditCandidate);
  auditedSelections.sort((left, right) => compareScoredCandidates(left.modeledBest, right.modeledBest));
  const selected = auditedSelections[0];
  if (!selected) throw new Error("At least one finalist must be formation-order audited");
  let best = selected.modeledBest;
  let bestOrderAudit = selected.audit;

  const formationOrderCoverage = {
    selection: "best-modeled-order-among-audited-finalists" as const,
    auditedLeaderTeamCandidates: auditedSelections.length,
    totalLeaderTeamCandidates: scored.length,
    unauditedLeaderTeamCandidates: scored.length - auditedSelections.length,
  };
  if (certificate.kind === "certified") {
    certificate = {
      ...certificate,
      formationOrder: {
        ...formationOrderCoverage,
        globalBestOrderCertified: auditedSelections.length === scored.length,
      },
    };
  } else {
    certificate = {
      ...certificate,
      formationOrder: {
        ...formationOrderCoverage,
        globalBestOrderCertified: false,
      },
    };
  }

  let localRefinementIterations = 0;
  let localCandidatesScreened = 0;
  let localImprovingCandidatesAudited = 0;
  let localFormationOrdersAudited = 0;
  let localStatus: NativeLocalRefinementCertificate["status"] = "fixed-point";
  const visitedFormations = new Set<string>([
    `${best.leaderOutfitCardId}|${best.memberCardIds.join("|")}`,
  ]);
  const auditHistory = new Map(
    auditedSelections.map((selection) => [
      `${selection.audit.leaderOutfitCardId}|${[...selection.audit.memberCardIds].sort().join("|")}`,
      selection,
    ]),
  );

  if (certificate.formationOrder.globalBestOrderCertified) {
    localStatus = "globally-certified";
  } else {
    while (true) {
      const screenedByKey = new Map<string, ScoredCandidate>();
      for (const [slot, replacedCardId] of best.memberCardIds.entries()) {
        if (normalized.anchors.some((anchor) => anchor.cardId === replacedCardId)) continue;
        const otherIds = best.memberCardIds.filter((_, index) => index !== slot);
        const otherTalents = new Set(otherIds.map((cardId) => cardById.get(cardId)!.talentId));
        const existingFiveStars = otherIds.filter(
          (cardId) => cardById.get(cardId)!.rarity === 5,
        ).length;
        for (const card of normalized.memberCards) {
          if (
            card.cardId === replacedCardId ||
            otherIds.includes(card.cardId) ||
            otherTalents.has(card.talentId) ||
            existingFiveStars + (card.rarity === 5 ? 1 : 0) > normalized.maxFiveStarMembers
          ) {
            continue;
          }
          const order = [...best.memberCardIds];
          order[slot] = card.cardId;
          const candidate: ScoredCandidate = {
            leaderOutfitCardId: best.leaderOutfitCardId,
            memberCardIds: asTeamTuple(order),
            utility: evaluate(best.leaderOutfitCardId, order),
          };
          localCandidatesScreened += 1;
          if (candidate.utility.relativeUtility.central > best.utility.relativeUtility.central + LOCAL_IMPROVEMENT_EPSILON) {
            screenedByKey.set(
              `${candidate.leaderOutfitCardId}|${[...candidate.memberCardIds].sort().join("|")}`,
              candidate,
            );
          }
        }
      }
      for (const leader of normalized.leaderCards) {
        if (leader.cardId === best.leaderOutfitCardId) continue;
        const candidate: ScoredCandidate = {
          leaderOutfitCardId: leader.cardId,
          memberCardIds: best.memberCardIds,
          utility: evaluate(leader.cardId, best.memberCardIds),
        };
        localCandidatesScreened += 1;
        if (candidate.utility.relativeUtility.central > best.utility.relativeUtility.central + LOCAL_IMPROVEMENT_EPSILON) {
          screenedByKey.set(
            `${candidate.leaderOutfitCardId}|${[...candidate.memberCardIds].sort().join("|")}`,
            candidate,
          );
        }
      }

      const improvingSelections: AuditedSelection[] = [];
      for (const [auditKey, candidate] of screenedByKey) {
        const before = auditCache.size;
        const audited = auditCandidate(candidate);
        localImprovingCandidatesAudited += 1;
        if (auditCache.size > before) localFormationOrdersAudited += 120;
        auditHistory.set(auditKey, audited);
        if (
          audited.modeledBest.utility.relativeUtility.central >
          best.utility.relativeUtility.central + LOCAL_IMPROVEMENT_EPSILON
        ) {
          improvingSelections.push(audited);
        }
      }
      improvingSelections.sort((left, right) =>
        compareScoredCandidates(left.modeledBest, right.modeledBest),
      );
      const improvement = improvingSelections[0];
      if (!improvement) break;
      const nextKey = `${improvement.modeledBest.leaderOutfitCardId}|${improvement.modeledBest.memberCardIds.join("|")}`;
      if (visitedFormations.has(nextKey)) {
        localStatus = "cycle-guard";
        break;
      }
      best = improvement.modeledBest;
      bestOrderAudit = improvement.audit;
      visitedFormations.add(nextKey);
      localRefinementIterations += 1;
    }
  }

  const localRefinement: NativeLocalRefinementCertificate = {
    status: localStatus,
    scope: "one-member-swap-or-leader-change",
    selection: "strict-central-coordinate-ascent",
    iterations: localRefinementIterations,
    candidatesScreened: localCandidatesScreened,
    improvingCandidatesAudited: localImprovingCandidatesAudited,
    formationOrdersAudited: localFormationOrdersAudited,
    visitedFormations: visitedFormations.size,
    globalOptimalityClaim: certificate.formationOrder.globalBestOrderCertified,
  };
  certificate = { ...certificate, localRefinement };
  const allAuditedSelections = [...auditHistory.values()].sort((left, right) =>
    compareScoredCandidates(left.modeledBest, right.modeledBest),
  );
  const auditedFinalists = allAuditedSelections.map((entry) => entry.audit);

  let replacementEvaluations = 0;
  const replacementsBySlot = best.memberCardIds.map((replacedCardId, slot) => {
    const anchored = normalized.anchors.some((anchor) => anchor.cardId === replacedCardId);
    const otherIds = best.memberCardIds.filter((_, index) => index !== slot);
    const otherTalents = new Set(otherIds.map((cardId) => cardById.get(cardId)!.talentId));
    const existingFiveStars = otherIds.filter((cardId) => cardById.get(cardId)!.rarity === 5).length;
    const alternatives = anchored
      ? []
      : normalized.memberCards
          .filter(
            (card) =>
              card.cardId !== replacedCardId &&
              !otherIds.includes(card.cardId) &&
              !otherTalents.has(card.talentId) &&
              existingFiveStars + (card.rarity === 5 ? 1 : 0) <= normalized.maxFiveStarMembers,
          )
          .map((card): NativeSearchReplacement => {
            const order = [...best.memberCardIds];
            order[slot] = card.cardId;
            const utility = evaluate(best.leaderOutfitCardId, order).relativeUtility;
            replacementEvaluations += 1;
            return {
              cardId: card.cardId,
              talentId: card.talentId,
              rarity: card.rarity,
              bloomStage: card.bloomStage,
              relativeUtility: utility,
              intervalLoss: subtractIntervals(best.utility.relativeUtility, utility),
            };
          })
          .sort((left, right) => {
            if (left.intervalLoss.central !== right.intervalLoss.central) {
              return left.intervalLoss.central - right.intervalLoss.central;
            }
            if (left.intervalLoss.lower !== right.intervalLoss.lower) {
              return left.intervalLoss.lower - right.intervalLoss.lower;
            }
            return left.cardId.localeCompare(right.cardId);
          });
    const dominatedAlternative = alternatives.find(
      (alternative) => alternative.intervalLoss.central < -LOCAL_IMPROVEMENT_EPSILON,
    );
    if (dominatedAlternative) {
      throw new Error(
        `Local refinement invariant failed: ${dominatedAlternative.cardId} improves slot ${slot} by ${round(-dominatedAlternative.intervalLoss.central)}`,
      );
    }
    return {
      slot,
      replacedCardId,
      anchored,
      comparisonOrder: "same-slot-aggregate-model" as const,
      alternatives: alternatives.slice(0, alternativesPerSlot),
    };
  });

  return {
    kind: "native-legal-team-search",
    methodologyVersion: "yd-native-search-1.0.0",
    status: "provisional",
    context: best.utility.context,
    certificate,
    constraints: {
      anchorCardId: normalized.anchor?.cardId ?? null,
      anchorCardIds: normalized.anchors.map((anchor) => anchor.cardId),
      fixedLeaderOutfitCardId: normalized.fixedLeader?.cardId ?? null,
      memberCardIds: normalized.memberCards.map((card) => card.cardId),
      leaderOutfitCardIds: normalized.leaderCards.map((card) => card.cardId),
      memberRarities: normalized.memberRarities,
      leaderRarities: normalized.leaderRarities,
      maxFiveStarMembers: normalized.maxFiveStarMembers,
      investmentLayer: input.investmentLayer,
      bloomStageByCardId: normalized.bloomStageByCardId,
    },
    counts: {
      eligibleMemberCards: normalized.memberCards.length,
      eligibleLeaderOutfits: normalized.leaderCards.length,
      legalTeamSetsInScope,
      finalistTeamSets: teamSets.length,
      leaderTeamEvaluations: scored.length,
      auditedFinalists: auditedFinalists.length,
      formationOrdersAudited: auditedFinalists.length * 120,
      localRefinementIterations,
      localCandidatesScreened,
      localImprovingCandidatesAudited,
      localFormationOrdersAudited,
      replacementEvaluations,
      utilityEvaluations,
    },
    leaderCoverageByFinalistTeam: teamSets.map((team) => ({
      memberCardIds: team.memberCardIds,
      evaluatedLeaderOutfitCardIds: normalized.leaderCards.map((leader) => leader.cardId),
    })),
    best: {
      leaderOutfitCardId: best.leaderOutfitCardId,
      members: best.memberCardIds.map((cardId, slot) => {
        const card = cardById.get(cardId)!;
        return {
          slot,
          cardId,
          talentId: card.talentId,
          rarity: card.rarity,
          investment: input.investmentLayer,
          bloomStage: normalized.bloomStageByCardId[cardId] ?? null,
        };
      }),
      relativeUtility: best.utility.relativeUtility,
      recipients: summarizeRecipients(best),
      timing: summarizeTiming(best),
      orderAudit: bestOrderAudit,
    },
    auditedFinalists,
    replacementsBySlot,
  };
}
