import {
  assertLegalFormation,
  evaluateFormation,
  provisionalRuntimePolicy,
  resolveActiveApplications,
  resolveLeaderApplications,
  type EvidenceGrade,
  type FormationInput,
  type LegalFormation,
  type SkillApplication,
  type TriggerObservation,
} from "./formation-evaluator";
import { mechanicsData, type CardMechanics } from "./mechanics";
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
  });
  const parameters = evaluator.members.map((member) => member.progression.parameters);
  const memberCardIds = evaluator.members.map((member) => member.cardId);
  const baseTotal = parameters.reduce(
    (total, value) => total + value.performance + value.technique + value.sense,
    0,
  );
  const parameterEffects = compileParameterEffects(evaluator, parameters);
  const support = compilePersistentSupport(evaluator, memberCardIds);
  const notes = uniformNotes(chart, song);
  const activeProfiles = compileActiveProfiles(legal, evaluator, support, song, chart);
  const states = noteActiveStates(notes, activeProfiles, legal, song);
  const specials = compileSpecials(notes, legal, evaluator, song);
  const activeWithSpecialPermil = aggregateActiveInterval(
    states,
    activeProfiles,
    specials.supportByNote,
    specials.activationRateWindows,
  );
  return round(
    baseTotal +
      parameterEffects.relativeUnits.central +
      (activeWithSpecialPermil.central * baseTotal) / 1_000,
  );
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
type ActivationRateWindow = {
  startsAtMilliseconds: number;
  endsAtMilliseconds: number;
  activationRateUpPermil: number;
};

const aggregateChartByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));
const songById = new Map(songContextData.songs.map((song) => [song.id, song]));
const uniformNotesByChartKey = new Map<string, UniformNote[]>();

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

function expectedMaximum(values: readonly { value: number; probability: number }[]): number {
  const ordered = [...values]
    .filter((entry) => entry.value > 0 && entry.probability > 0)
    .sort((left, right) => right.value - left.value);
  let result = 0;
  let noHigherProbability = 1;
  for (let index = 0; index < ordered.length; ) {
    const value = ordered[index]!.value;
    let noMemberInGroup = 1;
    let cursor = index;
    while (cursor < ordered.length && Math.abs(ordered[cursor]!.value - value) < 1e-9) {
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

function aggregateActiveInterval(
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

export function evaluateNativeRelativeUtility(input: NativeUtilityInput): NativeUtilityResult {
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
  const states = noteActiveStates(notes, activeProfiles, legal, song);
  const noSpecialEffect = notes.map(() => 0);
  const noActivationRateWindows: ActivationRateWindow[] = [];
  const activePermil = aggregateActiveInterval(
    states,
    activeProfiles,
    noSpecialEffect,
    noActivationRateWindows,
  );
  const specials = compileSpecials(notes, legal, evaluator, song);
  const activeWithSpecialSupportPermil = aggregateActiveInterval(
    states,
    activeProfiles,
    specials.supportByNote,
    noActivationRateWindows,
  );
  const activeWithSpecialPermil = aggregateActiveInterval(
    states,
    activeProfiles,
    specials.supportByNote,
    specials.activationRateWindows,
  );
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

  const activeByMember: ActiveMemberUtility[] = activeProfiles.map((profile, memberIndex) => {
    const averageProbability = mean(states.map((note) => note[memberIndex]!.probability));
    const averageBoostedProbability = mean(
      states.map((note) => {
        const state = note[memberIndex]!;
        return activeProbabilityForChecks(
          state.checkTimesMilliseconds,
          state.baseProbabilityPermil,
          specials.activationRateWindows,
        );
      }),
    );
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
  };
}
