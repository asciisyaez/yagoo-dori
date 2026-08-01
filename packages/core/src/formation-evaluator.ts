import {
  mechanicsCardById,
  mechanicsData,
  type CardMechanics,
} from "./mechanics";
import { publicCardById, type PublicCard } from "./public-data";
import {
  calculateSpecialOrderBreakpoints,
  chartClaimCapabilities,
  songContextData,
  type ChartClaimCapabilities,
  type ChartContext,
  type SongContext,
  type SpecialOrderBreakpoint,
} from "./song-contexts";

export type EvidenceGrade = "verified" | "corroborated" | "modeled" | "unresolved";

export type EvidenceAssessment = {
  grade: EvidenceGrade;
  ruleId: string;
  statement: string;
  sourceRefs: readonly string[];
};

export type InvestmentLayer =
  | "low-investment"
  | "one-copy-maximum"
  | "duplicate-enabled-ceiling";

export type BloomStage = 0 | 1 | 2 | 3 | 4 | 5;

export type FormationMember = {
  cardId: string;
  investment: InvestmentLayer;
  /**
   * Exact owned-card Bloom progression. When present, this takes precedence over
   * the broad investment lens while retaining that lens for backwards-compatible
   * reporting and callers that do not model individual ownership.
   */
  bloomStage?: BloomStage;
};

export type FormationInput = {
  leaderOutfitCardId: string;
  members: readonly FormationMember[];
};

export type CompiledFormationMember = FormationMember & {
  publicCard: PublicCard;
  mechanics: CardMechanics;
};

export type LegalFormation = {
  leaderOutfit: {
    cardId: string;
    publicCard: PublicCard;
    mechanics: CardMechanics;
    talentId: string;
  };
  members: readonly [
    CompiledFormationMember,
    CompiledFormationMember,
    CompiledFormationMember,
    CompiledFormationMember,
    CompiledFormationMember,
  ];
};

type InvestmentState = CardMechanics["progression"]["oneCopy"];
type ParameterName = "performance" | "technique" | "sense";

export type CardProgression = {
  layer: InvestmentLayer;
  bloomStage: BloomStage | null;
  evidenceGrade: "verified";
  state: InvestmentState;
  parameterBaseValue: number;
  liveDeckPowerPermyriadUp: number;
  parameters: Record<ParameterName, number>;
};

export type RuntimePolicy = Readonly<{
  mode: "verified-only" | "provisional";
  targetSelection: "enumerate";
  seed: number;
  simulationTrials: number;
}>;

export type FormationAccountState = Readonly<{
  board:
    | Readonly<{ mode: "unavailable" }>
    | Readonly<{
        mode: "declared-neutral";
        evidenceGrade: "verified" | "corroborated";
        evidenceRef: string;
      }>;
}>;

export type TriggerObservation = {
  combo?: number;
  life?: number;
  judgement?: "miss" | "bad" | "good" | "great" | "perfect" | "perfect-plus" | "auto";
  songSingerTalentIds?: readonly string[];
};

export type SkillApplication =
  CardMechanics["skills"]["active"][number]["applications"][number];
export type SkillTarget = NonNullable<SkillApplication["target"]>;
export type TriggerResult = boolean | "unresolved";

export type ApplicationResolution = {
  status: "resolved" | "provisional";
  alternatives: SkillApplication[][];
};

export type TargetRecipientResolution = {
  status: "resolved" | "enumerated";
  evidenceGrade: "verified" | "unresolved";
  eligibleMemberIndexes: number[];
  alternatives: number[][];
  recipientCount: { minimum: number; maximum: number };
  recipientIntervalByMember: Array<{
    memberIndex: number;
    minimum: 0 | 1;
    maximum: 0 | 1;
  }>;
};

export type ActiveCheckInput = {
  cardId: string;
  cooldownMilliseconds: number;
  durationMilliseconds: number;
  activationProbabilityPermil: number;
};

export type ModeledActiveSimulation = {
  status: "provisional";
  evidenceGrade: "modeled";
  seed: number;
  trials: number;
  liveDurationMilliseconds: number;
  assumptions: {
    firstCheck: "one-cooldown-after-live-start";
    collisions: "independent-unstacked";
  };
  members: Array<{
    cardId: string;
    checksPerTrial: number;
    meanActivations: number;
    meanNominalActiveMilliseconds: number;
  }>;
};

type ContributionSource = "leader" | "passive" | "active" | "special";

export type EffectContribution = {
  source: ContributionSource;
  sourceCardId: string;
  sourceMemberIndex: number | null;
  effectGroupId: string;
  effectKind: NonNullable<SkillApplication["effect"]>["kind"] | null;
  value: number | null;
  unit: NonNullable<SkillApplication["effect"]>["unit"] | null;
  evidenceGrade: EvidenceGrade;
  recipients: TargetRecipientResolution | null;
  recipientValueIntervalByMember: Array<{
    memberIndex: number;
    minimum: number;
    maximum: number;
  }>;
};

export type ConnectContribution = {
  sourceCardId: string;
  sourceMemberIndex: number;
  level: number;
  extentId: string;
  boardAmplificationPermil: number;
  appliedBoardContribution: 0 | null;
  recipients: null;
  evidenceGrade: "corroborated";
};

export type BoardContribution = {
  status: "unavailable" | "declared-neutral";
  appliedContribution: 0 | null;
  neutralContributionDeclared: boolean;
  evidenceGrade: "verified" | "corroborated" | "unresolved";
  evidenceRef: string | null;
};

export type FormationEvaluation = {
  status: "verified" | "provisional";
  absoluteScore: null;
  absoluteScoreAllowed: false;
  policy: RuntimePolicy;
  blockers: string[];
  context: {
    kind: "exact-chart";
    id: string;
    songId: string;
    songTitle: string;
    difficulty: ChartContext["difficulty"];
    fidelity: ChartContext["fidelity"];
    claimCapabilities: ChartClaimCapabilities;
  };
  evidence: {
    teamShape: EvidenceAssessment;
    uniqueMemberTalents: EvidenceAssessment;
    runtimeEquation: EvidenceAssessment;
    timeline: EvidenceAssessment;
    targetSelection: EvidenceAssessment;
    boardConnect: EvidenceAssessment;
  };
  leaderOutfitCardId: string;
  members: Array<{
    cardId: string;
    talentId: string;
    formationIndex: number;
    progression: CardProgression;
    connect: {
      level: number;
      valuePermil: number;
      extentId: string;
      evidenceGrade: "corroborated";
    };
  }>;
  contributions: {
    leader: EffectContribution[];
    passive: EffectContribution[];
    active: EffectContribution[];
    special: EffectContribution[];
    connect: ConnectContribution[];
    board: BoardContribution;
  };
  components: {
    accountState: {
      memberInvestments: Array<{
        cardId: string;
        layer: InvestmentLayer;
        bloomStage: BloomStage | null;
      }>;
      board: FormationAccountState["board"];
    };
    connectAndBoard: {
      applicationStatus: "unavailable" | "declared-neutral";
      boardCatalog: { effects: number; nodes: number };
      evidence: EvidenceAssessment;
    };
    targetCaps: {
      policy: "enumerate-all-eligible-subsets";
      enumeratedApplications: number;
      evidence: EvidenceAssessment;
    };
    stacking: {
      status: "unapplied";
      policy: "individual-effects-only";
      evidence: EvidenceAssessment;
    };
    timing: {
      activeChecks: "modeled" | "not-run";
      specialWindows: "verified" | "unavailable";
      timelineEvidence: EvidenceAssessment;
    };
    formationOrder: {
      memberCardIds: string[];
      specialResolution: "left-to-right";
      evidence: EvidenceAssessment;
    };
  };
  special: {
    currentOrder: string[];
    formations: string[][];
    windows: SpecialOrderBreakpoint[] | null;
    evidenceGrade: "corroborated";
  };
  activeSimulation: ModeledActiveSimulation | null;
};

export class FormationEvaluationBlockedError extends Error {
  readonly blockerIds: readonly string[];

  constructor(blockerIds: readonly string[]) {
    super(`Formation evaluation is blocked by unresolved runtime rules: ${blockerIds.join(", ")}`);
    this.name = "FormationEvaluationBlockedError";
    this.blockerIds = [...blockerIds];
  }
}

const PARAMETER_NAMES: readonly ParameterName[] = ["performance", "technique", "sense"];
const UINT32_MAX = 0xffff_ffff;

function assertSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new Error("A deterministic seed must be an unsigned 32-bit integer");
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

export function assertBloomStage(value: number): asserts value is BloomStage {
  if (!Number.isInteger(value) || value < 0 || value > 5) {
    throw new Error("Bloom stage must be an integer from 0 through 5");
  }
}

export function verifiedOnlyRuntimePolicy(seed: number): RuntimePolicy {
  assertSeed(seed);
  return {
    mode: "verified-only",
    targetSelection: "enumerate",
    seed,
    simulationTrials: 1,
  };
}

export function provisionalRuntimePolicy(seed: number, simulationTrials = 1_000): RuntimePolicy {
  assertSeed(seed);
  assertPositiveInteger(simulationTrials, "Simulation trials");
  return {
    mode: "provisional",
    targetSelection: "enumerate",
    seed,
    simulationTrials,
  };
}

function cardPair(cardId: string): { publicCard: PublicCard; mechanics: CardMechanics } {
  const publicCard = publicCardById.get(cardId);
  const mechanics = mechanicsCardById.get(cardId);
  if (!publicCard || !mechanics) {
    throw new Error(`Unknown Member or Leader/Outfit card: ${cardId}`);
  }
  if (publicCard.talentId !== mechanics.talentId) {
    throw new Error(`Public and mechanics talent IDs disagree for ${cardId}`);
  }
  return { publicCard, mechanics };
}

export function assertLegalFormation(input: FormationInput): LegalFormation {
  if (typeof input.leaderOutfitCardId !== "string" || input.leaderOutfitCardId.length === 0) {
    throw new Error("A formation requires exactly one Leader/Outfit");
  }
  if (input.members.length !== 5) {
    throw new Error(`A legal formation requires exactly five ordered Members; received ${input.members.length}`);
  }

  const leaderPair = cardPair(input.leaderOutfitCardId);
  const members = input.members.map((member) => {
    if (member.bloomStage !== undefined) assertBloomStage(member.bloomStage);
    const pair = cardPair(member.cardId);
    return { ...member, ...pair };
  });
  const talentIds = members.map((member) => member.publicCard.talentId);
  if (new Set(talentIds).size !== talentIds.length) {
    throw new Error("The five ordered Members must have unique talents");
  }

  return {
    leaderOutfit: {
      cardId: input.leaderOutfitCardId,
      ...leaderPair,
      talentId: leaderPair.mechanics.leaderOutfit.talentId,
    },
    members: members as unknown as LegalFormation["members"],
  };
}

function minimumSkillLevel(levels: readonly { level: number }[]): number {
  return Math.min(...levels.map((level) => level.level));
}

export function resolveCardInvestmentState(
  mechanics: CardMechanics,
  layer: InvestmentLayer,
  bloomStage?: BloomStage,
): InvestmentState {
  if (bloomStage !== undefined) {
    assertBloomStage(bloomStage);
    const state: InvestmentState = { ...mechanics.progression.oneCopy };
    const expectedKinds = {
      1: "active-skill-level-up",
      2: "all-parameters-up",
      3: "special-skill-level-up",
      4: "passive-skill-level-up",
      5: "connect-effect-level-up",
    } as const;
    for (let stage = 1; stage <= bloomStage; stage += 1) {
      const effects = mechanics.progression.potential.filter((effect) => effect.stage === stage);
      if (effects.length !== 1) {
        throw new Error(
          `${mechanics.cardId} Bloom ${stage} requires exactly one progression effect`,
        );
      }
      const effect = effects[0]!;
      const expectedKind = expectedKinds[stage as keyof typeof expectedKinds];
      if (effect.kind !== expectedKind) {
        throw new Error(
          `${mechanics.cardId} Bloom ${stage} must be ${expectedKind}; received ${effect.kind}`,
        );
      }
      if (effect.kind === "active-skill-level-up") state.activeSkillLevel = effect.value;
      else if (effect.kind === "all-parameters-up") state.allParameterPermilUp = effect.value;
      else if (effect.kind === "special-skill-level-up") state.specialSkillLevel = effect.value;
      else if (effect.kind === "passive-skill-level-up") state.passiveSkillLevel = effect.value;
      else if (effect.kind === "connect-effect-level-up") state.connectEffectLevel = effect.value;
    }
    return state;
  }
  if (layer === "one-copy-maximum") return { ...mechanics.progression.oneCopy };
  if (layer === "duplicate-enabled-ceiling") return { ...mechanics.progression.maxPotential };

  const firstLevel = mechanics.progression.levelCurve[0];
  if (!firstLevel) throw new Error(`${mechanics.cardId} has no progression levels`);
  return {
    level: firstLevel.level,
    activeSkillLevel: minimumSkillLevel(mechanics.skills.active),
    passiveSkillLevel: minimumSkillLevel(mechanics.skills.passive),
    specialSkillLevel: minimumSkillLevel(mechanics.skills.special),
    connectEffectLevel: minimumSkillLevel(mechanics.progression.connectEffect.levels),
    allParameterPermilUp: 0,
  };
}

function ceilDivide(numerator: number, denominator: number): number {
  return Math.floor((numerator + denominator - 1) / denominator);
}

export function calculateCardProgression(
  publicCard: PublicCard,
  mechanics: CardMechanics,
  layer: InvestmentLayer,
  bloomStage?: BloomStage,
): CardProgression {
  if (publicCard.id !== mechanics.cardId || publicCard.talentId !== mechanics.talentId) {
    throw new Error("Public card and mechanics record must identify the same card and talent");
  }

  const state = resolveCardInvestmentState(mechanics, layer, bloomStage);
  const level = mechanics.progression.levelCurve.find((candidate) => candidate.level === state.level);
  if (!level) throw new Error(`${mechanics.cardId} has no exact level-curve row for level ${state.level}`);

  const distributionPermil = Object.fromEntries(
    PARAMETER_NAMES.map((parameter) => [
      parameter,
      Math.round(publicCard.parameterDistribution[parameter] * 1_000),
    ]),
  ) as Record<ParameterName, number>;
  const totalDistribution = PARAMETER_NAMES.reduce(
    (total, parameter) => total + distributionPermil[parameter],
    0,
  );
  if (totalDistribution !== 1_000) {
    throw new Error(`${mechanics.cardId} parameter distribution is not an exact permil partition`);
  }

  const parameterMultiplierPermil = 1_000 + state.allParameterPermilUp;
  const parameters = Object.fromEntries(
    PARAMETER_NAMES.map((parameter) => [
      parameter,
      ceilDivide(
        level.parameterBaseValue * distributionPermil[parameter] * parameterMultiplierPermil,
        1_000_000,
      ),
    ]),
  ) as Record<ParameterName, number>;

  const pinnedParameters =
    bloomStage === 0 || (bloomStage === undefined && layer === "one-copy-maximum")
      ? publicCard.parameters.oneCopyMaxLevel
      : bloomStage === 5 || (bloomStage === undefined && layer === "duplicate-enabled-ceiling")
        ? publicCard.parameters.maxPotential
        : null;
  if (
    pinnedParameters &&
    PARAMETER_NAMES.some((parameter) => parameters[parameter] !== pinnedParameters[parameter])
  ) {
    throw new Error(`${mechanics.cardId} calculated parameters drifted from the pinned public record`);
  }

  return {
    layer,
    bloomStage: bloomStage ?? null,
    evidenceGrade: "verified",
    state,
    parameterBaseValue: level.parameterBaseValue,
    liveDeckPowerPermyriadUp: level.liveDeckPowerPermyriadUp,
    parameters,
  };
}

function normalizeGroupingName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function cardBelongsToCharacterGrouping(
  card: PublicCard,
  characterGroupingId: string,
): boolean {
  if (characterGroupingId === "grp-indonesia") {
    return card.branch === "hololive Indonesia";
  }

  const raw = characterGroupingId.replace(/^grp-/, "");
  const indonesiaGeneration = /^indonesia-gen_(\d+)$/.exec(raw);
  const generation = /^gen_(\d+)$/.exec(raw);
  const expectedName = indonesiaGeneration
    ? `ID Gen ${indonesiaGeneration[1]}`
    : generation
      ? `Gen ${generation[1]}`
      : raw;
  return card.groups.some(
    (group) => normalizeGroupingName(group) === normalizeGroupingName(expectedName),
  );
}

function requiredNumber(value: number | null, triggerId: string): number | "unresolved" {
  return value === null ? "unresolved" : value;
}

const JUDGEMENT_ORDER: readonly NonNullable<TriggerObservation["judgement"]>[] = [
  "miss",
  "bad",
  "good",
  "great",
  "perfect",
  "perfect-plus",
  "auto",
];

function normalizedTriggerJudgement(value: string): TriggerObservation["judgement"] | undefined {
  const suffix = value.toLowerCase().split("_").at(-1)?.replace("plus", "-plus");
  return JUDGEMENT_ORDER.find((judgement) => judgement === suffix);
}

export function evaluateTrigger(
  trigger: NonNullable<SkillApplication["trigger"]>,
  formation: LegalFormation,
  observation: TriggerObservation,
): TriggerResult {
  const members = formation.members;
  const threshold = requiredNumber(trigger.threshold, trigger.id);

  switch (trigger.kind) {
    case "combo-at-least":
      return observation.combo === undefined || threshold === "unresolved"
        ? "unresolved"
        : observation.combo >= threshold;
    case "deck-attribute-count":
      return threshold === "unresolved" || !trigger.attribute
        ? "unresolved"
        : members.filter((member) => member.publicCard.attribute === trigger.attribute).length >=
            threshold;
    case "deck-character-group-count":
      return threshold === "unresolved" || !trigger.characterGroupingId
        ? "unresolved"
        : members.filter((member) =>
              cardBelongsToCharacterGrouping(member.publicCard, trigger.characterGroupingId!),
            ).length >= threshold;
    case "leader-character":
      return trigger.characterIds.includes(formation.leaderOutfit.talentId);
    case "leader-character-group":
      return !trigger.characterGroupingId
        ? "unresolved"
        : cardBelongsToCharacterGrouping(
            formation.leaderOutfit.publicCard,
            trigger.characterGroupingId,
          );
    case "judgement-at-least": {
      const required = trigger.judgementType
        ? normalizedTriggerJudgement(trigger.judgementType)
        : undefined;
      if (!observation.judgement || !required) return "unresolved";
      return JUDGEMENT_ORDER.indexOf(observation.judgement) >= JUDGEMENT_ORDER.indexOf(required);
    }
    case "life-at-least":
      return observation.life === undefined || threshold === "unresolved"
        ? "unresolved"
        : observation.life >= threshold;
    case "life-at-most":
      return observation.life === undefined || threshold === "unresolved"
        ? "unresolved"
        : observation.life <= threshold;
    case "music-character":
      return observation.songSingerTalentIds === undefined
        ? "unresolved"
        : trigger.characterIds.some((talentId) =>
            observation.songSingerTalentIds!.includes(talentId),
          );
  }
}

function applicationIdentity(application: SkillApplication): string {
  return [
    application.channel,
    application.combination,
    application.effectGroupId,
    application.triggerGroupId ?? "",
  ].join("|");
}

function deduplicateApplicationAlternatives(
  alternatives: readonly SkillApplication[][],
): SkillApplication[][] {
  const seen = new Set<string>();
  return alternatives.filter((alternative) => {
    const key = alternative.map(applicationIdentity).join(";");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function triggerAssignments(triggerIds: readonly string[]): Array<Map<string, boolean>> {
  return triggerIds.reduce<Array<Map<string, boolean>>>(
    (assignments, triggerId) =>
      assignments.flatMap((assignment) => [
        new Map([...assignment, [triggerId, false]]),
        new Map([...assignment, [triggerId, true]]),
      ]),
    [new Map()],
  );
}

function resolveApplications(
  applications: readonly SkillApplication[],
  formation: LegalFormation,
  observation: TriggerObservation,
  activeOverrideSemantics: boolean,
): ApplicationResolution {
  const resultByTriggerId = new Map<string, TriggerResult>();
  for (const application of applications) {
    if (application.triggerGroupId && application.trigger) {
      resultByTriggerId.set(
        application.triggerGroupId,
        evaluateTrigger(application.trigger, formation, observation),
      );
    }
  }
  const unresolvedTriggerIds = [...resultByTriggerId.entries()]
    .filter(([, result]) => result === "unresolved")
    .map(([triggerId]) => triggerId);
  const assignments = triggerAssignments(unresolvedTriggerIds);

  const alternatives = assignments.map((assignment) => {
    const included: SkillApplication[] = [];
    for (const application of applications) {
      const triggerResult = application.triggerGroupId
        ? resultByTriggerId.get(application.triggerGroupId)
        : true;
      const passes =
        triggerResult === "unresolved"
          ? assignment.get(application.triggerGroupId!) === true
          : triggerResult !== false;
      if (!passes) continue;

      if (activeOverrideSemantics && application.combination === "conditional-override") {
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
    return included;
  });

  return {
    status: unresolvedTriggerIds.length === 0 ? "resolved" : "provisional",
    alternatives: deduplicateApplicationAlternatives(alternatives),
  };
}

export function resolveActiveApplications(
  applications: readonly SkillApplication[],
  formation: LegalFormation,
  observation: TriggerObservation,
): ApplicationResolution {
  return resolveApplications(applications, formation, observation, true);
}

export function resolveLeaderApplications(
  applications: readonly SkillApplication[],
  formation: LegalFormation,
  observation: TriggerObservation,
): ApplicationResolution {
  return resolveApplications(applications, formation, observation, false);
}

function combinations(values: readonly number[], size: number): number[][] {
  if (size === 0) return [[]];
  if (values.length < size) return [];
  const [head, ...tail] = values;
  return [
    ...combinations(tail, size - 1).map((rest) => [head!, ...rest]),
    ...combinations(tail, size),
  ];
}

export function resolveTargetRecipients(
  target: SkillTarget,
  members: LegalFormation["members"],
  sourceMemberIndex: number | null,
): TargetRecipientResolution {
  let eligibleMemberIndexes: number[];
  switch (target.kind) {
    case "all":
      eligibleMemberIndexes = members.map((_, index) => index);
      break;
    case "self":
      eligibleMemberIndexes =
        sourceMemberIndex !== null && sourceMemberIndex >= 0 && sourceMemberIndex < members.length
          ? [sourceMemberIndex]
          : [];
      break;
    case "attribute":
      eligibleMemberIndexes = members
        .map((member, index) => ({ member, index }))
        .filter(({ member }) => member.publicCard.attribute === target.attribute)
        .map(({ index }) => index);
      break;
    case "character-group":
      eligibleMemberIndexes = !target.characterGroupingId
        ? []
        : members
            .map((member, index) => ({ member, index }))
            .filter(({ member }) =>
              cardBelongsToCharacterGrouping(member.publicCard, target.characterGroupingId!),
            )
            .map(({ index }) => index);
      break;
  }

  const selectedCount =
    target.count === null
      ? eligibleMemberIndexes.length
      : Math.min(target.count, eligibleMemberIndexes.length);
  const alternatives = combinations(eligibleMemberIndexes, selectedCount);
  const status = alternatives.length > 1 ? "enumerated" : "resolved";
  const recipientCounts = alternatives.map((alternative) => alternative.length);

  return {
    status,
    evidenceGrade: status === "enumerated" ? "unresolved" : "verified",
    eligibleMemberIndexes,
    alternatives,
    recipientCount: {
      minimum: Math.min(...recipientCounts),
      maximum: Math.max(...recipientCounts),
    },
    recipientIntervalByMember: members.map((_, memberIndex) => ({
      memberIndex,
      minimum: alternatives.every((alternative) => alternative.includes(memberIndex)) ? 1 : 0,
      maximum: alternatives.some((alternative) => alternative.includes(memberIndex)) ? 1 : 0,
    })),
  };
}

export function enumerateSpecialOrders<T>(orderedMembers: readonly T[]): T[][] {
  if (orderedMembers.length !== 5) {
    throw new Error("Special order enumeration requires exactly five ordered Members");
  }
  const permute = (values: readonly T[]): T[][] => {
    if (values.length === 0) return [[]];
    return values.flatMap((value, index) =>
      permute([...values.slice(0, index), ...values.slice(index + 1)]).map((rest) => [
        value,
        ...rest,
      ]),
    );
  };
  return permute(orderedMembers);
}

function deterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function simulateModeledActiveChecks(
  inputs: readonly ActiveCheckInput[],
  options: {
    liveDurationMilliseconds: number;
    trials: number;
    seed: number;
  },
): ModeledActiveSimulation {
  assertSeed(options.seed);
  assertPositiveInteger(options.trials, "Simulation trials");
  assertPositiveInteger(options.liveDurationMilliseconds, "Live duration");
  for (const input of inputs) {
    assertPositiveInteger(input.cooldownMilliseconds, `${input.cardId} cooldown`);
    if (!Number.isInteger(input.durationMilliseconds) || input.durationMilliseconds < 0) {
      throw new Error(`${input.cardId} duration must be a nonnegative integer`);
    }
    if (
      !Number.isInteger(input.activationProbabilityPermil) ||
      input.activationProbabilityPermil < 0 ||
      input.activationProbabilityPermil > 1_000
    ) {
      throw new Error(`${input.cardId} activation probability must be an integer permil`);
    }
  }

  const random = deterministicRandom(options.seed);
  const activations = inputs.map(() => 0);
  const checksPerTrial = inputs.map((input) =>
    Math.floor(options.liveDurationMilliseconds / input.cooldownMilliseconds),
  );
  for (let trial = 0; trial < options.trials; trial += 1) {
    for (const [inputIndex, input] of inputs.entries()) {
      for (let check = 0; check < checksPerTrial[inputIndex]!; check += 1) {
        if (random() * 1_000 < input.activationProbabilityPermil) {
          activations[inputIndex]! += 1;
        }
      }
    }
  }

  return {
    status: "provisional",
    evidenceGrade: "modeled",
    seed: options.seed,
    trials: options.trials,
    liveDurationMilliseconds: options.liveDurationMilliseconds,
    assumptions: {
      firstCheck: "one-cooldown-after-live-start",
      collisions: "independent-unstacked",
    },
    members: inputs.map((input, index) => {
      const meanActivations = activations[index]! / options.trials;
      return {
        cardId: input.cardId,
        checksPerTrial: checksPerTrial[index]!,
        meanActivations,
        meanNominalActiveMilliseconds: meanActivations * input.durationMilliseconds,
      };
    }),
  };
}

function evidenceForRule(ruleId: string, gradeOverride?: EvidenceGrade): EvidenceAssessment {
  const rule = mechanicsData.runtimeRules.find((candidate) => candidate.id === ruleId);
  if (!rule) throw new Error(`Missing runtime evidence rule: ${ruleId}`);
  return {
    grade: gradeOverride ?? rule.status,
    ruleId,
    statement: rule.statement,
    sourceRefs: rule.sourceRefs,
  };
}

function runtimeBlockers(chart: ChartContext): string[] {
  return mechanicsData.runtimeRules
    .filter(
      (rule) =>
        rule.status === "unresolved" &&
        rule.blocksScoring &&
        !(rule.id === "timed-note-events" && chart.fidelity === "timed"),
    )
    .map((rule) => rule.id);
}

function validateAccountState(accountState: FormationAccountState): void {
  if (
    accountState.board.mode === "declared-neutral" &&
    accountState.board.evidenceRef.trim().length === 0
  ) {
    throw new Error("A declared-neutral Board state requires a nonempty evidence reference");
  }
}

function contributionResolution(
  resolution: ApplicationResolution,
  source: ContributionSource,
  sourceCardId: string,
  sourceMemberIndex: number | null,
  members: LegalFormation["members"],
): EffectContribution[] {
  const applications = new Map<string, SkillApplication>();
  for (const alternative of resolution.alternatives) {
    for (const application of alternative) {
      applications.set(applicationIdentity(application), application);
    }
  }

  return [...applications.entries()].map(([identity, application]) => {
    const alwaysActive = resolution.alternatives.every((alternative) =>
      alternative.some((candidate) => applicationIdentity(candidate) === identity),
    );
    const baseRecipients = application.target
      ? resolveTargetRecipients(application.target, members, sourceMemberIndex)
      : null;
    const value = application.effect?.value ?? null;
    const recipientValueIntervalByMember = members.map((_, memberIndex) => {
      const recipientMinimum =
        alwaysActive && baseRecipients
          ? baseRecipients.recipientIntervalByMember[memberIndex]!.minimum
          : 0;
      const recipientMaximum = baseRecipients
        ? baseRecipients.recipientIntervalByMember[memberIndex]!.maximum
        : 0;
      return {
        memberIndex,
        minimum: value === null ? 0 : recipientMinimum * value,
        maximum: value === null ? 0 : recipientMaximum * value,
      };
    });
    const evidenceGrade: EvidenceGrade =
      !alwaysActive || baseRecipients?.evidenceGrade === "unresolved"
        ? "unresolved"
        : source === "leader" && application.channel === "additional"
          ? "verified"
          : "verified";

    return {
      source,
      sourceCardId,
      sourceMemberIndex,
      effectGroupId: application.effectGroupId,
      effectKind: application.effect?.kind ?? null,
      value,
      unit: application.effect?.unit ?? null,
      evidenceGrade,
      recipients: baseRecipients,
      recipientValueIntervalByMember,
    };
  });
}

function exactSkillLevel<T extends { level: number }>(
  levels: readonly T[],
  level: number,
  label: string,
): T {
  const result = levels.find((candidate) => candidate.level === level);
  if (!result) throw new Error(`${label} has no exact level ${level}`);
  return result;
}

export function evaluateFormation(
  input: FormationInput,
  options: {
    chart: ChartContext;
    song: SongContext;
    policy: RuntimePolicy;
    accountState: FormationAccountState;
    observation?: TriggerObservation;
  },
): FormationEvaluation {
  assertSeed(options.policy.seed);
  if (options.policy.targetSelection !== "enumerate") {
    throw new Error("Unresolved target selection must be enumerated");
  }
  if (options.chart.songId !== options.song.id) {
    throw new Error("Chart and song context must identify the same song");
  }
  validateAccountState(options.accountState);

  const legal = assertLegalFormation(input);
  const blockers = [
    ...runtimeBlockers(options.chart),
    ...(options.accountState.board.mode === "unavailable"
      ? ["board-account-state-unavailable"]
      : []),
  ];
  if (options.policy.mode === "verified-only" && blockers.length > 0) {
    throw new FormationEvaluationBlockedError(blockers);
  }

  const observation = options.observation ?? {};
  const memberEvaluations = legal.members.map((member, formationIndex) => {
    const progression = calculateCardProgression(
      member.publicCard,
      member.mechanics,
      member.investment,
      member.bloomStage,
    );
    const connect = exactSkillLevel(
      member.mechanics.progression.connectEffect.levels,
      progression.state.connectEffectLevel,
      `${member.cardId} Connect effect`,
    );
    return {
      member,
      formationIndex,
      progression,
      connect,
      active: exactSkillLevel(
        member.mechanics.skills.active,
        progression.state.activeSkillLevel,
        `${member.cardId} Active skill`,
      ),
      passive: exactSkillLevel(
        member.mechanics.skills.passive,
        progression.state.passiveSkillLevel,
        `${member.cardId} Passive skill`,
      ),
      special: exactSkillLevel(
        member.mechanics.skills.special,
        progression.state.specialSkillLevel,
        `${member.cardId} Special skill`,
      ),
    };
  });

  const leaderResolution = resolveLeaderApplications(
    legal.leaderOutfit.mechanics.leaderOutfit.applications,
    legal,
    observation,
  );
  const leaderContributions = contributionResolution(
    leaderResolution,
    "leader",
    legal.leaderOutfit.cardId,
    null,
    legal.members,
  );
  const passiveContributions = memberEvaluations.flatMap((member) =>
    contributionResolution(
      resolveLeaderApplications(member.passive.applications, legal, observation),
      "passive",
      member.member.cardId,
      member.formationIndex,
      legal.members,
    ),
  );
  const activeContributions = memberEvaluations.flatMap((member) =>
    contributionResolution(
      resolveActiveApplications(member.active.applications, legal, observation),
      "active",
      member.member.cardId,
      member.formationIndex,
      legal.members,
    ),
  );
  const specialContributions = memberEvaluations.flatMap((member) =>
    contributionResolution(
      resolveLeaderApplications(member.special.applications, legal, observation),
      "special",
      member.member.cardId,
      member.formationIndex,
      legal.members,
    ),
  );

  const activeInputs: ActiveCheckInput[] = memberEvaluations.flatMap((member) =>
    member.active.cooldownMilliseconds === null ||
    member.active.durationMilliseconds === null ||
    member.active.activationProbabilityPermil === null
      ? []
      : [
          {
            cardId: member.member.cardId,
            cooldownMilliseconds: member.active.cooldownMilliseconds,
            durationMilliseconds: member.active.durationMilliseconds,
            activationProbabilityPermil: member.active.activationProbabilityPermil,
          },
        ],
  );
  const activeSimulation =
    options.policy.mode === "provisional"
      ? simulateModeledActiveChecks(activeInputs, {
          liveDurationMilliseconds: options.song.playingMilliseconds,
          trials: options.policy.simulationTrials,
          seed: options.policy.seed,
        })
      : null;

  const boardContribution: BoardContribution =
    options.accountState.board.mode === "declared-neutral"
      ? {
          status: "declared-neutral",
          appliedContribution: 0,
          neutralContributionDeclared: true,
          evidenceGrade: options.accountState.board.evidenceGrade,
          evidenceRef: options.accountState.board.evidenceRef,
        }
      : {
          status: "unavailable",
          appliedContribution: null,
          neutralContributionDeclared: false,
          evidenceGrade: "unresolved",
          evidenceRef: null,
        };
  const connectContributions: ConnectContribution[] = memberEvaluations.map((member) => ({
    sourceCardId: member.member.cardId,
    sourceMemberIndex: member.formationIndex,
    level: member.connect.level,
    extentId: member.connect.extentId,
    boardAmplificationPermil: member.connect.valuePermil,
    appliedBoardContribution:
      options.accountState.board.mode === "declared-neutral" ? 0 : null,
    recipients: null,
    evidenceGrade: "corroborated",
  }));

  const currentOrder = legal.members.map((member) => member.cardId);
  const specialDurationByCardId = Object.fromEntries(
    memberEvaluations.map((member) => {
      if (member.special.durationMilliseconds === null) {
        throw new Error(`${member.member.cardId} Special skill has no exact duration`);
      }
      return [member.member.cardId, member.special.durationMilliseconds];
    }),
  );
  const specialWindows =
    options.chart.fidelity === "timed"
      ? calculateSpecialOrderBreakpoints(
          options.chart,
          currentOrder as [string, string, string, string, string],
          specialDurationByCardId,
        )
      : null;
  const timelineEvidence =
    options.chart.fidelity === "timed"
      ? evidenceForRule("timed-note-events", "verified")
      : evidenceForRule("timed-note-events");

  return {
    status: blockers.length === 0 ? "verified" : "provisional",
    absoluteScore: null,
    absoluteScoreAllowed: false,
    policy: options.policy,
    blockers,
    context: {
      kind: "exact-chart",
      id: options.chart.key,
      songId: options.song.id,
      songTitle: options.song.title,
      difficulty: options.chart.difficulty,
      fidelity: options.chart.fidelity,
      claimCapabilities: chartClaimCapabilities(
        options.chart,
        songContextData.validation.runtimeScoreEquation,
      ),
    },
    evidence: {
      teamShape: evidenceForRule("team-shape"),
      uniqueMemberTalents: evidenceForRule("unique-member-talents"),
      runtimeEquation:
        songContextData.validation.runtimeScoreEquation === "validated"
          ? evidenceForRule("runtime-score-equation", "verified")
          : evidenceForRule("runtime-score-equation"),
      timeline: timelineEvidence,
      targetSelection: evidenceForRule("passive-target-selection-order"),
      boardConnect: evidenceForRule("board-connect-amplification"),
    },
    leaderOutfitCardId: legal.leaderOutfit.cardId,
    members: memberEvaluations.map((member) => ({
      cardId: member.member.cardId,
      talentId: member.member.publicCard.talentId,
      formationIndex: member.formationIndex,
      progression: member.progression,
      connect: {
        level: member.connect.level,
        valuePermil: member.connect.valuePermil,
        extentId: member.connect.extentId,
        evidenceGrade: "corroborated",
      },
    })),
    contributions: {
      leader: leaderContributions,
      passive: passiveContributions,
      active: activeContributions,
      special: specialContributions,
      connect: connectContributions,
      board: boardContribution,
    },
    components: {
      accountState: {
        memberInvestments: legal.members.map((member) => ({
          cardId: member.cardId,
          layer: member.investment,
          bloomStage: member.bloomStage ?? null,
        })),
        board: options.accountState.board,
      },
      connectAndBoard: {
        applicationStatus: options.accountState.board.mode,
        boardCatalog: {
          effects: mechanicsData.catalogs.boardEffects.length,
          nodes: mechanicsData.catalogs.boardNodes.length,
        },
        evidence: evidenceForRule("board-connect-amplification"),
      },
      targetCaps: {
        policy: "enumerate-all-eligible-subsets",
        enumeratedApplications: [...leaderContributions, ...passiveContributions].filter(
          (contribution) => contribution.recipients?.status === "enumerated",
        ).length,
        evidence: evidenceForRule("passive-target-selection-order"),
      },
      stacking: {
        status: "unapplied",
        policy: "individual-effects-only",
        evidence: evidenceForRule("effect-stacking-and-rounding"),
      },
      timing: {
        activeChecks: activeSimulation ? "modeled" : "not-run",
        specialWindows: specialWindows ? "verified" : "unavailable",
        timelineEvidence,
      },
      formationOrder: {
        memberCardIds: currentOrder,
        specialResolution: "left-to-right",
        evidence: evidenceForRule("special-left-to-right-order"),
      },
    },
    special: {
      currentOrder,
      formations: enumerateSpecialOrders(currentOrder),
      windows: specialWindows,
      evidenceGrade: "corroborated",
    },
    activeSimulation,
  };
}

/** Formation simulation always requires, and returns, an exact evidence-backed chart context. */
export const simulateFormation = evaluateFormation;
