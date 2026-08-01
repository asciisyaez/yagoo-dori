import {
  assertLegalFormation,
  enumerateSpecialOrders,
  evaluateFormation,
  provisionalRuntimePolicy,
  resolveActiveApplications,
  resolveCardInvestmentState,
  resolveLeaderApplications,
  type BloomStage,
  type LegalFormation,
  type SkillApplication,
} from "./formation-evaluator";
import type { CardMechanics } from "./mechanics";
import {
  rankingCorpusTimelineByKey,
  type RankingCorpusTimeline,
} from "./ranking-corpus-timelines";
import { TIMELINE_NOTE_TYPES } from "./chart-timeline-parser";
import { songContextData } from "./song-contexts";

type Five<T> = readonly [T, T, T, T, T];
type SkillLevel = CardMechanics["skills"]["special"][number];

const LOW_DISCREPANCY_LAYOUT_COUNT = 8;
const LOW_DISCREPANCY_SEED = 17;
const HALTON_BASES = [2, 3, 5, 7, 11] as const;
const PERMILLION = 1_000_000;
const REGRET_SCALE_PERMIL = 1_000;
const OBJECTIVE_EPSILON = 1e-9;

/** One basis point of regret is too small to present as a meaningful winner. */
export const FORMATION_ORDER_TINY_MARGIN_PERMIL = 0.1;

export type FormationOrderMember = Readonly<{
  cardId: string;
  bloomStage: BloomStage;
}>;

export type FormationOrderCorpusEntry = Readonly<{
  chartKey: string;
  expectedChartHash: string;
}>;

export type FormationOrderRecommenderInput = Readonly<{
  leaderOutfitCardId: string;
  members: Five<FormationOrderMember>;
  corpus: readonly FormationOrderCorpusEntry[];
  corpusMode?: "frozen-30-chart" | "exact-song";
  exactTimelineByKey?: ReadonlyMap<string, RankingCorpusTimeline>;
}>;

export type FormationOrderMarkerLayout = Readonly<{
  id: string;
  family: "low-discrepancy" | "stress" | "exact";
  description: string;
  markerPositionsPermillion: Five<number> | null;
}>;

export type FormationOrderComponent = Readonly<{
  cardId: string;
  bloomStage: BloomStage;
  recommendedSlot: 1 | 2 | 3 | 4 | 5;
  active: Readonly<{
    level: number;
    cooldownMilliseconds: number;
    durationMilliseconds: number;
    activationProbabilityPermil: number;
    persistentSupportPermilAcrossCorpus: Readonly<{
      minimum: number;
      maximum: number;
    }>;
  }>;
  special: Readonly<{
    level: number;
    durationMilliseconds: number;
    scoreSupportPermilAtFullComboWithoutSongMatch: number;
    activationRateUpPermilAtFullComboWithoutSongMatch: number;
    comboGateThresholds: readonly number[];
  }>;
}>;

type OrderObjective = Readonly<{
  order: Five<string>;
  maxRegretPermil: number;
  meanRegretPermil: number;
  winSharePermil: number;
  scenarioWins: number;
}>;

type FormationOrderRecommendationShared = Readonly<{
  order: Five<string>;
  components: Five<FormationOrderComponent>;
  method: Readonly<
    {
    selection: "minimum-max-regret-then-mean-regret-then-card-id";
    execution: "all-perfect-full-combo-full-life";
    permutationsChecked: 120;
    activeFirstCheck: "one-cooldown-after-live-start";
    persistentSupportRecipients: "guaranteed-recipient-floor";
    activeCollisionModel: "expected-maximum-unstacked";
    activationBoostStacking: "additive-capped-at-1000-permil";
    unresolvedApplicationPolicy: "mean-of-enumerated-alternatives";
    scoreScope: "relative-active-and-special-timing-only";
    } & (
      | Readonly<{
          markerModel: "sorted-five-dimensional-halton-with-stress-layouts";
          noteModel: "aggregate-uniform-note-midpoints";
          exactTimelineAvailable: false;
          noteTimelineAvailable: false;
          lowDiscrepancySeed: number;
          activeConditionalBreakpoints: "uniform-note-combo-threshold-events";
          changesModeledTimingUtility: false;
        }>
      | Readonly<{
          markerModel: "exact-per-chart-special-markers";
          noteModel: "exact-timed-note-events";
          exactTimelineAvailable: true;
          noteTimelineAvailable: true;
          lowDiscrepancySeed: null;
          activeConditionalBreakpoints: "exact-note-combo-threshold-events";
          changesModeledTimingUtility: true;
        }>
    )
  >;
  scenarios: Readonly<{
    count: number;
    chartCount: number;
    layoutCount: number;
    lowDiscrepancyLayoutCount: number;
    stressLayoutCount: number;
    layouts: readonly FormationOrderMarkerLayout[];
    charts: readonly Readonly<{
      chartKey: string;
      durationMilliseconds: number;
      noteCount: number;
      timelineSusSha256: string | null;
      timelineMetadataSha256: string | null;
    }>[];
  }>;
  objective: Readonly<{
    selected: OrderObjective;
    runnerUp: OrderObjective;
    runnerUpGapPermil: number;
    runnerUpGapBasis: "max-regret" | "mean-regret" | "tie";
    tinyMarginThresholdPermil: number;
    diagnostics: Readonly<{
      totalSpecialWindows: number;
      endClippedSpecialWindows: number;
      totalActiveChecks: number;
      activationBoostedActiveChecks: number;
    }>;
    worstScenarios: readonly Readonly<{
      scenarioId: string;
      chartKey: string;
      layoutId: string;
      markerMilliseconds: Five<number>;
      regretPermil: number;
    }>[];
    perChartDiagnostics: readonly Readonly<{
      chartKey: string;
      markerMilliseconds: Five<number>;
      selectedRelativeTimingScore: number;
      bestRelativeTimingScore: number;
      regretPermil: number;
      scenarioBestOrder: Five<string>;
      selectedWins: boolean;
      timelineSusSha256: string;
      timelineMetadataSha256: string;
      noteCoefficientTotalPermil: number;
    }>[];
  }>;
  fixedContext: Readonly<{
    judgement: "perfect";
    fullCombo: true;
    life: 1_000;
  }>;
  exactTimelineStatement: string;
}>;

export type FormationOrderRecommendation =
  | (FormationOrderRecommendationShared &
      Readonly<{
        kind: "modeled-general";
        status: "modeled-general" | "indeterminate";
        label: "Suggested general order";
        methodologyVersion: "yd-formation-order-modeled-general-1.0.0";
        confidence: Readonly<{
          kind: "modeled-general" | "indeterminate";
          statement: string;
        }>;
      }>)
  | (FormationOrderRecommendationShared &
      Readonly<{
        kind: "timed-corpus";
        status: "timed-corpus" | "indeterminate";
        label: "Chart-timed corpus order";
        methodologyVersion: "yd-formation-order-timed-corpus-1.0.0";
        confidence: Readonly<{
          kind: "timed-corpus" | "indeterminate";
          statement: string;
        }>;
      }>);

type TimingProfile = Readonly<{
  cardId: string;
  bloomStage: BloomStage;
  active: SkillLevel;
  special: SkillLevel;
}>;

type CompiledChart = Readonly<{
  chartKey: string;
  durationMilliseconds: number;
  noteCount: number;
  noteTimesMilliseconds: readonly number[];
  noteCoefficientPrefixPermil: readonly number[];
  songSingerTalentIds: readonly string[];
  activeScoreUpByProfileAndNote: readonly (readonly number[])[];
  persistentActiveSupportPermilByProfile: readonly number[];
  baseBreakpointsMilliseconds: readonly number[];
  timelineSusSha256: string | null;
  timelineMetadataSha256: string | null;
  exactSpecialMarkerMilliseconds: Five<number> | null;
  exactSpecialStartsAtCombo: Five<number> | null;
}>;

type SpecialWindow = Readonly<{
  startsAtMilliseconds: number;
  endsAtMilliseconds: number;
  scoreSupportPermil: number;
  activationRateUpPermil: number;
}>;

type ActiveCheck = Readonly<{
  atMilliseconds: number;
  endsAtMilliseconds: number;
  probabilityPermil: number;
  boosted: boolean;
}>;

type Scenario = Readonly<{
  id: string;
  chart: CompiledChart;
  layout: FormationOrderMarkerLayout;
  markerMilliseconds: Five<number>;
  specialStartsAtCombo: Five<number> | null;
  specialWindowsByProfileAndSlot: readonly (readonly SpecialWindow[])[];
}>;

type ScenarioDiagnostics = Readonly<{
  totalSpecialWindows: number;
  endClippedSpecialWindows: number;
  totalActiveChecks: number;
  activationBoostedActiveChecks: number;
}>;

type ScenarioEvaluation = Readonly<{
  score: number;
  diagnostics: ScenarioDiagnostics;
}>;

type PermutationAggregate = Readonly<{
  order: readonly TimingProfile[];
  key: string;
  scores: readonly number[];
  regretsPermil: readonly number[];
  maxRegretPermil: number;
  meanRegretPermil: number;
  scenarioWins: number;
  winSharePermil: number;
}>;

const manualPerfectCoefficientByNoteTypeCode = TIMELINE_NOTE_TYPES.map((noteType) => {
  const rule = songContextData.rules.noteJudgements.find(
    (candidate) =>
      candidate.playMode === "manual" &&
      candidate.noteType === noteType &&
      candidate.judgement === "perfect",
  );
  return rule?.scoreCoefficientPermilMultiply ?? null;
});

export function manualPerfectNoteCoefficientPermil(noteTypeCode: number): number {
  if (!Number.isInteger(noteTypeCode) || noteTypeCode < 0) {
    throw new Error(`Invalid exact note-type code: ${noteTypeCode}`);
  }
  const coefficient = manualPerfectCoefficientByNoteTypeCode[noteTypeCode];
  if (coefficient === null || coefficient === undefined) {
    throw new Error(`No pinned manual Perfect coefficient for note-type code ${noteTypeCode}`);
  }
  return coefficient;
}

function exactTimelineFor(
  chartKey: string,
  expectedChartHash: string,
  expectedNoteCount: number,
  timelineByKey: ReadonlyMap<string, RankingCorpusTimeline>,
): RankingCorpusTimeline | null {
  const timeline = timelineByKey.get(chartKey);
  if (!timeline) return null;
  if (
    timeline.expectedChartHash !== expectedChartHash ||
    timeline.fullComboNoteCount !== expectedNoteCount ||
    timeline.events.length !== expectedNoteCount
  ) {
    return null;
  }
  return timeline;
}

function asFive<T>(values: readonly T[], label: string): Five<T> {
  if (values.length !== 5) throw new Error(`${label} requires exactly five entries`);
  return values as unknown as Five<T>;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function requirePositiveInteger(value: number | null, label: string): number {
  if (value === null || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function requireProbability(value: number | null, label: string): number {
  if (value === null || !Number.isInteger(value) || value < 0 || value > 1_000) {
    throw new Error(`${label} must be an integer from 0 to 1000 permil`);
  }
  return value;
}

function requireSkillLevel(
  levels: readonly SkillLevel[],
  level: number,
  cardId: string,
  kind: "Active" | "Special",
): SkillLevel {
  const skill = levels.find((candidate) => candidate.level === level);
  if (!skill) throw new Error(`${cardId} has no ${kind} Skill level ${level}`);
  return skill;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function radicalInverse(index: number, base: number): number {
  let source = index;
  let inverseBase = 1 / base;
  let result = 0;
  while (source > 0) {
    result += (source % base) * inverseBase;
    source = Math.floor(source / base);
    inverseBase /= base;
  }
  return result;
}

function strictlyOrderedPermillion(values: readonly number[]): Five<number> {
  const result = [...values]
    .map((value) => Math.max(1, Math.min(PERMILLION - 1, Math.round(value * PERMILLION))))
    .sort((left, right) => left - right);
  for (let index = 1; index < result.length; index += 1) {
    if (result[index]! <= result[index - 1]!) result[index] = result[index - 1]! + 1;
  }
  if (result.at(-1)! >= PERMILLION) {
    const overflow = result.at(-1)! - (PERMILLION - 1);
    for (let index = 0; index < result.length; index += 1) result[index]! -= overflow;
  }
  return asFive(result, "Marker layout");
}

/**
 * A fixed five-dimensional Halton point supplies five marginally uniform
 * samples. Sorting each point produces a deterministic sample from the ordered
 * marker simplex without pretending the missing in-game markers are known.
 */
export function buildFormationOrderMarkerLayouts(): readonly FormationOrderMarkerLayout[] {
  const lowDiscrepancy = Array.from(
    { length: LOW_DISCREPANCY_LAYOUT_COUNT },
    (_, layoutIndex): FormationOrderMarkerLayout => ({
      id: `halton-${String(layoutIndex + 1).padStart(2, "0")}`,
      family: "low-discrepancy",
      description: "Sorted five-dimensional fixed-seed low-discrepancy sample.",
      markerPositionsPermillion: strictlyOrderedPermillion(
        HALTON_BASES.map((base) => radicalInverse(LOW_DISCREPANCY_SEED + layoutIndex, base)),
      ),
    }),
  );
  const stress = [
    {
      id: "stress-even",
      description: "Evenly spread markers.",
      values: [0.1, 0.3, 0.5, 0.7, 0.9],
    },
    {
      id: "stress-early",
      description: "Markers concentrated near the opening.",
      values: [0.03, 0.08, 0.14, 0.21, 0.29],
    },
    {
      id: "stress-late",
      description: "Markers concentrated near the ending to test clipping.",
      values: [0.71, 0.79, 0.86, 0.92, 0.97],
    },
    {
      id: "stress-middle-cluster",
      description: "Tightly clustered middle markers.",
      values: [0.44, 0.47, 0.5, 0.53, 0.56],
    },
    {
      id: "stress-front-loaded",
      description: "Front-loaded markers with a long late tail.",
      values: [0.05, 0.12, 0.23, 0.45, 0.78],
    },
    {
      id: "stress-back-loaded",
      description: "Back-loaded markers with one early outlier.",
      values: [0.22, 0.55, 0.77, 0.88, 0.95],
    },
  ].map(
    (layout): FormationOrderMarkerLayout => ({
      id: layout.id,
      family: "stress",
      description: layout.description,
      markerPositionsPermillion: strictlyOrderedPermillion(layout.values),
    }),
  );
  return Object.freeze([...lowDiscrepancy, ...stress]);
}

function applicationEffectValue(
  alternatives: readonly SkillApplication[][],
  kind: "score-support" | "activation-rate-up" | "score-up",
): number {
  return mean(
    alternatives.map((alternative) =>
      alternative.reduce(
        (total, application) =>
          total + (application.effect?.kind === kind ? application.effect.value ?? 0 : 0),
        0,
      ),
    ),
  );
}

function scoreUpAtObservation(
  skill: SkillLevel,
  formation: LegalFormation,
  observation: Parameters<typeof resolveActiveApplications>[2],
): number {
  return applicationEffectValue(
    resolveActiveApplications(skill.applications, formation, observation).alternatives,
    "score-up",
  );
}

function lowerBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle]! < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

export function modeledComboThresholdMilliseconds(
  noteCount: number,
  durationMilliseconds: number,
  comboThreshold: number,
): number {
  if (
    !Number.isInteger(noteCount) ||
    noteCount <= 0 ||
    !Number.isFinite(durationMilliseconds) ||
    durationMilliseconds <= 0 ||
    !Number.isInteger(comboThreshold) ||
    comboThreshold < 0
  ) {
    throw new Error("Modeled combo threshold requires positive chart values and a nonnegative integer threshold");
  }
  if (comboThreshold === 0) return 0;
  if (comboThreshold > noteCount) return durationMilliseconds;
  return ((comboThreshold - 0.5) * durationMilliseconds) / noteCount;
}

function compileChart(
  chartKey: string,
  durationMilliseconds: number,
  noteCount: number,
  songSingerTalentIds: readonly string[],
  profiles: readonly TimingProfile[],
  formation: LegalFormation,
  persistentActiveSupportPermilByProfile: readonly number[],
  exactTimeline?: Readonly<{
    noteTimesMilliseconds: readonly number[];
    noteCoefficientPermil: readonly number[];
    specialMarkerMilliseconds: Five<number>;
    specialStartsAtCombo: Five<number>;
    susSha256: string;
    metadataSha256: string;
  }>,
): CompiledChart {
  const noteTimesMilliseconds = exactTimeline
    ? [...exactTimeline.noteTimesMilliseconds]
    : Array.from(
        { length: noteCount },
        (_, noteIndex) => ((noteIndex + 0.5) * durationMilliseconds) / noteCount,
      );
  if (
    noteTimesMilliseconds.length !== noteCount ||
    noteTimesMilliseconds.some(
      (time, index) =>
        !Number.isFinite(time) ||
        time < 0 ||
        (index > 0 && time < noteTimesMilliseconds[index - 1]!),
    )
  ) {
    throw new Error(`${chartKey} exact note timeline is incomplete or unordered`);
  }
  const noteCoefficientPermil = exactTimeline?.noteCoefficientPermil ?? noteTimesMilliseconds.map(() => 1_000);
  if (
    noteCoefficientPermil.length !== noteCount ||
    noteCoefficientPermil.some((coefficient) => !Number.isFinite(coefficient) || coefficient < 0)
  ) {
    throw new Error(`${chartKey} exact note coefficients are incomplete`);
  }
  const noteCoefficientPrefixPermil = [0];
  for (const coefficient of noteCoefficientPermil) {
    noteCoefficientPrefixPermil.push(noteCoefficientPrefixPermil.at(-1)! + coefficient);
  }
  const activeScoreUpByProfileAndNote = profiles.map((profile) =>
    (() => {
      const comboThresholds = profile.active.applications
        .flatMap((application) =>
          application.trigger?.kind === "combo-at-least" &&
          application.trigger.threshold !== null
            ? [application.trigger.threshold]
            : [],
        )
        .sort((left, right) => left - right);
      const valueByComboBand = new Map<number, number>();
      return noteTimesMilliseconds.map((_, noteIndex) => {
        const combo = noteIndex + 1;
        const comboBand = comboThresholds.filter((threshold) => combo >= threshold).length;
        const cached = valueByComboBand.get(comboBand);
        if (cached !== undefined) return cached;
        const value = scoreUpAtObservation(profile.active, formation, {
          combo,
          life: 1_000,
          judgement: "perfect",
          songSingerTalentIds,
        });
        valueByComboBand.set(comboBand, value);
        return value;
      });
    })(),
  );
  const baseBreakpoints = [0, durationMilliseconds];
  for (const profile of profiles) {
    const cooldown = requirePositiveInteger(
      profile.active.cooldownMilliseconds,
      `${profile.cardId} Active cooldown`,
    );
    const duration = requirePositiveInteger(
      profile.active.durationMilliseconds,
      `${profile.cardId} Active duration`,
    );
    for (let check = cooldown; check < durationMilliseconds; check += cooldown) {
      baseBreakpoints.push(check, Math.min(durationMilliseconds, check + duration));
    }
    for (const application of profile.active.applications) {
      const threshold = application.trigger?.kind === "combo-at-least"
        ? application.trigger.threshold
        : null;
      if (threshold !== null && threshold > 0 && threshold <= noteCount) {
        baseBreakpoints.push(exactTimeline
          ? noteTimesMilliseconds[threshold - 1]!
          : modeledComboThresholdMilliseconds(noteCount, durationMilliseconds, threshold));
      }
    }
  }
  return {
    chartKey,
    durationMilliseconds,
    noteCount,
    noteTimesMilliseconds,
    noteCoefficientPrefixPermil,
    songSingerTalentIds,
    activeScoreUpByProfileAndNote,
    persistentActiveSupportPermilByProfile,
    baseBreakpointsMilliseconds: uniqueSorted(baseBreakpoints),
    timelineSusSha256: exactTimeline?.susSha256 ?? null,
    timelineMetadataSha256: exactTimeline?.metadataSha256 ?? null,
    exactSpecialMarkerMilliseconds: exactTimeline?.specialMarkerMilliseconds ?? null,
    exactSpecialStartsAtCombo: exactTimeline?.specialStartsAtCombo ?? null,
  };
}

function specialWindow(
  profile: TimingProfile,
  markerMilliseconds: number,
  chart: CompiledChart,
  formation: LegalFormation,
  exactStartsAtCombo?: number,
): SpecialWindow {
  const duration = requirePositiveInteger(
    profile.special.durationMilliseconds,
    `${profile.cardId} Special duration`,
  );
  const markerCombo = exactStartsAtCombo ?? Math.min(
      chart.noteCount,
      Math.floor((chart.noteCount * markerMilliseconds) / chart.durationMilliseconds),
    );
  const resolution = resolveLeaderApplications(profile.special.applications, formation, {
    combo: markerCombo,
    life: 1_000,
    judgement: "perfect",
    songSingerTalentIds: chart.songSingerTalentIds,
  });
  return {
    startsAtMilliseconds: markerMilliseconds,
    endsAtMilliseconds: Math.min(chart.durationMilliseconds, markerMilliseconds + duration),
    scoreSupportPermil: applicationEffectValue(resolution.alternatives, "score-support"),
    activationRateUpPermil: applicationEffectValue(
      resolution.alternatives,
      "activation-rate-up",
    ),
  };
}

function activeChecks(
  profile: TimingProfile,
  chart: CompiledChart,
  specialWindows: readonly SpecialWindow[],
): ActiveCheck[] {
  const cooldown = requirePositiveInteger(
    profile.active.cooldownMilliseconds,
    `${profile.cardId} Active cooldown`,
  );
  const duration = requirePositiveInteger(
    profile.active.durationMilliseconds,
    `${profile.cardId} Active duration`,
  );
  const baseProbability = requireProbability(
    profile.active.activationProbabilityPermil,
    `${profile.cardId} Active probability`,
  );
  const checks: ActiveCheck[] = [];
  for (let check = cooldown; check < chart.durationMilliseconds; check += cooldown) {
    const boost = specialWindows.reduce(
      (total, window) =>
        check >= window.startsAtMilliseconds && check < window.endsAtMilliseconds
          ? total + window.activationRateUpPermil
          : total,
      0,
    );
    checks.push({
      atMilliseconds: check,
      endsAtMilliseconds: Math.min(chart.durationMilliseconds, check + duration),
      probabilityPermil: Math.min(1_000, baseProbability + boost),
      boosted: boost > 0,
    });
  }
  return checks;
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

function activeProbabilityAt(
  atMilliseconds: number,
  checks: readonly ActiveCheck[],
): number {
  let low = 0;
  let high = checks.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (checks[middle]!.atMilliseconds <= atMilliseconds) low = middle + 1;
    else high = middle;
  }
  let noActivationProbability = 1;
  for (let index = low - 1; index >= 0; index -= 1) {
    const check = checks[index]!;
    if (check.endsAtMilliseconds <= atMilliseconds) break;
    noActivationProbability *= 1 - check.probabilityPermil / 1_000;
  }
  return 1 - noActivationProbability;
}

function evaluateScenarioOrder(
  order: readonly TimingProfile[],
  scenario: Scenario,
  profileIndexByCardId: ReadonlyMap<string, number>,
): ScenarioEvaluation {
  const specialWindows = order.map((profile, slotIndex) => {
    const profileIndex = profileIndexByCardId.get(profile.cardId);
    if (profileIndex === undefined) throw new Error(`Missing timing profile ${profile.cardId}`);
    return scenario.specialWindowsByProfileAndSlot[profileIndex]![slotIndex]!;
  });
  const activeChecksByProfile = order.map((profile) =>
    activeChecks(profile, scenario.chart, specialWindows),
  );
  const breakpoints = uniqueSorted([
    ...scenario.chart.baseBreakpointsMilliseconds,
    ...specialWindows.flatMap((window) => [window.startsAtMilliseconds, window.endsAtMilliseconds]),
  ]);
  let score = 0;
  for (let index = 0; index < breakpoints.length - 1; index += 1) {
    const startsAt = breakpoints[index]!;
    const endsAt = breakpoints[index + 1]!;
    if (endsAt <= startsAt) continue;
    const firstNoteIndex = lowerBound(scenario.chart.noteTimesMilliseconds, startsAt);
    const afterLastNoteIndex = lowerBound(scenario.chart.noteTimesMilliseconds, endsAt);
    const coveredNotes = afterLastNoteIndex - firstNoteIndex;
    if (coveredNotes <= 0) continue;
    const coveredNoteCoefficientPermil =
      scenario.chart.noteCoefficientPrefixPermil[afterLastNoteIndex]! -
      scenario.chart.noteCoefficientPrefixPermil[firstNoteIndex]!;
    const representativeTime = scenario.chart.noteTimesMilliseconds[firstNoteIndex]!;
    const specialSupportPermil = specialWindows.reduce(
      (total, window) =>
        representativeTime >= window.startsAtMilliseconds &&
        representativeTime < window.endsAtMilliseconds
          ? total + window.scoreSupportPermil
          : total,
      0,
    );
    const activeEntries = order.map((profile, orderIndex) => {
      const profileIndex = profileIndexByCardId.get(profile.cardId);
      if (profileIndex === undefined) throw new Error(`Missing timing profile ${profile.cardId}`);
      const scoreUpPermil =
        scenario.chart.activeScoreUpByProfileAndNote[profileIndex]![firstNoteIndex]!;
      const persistentSupportPermil =
        scenario.chart.persistentActiveSupportPermilByProfile[profileIndex]!;
      return {
        value:
          (scoreUpPermil *
            (1_000 + persistentSupportPermil + specialSupportPermil)) /
          1_000,
        probability: activeProbabilityAt(
          representativeTime,
          activeChecksByProfile[orderIndex]!,
        ),
      };
    });
    // Score Support is not a standalone score source. It multiplies an Active
    // Skill's Score UP while their windows overlap, matching the corroborated
    // combination rule used by native utility.
    score += (coveredNoteCoefficientPermil * expectedMaximum(activeEntries)) / 1_000;
  }

  const allActiveChecks = activeChecksByProfile.flat();
  return {
    score,
    diagnostics: {
      totalSpecialWindows: specialWindows.length,
      endClippedSpecialWindows: specialWindows.filter(
        (window, index) =>
          window.endsAtMilliseconds - window.startsAtMilliseconds <
          requirePositiveInteger(
            order[index]!.special.durationMilliseconds,
            `${order[index]!.cardId} Special duration`,
          ),
      ).length,
      totalActiveChecks: allActiveChecks.length,
      activationBoostedActiveChecks: allActiveChecks.filter((check) => check.boosted).length,
    },
  };
}

function compareAggregate(left: PermutationAggregate, right: PermutationAggregate): number {
  const maxDifference = left.maxRegretPermil - right.maxRegretPermil;
  if (Math.abs(maxDifference) > OBJECTIVE_EPSILON) return maxDifference;
  const meanDifference = left.meanRegretPermil - right.meanRegretPermil;
  if (Math.abs(meanDifference) > OBJECTIVE_EPSILON) return meanDifference;
  return left.key.localeCompare(right.key);
}

function objectiveFor(candidate: PermutationAggregate): OrderObjective {
  return {
    order: asFive(candidate.order.map((profile) => profile.cardId), "Objective order"),
    maxRegretPermil: round(candidate.maxRegretPermil),
    meanRegretPermil: round(candidate.meanRegretPermil),
    winSharePermil: round(candidate.winSharePermil),
    scenarioWins: candidate.scenarioWins,
  };
}

export function formationOrderConfidenceFromGap(
  runnerUpGapPermil: number,
): "modeled-general" | "indeterminate" {
  if (!Number.isFinite(runnerUpGapPermil) || runnerUpGapPermil < 0) {
    throw new Error("Runner-up gap must be a finite nonnegative permil value");
  }
  return runnerUpGapPermil <= FORMATION_ORDER_TINY_MARGIN_PERMIL
    ? "indeterminate"
    : "modeled-general";
}

function compilePersistentActiveSupport(
  evaluator: ReturnType<typeof evaluateFormation>,
  profiles: readonly TimingProfile[],
): number[] {
  const contributions = [
    ...evaluator.contributions.leader,
    ...evaluator.contributions.passive,
  ].filter(
    (contribution) =>
      contribution.effectKind === "active-skill-effect-up" && contribution.value !== null,
  );
  return profiles.map((profile) => {
    const memberIndex = evaluator.members.findIndex((member) => member.cardId === profile.cardId);
    if (memberIndex < 0) throw new Error(`Persistent support recipient is missing: ${profile.cardId}`);
    return contributions.reduce((total, contribution) => {
      const recipient = contribution.recipients?.recipientIntervalByMember[memberIndex];
      return total + (recipient ? contribution.value! * recipient.minimum : 0);
    }, 0);
  });
}

function fullComboSpecialValue(
  profile: TimingProfile,
  formation: LegalFormation,
  kind: "score-support" | "activation-rate-up",
): number {
  const resolution = resolveLeaderApplications(profile.special.applications, formation, {
    combo: Number.MAX_SAFE_INTEGER,
    life: 1_000,
    judgement: "perfect",
    songSingerTalentIds: [],
  });
  return applicationEffectValue(resolution.alternatives, kind);
}

export function recommendFormationOrder(
  input: FormationOrderRecommenderInput,
): FormationOrderRecommendation {
  const corpusMode = input.corpusMode ?? "frozen-30-chart";
  const expectedChartCount = corpusMode === "exact-song" ? 1 : 30;
  if (input.corpus.length !== expectedChartCount) {
    throw new Error(
      corpusMode === "exact-song"
        ? `Song-specific formation order requires exactly one chart; received ${input.corpus.length}`
        : `Formation order requires the frozen 30-chart corpus; received ${input.corpus.length}`,
    );
  }
  if (new Set(input.corpus.map((entry) => entry.chartKey)).size !== expectedChartCount) {
    throw new Error("Formation order corpus charts must be unique");
  }

  const formationInput = {
    leaderOutfitCardId: input.leaderOutfitCardId,
    members: input.members.map((member) => ({
      cardId: member.cardId,
      investment: "one-copy-maximum" as const,
      bloomStage: member.bloomStage,
    })),
  };
  const formation = assertLegalFormation(formationInput);
  const bloomByCardId = new Map(input.members.map((member) => [member.cardId, member.bloomStage]));
  const profiles = formation.members.map((member): TimingProfile => {
    const bloomStage = bloomByCardId.get(member.cardId);
    if (bloomStage === undefined) throw new Error(`Bloom stage is missing for ${member.cardId}`);
    const progression = resolveCardInvestmentState(
      member.mechanics,
      member.investment,
      bloomStage,
    );
    const active = requireSkillLevel(
      member.mechanics.skills.active,
      progression.activeSkillLevel,
      member.cardId,
      "Active",
    );
    const special = requireSkillLevel(
      member.mechanics.skills.special,
      progression.specialSkillLevel,
      member.cardId,
      "Special",
    );
    requirePositiveInteger(active.cooldownMilliseconds, `${member.cardId} Active cooldown`);
    requirePositiveInteger(active.durationMilliseconds, `${member.cardId} Active duration`);
    requireProbability(active.activationProbabilityPermil, `${member.cardId} Active probability`);
    requirePositiveInteger(special.durationMilliseconds, `${member.cardId} Special duration`);
    return { cardId: member.cardId, bloomStage, active, special };
  });
  const profileIndexByCardId = new Map(
    profiles.map((profile, index) => [profile.cardId, index]),
  );

  const chartByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));
  const songById = new Map(songContextData.songs.map((song) => [song.id, song]));
  const exactTimelineByKey = input.exactTimelineByKey ?? rankingCorpusTimelineByKey;
  const exactTimelineCandidates = input.corpus.map((entry) => {
    const chart = chartByKey.get(entry.chartKey);
    return chart
      ? exactTimelineFor(
          entry.chartKey,
          entry.expectedChartHash,
          chart.fullComboNoteCount,
          exactTimelineByKey,
        )
      : null;
  });
  const usesExactTimeline = exactTimelineCandidates.every(
    (timeline): timeline is RankingCorpusTimeline => timeline !== null,
  );
  if (corpusMode === "exact-song" && !usesExactTimeline) {
    throw new Error(`Exact song timeline is missing or drifted: ${input.corpus[0]!.chartKey}`);
  }
  const charts = input.corpus.map((entry, corpusIndex) => {
    const chart = chartByKey.get(entry.chartKey);
    if (!chart || chart.difficulty !== "expert" || chart.chartHash !== entry.expectedChartHash) {
      throw new Error(`Frozen corpus chart is missing or drifted: ${entry.chartKey}`);
    }
    const song = songById.get(chart.songId);
    if (!song) throw new Error(`Song context is missing for ${entry.chartKey}`);
    const evaluator = evaluateFormation(formationInput, {
      chart,
      song,
      policy: provisionalRuntimePolicy(0, 1),
      accountState: { board: { mode: "unavailable" } },
      observation: {
        combo: chart.fullComboNoteCount,
        life: 1_000,
        judgement: "perfect",
        songSingerTalentIds: song.singerTalentIds,
      },
    });
    const exactTimeline = usesExactTimeline ? exactTimelineCandidates[corpusIndex]! : null;
    return compileChart(
      entry.chartKey,
      song.playingMilliseconds,
      chart.fullComboNoteCount,
      song.singerTalentIds,
      profiles,
      formation,
      compilePersistentActiveSupport(evaluator, profiles),
      exactTimeline
          ? {
            noteTimesMilliseconds: exactTimeline.events.map((event) => event[0] / 1_000),
            noteCoefficientPermil: exactTimeline.events.map((event) =>
              manualPerfectNoteCoefficientPermil(event[1]),
            ),
            specialMarkerMilliseconds: asFive(
              exactTimeline.specialMarkerMicroseconds.map((marker) => marker / 1_000),
              `${entry.chartKey} exact Special markers`,
            ),
            specialStartsAtCombo: asFive(
              exactTimeline.specialStartsAtCombo,
              `${entry.chartKey} exact Special start combos`,
            ),
            susSha256: exactTimeline.source.susSha256,
            metadataSha256: exactTimeline.source.metadataSha256,
          }
        : undefined,
    );
  });
  const layouts: readonly FormationOrderMarkerLayout[] = usesExactTimeline
    ? [
        {
          id: "exact-per-chart",
          family: "exact",
          description: "Five exact Special markers parsed from each pinned public chart timeline.",
          markerPositionsPermillion: null,
        },
      ]
    : buildFormationOrderMarkerLayouts();
  const scenarios = charts.flatMap((chart) =>
    layouts.map((layout): Scenario => {
      const markerMilliseconds = chart.exactSpecialMarkerMilliseconds ?? asFive(
        layout.markerPositionsPermillion!.map((position) =>
          Math.round((chart.durationMilliseconds * position) / PERMILLION),
        ),
        "Scenario markers",
      );
      return {
        id: `${chart.chartKey}/${layout.id}`,
        chart,
        layout,
        markerMilliseconds,
        specialStartsAtCombo: chart.exactSpecialStartsAtCombo,
        specialWindowsByProfileAndSlot: profiles.map((profile) =>
          markerMilliseconds.map((marker, slotIndex) =>
            specialWindow(
              profile,
              marker,
              chart,
              formation,
              chart.exactSpecialStartsAtCombo?.[slotIndex],
            ),
          ),
        ),
      };
    }),
  );
  const permutations = enumerateSpecialOrders(profiles);
  if (permutations.length !== 120) {
    throw new Error(`Expected all 120 five-Member permutations; received ${permutations.length}`);
  }

  const scoresByPermutation = permutations.map(() => [] as number[]);
  const diagnosticsByPermutation = permutations.map(() => [] as ScenarioDiagnostics[]);
  const bestScoreByScenario: number[] = [];
  for (const scenario of scenarios) {
    let best = Number.NEGATIVE_INFINITY;
    for (const [permutationIndex, order] of permutations.entries()) {
      const evaluation = evaluateScenarioOrder(order, scenario, profileIndexByCardId);
      scoresByPermutation[permutationIndex]!.push(evaluation.score);
      diagnosticsByPermutation[permutationIndex]!.push(evaluation.diagnostics);
      best = Math.max(best, evaluation.score);
    }
    bestScoreByScenario.push(best);
  }

  const aggregates = permutations.map((order, permutationIndex): PermutationAggregate => {
    const scores = scoresByPermutation[permutationIndex]!;
    const regretsPermil = scores.map((score, scenarioIndex) => {
      const best = bestScoreByScenario[scenarioIndex]!;
      return Math.max(0, ((best - score) / Math.max(Math.abs(best), OBJECTIVE_EPSILON)) * REGRET_SCALE_PERMIL);
    });
    const scenarioWins = scores.filter((score, scenarioIndex) => {
      const best = bestScoreByScenario[scenarioIndex]!;
      return Math.abs(best - score) <= Math.max(1, Math.abs(best)) * OBJECTIVE_EPSILON;
    }).length;
    return {
      order,
      key: order.map((profile) => profile.cardId).join("|"),
      scores,
      regretsPermil,
      maxRegretPermil: Math.max(...regretsPermil),
      meanRegretPermil: mean(regretsPermil),
      scenarioWins,
      winSharePermil: (scenarioWins / scenarios.length) * REGRET_SCALE_PERMIL,
    };
  }).sort(compareAggregate);
  const selected = aggregates[0];
  const runnerUp = aggregates[1];
  if (!selected || !runnerUp) throw new Error("Formation order comparison is incomplete");

  const maxGap = runnerUp.maxRegretPermil - selected.maxRegretPermil;
  const meanGap = runnerUp.meanRegretPermil - selected.meanRegretPermil;
  const runnerUpGapBasis =
    Math.abs(maxGap) > OBJECTIVE_EPSILON
      ? "max-regret"
      : Math.abs(meanGap) > OBJECTIVE_EPSILON
        ? "mean-regret"
        : "tie";
  const runnerUpGapPermil = Math.max(
    0,
    runnerUpGapBasis === "max-regret"
      ? maxGap
      : runnerUpGapBasis === "mean-regret"
        ? meanGap
        : 0,
  );
  const gapStatus = formationOrderConfidenceFromGap(runnerUpGapPermil);
  const status: "timed-corpus" | "modeled-general" | "indeterminate" =
    gapStatus === "indeterminate"
      ? "indeterminate"
      : usesExactTimeline
        ? "timed-corpus"
        : "modeled-general";
  const selectedOriginalIndex = permutations.findIndex(
    (order) => order.map((profile) => profile.cardId).join("|") === selected.key,
  );
  if (selectedOriginalIndex < 0) throw new Error("Selected order diagnostics are missing");
  const selectedDiagnostics = diagnosticsByPermutation[selectedOriginalIndex]!;
  const aggregateDiagnostics = selectedDiagnostics.reduce<ScenarioDiagnostics>(
    (total, diagnostic) => ({
      totalSpecialWindows: total.totalSpecialWindows + diagnostic.totalSpecialWindows,
      endClippedSpecialWindows:
        total.endClippedSpecialWindows + diagnostic.endClippedSpecialWindows,
      totalActiveChecks: total.totalActiveChecks + diagnostic.totalActiveChecks,
      activationBoostedActiveChecks:
        total.activationBoostedActiveChecks + diagnostic.activationBoostedActiveChecks,
    }),
    {
      totalSpecialWindows: 0,
      endClippedSpecialWindows: 0,
      totalActiveChecks: 0,
      activationBoostedActiveChecks: 0,
    },
  );
  const worstScenarios = selected.regretsPermil
    .map((regretPermil, scenarioIndex) => ({ regretPermil, scenarioIndex }))
    .filter(
      ({ regretPermil }) =>
        Math.abs(regretPermil - selected.maxRegretPermil) <= OBJECTIVE_EPSILON,
    )
    .slice(0, 3)
    .map(({ regretPermil, scenarioIndex }) => {
      const scenario = scenarios[scenarioIndex]!;
      return {
        scenarioId: scenario.id,
        chartKey: scenario.chart.chartKey,
        layoutId: scenario.layout.id,
        markerMilliseconds: scenario.markerMilliseconds,
        regretPermil: round(regretPermil),
      };
    });
  const perChartDiagnostics = usesExactTimeline
    ? scenarios.map((scenario, scenarioIndex) => {
        const bestScore = bestScoreByScenario[scenarioIndex]!;
        const scenarioBest = aggregates
          .filter(
            (aggregate) =>
              Math.abs(aggregate.scores[scenarioIndex]! - bestScore) <=
              Math.max(1, Math.abs(bestScore)) * OBJECTIVE_EPSILON,
          )
          .sort((left, right) => left.key.localeCompare(right.key))[0]!;
        const selectedScore = selected.scores[scenarioIndex]!;
        return {
          chartKey: scenario.chart.chartKey,
          markerMilliseconds: scenario.markerMilliseconds,
          selectedRelativeTimingScore: round(selectedScore),
          bestRelativeTimingScore: round(bestScore),
          regretPermil: round(selected.regretsPermil[scenarioIndex]!),
          scenarioBestOrder: asFive(
            scenarioBest.order.map((profile) => profile.cardId),
            `${scenario.chart.chartKey} best order`,
          ),
          selectedWins:
            Math.abs(selectedScore - bestScore) <=
            Math.max(1, Math.abs(bestScore)) * OBJECTIVE_EPSILON,
          timelineSusSha256: scenario.chart.timelineSusSha256!,
          timelineMetadataSha256: scenario.chart.timelineMetadataSha256!,
          noteCoefficientTotalPermil: scenario.chart.noteCoefficientPrefixPermil.at(-1)!,
        };
      })
    : [];

  const selectedOrder = asFive(
    selected.order.map((profile) => profile.cardId),
    "Recommended order",
  );
  const components = selected.order.map((profile, index): FormationOrderComponent => ({
    cardId: profile.cardId,
    bloomStage: profile.bloomStage,
    recommendedSlot: (index + 1) as 1 | 2 | 3 | 4 | 5,
    active: {
      level: profile.active.level,
      cooldownMilliseconds: requirePositiveInteger(
        profile.active.cooldownMilliseconds,
        `${profile.cardId} Active cooldown`,
      ),
      durationMilliseconds: requirePositiveInteger(
        profile.active.durationMilliseconds,
        `${profile.cardId} Active duration`,
      ),
      activationProbabilityPermil: requireProbability(
        profile.active.activationProbabilityPermil,
        `${profile.cardId} Active probability`,
      ),
      persistentSupportPermilAcrossCorpus: {
        minimum: Math.min(
          ...charts.map((chart) =>
            chart.persistentActiveSupportPermilByProfile[
              profileIndexByCardId.get(profile.cardId)!
            ]!,
          ),
        ),
        maximum: Math.max(
          ...charts.map((chart) =>
            chart.persistentActiveSupportPermilByProfile[
              profileIndexByCardId.get(profile.cardId)!
            ]!,
          ),
        ),
      },
    },
    special: {
      level: profile.special.level,
      durationMilliseconds: requirePositiveInteger(
        profile.special.durationMilliseconds,
        `${profile.cardId} Special duration`,
      ),
      scoreSupportPermilAtFullComboWithoutSongMatch: fullComboSpecialValue(
        profile,
        formation,
        "score-support",
      ),
      activationRateUpPermilAtFullComboWithoutSongMatch: fullComboSpecialValue(
        profile,
        formation,
        "activation-rate-up",
      ),
      comboGateThresholds: profile.special.applications
        .flatMap((application) =>
          application.trigger?.kind === "combo-at-least" &&
          application.trigger.threshold !== null
            ? [application.trigger.threshold]
            : [],
        )
        .sort((left, right) => left - right),
    },
  }));

  const shared = {
    order: selectedOrder,
    components: asFive(components, "Order components"),
    scenarios: {
      count: scenarios.length,
      chartCount: charts.length,
      layoutCount: layouts.length,
      lowDiscrepancyLayoutCount: layouts.filter(
        (layout) => layout.family === "low-discrepancy",
      ).length,
      stressLayoutCount: layouts.filter((layout) => layout.family === "stress").length,
      layouts,
      charts: charts.map((chart) => ({
        chartKey: chart.chartKey,
        durationMilliseconds: chart.durationMilliseconds,
        noteCount: chart.noteCount,
        timelineSusSha256: chart.timelineSusSha256,
        timelineMetadataSha256: chart.timelineMetadataSha256,
      })),
    },
    objective: {
      selected: objectiveFor(selected),
      runnerUp: objectiveFor(runnerUp),
      runnerUpGapPermil: round(runnerUpGapPermil),
      runnerUpGapBasis,
      tinyMarginThresholdPermil: FORMATION_ORDER_TINY_MARGIN_PERMIL,
      diagnostics: aggregateDiagnostics,
      worstScenarios,
      perChartDiagnostics,
    },
    fixedContext: { judgement: "perfect", fullCombo: true, life: 1_000 },
  } as const;
  const methodBase = {
    selection: "minimum-max-regret-then-mean-regret-then-card-id",
    execution: "all-perfect-full-combo-full-life",
    permutationsChecked: 120,
    activeFirstCheck: "one-cooldown-after-live-start",
    persistentSupportRecipients: "guaranteed-recipient-floor",
    activeCollisionModel: "expected-maximum-unstacked",
    activationBoostStacking: "additive-capped-at-1000-permil",
    unresolvedApplicationPolicy: "mean-of-enumerated-alternatives",
    scoreScope: "relative-active-and-special-timing-only",
  } as const;

  if (usesExactTimeline) {
    const timedStatus = status === "indeterminate" ? "indeterminate" : "timed-corpus";
    return {
      ...shared,
      kind: "timed-corpus",
      status: timedStatus,
      label: "Chart-timed corpus order",
      methodologyVersion: "yd-formation-order-timed-corpus-1.0.0",
      method: {
        ...methodBase,
        markerModel: "exact-per-chart-special-markers",
        noteModel: "exact-timed-note-events",
        exactTimelineAvailable: true,
        noteTimelineAvailable: true,
        lowDiscrepancySeed: null,
        activeConditionalBreakpoints: "exact-note-combo-threshold-events",
        changesModeledTimingUtility: true,
      },
      confidence: {
        kind: timedStatus,
        statement:
          timedStatus === "indeterminate"
            ? "The chart-timed winner and runner-up are tied or separated by no more than one basis point; no meaningful order preference is claimed."
            : corpusMode === "exact-song"
              ? "The winner clears the published tiny-margin threshold on this exact chart timeline under the documented relative timing model."
              : "The minimax-regret winner clears the published tiny-margin threshold across all 30 pinned chart timelines under the documented relative timing model.",
      },
      exactTimelineStatement:
        corpusMode === "exact-song"
          ? "This song uses pinned timed note events and its five exact Special markers. The placement is specific to the documented relative Active and Score Support timing model, not an absolute Live Score claim."
          : "All 30 frozen charts use pinned timed note events and their five exact Special markers. The order is timing-optimal for the documented relative Active and Score Support model, not an absolute Live Score claim.",
    };
  }

  const modeledStatus = status === "indeterminate" ? "indeterminate" : "modeled-general";
  return {
    ...shared,
    kind: "modeled-general",
    status: modeledStatus,
    label: "Suggested general order",
    methodologyVersion: "yd-formation-order-modeled-general-1.0.0",
    method: {
      ...methodBase,
      markerModel: "sorted-five-dimensional-halton-with-stress-layouts",
      noteModel: "aggregate-uniform-note-midpoints",
      exactTimelineAvailable: false,
      noteTimelineAvailable: false,
      lowDiscrepancySeed: LOW_DISCREPANCY_SEED,
      activeConditionalBreakpoints: "uniform-note-combo-threshold-events",
      changesModeledTimingUtility: false,
    },
    confidence: {
      kind: modeledStatus,
      statement:
        modeledStatus === "indeterminate"
          ? "The modeled winner and runner-up are tied or separated by no more than one basis point; no meaningful order preference is claimed."
          : "The minimax-regret winner clears the published tiny-margin threshold across the modeled general-layout corpus.",
    },
    exactTimelineStatement:
      "Exact rainbow-marker timestamps or timed note events are missing for at least one requested chart. This is a deterministic general-order fallback, not an exact or certified per-song optimum.",
  };
}
