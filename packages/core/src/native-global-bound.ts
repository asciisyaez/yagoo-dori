import {
  assertBloomStage,
  cardBelongsToCharacterGrouping,
  calculateCardProgression,
  type BloomStage,
  type InvestmentLayer,
} from "./formation-evaluator";
import { fromCanonicalMicroUnits, upperBoundToCanonicalMicroUnits } from "./exact-optimizer-arithmetic";
import { mechanicsCardById, type CardMechanics } from "./mechanics";
import { compileNativeLeaderEquivalence } from "./native-leader-equivalence";
import { publicCardById, type PublicCard } from "./public-data";
import { songContextData } from "./song-contexts";

const TEAM_SIZE = 5;
const PARAMETER_EFFECT_KINDS = new Set([
  "performance-up",
  "technique-up",
  "sense-up",
  "all-parameters-up",
]);

type SkillApplications = CardMechanics["skills"]["passive"][number]["applications"];

type BoundCard = Readonly<{
  cardId: string;
  talentId: string;
  rarity: 4 | 5;
  publicCard: PublicCard;
  parameters: Readonly<{ performance: number; technique: number; sense: number }>;
  baseParameters: number;
  passiveApplications: SkillApplications;
  activeApplications: SkillApplications;
  activeActivationProbabilityPermil: number;
  activeCooldownMilliseconds: number;
  activeDurationMilliseconds: number;
  specialApplications: SkillApplications;
  specialDurationMilliseconds: number;
}>;

export type NativeGlobalBoundInput = Readonly<{
  partialMemberCardIds: readonly string[];
  eligibleMemberCardIds: readonly string[];
  eligibleLeaderOutfitCardIds: readonly string[];
  investmentLayer: InvestmentLayer;
  bloomStageByCardId?: Readonly<Record<string, BloomStage>>;
  maxFiveStarMembers?: number;
  /** One or more aggregate charts whose central utilities will be averaged. */
  chartKeys: readonly string[];
}>;

export type NativeGlobalBoundCompileInput = Readonly<
  Omit<NativeGlobalBoundInput, "partialMemberCardIds">
>;

export type NativeGlobalBoundContext = Readonly<{
  kind: "compiled-native-global-bound-context";
  methodologyVersion: "yd-native-global-bound-compiled-1.0.0";
  eligibleMemberCardIds: readonly string[];
  eligibleLeaderOutfitCardIds: readonly string[];
  leaderRepresentativeCardIds: readonly string[];
  leaderEquivalenceCounts: Readonly<{
    eligibleLeaderOutfits: number;
    equivalenceClasses: number;
    collapsedLeaderOutfits: number;
  }>;
  chartKeys: readonly string[];
  bound(input: Readonly<{
    partialMemberCardIds: readonly string[];
    /** A search subtree may narrow the compiled root roster. */
    eligibleMemberCardIds?: readonly string[];
    /** A complete-team proof may narrow to selected equivalence representatives. */
    eligibleLeaderOutfitCardIds?: readonly string[];
  }>): NativeGlobalBoundResult;
}>;

type CompiledChart = Readonly<{
  chartKey: string;
  noteCount: number;
  durationMilliseconds: number;
  songSingerTalentIds: readonly string[];
  checkHistogramByCardId: ReadonlyMap<string, readonly (readonly [number, number])[]>;
}>;

type BoundRuntime = Readonly<{
  cardById: ReadonlyMap<string, BoundCard>;
  leaderCardIds: readonly string[];
  charts: ReadonlyMap<string, CompiledChart>;
}>;

export type NativeGlobalBoundResult = Readonly<{
  kind: "native-global-optimistic-bound";
  methodologyVersion: "yd-native-global-bound-1.0.0";
  upperCentralUtility: number;
  partialMemberCardIds: readonly string[];
  remainingSlots: number;
  remainingFiveStarSlots: number;
  chartKeys: readonly string[];
  components: Readonly<{
    baseParameters: number;
    parameterEffectPermil: number;
    parameterEffects: number;
    activeScoreUpPermil: number;
    persistentSupportPermil: number;
    maximumSpecialScoreSupportPermil: number;
    activeAndSpecial: number;
    byChart: ReadonlyArray<{
      chartKey: string;
      specialScoreSupportPermil: number;
      activationRateUpPermil: number;
      maximumActiveScoreUpPermil: number;
      probabilityWeightedActiveScoreUpPermil: number;
      activeAndSpecialPermil: number;
      activeAndSpecial: number;
    }>;
  }>;
  relaxation: Readonly<{
    triggers: "all-pass";
    recipientTargets: "full-team-parameter-cap";
    activeProbability: "maximum-special-activation-rate";
    specialDuration: "exact-duration-weighted";
    componentCompletions: "independent";
  }>;
}>;

function unique(values: readonly string[], label: string): string[] {
  const result = [...new Set(values)].sort();
  if (result.length !== values.length) throw new Error(`${label} must not contain duplicates`);
  return result;
}

function selectedSkill<T extends { level: number }>(levels: readonly T[], level: number): T {
  const result = levels.find((candidate) => candidate.level === level);
  if (!result) throw new Error(`Missing exact skill level ${level}`);
  return result;
}

function sumEffects(applications: SkillApplications, kinds: ReadonlySet<string>): number {
  return applications.reduce((total, application) => {
    const value = application.effect?.value;
    if (value !== null && value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error("Global-bound monotonicity requires non-negative finite effect values");
    }
    return total +
      (application.effect && kinds.has(application.effect.kind) ? value ?? 0 : 0);
  }, 0);
}

function maximumActiveScoreUp(applications: SkillApplications): number {
  const triggerIds = [
    ...new Set(
      applications
        .map((application) => application.triggerGroupId)
        .filter((triggerId): triggerId is string => triggerId !== null),
    ),
  ];
  let maximum = 0;
  const assignmentCount = 2 ** triggerIds.length;
  for (let mask = 0; mask < assignmentCount; mask += 1) {
    const included: SkillApplications[number][] = [];
    for (const application of applications) {
      const triggerIndex = application.triggerGroupId
        ? triggerIds.indexOf(application.triggerGroupId)
        : -1;
      if (triggerIndex >= 0 && (mask & (1 << triggerIndex)) === 0) continue;
      if (application.combination === "conditional-override") {
        const replaceIndex = included.findIndex(
          (candidate) =>
            candidate.channel === "primary" &&
            candidate.effect?.family === application.effect?.family &&
            candidate.effect?.kind === application.effect?.kind,
        );
        if (replaceIndex >= 0) included.splice(replaceIndex, 1, application);
        else included.push(application);
      } else {
        included.push(application);
      }
    }
    const scoreUp = sumEffects(included, new Set(["score-up"]));
    maximum = Math.max(maximum, scoreUp);
  }
  return maximum;
}

function boundCard(
  cardId: string,
  investmentLayer: InvestmentLayer,
  bloomStage: BloomStage | undefined,
): BoundCard {
  const mechanics = mechanicsCardById.get(cardId);
  const publicCard = publicCardById.get(cardId);
  if (!mechanics || !publicCard) throw new Error(`Unknown Member card: ${cardId}`);
  const progression = calculateCardProgression(
    publicCard,
    mechanics,
    investmentLayer,
    bloomStage,
  );
  const state = progression.state;
  const passive = selectedSkill(mechanics.skills.passive, state.passiveSkillLevel);
  const active = selectedSkill(mechanics.skills.active, state.activeSkillLevel);
  const special = selectedSkill(mechanics.skills.special, state.specialSkillLevel);
  if (
    active.activationProbabilityPermil === null ||
    active.cooldownMilliseconds === null ||
    active.durationMilliseconds === null
  ) {
    throw new Error(`${cardId} lacks exact Active timing or probability for the global bound`);
  }
  if (special.durationMilliseconds === null) {
    throw new Error(`${cardId} lacks an exact Special duration for the global bound`);
  }
  return {
    cardId,
    talentId: mechanics.talentId,
    rarity: mechanics.rarity,
    publicCard,
    parameters: progression.parameters,
    baseParameters:
      progression.parameters.performance +
      progression.parameters.technique +
      progression.parameters.sense,
    passiveApplications: passive.applications,
    activeApplications: active.applications,
    activeActivationProbabilityPermil: active.activationProbabilityPermil,
    activeCooldownMilliseconds: active.cooldownMilliseconds,
    activeDurationMilliseconds: active.durationMilliseconds,
    specialApplications: special.applications,
    specialDurationMilliseconds: special.durationMilliseconds,
  };
}

function optimisticCompletionSum(
  selected: readonly BoundCard[],
  remaining: readonly BoundCard[],
  slots: number,
  fiveStarBudget: number,
  value: (card: BoundCard) => number,
): number {
  // This helper is on the hot path of every global-search bound.  The first
  // version used string-keyed Maps for each tiny cardinality DP state.  That
  // was simple, but on the 113-card roster it meant hundreds of allocations
  // per bound (and made a proof pass spend most of its time rebuilding the
  // same 0..5 x 0..5 state grid).  Keep the exact same legal-completion
  // relaxation, but use a fixed numeric grid instead.  The callback remains
  // the source of the card value, so this is a performance-only rewrite of a
  // sound upper-bound primitive.
  if (slots < 0 || fiveStarBudget < 0) return Number.NEGATIVE_INFINITY;
  if (slots === 0) return selected.reduce((total, card) => total + value(card), 0);
  const cardsByTalent = new Map<string, BoundCard[]>();
  for (const card of remaining) {
    const cards = cardsByTalent.get(card.talentId) ?? [];
    cards.push(card);
    cardsByTalent.set(card.talentId, cards);
  }
  if (cardsByTalent.size < slots) {
    throw new Error("The partial selection has no legal five-talent completion");
  }
  const selectedValue = selected.reduce((total, card) => total + value(card), 0);
  if (fiveStarBudget >= slots) {
    const future = [...cardsByTalent.values()]
      .map((cards) => Math.max(...cards.map(value)))
      .sort((left, right) => right - left)
      .slice(0, slots);
    return selectedValue + future.reduce((total, entry) => total + entry, 0);
  }
  const width = fiveStarBudget + 1;
  const stateCount = (slots + 1) * width;
  let states = new Float64Array(stateCount);
  states.fill(Number.NEGATIVE_INFINITY);
  states[0] = 0;
  for (const cards of cardsByTalent.values()) {
    const next = states.slice();
    for (let count = 0; count < slots; count += 1) {
      for (let stars = 0; stars <= fiveStarBudget; stars += 1) {
        const current = states[count * width + stars]!;
        if (!Number.isFinite(current)) continue;
        for (const card of cards) {
          const nextStars = stars + (card.rarity === 5 ? 1 : 0);
          if (nextStars > fiveStarBudget) continue;
          const nextIndex = (count + 1) * width + nextStars;
          const candidate = current + value(card);
          if (candidate > next[nextIndex]!) next[nextIndex] = candidate;
        }
      }
    }
    states = next;
  }
  const future = Math.max(
    ...Array.from({ length: fiveStarBudget + 1 }, (_, stars) =>
      states[slots * width + stars]!,
    ),
  );
  if (!Number.isFinite(future)) {
    throw new Error("The partial selection has no legal five-talent completion");
  }
  return selectedValue + future;
}

function optimisticCompletionMaximum(
  selected: readonly BoundCard[],
  remaining: readonly BoundCard[],
  slots: number,
  fiveStarBudget: number,
  value: (card: BoundCard) => number,
): number {
  const selectedMaximum = Math.max(0, ...selected.map(value));
  if (slots === 0) return selectedMaximum;
  const cardsByTalent = new Map<string, BoundCard[]>();
  for (const card of remaining) {
    const cards = cardsByTalent.get(card.talentId) ?? [];
    cards.push(card);
    cardsByTalent.set(card.talentId, cards);
  }
  if (fiveStarBudget >= slots) {
    if (cardsByTalent.size < slots) {
      throw new Error("The partial selection has no legal five-talent completion");
    }
    return Math.max(
      selectedMaximum,
      ...[...cardsByTalent.values()].flatMap((cards) => cards.map(value)),
    );
  }
  let states = new Map<string, number>([["0:0", selectedMaximum]]);
  for (const cards of cardsByTalent.values()) {
    const next = new Map(states);
    for (const [key, current] of states) {
      const [countText, starsText] = key.split(":");
      const count = Number(countText);
      const stars = Number(starsText);
      if (count >= slots) continue;
      for (const card of cards) {
        const nextStars = stars + (card.rarity === 5 ? 1 : 0);
        if (nextStars > fiveStarBudget) continue;
        const nextKey = `${count + 1}:${nextStars}`;
        next.set(nextKey, Math.max(next.get(nextKey) ?? Number.NEGATIVE_INFINITY, current, value(card)));
      }
    }
    states = next;
  }
  const maximum = Math.max(
    ...[...states.entries()]
      .filter(([key]) => Number(key.split(":")[0]) === slots)
      .map(([, result]) => result),
  );
  if (!Number.isFinite(maximum)) {
    throw new Error("The partial selection has no legal five-talent completion");
  }
  return maximum;
}

function parameterForEffect(card: BoundCard, effectKind: string): number {
  if (effectKind === "performance-up") return card.parameters.performance;
  if (effectKind === "technique-up") return card.parameters.technique;
  if (effectKind === "sense-up") return card.parameters.sense;
  if (effectKind === "all-parameters-up") return card.baseParameters;
  return 0;
}

function eligibleRecipients(
  cards: readonly BoundCard[],
  application: SkillApplications[number],
): BoundCard[] {
  const target = application.target;
  if (!target || target.kind === "all") return [...cards];
  if (target.kind === "attribute") {
    return cards.filter((card) => card.publicCard.attribute === target.attribute);
  }
  if (target.kind === "character-group") {
    return cards.filter(
      (card) =>
        target.characterGroupingId !== null &&
        cardBelongsToCharacterGrouping(card.publicCard, target.characterGroupingId),
    );
  }
  return [];
}

function parameterApplicationUpper(
  applications: SkillApplications,
  possibleRecipients: readonly BoundCard[],
  source: BoundCard | null,
): number {
  let total = 0;
  for (const application of applications) {
    const effect = application.effect;
    if (!effect || !PARAMETER_EFFECT_KINDS.has(effect.kind)) continue;
    const value = effect.value ?? 0;
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Global-bound monotonicity requires non-negative finite effect values");
    }
    if (application.target?.kind === "self") {
      if (source) total += (parameterForEffect(source, effect.kind) * value) / 1_000;
      continue;
    }
    const recipients = eligibleRecipients(possibleRecipients, application);
    const count = Math.min(application.target?.count ?? TEAM_SIZE, TEAM_SIZE, recipients.length);
    const recipientUpper = recipients
      .map((card) => parameterForEffect(card, effect.kind))
      .sort((left, right) => right - left)
      .slice(0, count)
      .reduce((sum, parameter) => sum + parameter, 0);
    total += (recipientUpper * value) / 1_000;
  }
  return total;
}

/** Exact central recipient allocation for a complete five-Member team. */
function parameterApplicationCompleteCentral(
  applications: SkillApplications,
  members: readonly BoundCard[],
  source: BoundCard | null,
): number {
  let total = 0;
  for (const application of applications) {
    const effect = application.effect;
    if (!effect || !PARAMETER_EFFECT_KINDS.has(effect.kind)) continue;
    const value = effect.value ?? 0;
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Global-bound monotonicity requires non-negative finite effect values");
    }
    if (application.target?.kind === "self") {
      if (source) total += (parameterForEffect(source, effect.kind) * value) / 1_000;
      continue;
    }
    const recipients = eligibleRecipients(members, application);
    const count = Math.min(application.target?.count ?? TEAM_SIZE, recipients.length);
    // Native central utility uses the guaranteed recipient floor. For an
    // unresolved capped subset this is the least valuable legal subset.
    const recipientCentral = recipients
      .map((card) => parameterForEffect(card, effect.kind))
      .sort((left, right) => left - right)
      .slice(0, count)
      .reduce((sum, parameter) => sum + parameter, 0);
    total += (recipientCentral * value) / 1_000;
  }
  return total;
}

function leaderParameterMaximum(
  leaderCardIds: readonly string[],
  possibleRecipients: readonly BoundCard[],
  context: TriggerContext,
): number {
  return Math.max(
    ...leaderCardIds.map((cardId) => {
      const mechanics = mechanicsCardById.get(cardId);
      if (!mechanics) throw new Error(`Unknown Leader/Outfit card: ${cardId}`);
      return parameterApplicationUpper(
        possibleApplications(mechanics.leaderOutfit.applications, context),
        possibleRecipients,
        null,
      );
    }),
  );
}

function targetCanInclude(
  application: SkillApplications[number],
  recipient: BoundCard,
  source: BoundCard | null,
): boolean {
  const target = application.target;
  if (!target) return false;
  if (target.kind === "all") return true;
  if (target.kind === "self") return source?.cardId === recipient.cardId;
  if (target.kind === "attribute") return recipient.publicCard.attribute === target.attribute;
  return (
    target.characterGroupingId !== null &&
    cardBelongsToCharacterGrouping(recipient.publicCard, target.characterGroupingId)
  );
}

function supportForRecipient(
  applications: SkillApplications,
  recipient: BoundCard,
  source: BoundCard | null,
): number {
  return applications.reduce((total, application) => {
    const effect = application.effect;
    if (!effect || effect.kind !== "active-skill-effect-up") return total;
    const value = effect.value ?? 0;
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Global-bound monotonicity requires non-negative finite effect values");
    }
    return total + (targetCanInclude(application, recipient, source) ? value : 0);
  }, 0);
}

function completeTeamSupportForRecipient(
  applications: SkillApplications,
  members: readonly BoundCard[],
  recipient: BoundCard,
  source: BoundCard | null,
): number {
  return applications.reduce((total, application) => {
    const effect = application.effect;
    if (!effect || effect.kind !== "active-skill-effect-up") return total;
    const eligible = eligibleRecipients(members, application);
    const selectedCount = Math.min(application.target?.count ?? eligible.length, eligible.length);
    const guaranteed =
      application.target?.kind === "self"
        ? source?.cardId === recipient.cardId
        : selectedCount === eligible.length && eligible.some((card) => card.cardId === recipient.cardId);
    return total + (guaranteed ? effect.value ?? 0 : 0);
  }, 0);
}

type TriggerContext = Readonly<{
  selected: readonly BoundCard[];
  remaining: readonly BoundCard[];
  remainingSlots: number;
  leaderCardIds: readonly string[];
  chart: CompiledChart;
  facts: TriggerFacts;
}>;

/**
 * Trigger feasibility is queried once for nearly every application on every
 * bound.  Keep the exact "at most one card per talent" relaxation, but cache
 * the counts/sets for the current subtree instead of repeatedly normalizing
 * every card's grouping name inside `possibleApplications`.
 */
type TriggerFacts = Readonly<{
  maxAttributeMatches: ReadonlyMap<string, number>;
  maxGroupingMatches: ReadonlyMap<string, number>;
  leaderTalentIds: ReadonlySet<string>;
  leaderGroupingMatches: ReadonlySet<string>;
}>;

const groupingMembershipCache = new Map<string, boolean>();

const knownTriggerGroupingIds = [
  ...new Set(
    [...mechanicsCardById.values()]
      .flatMap((card) => [
        ...card.skills.active,
        ...card.skills.passive,
        ...card.skills.special,
        card.leaderOutfit,
      ])
      .flatMap((skill) => skill.applications)
      .flatMap((application) => [
        application.target?.characterGroupingId,
        application.trigger?.characterGroupingId,
      ])
      .filter((value): value is string => Boolean(value)),
  ),
].sort();

function cachedGroupingMembership(card: BoundCard, groupingId: string): boolean {
  const key = `${card.cardId}|${groupingId}`;
  const cached = groupingMembershipCache.get(key);
  if (cached !== undefined) return cached;
  const result = cardBelongsToCharacterGrouping(card.publicCard, groupingId);
  groupingMembershipCache.set(key, result);
  return result;
}

function triggerFacts(
  selected: readonly BoundCard[],
  remaining: readonly BoundCard[],
  remainingSlots: number,
  leaderCardIds: readonly string[],
): TriggerFacts {
  const selectedAttributes = new Map<string, number>();
  const futureAttributes = new Map<string, Set<string>>();
  const selectedGroupings = new Map<string, number>();
  const futureGroupings = new Map<string, Set<string>>();
  const addCard = (card: BoundCard, selectedCard: boolean): void => {
    const attribute = card.publicCard.attribute;
    if (selectedCard) {
      selectedAttributes.set(attribute, (selectedAttributes.get(attribute) ?? 0) + 1);
    } else {
      const talents = futureAttributes.get(attribute) ?? new Set<string>();
      talents.add(card.talentId);
      futureAttributes.set(attribute, talents);
    }
    // The dataset has a small, finite set of grouping ids used by mechanics.
    // Cache each exact membership lookup; no trigger can become impossible
    // merely because a grouping is absent from a particular card.
    for (const groupingId of knownTriggerGroupingIds) {
      if (!cachedGroupingMembership(card, groupingId)) continue;
      if (selectedCard) {
        selectedGroupings.set(groupingId, (selectedGroupings.get(groupingId) ?? 0) + 1);
      } else {
        const talents = futureGroupings.get(groupingId) ?? new Set<string>();
        talents.add(card.talentId);
        futureGroupings.set(groupingId, talents);
      }
    }
  };
  for (const card of selected) addCard(card, true);
  for (const card of remaining) addCard(card, false);
  const maxAttributeMatches = new Map<string, number>();
  for (const [attribute, count] of selectedAttributes) {
    maxAttributeMatches.set(
      attribute,
      count + Math.min(remainingSlots, futureAttributes.get(attribute)?.size ?? 0),
    );
  }
  for (const [attribute, talents] of futureAttributes) {
    if (!maxAttributeMatches.has(attribute)) {
      maxAttributeMatches.set(attribute, Math.min(remainingSlots, talents.size));
    }
  }
  const maxGroupingMatches = new Map<string, number>();
  for (const [groupingId, count] of selectedGroupings) {
    maxGroupingMatches.set(
      groupingId,
      count + Math.min(remainingSlots, futureGroupings.get(groupingId)?.size ?? 0),
    );
  }
  for (const [groupingId, talents] of futureGroupings) {
    if (!maxGroupingMatches.has(groupingId)) {
      maxGroupingMatches.set(groupingId, Math.min(remainingSlots, talents.size));
    }
  }
  const leaderTalentIds = new Set<string>();
  const leaderGroupingMatches = new Set<string>();
  for (const cardId of leaderCardIds) {
    const leader = mechanicsCardById.get(cardId);
    if (!leader) continue;
    leaderTalentIds.add(leader.leaderOutfit.talentId);
    const publicLeader = publicCardById.get(cardId);
    if (!publicLeader) continue;
    for (const groupingId of knownTriggerGroupingIds) {
      if (cardBelongsToCharacterGrouping(publicLeader, groupingId)) {
        leaderGroupingMatches.add(groupingId);
      }
    }
  }
  return { maxAttributeMatches, maxGroupingMatches, leaderTalentIds, leaderGroupingMatches };
}

const JUDGEMENT_ORDER = [
  "miss",
  "bad",
  "good",
  "great",
  "perfect",
  "perfect-plus",
  "auto",
] as const;

function normalizedTriggerJudgement(value: string): (typeof JUDGEMENT_ORDER)[number] | null {
  const suffix = value.toLowerCase().split("_").at(-1)?.replace("plus", "-plus");
  return JUDGEMENT_ORDER.find((judgement) => judgement === suffix) ?? null;
}

/** True when a trigger can still pass in at least one legal completion. */
function triggerCouldPass(
  trigger: NonNullable<SkillApplications[number]["trigger"]>,
  context: TriggerContext,
): boolean {
  const threshold = trigger.threshold;
  switch (trigger.kind) {
    case "combo-at-least":
      return threshold === null || context.chart.noteCount >= threshold;
    case "deck-attribute-count":
      return (
        threshold === null ||
        trigger.attribute === null ||
        (context.facts.maxAttributeMatches.get(trigger.attribute) ?? 0) >= threshold
      );
    case "deck-character-group-count":
      return (
        threshold === null ||
        trigger.characterGroupingId === null ||
        (context.facts.maxGroupingMatches.get(trigger.characterGroupingId) ?? 0) >= threshold
      );
    case "leader-character":
      return trigger.characterIds.some((talentId) => context.facts.leaderTalentIds.has(talentId));
    case "leader-character-group":
      return (
        trigger.characterGroupingId === null ||
        context.facts.leaderGroupingMatches.has(trigger.characterGroupingId)
      );
    case "judgement-at-least": {
      if (trigger.judgementType === null) return true;
      const required = normalizedTriggerJudgement(trigger.judgementType);
      return required === null || JUDGEMENT_ORDER.indexOf("perfect") >= JUDGEMENT_ORDER.indexOf(required);
    }
    case "life-at-least":
      return threshold === null || 1_000 >= threshold;
    case "life-at-most":
      return threshold === null || 1_000 <= threshold;
    case "music-character":
      return trigger.characterIds.some((talentId) =>
        context.chart.songSingerTalentIds.includes(talentId),
      );
  }
}

function possibleApplications(
  applications: SkillApplications,
  context: TriggerContext,
): SkillApplications {
  const impossibleTriggerGroups = new Set(
    applications
      .filter(
        (application) =>
          application.triggerGroupId !== null &&
          application.trigger !== null &&
          !triggerCouldPass(application.trigger, context),
      )
      .map((application) => application.triggerGroupId!),
  );
  return applications.filter(
    (application) =>
      application.triggerGroupId === null ||
      !impossibleTriggerGroups.has(application.triggerGroupId),
  );
}

function possibleApplicationsInAnyChart(
  applications: SkillApplications,
  contexts: readonly TriggerContext[],
): SkillApplications {
  const impossibleTriggerGroups = new Set(
    applications
      .filter(
        (application) =>
          application.triggerGroupId !== null &&
          application.trigger !== null &&
          contexts.every((context) => !triggerCouldPass(application.trigger!, context)),
      )
      .map((application) => application.triggerGroupId!),
  );
  return applications.filter(
    (application) =>
      application.triggerGroupId === null ||
      !impossibleTriggerGroups.has(application.triggerGroupId),
  );
}

function completeTeamPersistentSupportUpper(
  members: readonly BoundCard[],
  recipient: BoundCard,
  leaderCardIds: readonly string[],
  context: TriggerContext,
): number {
  const memberSupport = members.reduce(
    (total, source) =>
      total +
      completeTeamSupportForRecipient(
        possibleApplications(source.passiveApplications, context),
        members,
        recipient,
        source,
      ),
    0,
  );
  const leaderSupport = Math.max(
    ...leaderCardIds.map((cardId) => {
      const mechanics = mechanicsCardById.get(cardId);
      if (!mechanics) throw new Error(`Unknown Leader/Outfit card: ${cardId}`);
      return completeTeamSupportForRecipient(
        possibleApplications(mechanics.leaderOutfit.applications, context),
        members,
        recipient,
        null,
      );
    }),
  );
  return memberSupport + leaderSupport;
}

function completionPersistentSupportUpper(
  recipient: BoundCard,
  selected: readonly BoundCard[],
  remaining: readonly BoundCard[],
  remainingSlots: number,
  remainingFiveStarSlots: number,
  leaderCardIds: readonly string[],
  context: TriggerContext,
): number {
  const alreadySelected = selected.some((card) => card.cardId === recipient.cardId);
  const forcedSelected = alreadySelected ? [...selected] : [...selected, recipient];
  const forcedRemaining = alreadySelected
    ? [...remaining]
    : remaining.filter((card) => card.talentId !== recipient.talentId);
  const forcedSlots = remainingSlots - (alreadySelected ? 0 : 1);
  const forcedFiveStarSlots =
    remainingFiveStarSlots - (!alreadySelected && recipient.rarity === 5 ? 1 : 0);
  if (forcedSlots < 0 || forcedFiveStarSlots < 0) return Number.NEGATIVE_INFINITY;
  let memberSupport: number;
  try {
    memberSupport = optimisticCompletionSum(
      forcedSelected,
      forcedRemaining,
      forcedSlots,
      forcedFiveStarSlots,
      (source) =>
        supportForRecipient(
          possibleApplications(source.passiveApplications, context),
          recipient,
          source,
        ),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "The partial selection has no legal five-talent completion"
    ) {
      return Number.NEGATIVE_INFINITY;
    }
    throw error;
  }
  const leaderSupport = Math.max(
    ...leaderCardIds.map((cardId) => {
      const leader = mechanicsCardById.get(cardId);
      if (!leader) throw new Error(`Unknown Leader/Outfit card: ${cardId}`);
      return supportForRecipient(
        possibleApplications(leader.leaderOutfit.applications, context),
        recipient,
        null,
      );
    }),
  );
  return memberSupport + leaderSupport;
}

/**
 * Force one possible Active card into a completion before taking the best
 * remaining cards for an additive contribution.  Keeping the forced card in
 * the same completion makes the Active-card upper bound materially tighter
 * than independently taking the five best support or Special cards.
 */
function forcedCompletionSum(
  forcedCard: BoundCard,
  selected: readonly BoundCard[],
  remaining: readonly BoundCard[],
  remainingSlots: number,
  remainingFiveStarSlots: number,
  value: (card: BoundCard) => number,
): number {
  const alreadySelected = selected.some((card) => card.cardId === forcedCard.cardId);
  const forcedSelected = alreadySelected ? [...selected] : [...selected, forcedCard];
  const forcedRemaining = alreadySelected
    ? [...remaining]
    : remaining.filter((card) => card.talentId !== forcedCard.talentId);
  const forcedSlots = remainingSlots - (alreadySelected ? 0 : 1);
  const forcedFiveStarSlots =
    remainingFiveStarSlots - (!alreadySelected && forcedCard.rarity === 5 ? 1 : 0);
  if (forcedSlots < 0 || forcedFiveStarSlots < 0) return Number.NEGATIVE_INFINITY;
  try {
    return optimisticCompletionSum(
      forcedSelected,
      forcedRemaining,
      forcedSlots,
      forcedFiveStarSlots,
      value,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "The partial selection has no legal five-talent completion"
    ) {
      return Number.NEGATIVE_INFINITY;
    }
    throw error;
  }
}

/**
 * Upper-bound the expected maximum of at most five Active entries without
 * pretending that one team can choose a different card for every note.  For
 * each score threshold, the five largest candidate activation probabilities
 * dominate every legal five-card team's threshold exceedance probability;
 * averaging those probabilities and capping their union at one is an
 * admissible (and much tighter than a raw sum) relaxation.
 */
function relaxedExpectedMaximumUpper(
  entries: readonly { value: number; probability: number }[],
  maximumEntries = TEAM_SIZE,
): number {
  const values = [
    ...new Set(entries.map((entry) => entry.value).filter((value) => value > 0)),
  ].sort((left, right) => right - left);
  let total = 0;
  for (let index = 0; index < values.length; index += 1) {
    const high = values[index]!;
    const low = values[index + 1] ?? 0;
    const probability = Math.min(
      1,
      entries
        .filter((entry) => entry.value >= high)
        .map((entry) => Math.max(0, Math.min(1, entry.probability)))
        .sort((left, right) => right - left)
        .slice(0, maximumEntries)
        .reduce((sum, value) => sum + value, 0),
    );
    total += (high - low) * probability;
  }
  return total;
}

/**
 * A legal-roster version of the tail-union relaxation above.  The previous
 * bound selected the five largest activation probabilities independently at
 * every score threshold, which is admissible but can select mutually
 * incompatible cards (or a different five-card roster for every threshold).
 * This recurrence still relaxes the cross-threshold correlation, but it
 * preserves the one-card-per-talent and five-star constraints for each tail.
 * Since `-log(1-p)` is additive, maximizing the union probability is a small
 * legal-completion DP over the same fixed 0..5 x 0..5 state grid.
 */
function legalExpectedMaximumUpper(
  entries: readonly { card: BoundCard; value: number; probability: number }[],
  selected: readonly BoundCard[],
  remaining: readonly BoundCard[],
  remainingSlots: number,
  remainingFiveStarSlots: number,
): number {
  const entryByCardId = new Map(entries.map((entry) => [entry.card.cardId, entry]));
  const values = [
    ...new Set(entries.map((entry) => entry.value).filter((value) => value > 0)),
  ].sort((left, right) => right - left);
  let total = 0;
  for (let index = 0; index < values.length; index += 1) {
    const high = values[index]!;
    const low = values[index + 1] ?? 0;
    const gain = (card: BoundCard): number => {
      const entry = entryByCardId.get(card.cardId);
      if (!entry || entry.value < high) return 0;
      const probability = Math.max(0, Math.min(1, entryByCardId.get(card.cardId)?.probability ?? 0));
      if (probability >= 1) return Number.POSITIVE_INFINITY;
      if (probability <= 0) return 0;
      return -Math.log1p(-probability);
    };
    const selectedGain = selected.reduce((sum, card) => {
      const entry = entryByCardId.get(card.cardId);
      return sum + (entry && entry.value >= high ? gain(card) : 0);
    }, 0);
    const completionGain = optimisticCompletionSum(
      [],
      remaining,
      remainingSlots,
      remainingFiveStarSlots,
      gain,
    );
    const totalGain = selectedGain + completionGain;
    const unionProbability = totalGain === Number.POSITIVE_INFINITY
      ? 1
      : 1 - Math.exp(-Math.max(0, totalGain));
    total += (high - low) * unionProbability;
  }
  return total;
}

function leaderEffectMaximum(
  leaderCardIds: readonly string[],
  kinds: ReadonlySet<string>,
  context: TriggerContext,
): number {
  return Math.max(
    ...leaderCardIds.map((cardId) => {
      const mechanics = mechanicsCardById.get(cardId);
      if (!mechanics) throw new Error(`Unknown Leader/Outfit card: ${cardId}`);
      return sumEffects(possibleApplications(mechanics.leaderOutfit.applications, context), kinds);
    }),
  );
}

function ceilSix(value: number): number {
  // Keep the bound comparator-safe without a floating-point epsilon. First
  // round toward positive infinity at the published boundary, then add one
  // whole micro-unit as an explicit interval enclosure. Equality with the
  // incumbent is still expanded by the strict search comparator.
  return fromCanonicalMicroUnits(
    (upperBoundToCanonicalMicroUnits(value) + 1) as ReturnType<typeof upperBoundToCanonicalMicroUnits>,
  );
}

function activeOpportunityChecksAt(
  atMilliseconds: number,
  cooldownMilliseconds: number,
  durationMilliseconds: number,
): number {
  const lastCheck = Math.floor(atMilliseconds / cooldownMilliseconds);
  if (lastCheck < 1) return 0;
  const firstPossible = Math.max(
    1,
    Math.floor((atMilliseconds - durationMilliseconds) / cooldownMilliseconds) + 1,
  );
  return Math.max(0, lastCheck - firstPossible + 1);
}

function averageActiveCoverage(
  card: BoundCard,
  activationRateUpPermil: number,
  noteCount: number,
  songDurationMilliseconds: number,
  histogram?: readonly (readonly [number, number])[],
): number {
  const probability = Math.min(
    1,
    Math.max(0, card.activeActivationProbabilityPermil + activationRateUpPermil) / 1_000,
  );
  const counts = histogram ?? activeCheckHistogram(card, noteCount, songDurationMilliseconds);
  const total = counts.reduce(
    (sum, [checks, occurrences]) =>
      sum + occurrences * (1 - (1 - probability) ** checks),
    0,
  );
  return total / noteCount;
}

function activeCheckHistogram(
  card: BoundCard,
  noteCount: number,
  songDurationMilliseconds: number,
): readonly (readonly [number, number])[] {
  const counts = new Map<number, number>();
  for (let index = 0; index < noteCount; index += 1) {
    const atMilliseconds = ((index + 0.5) * songDurationMilliseconds) / noteCount;
    const checks = activeOpportunityChecksAt(
      atMilliseconds,
      card.activeCooldownMilliseconds,
      card.activeDurationMilliseconds,
    );
    counts.set(checks, (counts.get(checks) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left - right);
}

/**
 * Returns a finite optimistic bound for every legal completion of a partial
 * five-Member selection and every eligible Leader/Outfit under the current
 * aggregate central-utility model.
 *
 * The bound deliberately relaxes correlations: base parameters, passive
 * effects, support, Active strength, and Leader choice may each take their best
 * distinct legal completion. Every trigger may pass, capped targets may consume
 * the whole team parameter pool, and each component may use a different legal
 * completion. Special duration and Active opportunity checks retain the exact
 * aggregate model while using independently maximal activation-rate support.
 * These choices can only increase the modeled central utility because all current effect values are non-negative. The bound
 * is therefore suitable for pruning only when it is no lower than an incumbent;
 * it is not a predicted score and must never be presented as one.
 */
function boundNativeAggregateCentralUtilityInternal(
  input: NativeGlobalBoundInput,
  runtime?: BoundRuntime,
): NativeGlobalBoundResult {
  if (
    !["low-investment", "one-copy-maximum", "duplicate-enabled-ceiling"].includes(
      input.investmentLayer,
    )
  ) {
    throw new Error(`Unknown investment layer: ${String(input.investmentLayer)}`);
  }
  const eligibleMemberCardIds = unique(input.eligibleMemberCardIds, "Eligible Member IDs");
  const partialMemberCardIds = unique(input.partialMemberCardIds, "Partial Member IDs");
  const declaredLeaderCardIds = unique(
    input.eligibleLeaderOutfitCardIds,
    "Leader/Outfit IDs",
  );
  const leaderCardIds = runtime?.leaderCardIds ?? declaredLeaderCardIds;
  const chartKeys = unique(input.chartKeys, "Chart keys");
  if (declaredLeaderCardIds.length === 0) throw new Error("At least one Leader/Outfit is required");
  if (chartKeys.length === 0) throw new Error("At least one aggregate chart is required");
  if (partialMemberCardIds.length > TEAM_SIZE) {
    throw new Error("A partial selection cannot contain more than five Members");
  }
  const maxFiveStarMembers = input.maxFiveStarMembers ?? TEAM_SIZE;
  if (
    !Number.isInteger(maxFiveStarMembers) ||
    maxFiveStarMembers < 0 ||
    maxFiveStarMembers > TEAM_SIZE
  ) {
    throw new Error("maxFiveStarMembers must be an integer from 0 through 5");
  }
  const eligibleSet = new Set(eligibleMemberCardIds);
  if (partialMemberCardIds.some((cardId) => !eligibleSet.has(cardId))) {
    throw new Error("Every partial Member must be eligible");
  }
  const chartByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));
  const songById = new Map(songContextData.songs.map((song) => [song.id, song]));
  const compiledCharts = new Map<string, CompiledChart>();
  for (const chartKey of chartKeys) {
    const compiled = runtime?.charts.get(chartKey);
    if (compiled) {
      compiledCharts.set(chartKey, compiled);
      continue;
    }
    const chart = chartByKey.get(chartKey);
    if (!chart || chart.fidelity !== "aggregate") throw new Error(`Global bound requires an aggregate chart: ${chartKey}`);
    const song = songById.get(chart.songId);
    if (!song) throw new Error(`Aggregate chart has no pinned song: ${chartKey}`);
    compiledCharts.set(chartKey, {
      chartKey,
      noteCount: chart.fullComboNoteCount,
      durationMilliseconds: song.playingMilliseconds,
      songSingerTalentIds: song.singerTalentIds,
      checkHistogramByCardId: new Map(),
    });
  }

  const bloomStageByCardId = input.bloomStageByCardId ?? {};
  for (const [cardId, stage] of Object.entries(bloomStageByCardId)) {
    if (!mechanicsCardById.has(cardId)) throw new Error(`Unknown Bloom-stage card: ${cardId}`);
    assertBloomStage(stage);
  }
  const cards = eligibleMemberCardIds.map((cardId) => {
    const compiled = runtime?.cardById.get(cardId);
    if (compiled) return compiled;
    return boundCard(cardId, input.investmentLayer, bloomStageByCardId[cardId]);
  });
  const cardById = new Map(cards.map((card) => [card.cardId, card]));
  const selected = partialMemberCardIds.map((cardId) => cardById.get(cardId)!);
  if (new Set(selected.map((card) => card.talentId)).size !== selected.length) {
    throw new Error("Partial Members must have unique talents");
  }
  const selectedTalents = new Set(selected.map((card) => card.talentId));
  const selectedFiveStars = selected.filter((card) => card.rarity === 5).length;
  if (selectedFiveStars > maxFiveStarMembers) {
    throw new Error("The partial selection exceeds maxFiveStarMembers");
  }
  const remaining = cards.filter((card) => !selectedTalents.has(card.talentId));
  const remainingSlots = TEAM_SIZE - selected.length;
  const remainingFiveStarSlots = maxFiveStarMembers - selectedFiveStars;
  const triggerContexts = [...compiledCharts.values()].map((chart) => ({
    selected,
    remaining,
    remainingSlots,
    leaderCardIds,
    chart,
    facts: triggerFacts(selected, remaining, remainingSlots, leaderCardIds),
  }));

  const baseParameters = optimisticCompletionSum(
    selected,
    remaining,
    remainingSlots,
    remainingFiveStarSlots,
    (card) => card.baseParameters,
  );
  const possibleRecipients = remainingSlots === 0 ? selected : [...selected, ...remaining];
  // Keep each source card paired with its own base parameters while relaxing
  // recipient allocation over the possible roster. The previous two
  // independent DPs could choose the five highest base cards and a different
  // five highest passive sources, materially widening the bound. This is still
  // an upper bound: every completed team has exactly one value for the paired
  // callback, while its capped recipients are allowed to come from the full
  // possible recipient pool.
  const baseAndMemberParameterUpper =
    remainingSlots === 0
      ? selected.reduce(
          (total, card) =>
            total +
            card.baseParameters +
            parameterApplicationCompleteCentral(
              possibleApplicationsInAnyChart(card.passiveApplications, triggerContexts),
              selected,
              card,
            ),
          0,
        )
      : optimisticCompletionSum(
          selected,
          remaining,
          remainingSlots,
          remainingFiveStarSlots,
          (card) =>
            card.baseParameters +
            parameterApplicationUpper(
              possibleApplicationsInAnyChart(card.passiveApplications, triggerContexts),
              possibleRecipients,
              card,
            ),
        );
  const memberParameterEffects = baseAndMemberParameterUpper - baseParameters;
  const leaderParameterEffects = Math.max(
    ...triggerContexts.map((context) =>
      remainingSlots === 0
        ? Math.max(
            ...leaderCardIds.map((cardId) => {
              const leader = mechanicsCardById.get(cardId);
              if (!leader) throw new Error(`Unknown Leader/Outfit card: ${cardId}`);
              return parameterApplicationCompleteCentral(
                possibleApplications(leader.leaderOutfit.applications, context),
                selected,
                null,
              );
            }),
          )
        : leaderParameterMaximum(leaderCardIds, possibleRecipients, context),
    ),
  );
  const parameterEffects = memberParameterEffects + leaderParameterEffects;
  const parameterEffectPermil = (parameterEffects * 1_000) / baseParameters;

  const memberSupportPermil = optimisticCompletionSum(
    selected,
    remaining,
    remainingSlots,
    remainingFiveStarSlots,
    (card) =>
      sumEffects(
        possibleApplicationsInAnyChart(card.passiveApplications, triggerContexts),
        new Set(["active-skill-effect-up"]),
      ),
  );
  const leaderSupportPermil = Math.max(
    ...triggerContexts.map((context) =>
      leaderEffectMaximum(
        leaderCardIds,
        new Set(["active-skill-effect-up"]),
        context,
      ),
    ),
  );
  const persistentSupportPermil = memberSupportPermil + leaderSupportPermil;
  const activeScoreUpPermil = optimisticCompletionMaximum(
    selected,
    remaining,
    remainingSlots,
    remainingFiveStarSlots,
    (card) =>
      Math.max(
        ...triggerContexts.map((context) =>
          maximumActiveScoreUp(possibleApplications(card.activeApplications, context)),
        ),
      ),
  );
  const chartBounds = chartKeys.map((chartKey) => {
    const chart = compiledCharts.get(chartKey)!;
    const triggerContext = triggerContexts.find((context) => context.chart.chartKey === chartKey)!;
    const durationCoverage = (card: BoundCard): number =>
      Math.min(1, card.specialDurationMilliseconds / chart.durationMilliseconds);
    const specialScoreSupportPermil = optimisticCompletionSum(
      selected,
      remaining,
      remainingSlots,
      remainingFiveStarSlots,
      (card) =>
        sumEffects(
          possibleApplications(card.specialApplications, triggerContext),
          new Set(["score-support"]),
        ) * durationCoverage(card),
    );
    const activationRateUpPermil = optimisticCompletionSum(
      selected,
      remaining,
      remainingSlots,
      remainingFiveStarSlots,
      (card) =>
        sumEffects(
          possibleApplications(card.specialApplications, triggerContext),
          new Set(["activation-rate-up"]),
        ) * durationCoverage(card),
    );
    let maximumActiveScoreUpPermil = activeScoreUpPermil;
    let probabilityWeightedActiveScoreUpPermil: number;
    let activeAndSpecialPermil: number;
    if (remainingSlots === 0) {
      const entries = selected.map((card) => {
        const persistent = completeTeamPersistentSupportUpper(
          selected,
          card,
          leaderCardIds,
          triggerContext,
        );
        const exactPossibleActiveScoreUp = maximumActiveScoreUp(
          possibleApplications(card.activeApplications, triggerContext),
        );
        const effectiveScoreUp =
          (exactPossibleActiveScoreUp *
            (1_000 + persistent + specialScoreSupportPermil)) /
          1_000;
        return {
          effectiveScoreUp,
          coverage: averageActiveCoverage(
            card,
            activationRateUpPermil,
            chart.noteCount,
            chart.durationMilliseconds,
            chart.checkHistogramByCardId.get(card.cardId),
          ),
        };
      });
      maximumActiveScoreUpPermil = Math.max(
        0,
        ...entries.map((entry) => entry.effectiveScoreUp),
      );
      probabilityWeightedActiveScoreUpPermil = entries.reduce(
        (total, entry) => total + entry.coverage * entry.effectiveScoreUp,
        0,
      );
      activeAndSpecialPermil = Math.min(
        maximumActiveScoreUpPermil,
        probabilityWeightedActiveScoreUpPermil,
      );
    } else {
      const possibleActiveCards = [...selected, ...remaining];
      const effectiveActiveScoreUp = (card: BoundCard): number => {
        const scoreUp = maximumActiveScoreUp(
          possibleApplications(card.activeApplications, triggerContext),
        );
        if (scoreUp <= 0) return 0;
        const memberAndSpecialSupportPermil = forcedCompletionSum(
          card,
          selected,
          remaining,
          remainingSlots,
          remainingFiveStarSlots,
          (specialCard) =>
            supportForRecipient(
              possibleApplications(specialCard.passiveApplications, triggerContext),
              card,
              specialCard,
            ) +
            sumEffects(
              possibleApplications(specialCard.specialApplications, triggerContext),
              new Set(["score-support"]),
            ) * durationCoverage(specialCard),
        );
        if (!Number.isFinite(memberAndSpecialSupportPermil)) return 0;
        const leaderSupportPermil = Math.max(
          ...leaderCardIds.map((leaderCardId) => {
            const leader = mechanicsCardById.get(leaderCardId);
            if (!leader) throw new Error(`Unknown Leader/Outfit card: ${leaderCardId}`);
            return supportForRecipient(
              possibleApplications(leader.leaderOutfit.applications, triggerContext),
              card,
              null,
            );
          }),
        );
        return (scoreUp * (1_000 + memberAndSpecialSupportPermil + leaderSupportPermil)) / 1_000;
      };
      const activeEntries = possibleActiveCards.map((card) => {
        const cardActivationRateUpPermil = forcedCompletionSum(
          card,
          selected,
          remaining,
          remainingSlots,
          remainingFiveStarSlots,
          (specialCard) =>
            sumEffects(
              possibleApplications(specialCard.specialApplications, triggerContext),
              new Set(["activation-rate-up"]),
            ) * durationCoverage(specialCard),
        );
        const effectiveScoreUp = effectiveActiveScoreUp(card);
        const scoreUp = maximumActiveScoreUp(
          possibleApplications(card.activeApplications, triggerContext),
        );
        return {
          card,
          scoreUp,
          value: effectiveScoreUp,
          probability:
            Number.isFinite(cardActivationRateUpPermil) && effectiveScoreUp > 0
              ? averageActiveCoverage(
                  card,
                  cardActivationRateUpPermil,
                  chart.noteCount,
                  chart.durationMilliseconds,
                  chart.checkHistogramByCardId.get(card.cardId),
                )
              : 0,
        };
      });
      maximumActiveScoreUpPermil = Math.max(0, ...activeEntries.map((entry) => entry.value));
      const soloEntries = activeEntries.map((entry) => ({
        value: entry.scoreUp,
        probability: entry.probability,
      }));
      const relaxedSolo = relaxedExpectedMaximumUpper(soloEntries);
      const leaderSupportUpper = optimisticCompletionSum(
        selected,
        remaining,
        remainingSlots,
        remainingFiveStarSlots,
        (card) => {
          const entry = activeEntries.find((candidate) => candidate.card.cardId === card.cardId);
          if (!entry) return 0;
          const leaderMaximum = Math.max(
            ...leaderCardIds.map((leaderCardId) => {
              const leader = mechanicsCardById.get(leaderCardId);
              if (!leader) throw new Error(`Unknown Leader/Outfit card: ${leaderCardId}`);
              return supportForRecipient(
                possibleApplications(leader.leaderOutfit.applications, triggerContext),
                card,
                null,
              );
            }),
          );
          return (entry.scoreUp * entry.probability * leaderMaximum) / 1_000;
        },
      );
      const memberSupportUpper = optimisticCompletionSum(
        selected,
        remaining,
        remainingSlots,
        remainingFiveStarSlots,
        (source) => {
          const sourceApplications = possibleApplications(source.passiveApplications, triggerContext);
          const targetValues = activeEntries
            .map((entry) =>
              (entry.scoreUp * entry.probability *
                supportForRecipient(sourceApplications, entry.card, source)) /
              1_000,
            )
            .sort((left, right) => right - left)
            .slice(0, TEAM_SIZE);
          return targetValues.reduce((sum, value) => sum + value, 0);
        },
      );
      const totalQ = [...activeEntries]
        .map((entry) => entry.scoreUp * entry.probability)
        .sort((left, right) => right - left)
        .slice(0, TEAM_SIZE)
        .reduce((sum, value) => sum + value, 0);
      const specialSupportUpper = (relaxedSolo * specialScoreSupportPermil) / 1_000;
      const additiveUpper =
        relaxedSolo + leaderSupportUpper + memberSupportUpper + specialSupportUpper;
      probabilityWeightedActiveScoreUpPermil = Math.min(
        legalExpectedMaximumUpper(
          activeEntries,
          selected,
          remaining,
          remainingSlots,
          remainingFiveStarSlots,
        ),
        additiveUpper,
      );
      activeAndSpecialPermil = Math.min(
        maximumActiveScoreUpPermil,
        probabilityWeightedActiveScoreUpPermil,
      );
    }
    return {
      chartKey,
      specialScoreSupportPermil: ceilSix(specialScoreSupportPermil),
      activationRateUpPermil: ceilSix(activationRateUpPermil),
      maximumActiveScoreUpPermil: ceilSix(maximumActiveScoreUpPermil),
      probabilityWeightedActiveScoreUpPermil: ceilSix(
        probabilityWeightedActiveScoreUpPermil,
      ),
      activeAndSpecialPermil: ceilSix(activeAndSpecialPermil),
      activeAndSpecial: ceilSix((baseParameters * activeAndSpecialPermil) / 1_000),
    };
  });
  const activeAndSpecial =
    chartBounds.reduce((total, chart) => total + chart.activeAndSpecial, 0) /
    chartBounds.length;
  const upperCentralUtility = ceilSix(baseParameters + parameterEffects + activeAndSpecial);

  return {
    kind: "native-global-optimistic-bound",
    methodologyVersion: "yd-native-global-bound-1.0.0",
    upperCentralUtility,
    partialMemberCardIds,
    remainingSlots,
    remainingFiveStarSlots,
    chartKeys,
    components: {
      baseParameters,
      parameterEffectPermil,
      parameterEffects: ceilSix(parameterEffects),
      activeScoreUpPermil,
      persistentSupportPermil,
      maximumSpecialScoreSupportPermil: Math.max(
        ...chartBounds.map((chart) => chart.specialScoreSupportPermil),
      ),
      activeAndSpecial: ceilSix(activeAndSpecial),
      byChart: chartBounds,
    },
    relaxation: {
      triggers: "all-pass",
      recipientTargets: "full-team-parameter-cap",
      activeProbability: "maximum-special-activation-rate",
      specialDuration: "exact-duration-weighted",
      componentCompletions: "independent",
    },
  };
}

/** Compile invariant card, Leader, chart, and Active-opportunity data once. */
export function compileNativeGlobalBoundContext(
  input: NativeGlobalBoundCompileInput,
): NativeGlobalBoundContext {
  const eligibleMemberCardIds = unique(input.eligibleMemberCardIds, "Eligible Member IDs");
  const eligibleLeaderOutfitCardIds = unique(
    input.eligibleLeaderOutfitCardIds,
    "Leader/Outfit IDs",
  );
  const chartKeys = unique(input.chartKeys, "Chart keys");
  if (eligibleLeaderOutfitCardIds.length === 0) {
    throw new Error("At least one Leader/Outfit is required");
  }
  if (chartKeys.length === 0) throw new Error("At least one aggregate chart is required");
  const bloomStageByCardId = input.bloomStageByCardId ?? {};
  for (const [cardId, stage] of Object.entries(bloomStageByCardId)) {
    if (!mechanicsCardById.has(cardId)) throw new Error(`Unknown Bloom-stage card: ${cardId}`);
    assertBloomStage(stage);
  }
  const cards = eligibleMemberCardIds.map((cardId) =>
    boundCard(cardId, input.investmentLayer, bloomStageByCardId[cardId]),
  );
  const cardById = new Map(cards.map((card) => [card.cardId, card]));
  const chartByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));
  const songById = new Map(songContextData.songs.map((song) => [song.id, song]));
  const charts = new Map<string, CompiledChart>();
  for (const chartKey of chartKeys) {
    const chart = chartByKey.get(chartKey);
    if (!chart || chart.fidelity !== "aggregate") {
      throw new Error(`Global bound requires an aggregate chart: ${chartKey}`);
    }
    const song = songById.get(chart.songId);
    if (!song) throw new Error(`Aggregate chart has no pinned song: ${chartKey}`);
    charts.set(chartKey, {
      chartKey,
      noteCount: chart.fullComboNoteCount,
      durationMilliseconds: song.playingMilliseconds,
      songSingerTalentIds: song.singerTalentIds,
      checkHistogramByCardId: new Map(
        cards.map((card) => [
          card.cardId,
          activeCheckHistogram(card, chart.fullComboNoteCount, song.playingMilliseconds),
        ]),
      ),
    });
  }
  const equivalence = compileNativeLeaderEquivalence({ eligibleLeaderOutfitCardIds });
  const leaderRepresentativeCardIds = equivalence.classes.map(
    (group) => group.representativeCardId,
  );
  const runtime: BoundRuntime = {
    cardById,
    leaderCardIds: leaderRepresentativeCardIds,
    charts,
  };
  const rootSet = new Set(eligibleMemberCardIds);
  const leaderRootSet = new Set(eligibleLeaderOutfitCardIds);
  const leaderRepresentativeByCardId = new Map(
    equivalence.classes.flatMap((group) =>
      group.eligibleCardIds.map((cardId) => [cardId, group.representativeCardId] as const),
    ),
  );
  return {
    kind: "compiled-native-global-bound-context",
    methodologyVersion: "yd-native-global-bound-compiled-1.0.0",
    eligibleMemberCardIds,
    eligibleLeaderOutfitCardIds,
    leaderRepresentativeCardIds,
    leaderEquivalenceCounts: equivalence.counts,
    chartKeys,
    bound(request) {
      const narrowed = request.eligibleMemberCardIds ?? eligibleMemberCardIds;
      if (narrowed.some((cardId) => !rootSet.has(cardId))) {
        throw new Error("A compiled bound context cannot expand its eligible Member roster");
      }
      const narrowedLeaders = request.eligibleLeaderOutfitCardIds ?? eligibleLeaderOutfitCardIds;
      if (narrowedLeaders.some((cardId) => !leaderRootSet.has(cardId))) {
        throw new Error("A compiled bound context cannot expand its eligible Leader roster");
      }
      const narrowedRuntime: BoundRuntime = {
        ...runtime,
        leaderCardIds: [
          ...new Set(narrowedLeaders.map((cardId) => leaderRepresentativeByCardId.get(cardId)!)),
        ],
      };
      return boundNativeAggregateCentralUtilityInternal(
        {
          partialMemberCardIds: request.partialMemberCardIds,
          eligibleMemberCardIds: narrowed,
          eligibleLeaderOutfitCardIds: narrowedLeaders,
          investmentLayer: input.investmentLayer,
          ...(input.bloomStageByCardId
            ? { bloomStageByCardId: input.bloomStageByCardId }
            : {}),
          ...(input.maxFiveStarMembers === undefined
            ? {}
            : { maxFiveStarMembers: input.maxFiveStarMembers }),
          chartKeys,
        },
        narrowedRuntime,
      );
    },
  };
}

/** One-shot compatibility API; repeated searches should compile a context. */
export function boundNativeAggregateCentralUtility(
  input: NativeGlobalBoundInput,
): NativeGlobalBoundResult {
  return boundNativeAggregateCentralUtilityInternal(input);
}
