import {
  assertLegalFormation,
  evaluateFormation,
  provisionalRuntimePolicy,
  resolveCardInvestmentState,
  resolveActiveApplications,
  resolveLeaderApplications,
  type EvidenceGrade,
  type FormationMember,
  type FormationInput,
  type LegalFormation,
  type SkillApplication,
  type TriggerObservation,
} from "./formation-evaluator";
import {
  certifyCanonicalMicroUnitEnclosure,
  certifyCanonicalUtilityInterval,
  outwardBinary64Add,
  outwardBinary64DividePositive,
  outwardBinary64Max,
  outwardBinary64Min,
  outwardBinary64Multiply,
  outwardBinary64Subtract,
  pointBinary64Enclosure,
  transformRepeatedBinary64Addition,
  type Binary64Enclosure,
  type ExactOptimizerBulkFallbackReason,
  type OrderedReplayRequired,
} from "./exact-optimizer-bulk-accumulation";
import { fromCanonicalMicroUnits } from "./exact-optimizer-arithmetic";
import { mechanicsCardById, mechanicsData, type CardMechanics } from "./mechanics";
import { songContextData, type AggregateChartContext, type SongContext } from "./song-contexts";

export const STANDARD_MANUAL_AP_FULL_LIFE_CONTEXT_ID =
  "standard-manual-ap-full-life-v1" as const;
export const AGGREGATE_UNIFORM_NOTE_TIMING_MODEL_ID =
  "aggregate-uniform-note-timing-v1" as const;
export const AGGREGATE_SPECIAL_COVERAGE_MODEL_ID =
  "aggregate-special-duration-coverage-v1" as const;

export type UtilityInterval = {
  lower: number;
  central: number;
  upper: number;
};

/** Divide by a strictly-positive interval using every endpoint combination. */
export function divideUtilityIntervals(
  numerator: UtilityInterval,
  denominator: UtilityInterval,
): UtilityInterval {
  if (
    numerator.lower > numerator.central ||
    numerator.central > numerator.upper ||
    denominator.lower > denominator.central ||
    denominator.central > denominator.upper
  ) {
    throw new Error("Utility interval bounds must be ordered");
  }
  if (denominator.lower <= 0) {
    throw new Error("Utility interval division requires a strictly-positive denominator");
  }
  const endpointRatios = [
    numerator.lower / denominator.lower,
    numerator.lower / denominator.upper,
    numerator.upper / denominator.lower,
    numerator.upper / denominator.upper,
  ];
  return interval(
    Math.min(...endpointRatios),
    numerator.central / denominator.central,
    Math.max(...endpointRatios),
  );
}

export type NeutralBoardAccountState = Readonly<{
  board: Readonly<{
    mode: "declared-neutral";
    evidenceGrade: "verified" | "corroborated";
    evidenceRef: string;
  }>;
}>;

export type NativeUtilityInput = Readonly<{
  formation: FormationInput;
  chartKey: string;
  seed: number;
  accountState: NeutralBoardAccountState;
}>;

/**
 * Exact central value of the published aggregate utility interval. This
 * intentionally omits the evidence/component document and the lower/upper
 * attribution passes, making it suitable for exact-search screening. Its
 * equality with `evaluateNativeRelativeUtility(...).relativeUtility.central`
 * is a tested contract, not a second methodology.
 */
export function evaluateNativeCentralUtility(input: NativeUtilityInput): number {
  // Keep one reference operation/rounding path for the published central
  // objective. The interval evaluator below is the source of lower/upper
  // attribution; its central field is the canonical value used by search.
  return evaluateNativeRelativeUtility(input).relativeUtility.central;
}

export type UtilityAssumption = {
  id: string;
  evidenceGrade: EvidenceGrade;
  ruleId: string | null;
  sourceRefs: readonly string[];
  statement: string;
};

type ParameterSet = { performance: number; technique: number; sense: number };

type ParameterEffectContribution = {
  source: "leader" | "passive";
  sourceCardId: string;
  effectGroupId: string;
  effectKind: "performance-up" | "technique-up" | "sense-up" | "all-parameters-up";
  valuePermil: number;
  recipientAlternatives: number[][];
  relativeUnits: UtilityInterval;
};

type ActiveMemberUtility = {
  cardId: string;
  baseUpPermil: number;
  conditionalOverrideUpPermil: number | null;
  selectedAtFullComboPermil: UtilityInterval;
  activationProbabilityPermil: number;
  cooldownMilliseconds: number;
  durationMilliseconds: number;
  modeledActiveNoteCoverage: number;
  modeledActiveNoteCoverageInterval: UtilityInterval;
  modeledSoloEffectiveUpPermil: UtilityInterval;
};

type SpecialMemberUtility = {
  slot: number;
  cardId: string;
  durationMilliseconds: number;
  modeledStartsAtMilliseconds: null;
  modeledEndsAtMilliseconds: null;
  modeledNoteCoverage: number;
  scoreSupportPermil: number;
  activationRateUpPermil: number;
  modeledActivationRateCoveragePermil: UtilityInterval;
};

export type NativeUtilityResult = {
  kind: "provisional-relative-utility";
  methodologyVersion: "yd-native-utility-1.0.0";
  status: "provisional";
  context: {
    id: string;
    chartKey: string;
    songId: string;
    songTitle: string;
    difficulty: AggregateChartContext["difficulty"];
    fidelity: "aggregate";
    playMode: "manual";
    judgement: "perfect";
    life: 1_000;
    noteCount: number;
    durationMilliseconds: number;
    timingModelId: typeof AGGREGATE_UNIFORM_NOTE_TIMING_MODEL_ID;
  };
  assumptions: UtilityAssumption[];
  relativeUtility: UtilityInterval;
  components: {
    baseParameters: {
      evidenceGrade: "verified";
      byMember: Array<{
        cardId: string;
        formationIndex: number;
        parameters: ParameterSet;
        total: number;
      }>;
      relativeUnits: UtilityInterval;
    };
    parameterEffects: {
      evidenceGrade: "unresolved";
      contributions: ParameterEffectContribution[];
      relativeUnits: UtilityInterval;
    };
    persistentScoreSupport: {
      evidenceGrade: "corroborated";
      formula: {
        evidenceGrade: "corroborated";
        ruleId: "score-support-combination";
        expression: "activeUpPermil * (1000 + summedSupportPermil) / 1000";
      };
      byMember: Array<{ cardId: string; supportPermil: UtilityInterval }>;
    };
    active: {
      evidenceGrade: "modeled";
      overlapEvidenceGrade: "unresolved";
      averageEffectiveUpPermil: UtilityInterval;
      byMember: ActiveMemberUtility[];
      relativeUnits: UtilityInterval;
    };
    special: {
      evidenceGrade: "modeled";
      byFormationOrder: SpecialMemberUtility[];
      scoreSupportRelativeUnits: UtilityInterval;
      activationRate: {
        evidenceGrade: "modeled";
        operation: "additive-permil-capped-at-1000";
        modeledAverageActivationRateUpPermil: UtilityInterval;
        relativeUnits: UtilityInterval;
      };
      relativeUnits: UtilityInterval;
    };
    board: {
      evidenceGrade: "verified" | "corroborated";
      evidenceRef: string;
      relativeUnits: UtilityInterval;
    };
  };
    uncertainty: {
      recipientAllocation: "enumerated";
      stacking: "declared-additive-scenario";
      activeOverlap: "conservative-interval";
      specialTiming: typeof AGGREGATE_SPECIAL_COVERAGE_MODEL_ID;
    };
};

type RawInterval = UtilityInterval;
type EvaluatorResult = ReturnType<typeof evaluateFormation>;
type EvaluatorContribution = EvaluatorResult["contributions"]["leader"][number];

type UniformNote = { atMilliseconds: number; combo: number };
type ActiveProfile = {
  cardId: string;
  skill: CardMechanics["skills"]["active"][number];
  support: RawInterval;
  fullComboSelection: RawInterval;
  baseUpPermil: number;
  conditionalOverrideUpPermil: number | null;
};

type NativeTeamActiveTiming = Readonly<{
  cardId: string;
  activeSkillLevel: number;
  cooldownMilliseconds: number;
  durationMilliseconds: number;
  activationProbabilityPermil: number;
}>;

/**
 * Leader-independent timing facts.  The cache is intentionally limited to
 * Member card progression and chart timing; resolved applications, recipients,
 * and Leader effects are never shared across Leaders.
 */
export type NativeUtilityTeamIntrinsic = Readonly<{
  kind: "native-utility-team-intrinsic";
  methodologyVersion: "yd-native-utility-team-intrinsic-1.0.0";
  members: readonly FormationMember[];
  activeTimingByMember: readonly NativeTeamActiveTiming[];
}>;

export type NativeActiveTraceExecution = Readonly<{
  mode: "trace-preserving-state-runs" | "uncompressed-fallback";
  noteCount: number;
  baseStateRuns: number;
  specialSupportStateRuns: number;
  specialStateRuns: number;
  fallbackReason: string | null;
  bulk: Readonly<{
    methodologyVersion: "yd-exact-optimizer-bulk-accumulation-1.0.0";
    mode: "bulk-certified-reference-equivalent" | "ordered-replay" | "not-attempted";
    finalCanonical:
      | "bulk-certified-reference-equivalent"
      | "ordered-replay"
      | "not-attempted";
    certifiedRunCount: number;
    orderedReplayRunCount: number;
    fallbackReason: ExactOptimizerBulkFallbackReason | null;
  }>;
}>;

export type NativeUtilityTraceEvaluation = Readonly<{
  result: NativeUtilityResult;
  activeTrace: NativeActiveTraceExecution;
}>;

/**
 * B2's deliberately narrow contract: the central candidate value and proof
 * telemetry only. B3/finalists must call the full interval evaluator below.
 */
export type NativeCentralUtilityTraceEvaluation = Readonly<{
  kind: "bulk-certified-reference-equivalent" | "ordered-replay-required";
  central: number | null;
  activeTrace: NativeActiveTraceExecution;
  fallbackReason: ExactOptimizerBulkFallbackReason | null;
}>;
type ActivationRateWindow = {
  startsAtMilliseconds: number;
  endsAtMilliseconds: number;
  activationRateUpPermil: number;
};

const aggregateChartByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));
const songById = new Map(songContextData.songs.map((song) => [song.id, song]));
const uniformNotesByChartKey = new Map<string, UniformNote[]>();
const teamIntrinsicByKey = new Map<string, NativeUtilityTeamIntrinsic>();
const activeCheckCountsByTeam = new WeakMap<
  NativeUtilityTeamIntrinsic,
  Map<string, readonly Uint16Array[]>
>();

const PARAMETER_EFFECT_KINDS = new Set([
  "performance-up",
  "technique-up",
  "sense-up",
  "all-parameters-up",
]);

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function interval(lower: number, central: number, upper: number): UtilityInterval {
  const boundedCentral = Math.max(lower, Math.min(central, upper));
  return {
    lower: round(lower),
    central: round(boundedCentral),
    upper: round(Math.max(upper, boundedCentral)),
  };
}

function exactInterval(value: number): UtilityInterval {
  return interval(value, value, value);
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function ruleAssumption(id: string, ruleId: string, modelStatement?: string): UtilityAssumption {
  const rule = mechanicsData.runtimeRules.find((candidate) => candidate.id === ruleId);
  if (!rule) throw new Error(`Missing native-utility evidence rule: ${ruleId}`);
  return {
    id,
    evidenceGrade: rule.status,
    ruleId,
    sourceRefs: rule.sourceRefs,
    statement: modelStatement ? `${rule.statement} ${modelStatement}` : rule.statement,
  };
}

function assertInputBoundary(input: NativeUtilityInput): void {
  const forbiddenKey = (value: unknown, path: string): string | null => {
    if (typeof value === "string" && /appmedia/i.test(value)) return path || "input";
    if (Array.isArray(value)) {
      for (const [index, entry] of value.entries()) {
        const found = forbiddenKey(entry, `${path}[${index}]`);
        if (found) return found;
      }
      return null;
    }
    if (!value || typeof value !== "object") return null;
    for (const [key, nested] of Object.entries(value)) {
      if (/appmedia|editorial|tier(?:label)?|ranking(?:label)?/i.test(key)) {
        return path ? `${path}.${key}` : key;
      }
      const found = forbiddenKey(nested, path ? `${path}.${key}` : key);
      if (found) return found;
    }
    return null;
  };
  const forbidden = forbiddenKey(input, "");
  if (forbidden) throw new Error(`Editorial inputs are forbidden in native utility: ${forbidden}`);

  const allowedTopLevel = new Set(["formation", "chartKey", "seed", "accountState"]);
  const unknownTopLevel = Object.keys(input).find((key) => !allowedTopLevel.has(key));
  if (unknownTopLevel) throw new Error(`Unknown native-utility input field: ${unknownTopLevel}`);

  if (
    input.accountState?.board?.mode !== "declared-neutral" ||
    !["verified", "corroborated"].includes(input.accountState.board.evidenceGrade) ||
    input.accountState.board.evidenceRef.trim().length === 0
  ) {
    throw new Error("Native utility requires an explicitly evidenced neutral Board");
  }
}

function uniformNotes(chart: AggregateChartContext, song: SongContext): UniformNote[] {
  const cached = uniformNotesByChartKey.get(chart.key);
  if (cached) return cached;
  const notes = Array.from({ length: chart.fullComboNoteCount }, (_, index) => ({
    atMilliseconds: ((index + 0.5) * song.playingMilliseconds) / chart.fullComboNoteCount,
    combo: index + 1,
  }));
  uniformNotesByChartKey.set(chart.key, notes);
  return notes;
}

function teamIntrinsicKey(members: readonly FormationMember[]): string {
  return members
    .map((member) => `${member.cardId}@${member.investment}:${member.bloomStage ?? "none"}`)
    .join("|");
}

/**
 * Compile the Member-only Active timing layer once.  It deliberately excludes
 * all application resolution and support values because either can depend on
 * the concrete Leader/Outfit; those stay in the fixed-Leader dynamic trace.
 */
export function compileNativeUtilityTeamIntrinsic(
  members: readonly FormationMember[],
): NativeUtilityTeamIntrinsic {
  if (members.length !== 5) {
    throw new Error(`Native utility team intrinsic requires five Members; received ${members.length}`);
  }
  const copiedMembers = members.map((member) =>
    member.bloomStage === undefined
      ? { cardId: member.cardId, investment: member.investment }
      : { cardId: member.cardId, investment: member.investment, bloomStage: member.bloomStage },
  );
  const cardIds = copiedMembers.map((member) => member.cardId);
  if (new Set(cardIds).size !== cardIds.length) {
    throw new Error("Native utility team intrinsic Member IDs must be unique");
  }
  const cards = copiedMembers.map((member) => {
    const card = mechanicsCardById.get(member.cardId);
    if (!card) throw new Error(`Unknown native utility Member: ${member.cardId}`);
    return card;
  });
  if (new Set(cards.map((card) => card.talentId)).size !== cards.length) {
    throw new Error("Native utility team intrinsic Members must have unique talents");
  }
  const activeTimingByMember = copiedMembers.map((member, index) => {
    const mechanics = cards[index]!;
    const state = resolveCardInvestmentState(
      mechanics,
      member.investment,
      member.bloomStage,
    );
    const skill = exactSkillLevel(mechanics.skills.active, state.activeSkillLevel);
    if (
      skill.cooldownMilliseconds === null ||
      skill.durationMilliseconds === null ||
      skill.activationProbabilityPermil === null
    ) {
      throw new Error(`${member.cardId} lacks exact Active timing or probability`);
    }
    return Object.freeze({
      cardId: member.cardId,
      activeSkillLevel: state.activeSkillLevel,
      cooldownMilliseconds: skill.cooldownMilliseconds,
      durationMilliseconds: skill.durationMilliseconds,
      activationProbabilityPermil: skill.activationProbabilityPermil,
    });
  });
  return Object.freeze({
    kind: "native-utility-team-intrinsic",
    methodologyVersion: "yd-native-utility-team-intrinsic-1.0.0",
    members: Object.freeze(copiedMembers),
    activeTimingByMember: Object.freeze(activeTimingByMember),
  });
}

function cachedNativeUtilityTeamIntrinsic(
  members: readonly FormationMember[],
): NativeUtilityTeamIntrinsic {
  const key = teamIntrinsicKey(members);
  const cached = teamIntrinsicByKey.get(key);
  if (cached) return cached;
  const intrinsic = compileNativeUtilityTeamIntrinsic(members);
  teamIntrinsicByKey.set(key, intrinsic);
  return intrinsic;
}

function cachedActiveCheckCounts(
  intrinsic: NativeUtilityTeamIntrinsic,
  chartKey: string,
  notes: readonly UniformNote[],
): readonly Uint16Array[] {
  let byChart = activeCheckCountsByTeam.get(intrinsic);
  if (!byChart) {
    byChart = new Map<string, readonly Uint16Array[]>();
    activeCheckCountsByTeam.set(intrinsic, byChart);
  }
  const cached = byChart.get(chartKey);
  if (cached) return cached;
  const countsByMember = intrinsic.activeTimingByMember.map((timing) => {
    const counts = new Uint16Array(notes.length);
    for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
      const count = activeOpportunityCheckCountAt(
        notes[noteIndex]!.atMilliseconds,
        timing.cooldownMilliseconds,
        timing.durationMilliseconds,
      );
      if (count > 0xffff) {
        throw new Error("Active check count exceeds compact uint16 trace capacity");
      }
      counts[noteIndex] = count;
    }
    return counts;
  });
  const frozen = Object.freeze(countsByMember);
  byChart.set(chartKey, frozen);
  return frozen;
}

function memberParameterForEffect(parameters: ParameterSet, effectKind: string): number {
  switch (effectKind) {
    case "performance-up":
      return parameters.performance;
    case "technique-up":
      return parameters.technique;
    case "sense-up":
      return parameters.sense;
    case "all-parameters-up":
      return parameters.performance + parameters.technique + parameters.sense;
    default:
      return 0;
  }
}

function recipientAlternatives(contribution: EvaluatorContribution): number[][] {
  return contribution.recipients?.alternatives ?? [[]];
}

function contributionParameterInterval(
  contribution: EvaluatorContribution,
  parameters: readonly ParameterSet[],
): RawInterval {
  if (contribution.value === null || !contribution.effectKind) return exactInterval(0);
  const values = recipientAlternatives(contribution).map((recipients) =>
    recipients.reduce(
      (total, memberIndex) =>
        total +
        (memberParameterForEffect(parameters[memberIndex]!, contribution.effectKind!) *
          contribution.value!) /
          1_000,
      0,
    ),
  );
  const minimum = Math.min(...values);
  return interval(minimum, minimum, Math.max(...values));
}

function compileParameterEffects(
  evaluator: EvaluatorResult,
  parameters: readonly ParameterSet[],
): {
  contributions: ParameterEffectContribution[];
  relativeUnits: RawInterval;
} {
  const source = [...evaluator.contributions.leader, ...evaluator.contributions.passive].filter(
    (contribution) =>
      contribution.effectKind !== null && PARAMETER_EFFECT_KINDS.has(contribution.effectKind),
  );
  const contributions = source.map((contribution) => {
    const effectKind = contribution.effectKind as ParameterEffectContribution["effectKind"];
    return {
      source: contribution.source as "leader" | "passive",
      sourceCardId: contribution.sourceCardId,
      effectGroupId: contribution.effectGroupId,
      effectKind,
      valuePermil: contribution.value!,
      recipientAlternatives: recipientAlternatives(contribution),
      relativeUnits: contributionParameterInterval(contribution, parameters),
    };
  });

  // The public data identifies each active Leader/Passive parameter effect and
  // every legal capped-recipient subset, but it does not establish a
  // multiplicative runtime stacking order. Add every active effect once, then
  // envelope its legal recipient alternatives. Because the still-unknown
  // deterministic resolver can correlate selections across effects, the summed
  // endpoints are conservative bounds and are not claimed to be jointly
  // attainable. Discarding guaranteed effects or applying a capped effect to
  // every eligible Member would be invalid even as an envelope.
  const lower = contributions.reduce(
    (total, contribution) => total + contribution.relativeUnits.lower,
    0,
  );
  const central = contributions.reduce(
    (total, contribution) => total + contribution.relativeUnits.central,
    0,
  );
  const upper = contributions.reduce(
    (total, contribution) => total + contribution.relativeUnits.upper,
    0,
  );

  return { contributions, relativeUnits: interval(lower, central, upper) };
}

function compilePersistentSupport(
  evaluator: EvaluatorResult,
  memberCardIds: readonly string[],
): Array<{ cardId: string; raw: RawInterval }> {
  const supportContributions = [
    ...evaluator.contributions.leader,
    ...evaluator.contributions.passive,
  ].filter(
    (contribution) =>
      contribution.effectKind === "active-skill-effect-up" && contribution.value !== null,
  );
  return memberCardIds.map((cardId, memberIndex) => {
    let lower = 0;
    let central = 0;
    let upper = 0;
    for (const contribution of supportContributions) {
      const recipient = contribution.recipients?.recipientIntervalByMember[memberIndex];
      if (!recipient) continue;
      lower += contribution.value! * recipient.minimum;
      // The resolver is deterministic but still unknown. Rank and search on
      // the guaranteed recipient floor rather than pretending every legal
      // subset is equally likely.
      central += contribution.value! * recipient.minimum;
      upper += contribution.value! * recipient.maximum;
    }
    return { cardId, raw: interval(lower, central, upper) };
  });
}

function scoreUpInterval(
  applications: readonly SkillApplication[],
  formation: LegalFormation,
  observation: TriggerObservation,
): RawInterval {
  const resolution = resolveActiveApplications(applications, formation, observation);
  const values = resolution.alternatives.map((alternative) =>
    alternative.reduce(
      (total, application) =>
        total + (application.effect?.kind === "score-up" ? application.effect.value ?? 0 : 0),
      0,
    ),
  );
  return interval(Math.min(...values), mean(values), Math.max(...values));
}

function activeOpportunityChecksAt(
  atMilliseconds: number,
  cooldownMilliseconds: number,
  durationMilliseconds: number,
): number[] {
  const lastCheck = Math.floor(atMilliseconds / cooldownMilliseconds);
  if (lastCheck < 1) return [];
  const firstPossible = Math.max(
    1,
    Math.floor((atMilliseconds - durationMilliseconds) / cooldownMilliseconds) + 1,
  );
  return Array.from(
    { length: Math.max(0, lastCheck - firstPossible + 1) },
    (_, index) => (firstPossible + index) * cooldownMilliseconds,
  );
}

function activeProbabilityForChecks(
  checkTimesMilliseconds: readonly number[],
  baseProbabilityPermil: number,
  activationRateWindows: readonly ActivationRateWindow[] = [],
): number {
  const noActivationProbability = checkTimesMilliseconds.reduce((probability, checkTime) => {
    const activationRateUpPermil = activationRateWindows.reduce(
      (total, window) =>
        checkTime >= window.startsAtMilliseconds && checkTime < window.endsAtMilliseconds
          ? total + window.activationRateUpPermil
          : total,
      0,
    );
    const checkProbabilityPermil = Math.max(
      0,
      Math.min(1_000, baseProbabilityPermil + activationRateUpPermil),
    );
    return probability * (1 - checkProbabilityPermil / 1_000);
  }, 1);
  return 1 - noActivationProbability;
}

export function expectedMaximum(values: readonly { value: number; probability: number }[]): number {
  const ordered = [...values]
    .filter((entry) => entry.value > 0 && entry.probability > 0)
    .sort((left, right) => right.value - left.value);
  let result = 0;
  let noHigherProbability = 1;
  for (let index = 0; index < ordered.length; ) {
    const value = ordered[index]!.value;
    let noMemberInGroup = 1;
    let cursor = index;
    while (cursor < ordered.length && ordered[cursor]!.value === value) {
      noMemberInGroup *= 1 - ordered[cursor]!.probability;
      cursor += 1;
    }
    result += value * noHigherProbability * (1 - noMemberInGroup);
    noHigherProbability *= noMemberInGroup;
    index = cursor;
  }
  return result;
}

function exactSkillLevel<T extends { level: number }>(levels: readonly T[], level: number): T {
  const result = levels.find((candidate) => candidate.level === level);
  if (!result) throw new Error(`Missing exact skill level ${level}`);
  return result;
}

function compileActiveProfiles(
  formation: LegalFormation,
  evaluator: EvaluatorResult,
  support: readonly { cardId: string; raw: RawInterval }[],
  song: SongContext,
  chart: AggregateChartContext,
): ActiveProfile[] {
  return formation.members.map((member, memberIndex) => {
    const state = evaluator.members[memberIndex]!.progression.state;
    const skill = exactSkillLevel(member.mechanics.skills.active, state.activeSkillLevel);
    if (
      skill.cooldownMilliseconds === null ||
      skill.durationMilliseconds === null ||
      skill.activationProbabilityPermil === null
    ) {
      throw new Error(`${member.cardId} lacks exact Active timing or probability`);
    }
    const baseUpPermil =
      skill.applications.find(
        (application) =>
          application.channel === "primary" && application.effect?.kind === "score-up",
      )?.effect?.value ?? 0;
    const conditionalOverrideUpPermil =
      skill.applications.find(
        (application) =>
          application.combination === "conditional-override" &&
          application.effect?.kind === "score-up",
      )?.effect?.value ?? null;
    const fullComboSelection = scoreUpInterval(skill.applications, formation, {
      combo: chart.fullComboNoteCount,
      life: 1_000,
      judgement: "perfect",
      songSingerTalentIds: song.singerTalentIds,
    });
    return {
      cardId: member.cardId,
      skill,
      support: support[memberIndex]!.raw,
      fullComboSelection,
      baseUpPermil,
      conditionalOverrideUpPermil,
    };
  });
}

type NoteActiveState = {
  checkTimesMilliseconds: number[];
  baseProbabilityPermil: number;
  probability: number;
  selectedUpPermil: RawInterval;
};

type ActiveSelectionSequence = Readonly<{
  selections: readonly RawInterval[];
  selectionIndexByNote: Uint8Array;
}>;

type CompiledActiveTrace = Readonly<{
  profiles: readonly ActiveProfile[];
  checkCountsByMember: readonly Uint16Array[];
  selectionsByMember: readonly ActiveSelectionSequence[];
  runs: readonly CompressedActiveRun[];
  supported: boolean;
  fallbackReason: string | null;
}>;

type CompressedActiveRun = Readonly<{
  startInclusive: number;
  endExclusive: number;
  multiplicity: number;
}>;

type CompressedActiveAggregate = Readonly<{
  value: RawInterval;
  stateRuns: number;
  bulk: NativeActiveTraceExecution["bulk"];
  outputEnclosure: Readonly<{
    lower: Binary64Enclosure;
    central: Binary64Enclosure;
    upper: Binary64Enclosure;
  }>;
}>;

const STATIC_ACTIVE_TRIGGER_KINDS = new Set([
  "combo-at-least",
  "deck-attribute-count",
  "deck-character-group-count",
  "judgement-at-least",
  "life-at-least",
  "life-at-most",
  "music-character",
]);

function activeOpportunityCheckCountAt(
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

function activeProbabilityForCheckCount(
  checkCount: number,
  baseProbabilityPermil: number,
  activationRateUpPermil = 0,
): number {
  const checkProbabilityPermil = Math.max(
    0,
    Math.min(1_000, baseProbabilityPermil + activationRateUpPermil),
  );
  let noActivationProbability = 1;
  for (let index = 0; index < checkCount; index += 1) {
    noActivationProbability *= 1 - checkProbabilityPermil / 1_000;
  }
  return 1 - noActivationProbability;
}

function activeSelectionSequence(
  profile: ActiveProfile,
  formation: LegalFormation,
  song: SongContext,
  noteCount: number,
): ActiveSelectionSequence {
  const starts = new Set<number>([1]);
  let supported = true;
  for (const application of profile.skill.applications) {
    const trigger = application.trigger;
    if (!trigger) continue;
    if (!STATIC_ACTIVE_TRIGGER_KINDS.has(trigger.kind)) {
      supported = false;
      break;
    }
    if (trigger.kind === "combo-at-least" && trigger.threshold !== null) {
      const start = Math.max(1, Math.min(noteCount + 1, Math.ceil(trigger.threshold)));
      starts.add(start);
    }
  }
  if (!supported) {
    return { selections: Object.freeze([]), selectionIndexByNote: new Uint8Array(noteCount) };
  }
  const breakpoints = [...starts].sort((left, right) => left - right);
  const selections = breakpoints.map((combo) =>
    scoreUpInterval(profile.skill.applications, formation, {
      combo,
      life: 1_000,
      judgement: "perfect",
      songSingerTalentIds: song.singerTalentIds,
    }),
  );
  if (selections.length > 255) {
    // Uint8 state IDs are a compact hot-path contract. More than 255 Active
    // breakpoints is unsupported until a wider representation is proven.
    return { selections: Object.freeze([]), selectionIndexByNote: new Uint8Array(noteCount) };
  }
  const selectionIndexByNote = new Uint8Array(noteCount);
  let breakpointIndex = 0;
  for (let noteIndex = 0; noteIndex < noteCount; noteIndex += 1) {
    const combo = noteIndex + 1;
    while (
      breakpointIndex + 1 < breakpoints.length &&
      combo >= breakpoints[breakpointIndex + 1]!
    ) {
      breakpointIndex += 1;
    }
    selectionIndexByNote[noteIndex] = breakpointIndex;
  }
  return { selections: Object.freeze(selections), selectionIndexByNote };
}

/**
 * Run boundaries depend only on the Member timing/check ledger and the
 * resolved Active selection ledger. Support and activation-rate scalars are
 * constant over an aggregate-chart pass, so one source-order run ledger is
 * valid for the base, Special-support, and Special-activation passes.
 */
function compileCompressedActiveRuns(
  checkCountsByMember: readonly Uint16Array[],
  selectionsByMember: readonly ActiveSelectionSequence[],
  noteCount: number,
): readonly CompressedActiveRun[] {
  const sameInputState = (left: number, right: number): boolean => {
    for (let memberIndex = 0; memberIndex < 5; memberIndex += 1) {
      if (
        checkCountsByMember[memberIndex]![left] !== checkCountsByMember[memberIndex]![right] ||
        selectionsByMember[memberIndex]!.selectionIndexByNote[left] !==
          selectionsByMember[memberIndex]!.selectionIndexByNote[right]
      ) {
        return false;
      }
    }
    return true;
  };
  const runs: CompressedActiveRun[] = [];
  let startInclusive = 0;
  for (let noteIndex = 1; noteIndex <= noteCount; noteIndex += 1) {
    if (noteIndex < noteCount && sameInputState(startInclusive, noteIndex)) continue;
    runs.push({
      startInclusive,
      endExclusive: noteIndex,
      multiplicity: noteIndex - startInclusive,
    });
    startInclusive = noteIndex;
  }
  return Object.freeze(runs);
}

function compileActiveTrace(
  chartKey: string,
  notes: readonly UniformNote[],
  profiles: readonly ActiveProfile[],
  formation: LegalFormation,
  song: SongContext,
  intrinsic: NativeUtilityTeamIntrinsic,
): CompiledActiveTrace {
  if (intrinsic.activeTimingByMember.length !== profiles.length) {
    return {
      profiles,
      checkCountsByMember: Object.freeze([]),
      selectionsByMember: Object.freeze([]),
      runs: Object.freeze([]),
      supported: false,
      fallbackReason: "team-intrinsic-member-count-mismatch",
    };
  }
  const checkCountsByMember: Uint16Array[] = [];
  const selectionsByMember: ActiveSelectionSequence[] = [];
  const cachedCounts = cachedActiveCheckCounts(intrinsic, chartKey, notes);
  for (let memberIndex = 0; memberIndex < profiles.length; memberIndex += 1) {
    const profile = profiles[memberIndex]!;
    const timing = intrinsic.activeTimingByMember[memberIndex]!;
    if (
      profile.cardId !== timing.cardId ||
      profile.skill.cooldownMilliseconds !== timing.cooldownMilliseconds ||
      profile.skill.durationMilliseconds !== timing.durationMilliseconds ||
      profile.skill.activationProbabilityPermil !== timing.activationProbabilityPermil
    ) {
      return {
        profiles,
        checkCountsByMember: Object.freeze([]),
        selectionsByMember: Object.freeze([]),
        runs: Object.freeze([]),
        supported: false,
        fallbackReason: "team-intrinsic-active-timing-mismatch",
      };
    }
    const sequence = activeSelectionSequence(profile, formation, song, notes.length);
    if (sequence.selections.length === 0) {
      return {
        profiles,
        checkCountsByMember: Object.freeze([]),
        selectionsByMember: Object.freeze([]),
        runs: Object.freeze([]),
        supported: false,
        fallbackReason: "unsupported-active-trigger-or-breakpoint-width",
      };
    }
    checkCountsByMember.push(cachedCounts[memberIndex]!);
    selectionsByMember.push(sequence);
  }
  return {
    profiles,
    checkCountsByMember: Object.freeze(checkCountsByMember),
    selectionsByMember: Object.freeze(selectionsByMember),
    runs: compileCompressedActiveRuns(checkCountsByMember, selectionsByMember, notes.length),
    supported: true,
    fallbackReason: null,
  };
}

function constantByNote(values: readonly number[]): number | null {
  if (values.length === 0) return 0;
  const first = values[0]!;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] !== first) return null;
  }
  return first;
}

function fullChartActivationRate(
  windows: readonly ActivationRateWindow[],
  durationMilliseconds: number,
): number | null {
  let total = 0;
  for (const window of windows) {
    if (window.startsAtMilliseconds !== 0 || window.endsAtMilliseconds !== durationMilliseconds) {
      return null;
    }
    total += window.activationRateUpPermil;
  }
  return total;
}

export function expectedMaximumFive(
  values: Float64Array,
  probabilities: Float64Array,
  order: Uint8Array,
): number {
  let orderLength = 0;
  for (let index = 0; index < 5; index += 1) {
    if (values[index]! > 0 && probabilities[index]! > 0) {
      let insertAt = orderLength;
      while (insertAt > 0 && values[index]! > values[order[insertAt - 1]!]!) {
        order[insertAt] = order[insertAt - 1]!;
        insertAt -= 1;
      }
      order[insertAt] = index;
      orderLength += 1;
    }
  }
  let result = 0;
  let noHigherProbability = 1;
  let index = 0;
  while (index < orderLength) {
    const value = values[order[index]!]!;
    let noMemberInGroup = 1;
    let cursor = index;
    while (
      cursor < orderLength &&
      values[order[cursor]!]! === value
    ) {
      noMemberInGroup *= 1 - probabilities[order[cursor]!]!;
      cursor += 1;
    }
    result += value * noHigherProbability * (1 - noMemberInGroup);
    noHigherProbability *= noMemberInGroup;
    index = cursor;
  }
  return result;
}

function fillCompressedActiveState(
  trace: CompiledActiveTrace,
  noteIndex: number,
  additionalSupport: number,
  activationRateUpPermil: number,
  state: Float64Array,
  centralValues: Float64Array,
  centralProbabilities: Float64Array,
  expectedOrder: Uint8Array,
): readonly [number, number, number] {
  let lower = 0;
  let upper = 0;
  for (let memberIndex = 0; memberIndex < 5; memberIndex += 1) {
    const profile = trace.profiles[memberIndex]!;
    const selection = trace.selectionsByMember[memberIndex]!;
    const selected = selection.selections[selection.selectionIndexByNote[noteIndex]!]!;
    const checkCount = trace.checkCountsByMember[memberIndex]![noteIndex]!;
    const lowerProbability = activeProbabilityForCheckCount(
      checkCount,
      profile.skill.activationProbabilityPermil!,
    );
    const centralProbability = activeProbabilityForCheckCount(
      checkCount,
      profile.skill.activationProbabilityPermil!,
      activationRateUpPermil,
    );
    const lowerValue =
      (selected.lower * (1_000 + profile.support.lower + additionalSupport)) / 1_000;
    const centralValue =
      (selected.central * (1_000 + profile.support.central + additionalSupport)) / 1_000;
    const upperValue =
      (selected.upper * (1_000 + profile.support.upper + additionalSupport)) / 1_000;
    const offset = memberIndex * 6;
    state[offset] = checkCount;
    state[offset + 1] = lowerProbability;
    state[offset + 2] = centralProbability;
    state[offset + 3] = lowerValue;
    state[offset + 4] = centralValue;
    state[offset + 5] = upperValue;
    lower = Math.max(lower, lowerProbability * lowerValue);
    centralValues[memberIndex] = centralValue;
    centralProbabilities[memberIndex] = centralProbability;
    upper += centralProbability * upperValue;
  }
  return [lower, expectedMaximumFive(centralValues, centralProbabilities, expectedOrder), upper];
}

function pointOutputEnclosure(value: RawInterval): CompressedActiveAggregate["outputEnclosure"] {
  return {
    lower: pointBinary64Enclosure(value.lower),
    central: pointBinary64Enclosure(value.central),
    upper: pointBinary64Enclosure(value.upper),
  };
}

function orderedReplayCompressedActiveInterval(
  trace: CompiledActiveTrace,
  noteCount: number,
  additionalSupport: number,
  activationRateUpPermil: number,
  fallbackReason: ExactOptimizerBulkFallbackReason | null,
): CompressedActiveAggregate {
  const state = new Float64Array(30);
  const centralValues = new Float64Array(5);
  const centralProbabilities = new Float64Array(5);
  const expectedOrder = new Uint8Array(5);
  let lower = 0;
  let central = 0;
  let upper = 0;
  for (let noteIndex = 0; noteIndex < noteCount; noteIndex += 1) {
    const contribution = fillCompressedActiveState(
      trace,
      noteIndex,
      additionalSupport,
      activationRateUpPermil,
      state,
      centralValues,
      centralProbabilities,
      expectedOrder,
    );
    lower += contribution[0];
    central += contribution[1];
    upper += contribution[2];
  }
  const value = interval(lower / noteCount, central / noteCount, upper / noteCount);
  return {
    value,
    stateRuns: trace.runs.length,
    bulk: {
      methodologyVersion: "yd-exact-optimizer-bulk-accumulation-1.0.0",
      mode: "ordered-replay",
      finalCanonical: "not-attempted",
      certifiedRunCount: 0,
      orderedReplayRunCount: trace.runs.length,
      fallbackReason,
    },
    outputEnclosure: pointOutputEnclosure(value),
  };
}

function aggregateCompressedActiveInterval(
  trace: CompiledActiveTrace,
  noteCount: number,
  additionalSupport: number,
  activationRateUpPermil: number,
  forceOrderedReplay = false,
): CompressedActiveAggregate {
  // This is an independently callable oracle for the compressed state trace.
  // It retains the compiled source-order scheduler, but deliberately expands
  // every note into the reference `sum += contribution` recurrence.  It is
  // used by the bulk-parity harness, not as a production fallback reason.
  if (forceOrderedReplay) {
    return orderedReplayCompressedActiveInterval(
      trace,
      noteCount,
      additionalSupport,
      activationRateUpPermil,
      null,
    );
  }
  const state = new Float64Array(30);
  const verificationState = new Float64Array(30);
  const centralValues = new Float64Array(5);
  const centralProbabilities = new Float64Array(5);
  const expectedOrder = new Uint8Array(5);
  const verificationCentralValues = new Float64Array(5);
  const verificationCentralProbabilities = new Float64Array(5);
  const verificationExpectedOrder = new Uint8Array(5);
  let lower: Binary64Enclosure = pointBinary64Enclosure(0);
  let central: Binary64Enclosure = pointBinary64Enclosure(0);
  let upper: Binary64Enclosure = pointBinary64Enclosure(0);
  let certifiedRunCount = 0;
  for (const run of trace.runs) {
    const contribution = fillCompressedActiveState(
      trace,
      run.startInclusive,
      additionalSupport,
      activationRateUpPermil,
      state,
      centralValues,
      centralProbabilities,
      expectedOrder,
    );
    const expectedContribution = run.multiplicity === 1
      ? contribution
      : fillCompressedActiveState(
          trace,
          run.endExclusive - 1,
          additionalSupport,
          activationRateUpPermil,
          verificationState,
          verificationCentralValues,
          verificationCentralProbabilities,
          verificationExpectedOrder,
        );
    const lowerRun = transformRepeatedBinary64Addition({
      incoming: lower,
      contribution: contribution[0],
      expectedContribution: expectedContribution[0],
      multiplicity: run.multiplicity,
    });
    const centralRun = transformRepeatedBinary64Addition({
      incoming: central,
      contribution: contribution[1],
      expectedContribution: expectedContribution[1],
      multiplicity: run.multiplicity,
    });
    const upperRun = transformRepeatedBinary64Addition({
      incoming: upper,
      contribution: contribution[2],
      expectedContribution: expectedContribution[2],
      multiplicity: run.multiplicity,
    });
    if (lowerRun.kind === "ordered-replay-required") {
      return orderedReplayCompressedActiveInterval(
        trace,
        noteCount,
        additionalSupport,
        activationRateUpPermil,
        lowerRun.fallbackReason,
      );
    }
    if (centralRun.kind === "ordered-replay-required") {
      return orderedReplayCompressedActiveInterval(
        trace,
        noteCount,
        additionalSupport,
        activationRateUpPermil,
        centralRun.fallbackReason,
      );
    }
    if (upperRun.kind === "ordered-replay-required") {
      return orderedReplayCompressedActiveInterval(
        trace,
        noteCount,
        additionalSupport,
        activationRateUpPermil,
        upperRun.fallbackReason,
      );
    }
    lower = lowerRun.enclosure;
    central = centralRun.enclosure;
    upper = upperRun.enclosure;
    certifiedRunCount += 1;
  }
  const lowerAverage = outwardBinary64DividePositive(lower, noteCount);
  const centralAverage = outwardBinary64DividePositive(central, noteCount);
  const upperAverage = outwardBinary64DividePositive(upper, noteCount);
  if (!lowerAverage || !centralAverage || !upperAverage) {
    return orderedReplayCompressedActiveInterval(
      trace,
      noteCount,
      additionalSupport,
      activationRateUpPermil,
      "interval-width-overflow",
    );
  }
  const canonical = certifyCanonicalUtilityInterval({
    lower: lowerAverage,
    central: centralAverage,
    upper: upperAverage,
  });
  if (canonical.kind === "ordered-replay-required") {
    return orderedReplayCompressedActiveInterval(
      trace,
      noteCount,
      additionalSupport,
      activationRateUpPermil,
      canonical.fallbackReason,
    );
  }
  return {
    value: canonical.value,
    stateRuns: trace.runs.length,
    bulk: {
      methodologyVersion: "yd-exact-optimizer-bulk-accumulation-1.0.0",
      mode: "bulk-certified-reference-equivalent",
      finalCanonical: "not-attempted",
      certifiedRunCount,
      orderedReplayRunCount: 0,
      fallbackReason: null,
    },
    outputEnclosure: canonical.enclosure,
  };
}

type CentralCompressedActiveAggregate =
  | Readonly<{
      kind: "bulk-certified-reference-equivalent";
      value: number;
      stateRuns: number;
      certifiedRunCount: number;
    }>
  | Readonly<{
      kind: "ordered-replay-required";
      fallbackReason: ExactOptimizerBulkFallbackReason;
      stateRuns: number;
    }>;

function orderedFiniteInterval(value: UtilityInterval): boolean {
  return (
    Number.isFinite(value.lower) &&
    Number.isFinite(value.central) &&
    Number.isFinite(value.upper) &&
    !Object.is(value.lower, -0) &&
    !Object.is(value.central, -0) &&
    !Object.is(value.upper, -0) &&
    value.lower <= value.central &&
    value.central <= value.upper
  );
}

/**
 * Central B2 needs only the expected-maximum branch.  The interval-order
 * precondition below is the proof that native `interval()` cannot clamp that
 * central value: every selected Active/support interval is ordered and every
 * contribution is non-negative, so lower <= central <= upper is preserved by
 * source-order addition, division, positive scaling, and final addition.
 */
function centralBulkPrecondition(
  trace: CompiledActiveTrace,
  profiles: readonly ActiveProfile[],
  baseTotal: number,
  parameterEffects: UtilityInterval,
): ExactOptimizerBulkFallbackReason | null {
  if (!Number.isFinite(baseTotal) || baseTotal <= 0 || Object.is(baseTotal, -0)) {
    return "unsupported-operation-path";
  }
  if (!orderedFiniteInterval(parameterEffects)) return "unsupported-operation-path";
  if (trace.runs.length === 0 || trace.profiles.length !== 5) return "unsupported-operation-path";
  for (const profile of profiles) {
    if (!orderedFiniteInterval(profile.support) || !orderedFiniteInterval(profile.fullComboSelection)) {
      return "unsupported-operation-path";
    }
    if (profile.support.lower < -1_000 || profile.fullComboSelection.lower < 0) {
      return "unsupported-operation-path";
    }
  }
  for (const selections of trace.selectionsByMember) {
    for (const selection of selections.selections) {
      if (!orderedFiniteInterval(selection) || selection.lower < 0) {
        return "unsupported-operation-path";
      }
    }
  }
  return null;
}

function fillCompressedActiveCentralState(
  trace: CompiledActiveTrace,
  noteIndex: number,
  additionalSupport: number,
  activationRateUpPermil: number,
  centralValues: Float64Array,
  centralProbabilities: Float64Array,
  expectedOrder: Uint8Array,
): number {
  for (let memberIndex = 0; memberIndex < 5; memberIndex += 1) {
    const profile = trace.profiles[memberIndex]!;
    const selection = trace.selectionsByMember[memberIndex]!;
    const selected = selection.selections[selection.selectionIndexByNote[noteIndex]!]!;
    const checkCount = trace.checkCountsByMember[memberIndex]![noteIndex]!;
    const centralProbability = activeProbabilityForCheckCount(
      checkCount,
      profile.skill.activationProbabilityPermil!,
      activationRateUpPermil,
    );
    const centralValue =
      (selected.central * (1_000 + profile.support.central + additionalSupport)) / 1_000;
    if (!Number.isFinite(centralProbability) || !Number.isFinite(centralValue) || centralValue < 0) {
      return Number.NaN;
    }
    centralValues[memberIndex] = centralValue;
    centralProbabilities[memberIndex] = centralProbability;
  }
  return expectedMaximumFive(centralValues, centralProbabilities, expectedOrder);
}

function aggregateCompressedActiveCentral(
  trace: CompiledActiveTrace,
  noteCount: number,
  additionalSupport: number,
  activationRateUpPermil: number,
): CentralCompressedActiveAggregate {
  const centralValues = new Float64Array(5);
  const centralProbabilities = new Float64Array(5);
  const expectedOrder = new Uint8Array(5);
  const verificationCentralValues = new Float64Array(5);
  const verificationCentralProbabilities = new Float64Array(5);
  const verificationExpectedOrder = new Uint8Array(5);
  let sum = pointBinary64Enclosure(0);
  let certifiedRunCount = 0;
  for (const run of trace.runs) {
    const contribution = fillCompressedActiveCentralState(
      trace,
      run.startInclusive,
      additionalSupport,
      activationRateUpPermil,
      centralValues,
      centralProbabilities,
      expectedOrder,
    );
    const expectedContribution = run.multiplicity === 1
      ? contribution
      : fillCompressedActiveCentralState(
          trace,
          run.endExclusive - 1,
          additionalSupport,
          activationRateUpPermil,
          verificationCentralValues,
          verificationCentralProbabilities,
          verificationExpectedOrder,
        );
    const transformed = transformRepeatedBinary64Addition({
      incoming: sum,
      contribution,
      expectedContribution,
      multiplicity: run.multiplicity,
    });
    if (transformed.kind === "ordered-replay-required") {
      return {
        kind: "ordered-replay-required",
        fallbackReason: transformed.fallbackReason,
        stateRuns: trace.runs.length,
      };
    }
    sum = transformed.enclosure;
    certifiedRunCount += 1;
  }
  const average = outwardBinary64DividePositive(sum, noteCount);
  if (!average) {
    return {
      kind: "ordered-replay-required",
      fallbackReason: "interval-width-overflow",
      stateRuns: trace.runs.length,
    };
  }
  const canonical = certifyCanonicalMicroUnitEnclosure(average);
  if (canonical.kind === "ordered-replay-required") {
    return {
      kind: "ordered-replay-required",
      fallbackReason: canonical.fallbackReason,
      stateRuns: trace.runs.length,
    };
  }
  return {
    kind: "bulk-certified-reference-equivalent",
    value: fromCanonicalMicroUnits(canonical.canonicalMicroUnits),
    stateRuns: trace.runs.length,
    certifiedRunCount,
  };
}

function noteActiveStates(
  notes: readonly UniformNote[],
  profiles: readonly ActiveProfile[],
  formation: LegalFormation,
  song: SongContext,
): NoteActiveState[][] {
  return notes.map((note) =>
    profiles.map((profile) => {
      const checkTimesMilliseconds = activeOpportunityChecksAt(
        note.atMilliseconds,
        profile.skill.cooldownMilliseconds!,
        profile.skill.durationMilliseconds!,
      );
      const baseProbabilityPermil = profile.skill.activationProbabilityPermil!;
      return {
        checkTimesMilliseconds,
        baseProbabilityPermil,
        probability: activeProbabilityForChecks(checkTimesMilliseconds, baseProbabilityPermil),
        selectedUpPermil: scoreUpInterval(profile.skill.applications, formation, {
          combo: note.combo,
          life: 1_000,
          judgement: "perfect",
          songSingerTalentIds: song.singerTalentIds,
        }),
      };
    }),
  );
}

function aggregateActiveIntervalUncompressed(
  states: readonly NoteActiveState[][],
  profiles: readonly ActiveProfile[],
  additionalSupportByNote: readonly number[],
  activationRateWindows: readonly ActivationRateWindow[],
): RawInterval {
  let lower = 0;
  let central = 0;
  let upper = 0;
  for (const [noteIndex, noteStates] of states.entries()) {
    const additionalSupport = additionalSupportByNote[noteIndex] ?? 0;
    const entries = noteStates.map((state, memberIndex) => {
      const support = profiles[memberIndex]!.support;
      const boostedProbability = activeProbabilityForChecks(
        state.checkTimesMilliseconds,
        state.baseProbabilityPermil,
        activationRateWindows,
      );
      return {
        lowerProbability: state.probability,
        centralProbability: boostedProbability,
        upperProbability: boostedProbability,
        lower:
          (state.selectedUpPermil.lower * (1_000 + support.lower + additionalSupport)) / 1_000,
        central:
          (state.selectedUpPermil.central * (1_000 + support.central + additionalSupport)) /
          1_000,
        upper:
          (state.selectedUpPermil.upper * (1_000 + support.upper + additionalSupport)) / 1_000,
      };
    });
    lower += Math.max(0, ...entries.map((entry) => entry.lowerProbability * entry.lower));
    central += expectedMaximum(
      entries.map((entry) => ({ value: entry.central, probability: entry.centralProbability })),
    );
    upper += entries.reduce(
      (total, entry) => total + entry.upperProbability * entry.upper,
      0,
    );
  }
  return interval(lower / states.length, central / states.length, upper / states.length);
}

function compileSpecials(
  notes: readonly UniformNote[],
  formation: LegalFormation,
  evaluator: EvaluatorResult,
  song: SongContext,
): {
  entries: SpecialMemberUtility[];
  supportByNote: number[];
  activationRateByNote: number[];
  activationRateWindows: ActivationRateWindow[];
} {
  const supportByNote = notes.map(() => 0);
  const activationRateByNote = notes.map(() => 0);
  const activationRateWindows: ActivationRateWindow[] = [];
  const entries = formation.members.map((member, slotIndex) => {
    const state = evaluator.members[slotIndex]!.progression.state;
    const skill = exactSkillLevel(member.mechanics.skills.special, state.specialSkillLevel);
    if (skill.durationMilliseconds === null) {
      throw new Error(`${member.cardId} lacks an exact Special duration`);
    }
    // Public aggregate charts contain note totals but not the rainbow-marker
    // timestamps that start Specials. Do not fabricate five equally-spaced
    // markers. The decision scenario uses time-averaged duration coverage and
    // therefore cannot claim one formation order scores above another.
    const durationCoverage = Math.min(1, skill.durationMilliseconds / song.playingMilliseconds);
    const resolution = resolveLeaderApplications(skill.applications, formation, {
      life: 1_000,
      judgement: "perfect",
      songSingerTalentIds: song.singerTalentIds,
    });
    const alternatives = resolution.alternatives;
    const scoreSupportValues = alternatives.map((alternative) =>
        alternative.reduce(
          (total, application) =>
            total + (application.effect?.kind === "score-support" ? application.effect.value ?? 0 : 0),
          0,
        ),
      );
    const activationRateValues = alternatives.map((alternative) =>
        alternative.reduce(
          (total, application) =>
            total +
            (application.effect?.kind === "activation-rate-up" ? application.effect.value ?? 0 : 0),
          0,
        ),
      );
    const scoreSupportPermil = Math.min(...scoreSupportValues);
    const activationRateUpPermil = Math.min(...activationRateValues);
    const timeAveragedScoreSupportPermil = scoreSupportPermil * durationCoverage;
    const timeAveragedActivationRateUpPermil = activationRateUpPermil * durationCoverage;
    activationRateWindows.push({
      startsAtMilliseconds: 0,
      endsAtMilliseconds: song.playingMilliseconds,
      activationRateUpPermil: timeAveragedActivationRateUpPermil,
    });
    for (const noteIndex of notes.keys()) {
      supportByNote[noteIndex]! += timeAveragedScoreSupportPermil;
      activationRateByNote[noteIndex]! += timeAveragedActivationRateUpPermil;
    }
    const modeledActivationRateCoveragePermil =
      activationRateUpPermil * durationCoverage;
    return {
      slot: slotIndex + 1,
      cardId: member.cardId,
      durationMilliseconds: skill.durationMilliseconds,
      modeledStartsAtMilliseconds: null,
      modeledEndsAtMilliseconds: null,
      modeledNoteCoverage: round(durationCoverage),
      scoreSupportPermil: round(scoreSupportPermil),
      activationRateUpPermil: round(activationRateUpPermil),
      modeledActivationRateCoveragePermil: interval(
        0,
        modeledActivationRateCoveragePermil,
        modeledActivationRateCoveragePermil,
      ),
    };
  });
  return { entries, supportByNote, activationRateByNote, activationRateWindows };
}

function scaledInterval(source: RawInterval, scale: number): UtilityInterval {
  return interval(
    (source.lower * scale) / 1_000,
    (source.central * scale) / 1_000,
    (source.upper * scale) / 1_000,
  );
}

type EnclosedUtilityInterval = Readonly<{
  value: UtilityInterval;
  enclosure: Readonly<{
    lower: Binary64Enclosure;
    central: Binary64Enclosure;
    upper: Binary64Enclosure;
  }>;
}>;

type NativeBulkPostActiveProof = Readonly<{
  kind: "bulk-certified-reference-equivalent";
  scoreSupportSpecialPermil: UtilityInterval;
  activationRateSpecialPermil: UtilityInterval;
  specialPermil: UtilityInterval;
  activeUnits: UtilityInterval;
  scoreSupportSpecialUnits: UtilityInterval;
  activationRateSpecialUnits: UtilityInterval;
  specialUnits: UtilityInterval;
  relativeUtility: UtilityInterval;
}>;

function isOrderedReplayProof(
  value: EnclosedUtilityInterval | OrderedReplayRequired,
): value is OrderedReplayRequired {
  return "kind" in value && value.kind === "ordered-replay-required";
}

function bulkPostActiveFallback(
  fallbackReason: ExactOptimizerBulkFallbackReason,
): OrderedReplayRequired {
  return { kind: "ordered-replay-required", fallbackReason, enclosure: null };
}

function pointUtilityEnclosure(value: UtilityInterval): Readonly<{
  lower: Binary64Enclosure;
  central: Binary64Enclosure;
  upper: Binary64Enclosure;
}> {
  return pointOutputEnclosure(value);
}

function pointOrOutwardBinary64(
  left: Binary64Enclosure,
  right: Binary64Enclosure,
  exact: (left: number, right: number) => number,
  outward: (left: Binary64Enclosure, right: Binary64Enclosure) => Binary64Enclosure | null,
): Binary64Enclosure | null {
  if (Object.is(left.lower, left.upper) && Object.is(right.lower, right.upper)) {
    const value = exact(left.lower, right.lower);
    return Number.isFinite(value) && !Object.is(value, -0) ? pointBinary64Enclosure(value) : null;
  }
  return outward(left, right);
}

function proofAdd(left: Binary64Enclosure, right: Binary64Enclosure): Binary64Enclosure | null {
  return pointOrOutwardBinary64(left, right, (a, b) => a + b, outwardBinary64Add);
}

function proofSubtract(left: Binary64Enclosure, right: Binary64Enclosure): Binary64Enclosure | null {
  return pointOrOutwardBinary64(left, right, (a, b) => a - b, outwardBinary64Subtract);
}

function proofMultiply(left: Binary64Enclosure, right: Binary64Enclosure): Binary64Enclosure | null {
  return pointOrOutwardBinary64(left, right, (a, b) => a * b, outwardBinary64Multiply);
}

function proofDividePositive(source: Binary64Enclosure, divisor: number): Binary64Enclosure | null {
  if (Object.is(source.lower, source.upper)) {
    const value = source.lower / divisor;
    return Number.isFinite(value) && !Object.is(value, -0) ? pointBinary64Enclosure(value) : null;
  }
  return outwardBinary64DividePositive(source, divisor);
}

function proofMax(left: Binary64Enclosure, right: Binary64Enclosure): Binary64Enclosure | null {
  return pointOrOutwardBinary64(left, right, Math.max, outwardBinary64Max);
}

function proofMin(left: Binary64Enclosure, right: Binary64Enclosure): Binary64Enclosure | null {
  return pointOrOutwardBinary64(left, right, Math.min, outwardBinary64Min);
}

function proofUtilityInterval(
  lower: Binary64Enclosure,
  central: Binary64Enclosure,
  upper: Binary64Enclosure,
): EnclosedUtilityInterval | OrderedReplayRequired {
  const certified = certifyCanonicalUtilityInterval({ lower, central, upper });
  if (certified.kind === "ordered-replay-required") return certified;
  return {
    value: certified.value,
    // `interval()` returns `microUnits / 1e6`; after a singleton proof those
    // are exact point inputs to every later source-order operation.
    enclosure: pointUtilityEnclosure(certified.value),
  };
}

function proofScaledInterval(
  source: EnclosedUtilityInterval,
  scale: number,
): EnclosedUtilityInterval | OrderedReplayRequired {
  const scaleEnclosure = pointBinary64Enclosure(scale);
  const thousand = 1_000;
  const lower = proofMultiply(source.enclosure.lower, scaleEnclosure);
  const central = proofMultiply(source.enclosure.central, scaleEnclosure);
  const upper = proofMultiply(source.enclosure.upper, scaleEnclosure);
  if (!lower || !central || !upper) return bulkPostActiveFallback("interval-width-overflow");
  const lowerScaled = proofDividePositive(lower, thousand);
  const centralScaled = proofDividePositive(central, thousand);
  const upperScaled = proofDividePositive(upper, thousand);
  if (!lowerScaled || !centralScaled || !upperScaled) {
    return bulkPostActiveFallback("interval-width-overflow");
  }
  return proofUtilityInterval(lowerScaled, centralScaled, upperScaled);
}

function proofSpecialInterval(
  centralDifference: Binary64Enclosure,
  upperDifference: Binary64Enclosure,
): EnclosedUtilityInterval | OrderedReplayRequired {
  const zero = pointBinary64Enclosure(0);
  const central = proofMax(zero, centralDifference);
  const upper = proofMax(centralDifference, upperDifference);
  if (!central || !upper) return bulkPostActiveFallback("interval-width-overflow");
  return proofUtilityInterval(zero, central, upper);
}

/**
 * Continue the bulk enclosure after the three Active averages. This mirrors
 * native-utility's source-order Special subtraction/max branches, every
 * `interval()` clamp, base-parameter scaling, parameter-effect addition, and
 * final six-decimal boundary. It exists so an Active-average singleton alone
 * is never treated as a final utility certificate.
 */
export function proveNativeBulkPostActiveCanonical(input: Readonly<{
  baseTotal: number;
  parameterEffects: UtilityInterval;
  activePermil: UtilityInterval;
  activeWithSpecialSupportPermil: UtilityInterval;
  activeWithSpecialPermil: UtilityInterval;
}>): NativeBulkPostActiveProof | OrderedReplayRequired {
  const active = { value: input.activePermil, enclosure: pointUtilityEnclosure(input.activePermil) };
  const support = {
    value: input.activeWithSpecialSupportPermil,
    enclosure: pointUtilityEnclosure(input.activeWithSpecialSupportPermil),
  };
  const special = {
    value: input.activeWithSpecialPermil,
    enclosure: pointUtilityEnclosure(input.activeWithSpecialPermil),
  };
  const scoreSupportCentralDifference = proofSubtract(
    support.enclosure.central,
    active.enclosure.central,
  );
  const scoreSupportUpperDifference = proofSubtract(
    support.enclosure.upper,
    active.enclosure.upper,
  );
  const activationCentralDifference = proofSubtract(
    special.enclosure.central,
    support.enclosure.central,
  );
  const activationUpperDifference = proofSubtract(
    special.enclosure.upper,
    support.enclosure.upper,
  );
  const specialCentralDifference = proofSubtract(
    special.enclosure.central,
    active.enclosure.central,
  );
  const specialUpperDifference = proofSubtract(
    special.enclosure.upper,
    active.enclosure.upper,
  );
  if (
    !scoreSupportCentralDifference ||
    !scoreSupportUpperDifference ||
    !activationCentralDifference ||
    !activationUpperDifference ||
    !specialCentralDifference ||
    !specialUpperDifference
  ) {
    return bulkPostActiveFallback("interval-width-overflow");
  }
  const scoreSupportSpecialPermil = proofSpecialInterval(
    scoreSupportCentralDifference,
    scoreSupportUpperDifference,
  );
  if (isOrderedReplayProof(scoreSupportSpecialPermil)) return scoreSupportSpecialPermil;
  const activationRateSpecialPermil = proofSpecialInterval(
    activationCentralDifference,
    activationUpperDifference,
  );
  if (isOrderedReplayProof(activationRateSpecialPermil)) return activationRateSpecialPermil;
  const specialPermil = proofSpecialInterval(specialCentralDifference, specialUpperDifference);
  if (isOrderedReplayProof(specialPermil)) return specialPermil;

  const activeUnits = proofScaledInterval(active, input.baseTotal);
  if (isOrderedReplayProof(activeUnits)) return activeUnits;
  const scoreSupportSpecialUnits = proofScaledInterval(scoreSupportSpecialPermil, input.baseTotal);
  if (isOrderedReplayProof(scoreSupportSpecialUnits)) return scoreSupportSpecialUnits;
  const activationRateSpecialUnits = proofScaledInterval(activationRateSpecialPermil, input.baseTotal);
  if (isOrderedReplayProof(activationRateSpecialUnits)) return activationRateSpecialUnits;
  const specialUnits = proofScaledInterval(specialPermil, input.baseTotal);
  if (isOrderedReplayProof(specialUnits)) return specialUnits;

  const base = pointBinary64Enclosure(input.baseTotal);
  const parameterEffects = pointUtilityEnclosure(input.parameterEffects);
  const lowerBaseAndParameter = proofAdd(base, parameterEffects.lower);
  const centralBaseAndParameter = proofAdd(base, parameterEffects.central);
  const upperBaseAndParameter = proofAdd(base, parameterEffects.upper);
  if (!lowerBaseAndParameter || !centralBaseAndParameter || !upperBaseAndParameter) {
    return bulkPostActiveFallback("interval-width-overflow");
  }
  const lowerWithActive = proofAdd(lowerBaseAndParameter, activeUnits.enclosure.lower);
  const centralWithActive = proofAdd(centralBaseAndParameter, activeUnits.enclosure.central);
  const upperWithActive = proofAdd(upperBaseAndParameter, activeUnits.enclosure.upper);
  if (!lowerWithActive || !centralWithActive || !upperWithActive) {
    return bulkPostActiveFallback("interval-width-overflow");
  }
  const lowerFinal = proofAdd(lowerWithActive, specialUnits.enclosure.lower);
  const centralFinal = proofAdd(centralWithActive, specialUnits.enclosure.central);
  const upperFinal = proofAdd(upperWithActive, specialUnits.enclosure.upper);
  if (!lowerFinal || !centralFinal || !upperFinal) {
    return bulkPostActiveFallback("interval-width-overflow");
  }
  const relativeUtility = proofUtilityInterval(lowerFinal, centralFinal, upperFinal);
  if (isOrderedReplayProof(relativeUtility)) return relativeUtility;
  return {
    kind: "bulk-certified-reference-equivalent",
    scoreSupportSpecialPermil: scoreSupportSpecialPermil.value,
    activationRateSpecialPermil: activationRateSpecialPermil.value,
    specialPermil: specialPermil.value,
    activeUnits: activeUnits.value,
    scoreSupportSpecialUnits: scoreSupportSpecialUnits.value,
    activationRateSpecialUnits: activationRateSpecialUnits.value,
    specialUnits: specialUnits.value,
    relativeUtility: relativeUtility.value,
  };
}

function assumptions(input: NativeUtilityInput): UtilityAssumption[] {
  return [
    {
      id: STANDARD_MANUAL_AP_FULL_LIFE_CONTEXT_ID,
      evidenceGrade: "modeled",
      ruleId: null,
      sourceRefs: songContextData.rules.manualLive.source
        ? [songContextData.rules.manualLive.source.url]
        : [],
      statement: "Manual play is modeled as all Perfect with full Life for the named exact chart.",
    },
    {
      id: AGGREGATE_UNIFORM_NOTE_TIMING_MODEL_ID,
      evidenceGrade: "modeled",
      ruleId: "timed-note-events",
      sourceRefs: [],
      statement:
        "Aggregate notes are placed at equal time intervals for Active-skill exposure; no exact note timeline is claimed.",
    },
    {
      id: AGGREGATE_SPECIAL_COVERAGE_MODEL_ID,
      evidenceGrade: "modeled",
      ruleId: "special-timeline",
      sourceRefs: [],
      statement:
        "Rainbow-marker timestamps are unavailable. Specials use duration divided by song length as timing-agnostic expected coverage, so formation order has no modeled score advantage.",
    },
    ruleAssumption(
      "corroborated-score-support-add-then-multiply-v1",
      "score-support-combination",
    ),
    ruleAssumption(
      "recipient-allocation-enumerated-interval-v1",
      "passive-target-selection-order",
      "Lower and central use the guaranteed minimum across legal capped-recipient subsets; upper records the maximum. No probability distribution over the unknown deterministic resolver is invented.",
    ),
    ruleAssumption(
      "parameter-effect-additive-scenario-v1",
      "effect-stacking-and-rounding",
      "Every active parameter effect is added once. Lower, central, and upper vary only its enumerated capped-recipient allocation; no undocumented multiplicative stacking is assumed.",
    ),
    ruleAssumption(
      "active-overlap-conservative-interval-v1",
      "active-skill-collision",
      "Lower assumes complete overlap, central uses independent activation with strongest-effect selection, and upper sums non-overlapping opportunities.",
    ),
    {
      id: "active-first-check-at-cooldown-model-v1",
      evidenceGrade: "modeled",
      ruleId: "active-skill-collision",
      sourceRefs: [],
      statement:
        "The aggregate timing model places each first Active check one cooldown after the start and repeats at exact cooldown intervals.",
    },
    {
      id: "parameter-equivalent-relative-unit-v1",
      evidenceGrade: "modeled",
      ruleId: "runtime-score-equation",
      sourceRefs: [],
      statement:
        "Exact parameter totals anchor relative units; effect components are provisional deltas, not an absolute result equation.",
    },
    {
      id: "linear-unbuffed-parameter-skill-base-v1",
      evidenceGrade: "modeled",
      ruleId: "runtime-score-equation",
      sourceRefs: [],
      statement:
        "Active and Special exposure is converted to relative units against the exact unbuffed team parameter total; no undocumented parameter-skill cross term or runtime operation order is assumed.",
    },
    {
      id: "special-activation-rate-additive-capped-model-v1",
      evidenceGrade: "modeled",
      ruleId: "active-skill-collision",
      sourceRefs: [],
      statement:
        "Central applies duration-weighted Special activation-rate coverage to Active checks and caps probability at 1000; lower retains the base probability because rainbow-marker timing remains unresolved.",
    },
    {
      id: "caller-declared-neutral-board-v1",
      evidenceGrade: input.accountState.board.evidenceGrade,
      ruleId: null,
      sourceRefs: [input.accountState.board.evidenceRef],
      statement: "The caller explicitly declares an evidenced neutral Board contribution.",
    },
  ];
}

function evaluateNativeRelativeUtilityWithIntrinsic(
  input: NativeUtilityInput,
  intrinsic: NativeUtilityTeamIntrinsic,
  forceUncompressed = false,
  forceOrderedStateRuns = false,
): NativeUtilityTraceEvaluation {
  assertInputBoundary(input);
  const chart = aggregateChartByKey.get(input.chartKey);
  if (!chart) throw new Error(`Unknown exact aggregate chart context: ${input.chartKey}`);
  const song = songById.get(chart.songId);
  if (!song) throw new Error(`Chart ${chart.key} has no pinned song context`);

  const legal = assertLegalFormation(input.formation);
  const observation: TriggerObservation = {
    combo: chart.fullComboNoteCount,
    life: 1_000,
    judgement: "perfect",
    songSingerTalentIds: song.singerTalentIds,
  };
  const evaluator = evaluateFormation(input.formation, {
    chart,
    song,
    policy: provisionalRuntimePolicy(input.seed, 1),
    accountState: input.accountState,
    observation,
    runActiveSimulation: false,
  });

  const baseMembers = evaluator.members.map((member) => {
    const parameters = member.progression.parameters;
    return {
      cardId: member.cardId,
      formationIndex: member.formationIndex,
      parameters,
      total: parameters.performance + parameters.technique + parameters.sense,
    };
  });
  const baseTotal = baseMembers.reduce((total, member) => total + member.total, 0);
  const parameterEffects = compileParameterEffects(
    evaluator,
    baseMembers.map((member) => member.parameters),
  );
  const support = compilePersistentSupport(
    evaluator,
    baseMembers.map((member) => member.cardId),
  );
  const notes = uniformNotes(chart, song);
  const activeProfiles = compileActiveProfiles(legal, evaluator, support, song, chart);
  const specials = compileSpecials(notes, legal, evaluator, song);
  const activeTrace = compileActiveTrace(
    chart.key,
    notes,
    activeProfiles,
    legal,
    song,
    intrinsic,
  );
  const specialSupport = constantByNote(specials.supportByNote);
  const specialActivationRate = fullChartActivationRate(
    specials.activationRateWindows,
    song.playingMilliseconds,
  );
  let fallbackStates: NoteActiveState[][] | null = null;
  let activePermil: RawInterval;
  let activeWithSpecialSupportPermil: RawInterval;
  let activeWithSpecialPermil: RawInterval;
  let activeTraceExecution: NativeActiveTraceExecution;
  let bulkPostActiveProof: NativeBulkPostActiveProof | null = null;
  if (
    !forceUncompressed &&
    activeTrace.supported &&
    specialSupport !== null &&
    specialActivationRate !== null
  ) {
    let base = aggregateCompressedActiveInterval(
      activeTrace,
      notes.length,
      0,
      0,
      forceOrderedStateRuns,
    );
    let supportPass = aggregateCompressedActiveInterval(
      activeTrace,
      notes.length,
      specialSupport,
      0,
      forceOrderedStateRuns,
    );
    let specialPass = aggregateCompressedActiveInterval(
      activeTrace,
      notes.length,
      specialSupport,
      specialActivationRate,
      forceOrderedStateRuns,
    );
    activePermil = base.value;
    activeWithSpecialSupportPermil = supportPass.value;
    activeWithSpecialPermil = specialPass.value;
    const allPassesBulkCertified =
      base.bulk.mode === "bulk-certified-reference-equivalent" &&
      supportPass.bulk.mode === "bulk-certified-reference-equivalent" &&
      specialPass.bulk.mode === "bulk-certified-reference-equivalent";
    let finalBulkFallbackReason: ExactOptimizerBulkFallbackReason | null = null;
    if (allPassesBulkCertified) {
      const postActiveProof = proveNativeBulkPostActiveCanonical({
        baseTotal,
        parameterEffects: parameterEffects.relativeUnits,
        activePermil,
        activeWithSpecialSupportPermil,
        activeWithSpecialPermil,
      });
      if (postActiveProof.kind === "ordered-replay-required") {
        finalBulkFallbackReason = postActiveProof.fallbackReason;
        // The proof became ambiguous only after later source-order arithmetic.
        // Replay the three Active components, not the complete formation.
        base = orderedReplayCompressedActiveInterval(
          activeTrace,
          notes.length,
          0,
          0,
          postActiveProof.fallbackReason,
        );
        supportPass = orderedReplayCompressedActiveInterval(
          activeTrace,
          notes.length,
          specialSupport,
          0,
          postActiveProof.fallbackReason,
        );
        specialPass = orderedReplayCompressedActiveInterval(
          activeTrace,
          notes.length,
          specialSupport,
          specialActivationRate,
          postActiveProof.fallbackReason,
        );
        activePermil = base.value;
        activeWithSpecialSupportPermil = supportPass.value;
        activeWithSpecialPermil = specialPass.value;
      } else {
        bulkPostActiveProof = postActiveProof;
      }
    }
    activeTraceExecution = {
      mode: "trace-preserving-state-runs",
      noteCount: notes.length,
      baseStateRuns: base.stateRuns,
      specialSupportStateRuns: supportPass.stateRuns,
      specialStateRuns: specialPass.stateRuns,
      fallbackReason: null,
      bulk: {
        methodologyVersion: "yd-exact-optimizer-bulk-accumulation-1.0.0",
        mode:
          base.bulk.mode === "bulk-certified-reference-equivalent" &&
          supportPass.bulk.mode === "bulk-certified-reference-equivalent" &&
          specialPass.bulk.mode === "bulk-certified-reference-equivalent"
            ? "bulk-certified-reference-equivalent"
            : "ordered-replay",
        finalCanonical:
          bulkPostActiveProof !== null
            ? "bulk-certified-reference-equivalent"
            : finalBulkFallbackReason !== null
              ? "ordered-replay"
              : "not-attempted",
        certifiedRunCount:
          base.bulk.certifiedRunCount +
          supportPass.bulk.certifiedRunCount +
          specialPass.bulk.certifiedRunCount,
        orderedReplayRunCount:
          base.bulk.orderedReplayRunCount +
          supportPass.bulk.orderedReplayRunCount +
          specialPass.bulk.orderedReplayRunCount,
        fallbackReason:
          finalBulkFallbackReason ??
          base.bulk.fallbackReason ??
          supportPass.bulk.fallbackReason ??
          specialPass.bulk.fallbackReason,
      },
    };
  } else {
    fallbackStates = noteActiveStates(notes, activeProfiles, legal, song);
    const noSpecialEffect = notes.map(() => 0);
    const noActivationRateWindows: ActivationRateWindow[] = [];
    activePermil = aggregateActiveIntervalUncompressed(
      fallbackStates,
      activeProfiles,
      noSpecialEffect,
      noActivationRateWindows,
    );
    activeWithSpecialSupportPermil = aggregateActiveIntervalUncompressed(
      fallbackStates,
      activeProfiles,
      specials.supportByNote,
      noActivationRateWindows,
    );
    activeWithSpecialPermil = aggregateActiveIntervalUncompressed(
      fallbackStates,
      activeProfiles,
      specials.supportByNote,
      specials.activationRateWindows,
    );
    activeTraceExecution = {
      mode: "uncompressed-fallback",
      noteCount: notes.length,
      baseStateRuns: 0,
      specialSupportStateRuns: 0,
      specialStateRuns: 0,
      fallbackReason:
        forceUncompressed
          ? "forced-uncompressed-cross-check"
          : activeTrace.fallbackReason ??
            (specialSupport === null
              ? "special-support-is-not-constant-by-note"
              : "activation-rate-window-is-not-full-chart"),
      bulk: {
        methodologyVersion: "yd-exact-optimizer-bulk-accumulation-1.0.0",
        mode: "not-attempted",
        finalCanonical: "not-attempted",
        certifiedRunCount: 0,
        orderedReplayRunCount: 0,
        fallbackReason: null,
      },
    };
  }
  const scoreSupportSpecialPermil = interval(
    0,
    Math.max(0, activeWithSpecialSupportPermil.central - activePermil.central),
    Math.max(
      activeWithSpecialSupportPermil.central - activePermil.central,
      activeWithSpecialSupportPermil.upper - activePermil.upper,
    ),
  );
  const activationRateSpecialPermil = interval(
    0,
    Math.max(0, activeWithSpecialPermil.central - activeWithSpecialSupportPermil.central),
    Math.max(
      activeWithSpecialPermil.central - activeWithSpecialSupportPermil.central,
      activeWithSpecialPermil.upper - activeWithSpecialSupportPermil.upper,
    ),
  );
  const specialPermil = interval(
    0,
    Math.max(0, activeWithSpecialPermil.central - activePermil.central),
    Math.max(
      activeWithSpecialPermil.central - activePermil.central,
      activeWithSpecialPermil.upper - activePermil.upper,
    ),
  );
  const activeUnits = scaledInterval(activePermil, baseTotal);
  const scoreSupportSpecialUnits = scaledInterval(scoreSupportSpecialPermil, baseTotal);
  const activationRateSpecialUnits = scaledInterval(activationRateSpecialPermil, baseTotal);
  const specialUnits = scaledInterval(specialPermil, baseTotal);
  const modeledAverageActivationRateUpPermil = mean(specials.activationRateByNote);
  const relativeUtility = interval(
    baseTotal +
      parameterEffects.relativeUnits.lower +
      activeUnits.lower +
      specialUnits.lower,
    baseTotal +
      parameterEffects.relativeUnits.central +
      activeUnits.central +
      specialUnits.central,
    baseTotal +
      parameterEffects.relativeUnits.upper +
      activeUnits.upper +
      specialUnits.upper,
  );
  if (bulkPostActiveProof) {
    const sameInterval = (left: UtilityInterval, right: UtilityInterval): boolean =>
      left.lower === right.lower && left.central === right.central && left.upper === right.upper;
    if (
      !sameInterval(scoreSupportSpecialPermil, bulkPostActiveProof.scoreSupportSpecialPermil) ||
      !sameInterval(activationRateSpecialPermil, bulkPostActiveProof.activationRateSpecialPermil) ||
      !sameInterval(specialPermil, bulkPostActiveProof.specialPermil) ||
      !sameInterval(activeUnits, bulkPostActiveProof.activeUnits) ||
      !sameInterval(scoreSupportSpecialUnits, bulkPostActiveProof.scoreSupportSpecialUnits) ||
      !sameInterval(activationRateSpecialUnits, bulkPostActiveProof.activationRateSpecialUnits) ||
      !sameInterval(specialUnits, bulkPostActiveProof.specialUnits) ||
      !sameInterval(relativeUtility, bulkPostActiveProof.relativeUtility)
    ) {
      throw new Error("Bulk post-Active proof diverged from the ordered native arithmetic path");
    }
  }

  const activeByMember: ActiveMemberUtility[] = activeProfiles.map((profile, memberIndex) => {
    let averageProbability: number;
    let averageBoostedProbability: number;
    if (activeTraceExecution.mode === "trace-preserving-state-runs") {
      let probabilityTotal = 0;
      let boostedProbabilityTotal = 0;
      const checkCounts = activeTrace.checkCountsByMember[memberIndex]!;
      for (let noteIndex = 0; noteIndex < checkCounts.length; noteIndex += 1) {
        const checkCount = checkCounts[noteIndex]!;
        probabilityTotal += activeProbabilityForCheckCount(
          checkCount,
          profile.skill.activationProbabilityPermil!,
        );
        boostedProbabilityTotal += activeProbabilityForCheckCount(
          checkCount,
          profile.skill.activationProbabilityPermil!,
          specialActivationRate!,
        );
      }
      averageProbability = probabilityTotal / checkCounts.length;
      averageBoostedProbability = boostedProbabilityTotal / checkCounts.length;
    } else {
      const states = fallbackStates!;
      averageProbability = mean(states.map((note) => note[memberIndex]!.probability));
      averageBoostedProbability = mean(
        states.map((note) => {
          const state = note[memberIndex]!;
          return activeProbabilityForChecks(
            state.checkTimesMilliseconds,
            state.baseProbabilityPermil,
            specials.activationRateWindows,
          );
        }),
      );
    }
    const solo = interval(
      averageProbability *
        ((profile.fullComboSelection.lower * (1_000 + profile.support.lower)) / 1_000),
      averageProbability *
        ((profile.fullComboSelection.central * (1_000 + profile.support.central)) / 1_000),
      averageProbability *
        ((profile.fullComboSelection.upper * (1_000 + profile.support.upper)) / 1_000),
    );
    return {
      cardId: profile.cardId,
      baseUpPermil: profile.baseUpPermil,
      conditionalOverrideUpPermil: profile.conditionalOverrideUpPermil,
      selectedAtFullComboPermil: profile.fullComboSelection,
      activationProbabilityPermil: profile.skill.activationProbabilityPermil!,
      cooldownMilliseconds: profile.skill.cooldownMilliseconds!,
      durationMilliseconds: profile.skill.durationMilliseconds!,
      modeledActiveNoteCoverage: round(averageProbability),
      modeledActiveNoteCoverageInterval: interval(
        averageProbability,
        averageBoostedProbability,
        averageBoostedProbability,
      ),
      modeledSoloEffectiveUpPermil: solo,
    };
  });

  return {
    result: {
      kind: "provisional-relative-utility",
    methodologyVersion: "yd-native-utility-1.0.0",
    status: "provisional",
    context: {
      id: `${STANDARD_MANUAL_AP_FULL_LIFE_CONTEXT_ID}@${chart.key}`,
      chartKey: chart.key,
      songId: song.id,
      songTitle: song.title,
      difficulty: chart.difficulty,
      fidelity: "aggregate",
      playMode: "manual",
      judgement: "perfect",
      life: 1_000,
      noteCount: chart.fullComboNoteCount,
      durationMilliseconds: song.playingMilliseconds,
      timingModelId: AGGREGATE_UNIFORM_NOTE_TIMING_MODEL_ID,
    },
    assumptions: assumptions(input),
    relativeUtility,
    components: {
      baseParameters: {
        evidenceGrade: "verified",
        byMember: baseMembers,
        relativeUnits: exactInterval(baseTotal),
      },
      parameterEffects: {
        evidenceGrade: "unresolved",
        contributions: parameterEffects.contributions,
        relativeUnits: parameterEffects.relativeUnits,
      },
      persistentScoreSupport: {
        evidenceGrade: "corroborated",
        formula: {
          evidenceGrade: "corroborated",
          ruleId: "score-support-combination",
          expression: "activeUpPermil * (1000 + summedSupportPermil) / 1000",
        },
        byMember: support.map((entry) => ({
          cardId: entry.cardId,
          supportPermil: entry.raw,
        })),
      },
      active: {
        evidenceGrade: "modeled",
        overlapEvidenceGrade: "unresolved",
        averageEffectiveUpPermil: activePermil,
        byMember: activeByMember,
        relativeUnits: activeUnits,
      },
      special: {
        evidenceGrade: "modeled",
        byFormationOrder: specials.entries,
        scoreSupportRelativeUnits: scoreSupportSpecialUnits,
        activationRate: {
          evidenceGrade: "modeled",
          operation: "additive-permil-capped-at-1000",
          modeledAverageActivationRateUpPermil: interval(
            0,
            modeledAverageActivationRateUpPermil,
            modeledAverageActivationRateUpPermil,
          ),
          relativeUnits: activationRateSpecialUnits,
        },
        relativeUnits: specialUnits,
      },
      board: {
        evidenceGrade: input.accountState.board.evidenceGrade,
        evidenceRef: input.accountState.board.evidenceRef,
        relativeUnits: exactInterval(0),
      },
    },
      uncertainty: {
        recipientAllocation: "enumerated",
        stacking: "declared-additive-scenario",
        activeOverlap: "conservative-interval",
        specialTiming: AGGREGATE_SPECIAL_COVERAGE_MODEL_ID,
      },
    },
    activeTrace: activeTraceExecution,
  };
}

/**
 * Evaluate with a caller-owned Member-only intrinsic cache.  The cache is
 * checked against the formation before use, so a Leader-specific formation can
 * never inherit another team's timing state.
 */
export function evaluateNativeRelativeUtilityWithCompiledTeam(
  input: NativeUtilityInput,
  intrinsic: NativeUtilityTeamIntrinsic,
): NativeUtilityTraceEvaluation {
  const inputKey = teamIntrinsicKey(input.formation.members);
  const intrinsicKey = teamIntrinsicKey(intrinsic.members);
  if (inputKey !== intrinsicKey) {
    throw new Error("Native utility compiled team does not match formation Members");
  }
  return evaluateNativeRelativeUtilityWithIntrinsic(input, intrinsic);
}

/**
 * Central-only B2 entrypoint. It intentionally returns no lower/upper tuple;
 * callers may prune only on a strict certified central loss. Equality and
 * finalist cases must promote to `evaluateNativeRelativeUtilityWithCompiledTeam`
 * for B3 materialization.
 */
export function evaluateNativeCentralUtilityWithCompiledTeam(
  input: NativeUtilityInput,
  intrinsic: NativeUtilityTeamIntrinsic,
): NativeCentralUtilityTraceEvaluation {
  const inputKey = teamIntrinsicKey(input.formation.members);
  const intrinsicKey = teamIntrinsicKey(intrinsic.members);
  if (inputKey !== intrinsicKey) {
    throw new Error("Native utility compiled team does not match formation Members");
  }
  assertInputBoundary(input);
  const chart = aggregateChartByKey.get(input.chartKey);
  if (!chart) throw new Error(`Unknown exact aggregate chart context: ${input.chartKey}`);
  const song = songById.get(chart.songId);
  if (!song) throw new Error(`Chart ${chart.key} has no pinned song context`);
  const legal = assertLegalFormation(input.formation);
  const observation: TriggerObservation = {
    combo: chart.fullComboNoteCount,
    life: 1_000,
    judgement: "perfect",
    songSingerTalentIds: song.singerTalentIds,
  };
  const evaluator = evaluateFormation(input.formation, {
    chart,
    song,
    policy: provisionalRuntimePolicy(input.seed, 1),
    accountState: input.accountState,
    observation,
    runActiveSimulation: false,
  });
  const baseMembers = evaluator.members.map((member) => ({
    cardId: member.cardId,
    parameters: member.progression.parameters,
    total:
      member.progression.parameters.performance +
      member.progression.parameters.technique +
      member.progression.parameters.sense,
  }));
  const baseTotal = baseMembers.reduce((total, member) => total + member.total, 0);
  const parameterEffects = compileParameterEffects(
    evaluator,
    baseMembers.map((member) => member.parameters),
  );
  const support = compilePersistentSupport(
    evaluator,
    baseMembers.map((member) => member.cardId),
  );
  const notes = uniformNotes(chart, song);
  const activeProfiles = compileActiveProfiles(legal, evaluator, support, song, chart);
  const specials = compileSpecials(notes, legal, evaluator, song);
  const activeTrace = compileActiveTrace(
    chart.key,
    notes,
    activeProfiles,
    legal,
    song,
    intrinsic,
  );
  const specialSupport = constantByNote(specials.supportByNote);
  const specialActivationRate = fullChartActivationRate(
    specials.activationRateWindows,
    song.playingMilliseconds,
  );
  const fallback = (
    fallbackReason: ExactOptimizerBulkFallbackReason,
    baseStateRuns = 0,
    supportStateRuns = 0,
    specialStateRuns = 0,
  ): NativeCentralUtilityTraceEvaluation => ({
    kind: "ordered-replay-required",
    central: null,
    fallbackReason,
    activeTrace: {
      mode: "uncompressed-fallback",
      noteCount: notes.length,
      baseStateRuns,
      specialSupportStateRuns: supportStateRuns,
      specialStateRuns,
      fallbackReason,
      bulk: {
        methodologyVersion: "yd-exact-optimizer-bulk-accumulation-1.0.0",
        mode: "not-attempted",
        finalCanonical: "not-attempted",
        certifiedRunCount: 0,
        orderedReplayRunCount: 0,
        fallbackReason,
      },
    },
  });
  if (!activeTrace.supported || specialSupport === null || specialActivationRate === null) {
    return fallback("unsupported-operation-path");
  }
  const precondition = centralBulkPrecondition(
    activeTrace,
    activeProfiles,
    baseTotal,
    parameterEffects.relativeUnits,
  );
  if (precondition) return fallback(precondition);

  const base = aggregateCompressedActiveCentral(activeTrace, notes.length, 0, 0);
  if (base.kind === "ordered-replay-required") {
    return fallback(base.fallbackReason, base.stateRuns);
  }
  const supportPass = aggregateCompressedActiveCentral(
    activeTrace,
    notes.length,
    specialSupport,
    0,
  );
  if (supportPass.kind === "ordered-replay-required") {
    return fallback(supportPass.fallbackReason, base.stateRuns, supportPass.stateRuns);
  }
  const specialPass = aggregateCompressedActiveCentral(
    activeTrace,
    notes.length,
    specialSupport,
    specialActivationRate,
  );
  if (specialPass.kind === "ordered-replay-required") {
    return fallback(
      specialPass.fallbackReason,
      base.stateRuns,
      supportPass.stateRuns,
      specialPass.stateRuns,
    );
  }

  // This is the central-only source-order continuation. The precondition above
  // proves that every corresponding `interval()` clamp is identity on central.
  const scoreSupportSpecialPermil = round(Math.max(0, supportPass.value - base.value));
  const activationRateSpecialPermil = round(Math.max(0, specialPass.value - supportPass.value));
  const specialPermil = round(Math.max(0, specialPass.value - base.value));
  const activeUnits = round((base.value * baseTotal) / 1_000);
  const scoreSupportSpecialUnits = round((scoreSupportSpecialPermil * baseTotal) / 1_000);
  const activationRateSpecialUnits = round((activationRateSpecialPermil * baseTotal) / 1_000);
  const specialUnits = round((specialPermil * baseTotal) / 1_000);
  const central = round(
    baseTotal + parameterEffects.relativeUnits.central + activeUnits + specialUnits,
  );
  const finalCanonical = certifyCanonicalMicroUnitEnclosure(pointBinary64Enclosure(central));
  if (finalCanonical.kind === "ordered-replay-required") {
    return fallback(
      finalCanonical.fallbackReason,
      base.stateRuns,
      supportPass.stateRuns,
      specialPass.stateRuns,
    );
  }
  // Keep otherwise-unused central Special components in the exact source order
  // so a future refactor cannot silently omit their clamp/rounding boundary.
  if (
    !Number.isFinite(scoreSupportSpecialUnits) ||
    !Number.isFinite(activationRateSpecialUnits) ||
    !Number.isFinite(central)
  ) {
    return fallback(
      "unsupported-nonfinite-value",
      base.stateRuns,
      supportPass.stateRuns,
      specialPass.stateRuns,
    );
  }
  return {
    kind: "bulk-certified-reference-equivalent",
    central: fromCanonicalMicroUnits(finalCanonical.canonicalMicroUnits),
    fallbackReason: null,
    activeTrace: {
      mode: "trace-preserving-state-runs",
      noteCount: notes.length,
      baseStateRuns: base.stateRuns,
      specialSupportStateRuns: supportPass.stateRuns,
      specialStateRuns: specialPass.stateRuns,
      fallbackReason: null,
      bulk: {
        methodologyVersion: "yd-exact-optimizer-bulk-accumulation-1.0.0",
        mode: "bulk-certified-reference-equivalent",
        finalCanonical: "bulk-certified-reference-equivalent",
        certifiedRunCount:
          base.certifiedRunCount + supportPass.certifiedRunCount + specialPass.certifiedRunCount,
        orderedReplayRunCount: 0,
        fallbackReason: null,
      },
    },
  };
}

/** Exposes execution evidence while retaining the existing result contract. */
export function evaluateNativeRelativeUtilityWithTrace(
  input: NativeUtilityInput,
): NativeUtilityTraceEvaluation {
  return evaluateNativeRelativeUtilityWithIntrinsic(
    input,
    cachedNativeUtilityTeamIntrinsic(input.formation.members),
  );
}

/** Independent fallback path used only for exact compression cross-checks. */
export function evaluateNativeRelativeUtilityUncompressed(
  input: NativeUtilityInput,
): NativeUtilityResult {
  return evaluateNativeRelativeUtilityWithIntrinsic(
    input,
    cachedNativeUtilityTeamIntrinsic(input.formation.members),
    true,
  ).result;
}

/**
 * Independent ordered reference over the compiled state-run scheduler.
 *
 * Unlike the bulk evaluator this expands every scheduled note contribution
 * through the native binary64 `sum += contribution` recurrence.  Unlike the
 * uncompressed cross-check it still proves that run scheduling itself has not
 * changed.  It exists for parity/research evidence and is not a pruning path.
 */
export function evaluateNativeRelativeUtilityWithOrderedStateRuns(
  input: NativeUtilityInput,
): NativeUtilityTraceEvaluation {
  return evaluateNativeRelativeUtilityWithIntrinsic(
    input,
    cachedNativeUtilityTeamIntrinsic(input.formation.members),
    false,
    true,
  );
}

export function evaluateNativeRelativeUtility(input: NativeUtilityInput): NativeUtilityResult {
  return evaluateNativeRelativeUtilityWithTrace(input).result;
}
