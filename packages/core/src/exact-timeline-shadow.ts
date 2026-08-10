import { TIMELINE_NOTE_TYPES } from "./chart-timeline-parser";
import { resolveComboScoreBonus, resolveJudgementCoefficient } from "./score-kernel";
import { songContextData } from "./song-contexts";

type Five<T> = readonly [T, T, T, T, T];

// The idle length is a pinned upstream fact (Setting.json via the song rules
// catalog), not a prose-derived constant: source it from the catalog and pin
// the reviewed expectation so silent upstream drift fails loudly.
export const SHADOW_LIVE_START_IDLE_MILLISECONDS =
  songContextData.rules.live.musicStartIdleTimeMilliseconds;
if (SHADOW_LIVE_START_IDLE_MILLISECONDS !== 3_000) {
  throw new Error(
    `Pinned Live-start idle drifted: expected 3000ms, catalog has ${SHADOW_LIVE_START_IDLE_MILLISECONDS}ms — re-review the idle-clock assumption before trusting shadow variant E/F`,
  );
}
export const SHADOW_COMBO_GROUP_ID = "live_combo-1" as const;

export type ExactTimelineShadowVariant = Readonly<{
  noteTiming: "uniform" | "exact";
  noteWeights: "unit" | "manual-perfect-coefficients";
  comboBonus: "off" | "live-combo-1";
  liveStartIdle: "off" | "pinned-3000ms";
  specialWindows: "duration-coverage" | "exact-markers";
}>;

export type ShadowTimelineEvent = readonly [
  atMicroseconds: number,
  noteTypeCode: number,
  criticalFlag: 0 | 1,
];

export type ShadowChartInput = Readonly<{
  chartKey?: string;
  durationMilliseconds?: number;
  playingMilliseconds?: number;
  fullComboNoteCount: number;
  events?: readonly ShadowTimelineEvent[];
  timelineEvents?: readonly ShadowTimelineEvent[];
  specialMarkerMicroseconds?: readonly number[];
  specialStartsAtCombo?: readonly number[];
}>;

export type ShadowComboSelection = Readonly<{
  comboAtLeast: number;
  scoreUpPermil: number;
}>;

export type ShadowMemberProfile = Readonly<{
  cardId?: string;
  active: Readonly<{
    scoreUpPermil: number;
    comboGatedSelections?: readonly ShadowComboSelection[];
    cooldownMilliseconds: number;
    durationMilliseconds: number;
    activationProbabilityPermil: number;
    persistentSupportPermil: number;
  }>;
  special: Readonly<{
    durationMilliseconds: number;
    scoreSupportPermil: number;
    activationRateUpPermil: number;
  }>;
}>;

export type ShadowCompiledChart = Readonly<{
  chartKey: string | null;
  durationMilliseconds: number;
  noteCount: number;
  noteTimesMilliseconds: readonly number[];
  noteWeightsPermil: readonly number[];
  noteWeightPrefixPermil: readonly number[];
  comboCountsAtScoring: readonly number[];
  specialMarkerMilliseconds: Five<number> | null;
  specialStartsAtCombo: Five<number> | null;
  baseBreakpointsMilliseconds: readonly number[];
  variant: ExactTimelineShadowVariant;
}>;

export type ShadowTimingDiagnostics = Readonly<{
  noteCount: number;
  activeChecks: number;
  specialWindows: number;
  endClippedWindows: number;
  segments: number;
}>;

export type ShadowTimingResult = Readonly<{
  timingPermil: number;
  diagnostics: ShadowTimingDiagnostics;
}>;

export type ShadowCentralComposition = Readonly<{
  baseParametersRelativeUnitsCentral: number;
  parameterEffectsRelativeUnitsCentral: number;
  baseTotal: number;
  shadowTimingPermil: number;
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
}>;

const FIVE_MARKERS = 5;
function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function assertNonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function assertPermil(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000) {
    throw new Error(`${label} must be an integer from 0 to 1000 permil`);
  }
}

function assertNonnegativePermil(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative finite permil value`);
  }
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function asFive<T>(values: readonly T[], label: string): Five<T> {
  if (values.length !== FIVE_MARKERS) {
    throw new Error(`${label} requires exactly five entries`);
  }
  return values as Five<T>;
}

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function resolveDuration(input: ShadowChartInput): number {
  const duration = input.durationMilliseconds ?? input.playingMilliseconds;
  if (duration === undefined) {
    throw new Error("Shadow chart requires durationMilliseconds or playingMilliseconds");
  }
  if (
    input.durationMilliseconds !== undefined &&
    input.playingMilliseconds !== undefined &&
    input.durationMilliseconds !== input.playingMilliseconds
  ) {
    throw new Error("Shadow chart duration fields disagree");
  }
  assertPositiveInteger(duration, "Shadow chart duration");
  return duration;
}

function resolveEvents(input: ShadowChartInput): readonly ShadowTimelineEvent[] | null {
  if (input.events !== undefined && input.timelineEvents !== undefined) {
    if (input.events.length !== input.timelineEvents.length) {
      throw new Error("Shadow chart event fields disagree");
    }
    for (const [index, event] of input.events.entries()) {
      if (event[0] !== input.timelineEvents[index]![0] || event[1] !== input.timelineEvents[index]![1]) {
        throw new Error("Shadow chart event fields disagree");
      }
    }
  }
  return input.events ?? input.timelineEvents ?? null;
}

function validateVariant(variant: ExactTimelineShadowVariant): void {
  if (variant.noteTiming === "uniform" && variant.specialWindows !== "duration-coverage") {
    throw new Error("Uniform shadow timing requires duration-coverage Specials");
  }
  if (variant.noteTiming === "exact" && variant.specialWindows !== "exact-markers") {
    throw new Error("Exact shadow timing requires exact-marker Specials");
  }
  if (variant.comboBonus === "live-combo-1" && SHADOW_COMBO_GROUP_ID !== "live_combo-1") {
    throw new Error("Pinned LiveCombo group identifier drifted");
  }
}

function noteWeights(
  variant: ExactTimelineShadowVariant,
  events: readonly ShadowTimelineEvent[] | null,
  noteCount: number,
): number[] {
  if (variant.noteWeights === "unit") return Array.from({ length: noteCount }, () => 1_000);
  if (!events) {
    throw new Error("Manual Perfect shadow weights require exact note-type events");
  }
  return events.map((event, index) => {
    const noteType = TIMELINE_NOTE_TYPES[event[1]];
    if (!noteType) throw new Error(`Unknown exact note-type code at note ${index}: ${event[1]}`);
    return resolveJudgementCoefficient({
      platform: "mobile",
      playMode: "manual",
      noteType,
      judgement: "perfect",
    }).appliedPermil;
  });
}

function comboMultiplierPermil(
  variant: ExactTimelineShadowVariant,
  comboCountAtScoring: number,
  cache: Map<number, number>,
): number {
  if (variant.comboBonus === "off") return 1_000;
  const cached = cache.get(comboCountAtScoring);
  if (cached !== undefined) return cached;
  const multiplier = resolveComboScoreBonus({
    groupId: SHADOW_COMBO_GROUP_ID,
    comboCountAtScoring,
    playMode: "manual",
  }).multiplierPermil;
  cache.set(comboCountAtScoring, multiplier);
  return multiplier;
}

function validateExactEvents(
  events: readonly ShadowTimelineEvent[],
  noteCount: number,
): void {
  if (events.length !== noteCount) {
    throw new Error(`Shadow timeline event count ${events.length} does not match note count ${noteCount}`);
  }
  let previousTime = -1;
  for (const [index, event] of events.entries()) {
    assertNonnegativeInteger(event[0], `Shadow event ${index} timestamp`);
    if (event[0] < previousTime) throw new Error("Shadow timeline events must be chronological");
    previousTime = event[0];
    if (!Number.isInteger(event[1]) || event[1] < 0 || event[1] >= TIMELINE_NOTE_TYPES.length) {
      throw new Error(`Shadow event ${index} has an invalid note-type code`);
    }
    if (event[2] !== 0 && event[2] !== 1) {
      throw new Error(`Shadow event ${index} has an invalid critical flag`);
    }
  }
}

function resolveSpecialMarkers(
  input: ShadowChartInput,
  variant: ExactTimelineShadowVariant,
  events: readonly ShadowTimelineEvent[] | null,
): { markers: Five<number> | null; startsAtCombo: Five<number> | null } {
  if (variant.specialWindows !== "exact-markers") return { markers: null, startsAtCombo: null };
  if (!input.specialMarkerMicroseconds) {
    throw new Error("Exact-marker shadow Specials require five pinned marker timestamps");
  }
  const markerMicroseconds = asFive(input.specialMarkerMicroseconds, "Shadow Special markers");
  markerMicroseconds.forEach((marker, index) => {
    assertNonnegativeInteger(marker, `Shadow Special marker ${index}`);
    if (index > 0 && marker <= markerMicroseconds[index - 1]!) {
      throw new Error("Shadow Special markers must be strictly chronological");
    }
  });
  if (!events) throw new Error("Exact-marker shadow Specials require exact timeline events");
  const derivedStarts = markerMicroseconds.map((marker) =>
    events.filter((event) => event[0] < marker).length,
  );
  const suppliedStarts = input.specialStartsAtCombo
    ? asFive(input.specialStartsAtCombo, "Shadow Special start combos")
    : null;
  if (suppliedStarts) {
    suppliedStarts.forEach((combo, index) => {
      assertNonnegativeInteger(combo, `Shadow Special start combo ${index}`);
      if (combo !== derivedStarts[index]) {
        throw new Error(`Shadow Special start combo ${index} does not match pinned events`);
      }
    });
  }
  return {
    markers: asFive(markerMicroseconds.map((marker) => marker / 1_000), "Shadow Special markers"),
    startsAtCombo: asFive(suppliedStarts ?? derivedStarts, "Shadow Special start combos"),
  };
}

export function compileShadowChart(
  input: ShadowChartInput,
  variant: ExactTimelineShadowVariant,
): ShadowCompiledChart {
  validateVariant(variant);
  assertPositiveInteger(input.fullComboNoteCount, "Shadow chart note count");
  const durationMilliseconds = resolveDuration(input);
  const events = resolveEvents(input);
  if (variant.noteTiming === "exact" || variant.noteWeights === "manual-perfect-coefficients") {
    if (!events) throw new Error("Exact shadow variant requires injected timeline events");
    validateExactEvents(events, input.fullComboNoteCount);
  }
  if (events && events.length !== input.fullComboNoteCount) {
    throw new Error("Shadow chart event count does not match note count");
  }

  const noteTimesMilliseconds = variant.noteTiming === "exact"
    ? events!.map((event) => event[0] / 1_000)
    : Array.from(
        { length: input.fullComboNoteCount },
        (_, index) => ((index + 0.5) * durationMilliseconds) / input.fullComboNoteCount,
      );
  const weights = noteWeights(variant, events, input.fullComboNoteCount);
  const comboCountsAtScoring = Array.from(
    { length: input.fullComboNoteCount },
    (_, index) => index,
  );
  const comboCache = new Map<number, number>();
  const noteWeightsPermil = weights.map((weight, index) =>
    (weight * comboMultiplierPermil(variant, comboCountsAtScoring[index]!, comboCache)) / 1_000,
  );
  const noteWeightPrefixPermil = [0];
  for (const weight of noteWeightsPermil) {
    noteWeightPrefixPermil.push(noteWeightPrefixPermil.at(-1)! + weight);
  }
  const special = resolveSpecialMarkers(input, variant, events);
  const baseBreakpoints = [0, durationMilliseconds, ...noteTimesMilliseconds];
  if (special.markers) baseBreakpoints.push(...special.markers);

  return Object.freeze({
    chartKey: input.chartKey ?? null,
    durationMilliseconds,
    noteCount: input.fullComboNoteCount,
    noteTimesMilliseconds: Object.freeze(noteTimesMilliseconds),
    noteWeightsPermil: Object.freeze(noteWeightsPermil),
    noteWeightPrefixPermil: Object.freeze(noteWeightPrefixPermil),
    comboCountsAtScoring: Object.freeze(comboCountsAtScoring),
    specialMarkerMilliseconds: special.markers,
    specialStartsAtCombo: special.startsAtCombo,
    baseBreakpointsMilliseconds: Object.freeze(
      uniqueSorted(baseBreakpoints.filter((value) => value >= 0 && value <= durationMilliseconds)),
    ),
    variant,
  });
}

function validateProfiles(profiles: readonly ShadowMemberProfile[]): Five<ShadowMemberProfile> {
  const five = asFive(profiles, "Shadow member profiles");
  five.forEach((profile, index) => {
    const prefix = profile.cardId ? `${profile.cardId} ` : `Member ${index + 1} `;
    assertNonnegativePermil(profile.active.scoreUpPermil, `${prefix}Active score-up`);
    if (profile.active.comboGatedSelections) {
      let previousThreshold = 0;
      for (const selection of profile.active.comboGatedSelections) {
        assertPositiveInteger(selection.comboAtLeast, `${prefix}Active combo threshold`);
        assertNonnegativePermil(selection.scoreUpPermil, `${prefix}Active combo score-up`);
        if (selection.comboAtLeast <= previousThreshold) {
          throw new Error(`${prefix}Active combo thresholds must be strictly increasing`);
        }
        previousThreshold = selection.comboAtLeast;
      }
    }
    assertPositiveInteger(profile.active.cooldownMilliseconds, `${prefix}Active cooldown`);
    assertPositiveInteger(profile.active.durationMilliseconds, `${prefix}Active duration`);
    assertPermil(profile.active.activationProbabilityPermil, `${prefix}Active probability`);
    assertNonnegativePermil(profile.active.persistentSupportPermil, `${prefix}persistent support`);
    assertPositiveInteger(profile.special.durationMilliseconds, `${prefix}Special duration`);
    assertNonnegativePermil(profile.special.scoreSupportPermil, `${prefix}Special score support`);
    assertNonnegativePermil(profile.special.activationRateUpPermil, `${prefix}Special activation rate`);
  });
  return five;
}

function activeChecksForProfile(
  profile: ShadowMemberProfile,
  chart: ShadowCompiledChart,
  specialWindows: readonly SpecialWindow[],
): ActiveCheck[] {
  const firstCheck = chart.variant.liveStartIdle === "pinned-3000ms"
    ? SHADOW_LIVE_START_IDLE_MILLISECONDS + profile.active.cooldownMilliseconds
    : profile.active.cooldownMilliseconds;
  const checks: ActiveCheck[] = [];
  for (
    let atMilliseconds = firstCheck;
    atMilliseconds < chart.durationMilliseconds;
    atMilliseconds += profile.active.cooldownMilliseconds
  ) {
    const activationBoost = specialWindows.reduce(
      (total, window) =>
        atMilliseconds >= window.startsAtMilliseconds && atMilliseconds < window.endsAtMilliseconds
          ? total + window.activationRateUpPermil
          : total,
      0,
    );
    checks.push({
      atMilliseconds,
      endsAtMilliseconds: Math.min(
        chart.durationMilliseconds,
        atMilliseconds + profile.active.durationMilliseconds,
      ),
      probabilityPermil: Math.min(1_000, profile.active.activationProbabilityPermil + activationBoost),
    });
  }
  return checks;
}

function activeProbabilityAt(
  noteTimeMilliseconds: number,
  checks: readonly ActiveCheck[],
): number {
  let noActivationProbability = 1;
  for (const check of checks) {
    if (check.atMilliseconds > noteTimeMilliseconds) break;
    if (check.endsAtMilliseconds <= noteTimeMilliseconds) continue;
    noActivationProbability *= 1 - check.probabilityPermil / 1_000;
  }
  return 1 - noActivationProbability;
}

function scoreUpAtCombo(profile: ShadowMemberProfile, combo: number): number {
  let scoreUpPermil = profile.active.scoreUpPermil;
  for (const selection of profile.active.comboGatedSelections ?? []) {
    if (selection.comboAtLeast > combo) break;
    scoreUpPermil = selection.scoreUpPermil;
  }
  return scoreUpPermil;
}

function expectedMaximum(
  values: readonly { value: number; probability: number }[],
): number {
  const ordered = values
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry) => entry.value > 0 && entry.probability > 0)
    .sort((left, right) => right.value - left.value || left.index - right.index);
  let result = 0;
  let noHigherProbability = 1;
  for (let index = 0; index < ordered.length;) {
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

function specialWindowsFor(
  profiles: Five<ShadowMemberProfile>,
  chart: ShadowCompiledChart,
): { windows: SpecialWindow[]; endClippedWindows: number } {
  if (chart.variant.specialWindows === "duration-coverage") {
    return {
      windows: profiles.map((profile) => {
        const coverage = Math.min(
          1,
          profile.special.durationMilliseconds / chart.durationMilliseconds,
        );
        return {
          startsAtMilliseconds: 0,
          endsAtMilliseconds: chart.durationMilliseconds,
          scoreSupportPermil: profile.special.scoreSupportPermil * coverage,
          activationRateUpPermil: profile.special.activationRateUpPermil * coverage,
        };
      }),
      endClippedWindows: 0,
    };
  }
  if (!chart.specialMarkerMilliseconds) {
    throw new Error("Exact-marker shadow chart has no Special markers");
  }
  let endClippedWindows = 0;
  const windows = profiles.map((profile, index) => {
    const startsAtMilliseconds = chart.specialMarkerMilliseconds![index]!;
    const untrimmedEnd = startsAtMilliseconds + profile.special.durationMilliseconds;
    const endsAtMilliseconds = Math.min(chart.durationMilliseconds, untrimmedEnd);
    if (endsAtMilliseconds < untrimmedEnd) endClippedWindows += 1;
    return {
      startsAtMilliseconds,
      endsAtMilliseconds,
      scoreSupportPermil: profile.special.scoreSupportPermil,
      activationRateUpPermil: profile.special.activationRateUpPermil,
    };
  });
  return { windows, endClippedWindows };
}

function segmentCount(
  chart: ShadowCompiledChart,
  checksByMember: readonly (readonly ActiveCheck[])[],
  specialWindows: readonly SpecialWindow[],
  profiles: Five<ShadowMemberProfile>,
): number {
  const breakpoints = [
    ...chart.baseBreakpointsMilliseconds,
    ...checksByMember.flatMap((checks) => checks.flatMap((check) => [
      check.atMilliseconds,
      check.endsAtMilliseconds,
    ])),
    ...specialWindows.flatMap((window) => [window.startsAtMilliseconds, window.endsAtMilliseconds]),
    ...profiles.flatMap((profile) =>
      (profile.active.comboGatedSelections ?? []).flatMap((selection) => {
        const noteIndex = selection.comboAtLeast - 1;
        return noteIndex >= 0 && noteIndex < chart.noteCount
          ? [chart.noteTimesMilliseconds[noteIndex]!]
          : [];
      }),
    ),
  ];
  const sorted = uniqueSorted(breakpoints.filter((value) => value >= 0 && value <= chart.durationMilliseconds));
  let segments = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]! > sorted[index - 1]!) segments += 1;
  }
  return segments;
}

export function evaluateShadowTiming(
  profiles: readonly ShadowMemberProfile[],
  chart: ShadowCompiledChart,
): ShadowTimingResult {
  const fiveProfiles = validateProfiles(profiles);
  const { windows, endClippedWindows } = specialWindowsFor(fiveProfiles, chart);
  const checksByMember = fiveProfiles.map((profile) =>
    activeChecksForProfile(profile, chart, windows),
  );
  let weightedTimingTotal = 0;
  for (let noteIndex = 0; noteIndex < chart.noteCount; noteIndex += 1) {
    const noteTimeMilliseconds = chart.noteTimesMilliseconds[noteIndex]!;
    const specialSupportPermil = windows.reduce(
      (total, window) =>
        noteTimeMilliseconds >= window.startsAtMilliseconds &&
        noteTimeMilliseconds < window.endsAtMilliseconds
          ? total + window.scoreSupportPermil
          : total,
      0,
    );
    const entries = fiveProfiles.map((profile, memberIndex) => ({
      value:
        (scoreUpAtCombo(profile, chart.comboCountsAtScoring[noteIndex]! + 1) *
          (1_000 + profile.active.persistentSupportPermil + specialSupportPermil)) /
        1_000,
      probability: activeProbabilityAt(noteTimeMilliseconds, checksByMember[memberIndex]!),
    }));
    weightedTimingTotal += chart.noteWeightsPermil[noteIndex]! * expectedMaximum(entries);
  }
  // Normalize by the chart's weighted note mass, not by noteCount×1000: the
  // composed total scales this permil by the chart-independent baseTotal, so
  // the weights must redistribute note importance without changing the
  // Active-vs-base scale (weights hit base score and Active boost equally).
  const weightMassPermil = chart.noteWeightPrefixPermil.at(-1)!;
  if (!(weightMassPermil > 0)) throw new Error("Shadow chart has no scorable note weight");
  const timingPermil = rounded(weightedTimingTotal / weightMassPermil);
  return Object.freeze({
    timingPermil,
    diagnostics: Object.freeze({
      noteCount: chart.noteCount,
      activeChecks: checksByMember.reduce((total, checks) => total + checks.length, 0),
      specialWindows: windows.length,
      endClippedWindows,
      segments: segmentCount(chart, checksByMember, windows, fiveProfiles),
    }),
  });
}

export function composeShadowCentral(input: ShadowCentralComposition): number {
  assertFiniteNumber(input.baseParametersRelativeUnitsCentral, "Shadow base parameter units");
  assertFiniteNumber(input.parameterEffectsRelativeUnitsCentral, "Shadow parameter-effect units");
  assertFiniteNumber(input.baseTotal, "Shadow base total");
  assertFiniteNumber(input.shadowTimingPermil, "Shadow timing permil");
  return rounded(
    input.baseParametersRelativeUnitsCentral +
      input.parameterEffectsRelativeUnitsCentral +
      (input.shadowTimingPermil * input.baseTotal) / 1_000,
  );
}
