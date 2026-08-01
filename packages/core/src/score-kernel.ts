import {
  songContextData,
  type SongSourceStamp,
} from "./song-contexts";

export type ScorePlatform = "mobile" | "pc";
export type ScorePlayMode =
  (typeof songContextData.rules.noteJudgements)[number]["playMode"];
export type ScoreNoteType =
  (typeof songContextData.rules.noteJudgements)[number]["noteType"];
export type ScoreJudgement =
  (typeof songContextData.rules.noteJudgements)[number]["judgement"];

type ManualJudgement = Exclude<ScoreJudgement, "auto">;

export type KnownNoteScoreKernelInput = Readonly<{
  songId: string;
  platform: ScorePlatform;
  noteType: ScoreNoteType;
  /**
   * The combo value to look up for this note. The caller must supply it because
   * the public tables do not prove whether a boundary note is scored before or
   * after its combo increment.
   */
  comboCountAtScoring: number;
}> &
  (
    | Readonly<{ playMode: "manual"; judgement: ManualJudgement }>
    | Readonly<{ playMode: "auto"; judgement: "auto" }>
  );

export type ScoreKernelSourceRef = Pick<
  SongSourceStamp,
  "url" | "commit" | "masterVersion" | "retrievedAt" | "table" | "rowKey"
>;

export type ScoreKernelRuleState = Readonly<{
  id: string;
  status: "implemented-from-pinned-data" | "unresolved";
  blocksAbsoluteScore: boolean;
  summary: string;
  sourceRows: readonly string[];
}>;

export type RationalFactor = Readonly<{
  numerator: number;
  denominator: number;
}>;

export type JudgementCoefficient = Readonly<{
  platform: ScorePlatform;
  playMode: ScorePlayMode;
  noteType: ScoreNoteType;
  judgement: ScoreJudgement;
  sourcePermil: number | null;
  appliedPermil: number;
  awardsBaseScore: boolean;
  source: ScoreKernelSourceRef;
}>;

export type ComboScoreBonus = Readonly<{
  groupId: string;
  comboCountAtScoring: number;
  matchedBreakpointFrom: number | null;
  bonusPermil: number;
  multiplierPermil: number;
  disabledBy: "auto-live" | null;
  source: ScoreKernelSourceRef | null;
}>;

export type MusicScoreCoefficient = Readonly<{
  songId: string;
  songTitle: string;
  coefficientPermil: number;
  source: ScoreKernelSourceRef;
}>;

export type KnownNoteScoreKernel = Readonly<{
  status: "partial-known-kernel";
  canProduceAbsoluteScore: false;
  input: KnownNoteScoreKernelInput;
  music: MusicScoreCoefficient;
  judgement: JudgementCoefficient;
  combo: ComboScoreBonus;
  autoRestrictions: null | Readonly<{
    usesAutoJudgementRows: true;
    comboScoreBonusEnabled: false;
    judgmentScoreDisplayed: false;
    judgmentBoostCanChangeAutoJudgement: false;
    lifeRestoreEnabled: false;
  }>;
  /** Exact product of only the three implemented factors, before any rounding. */
  knownFactor: RationalFactor;
  unresolvedRuleIds: readonly string[];
}>;

export type KernelIntegerProjection = Readonly<{
  status: "rounding-unresolved";
  canProduceAbsoluteScore: false;
  baseUnits: bigint;
  exactNumerator: bigint;
  exactDenominator: bigint;
  floorCandidate: bigint;
  nearestHalfUpCandidate: bigint;
  ceilCandidate: bigint;
  selectedValue: null;
  unresolvedRuleIds: readonly [
    "unit-score-equation",
    "score-factor-operation-order",
    "runtime-integer-rounding",
  ];
}>;

const sourceRef = (source: SongSourceStamp): ScoreKernelSourceRef => ({
  url: source.url,
  commit: source.commit,
  masterVersion: source.masterVersion,
  retrievedAt: source.retrievedAt,
  table: source.table,
  rowKey: source.rowKey,
});

const sourceRow = (source: SongSourceStamp): string =>
  `${source.table}:${source.rowKey}`;

const firstNoteSource = songContextData.rules.noteJudgements[0]?.source;
const firstComboSource = songContextData.rules.comboBonuses[0]?.source;
const firstSongSource = songContextData.songs[0]?.source;
if (!firstNoteSource || !firstComboSource || !firstSongSource) {
  throw new Error("Pinned score-kernel sources are empty");
}

export const SCORE_KERNEL_SOURCE_SNAPSHOT = Object.freeze({
  repository: songContextData.sourceSnapshot.repository,
  commit: songContextData.sourceSnapshot.commit,
  masterVersion: songContextData.sourceSnapshot.masterVersion,
  retrievedAt: songContextData.retrievedAt,
  methodologyVersion: "known-score-kernel-v1",
});

export const SCORE_KERNEL_RULE_STATES: readonly ScoreKernelRuleState[] = Object.freeze([
  {
    id: "note-judgement-platform-coefficients",
    status: "implemented-from-pinned-data",
    blocksAbsoluteScore: false,
    summary: "Mobile and PC note-judgement permil coefficients come from LiveNote rows.",
    sourceRows: [sourceRow(firstNoteSource)],
  },
  {
    id: "combo-score-bonus-breakpoints",
    status: "implemented-from-pinned-data",
    blocksAbsoluteScore: false,
    summary: "The highest LiveCombo breakpoint not above a caller-supplied combo count is used.",
    sourceRows: [sourceRow(firstComboSource)],
  },
  {
    id: "music-score-coefficient",
    status: "implemented-from-pinned-data",
    blocksAbsoluteScore: false,
    summary: "The song-specific Music live-score coefficient is retained as an integer permil factor.",
    sourceRows: [sourceRow(firstSongSource)],
  },
  {
    id: "auto-live-restrictions",
    status: "implemented-from-pinned-data",
    blocksAbsoluteScore: false,
    summary: "Auto uses AUTO judgement rows, disables combo score bonus, and preserves documented skill restrictions.",
    sourceRows: songContextData.rules.autoLive.sources.map(sourceRow),
  },
  {
    id: "combo-boundary-application-order",
    status: "unresolved",
    blocksAbsoluteScore: true,
    summary: "The public tables do not prove whether a note increments combo before or after its score lookup.",
    sourceRows: [sourceRow(firstComboSource)],
  },
  {
    id: "unit-score-equation",
    status: "unresolved",
    blocksAbsoluteScore: true,
    summary: "The complete conversion from parameters, skills, Board state, and collection bonuses to Unit Score is unvalidated.",
    sourceRows: [sourceRow(songContextData.rules.scoreConstants.source)],
  },
  {
    id: "score-factor-operation-order",
    status: "unresolved",
    blocksAbsoluteScore: true,
    summary: "The runtime order for Unit Score, song, judgement, combo, and skill factors is unvalidated.",
    sourceRows: [
      sourceRow(firstSongSource),
      sourceRow(firstNoteSource),
      sourceRow(firstComboSource),
    ],
  },
  {
    id: "runtime-integer-rounding",
    status: "unresolved",
    blocksAbsoluteScore: true,
    summary: "The game\'s intermediate and final integer rounding policy is unvalidated.",
    sourceRows: [
      sourceRow(firstSongSource),
      sourceRow(firstNoteSource),
      sourceRow(firstComboSource),
    ],
  },
]);

const songById = new Map(songContextData.songs.map((song) => [song.id, song]));

function assertNonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative safe integer`);
  }
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

function reduceFactor(numerator: number, denominator: number): RationalFactor {
  if (!Number.isSafeInteger(numerator) || numerator < 0) {
    throw new Error("Factor numerator must be a nonnegative safe integer");
  }
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error("Factor denominator must be a positive safe integer");
  }
  if (numerator === 0) return { numerator: 0, denominator: 1 };
  const divisor = greatestCommonDivisor(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

export function resolveMusicScoreCoefficient(songId: string): MusicScoreCoefficient {
  const song = songById.get(songId);
  if (!song) throw new Error(`Unknown song ${songId}`);
  return {
    songId: song.id,
    songTitle: song.title,
    coefficientPermil: song.liveScoreCoefficientPermilRaw,
    source: sourceRef(song.source),
  };
}

export function resolveJudgementCoefficient(input: Readonly<{
  platform: ScorePlatform;
  playMode: ScorePlayMode;
  noteType: ScoreNoteType;
  judgement: ScoreJudgement;
}>): JudgementCoefficient {
  if (input.playMode === "auto" && input.judgement !== "auto") {
    throw new Error("Auto Live must use the AUTO judgement row");
  }
  if (input.playMode === "manual" && input.judgement === "auto") {
    throw new Error("Manual Live cannot use the AUTO judgement row");
  }
  const row = songContextData.rules.noteJudgements.find(
    (candidate) =>
      candidate.playMode === input.playMode &&
      candidate.noteType === input.noteType &&
      candidate.judgement === input.judgement,
  );
  if (!row) {
    throw new Error(
      `No pinned LiveNote row for ${input.playMode}:${input.noteType}:${input.judgement}`,
    );
  }
  const sourcePermil =
    input.platform === "pc"
      ? row.pcScoreCoefficientPermilMultiply
      : row.scoreCoefficientPermilMultiply;
  return {
    ...input,
    sourcePermil,
    appliedPermil: sourcePermil ?? 0,
    awardsBaseScore: sourcePermil !== null,
    source: sourceRef(row.source),
  };
}

export function resolveComboScoreBonus(input: Readonly<{
  groupId: string;
  comboCountAtScoring: number;
  playMode: ScorePlayMode;
}>): ComboScoreBonus {
  assertNonnegativeInteger(input.comboCountAtScoring, "Combo count");

  const rows = songContextData.rules.comboBonuses
    .filter((candidate) => candidate.groupId === input.groupId)
    .sort((left, right) => left.comboCountFrom - right.comboCountFrom);
  if (rows.length === 0) throw new Error(`Unknown combo group ${input.groupId}`);

  if (input.playMode === "auto") {
    return {
      groupId: input.groupId,
      comboCountAtScoring: input.comboCountAtScoring,
      matchedBreakpointFrom: null,
      bonusPermil: 0,
      multiplierPermil: 1_000,
      disabledBy: "auto-live",
      source: null,
    };
  }

  let row: (typeof rows)[number] | undefined;
  for (const candidate of rows) {
    if (candidate.comboCountFrom > input.comboCountAtScoring) break;
    row = candidate;
  }
  if (!row) {
    throw new Error(
      `Combo group ${input.groupId} has no breakpoint for ${input.comboCountAtScoring}`,
    );
  }
  const bonusPermil = row.scoreUpPermil ?? 0;
  return {
    groupId: input.groupId,
    comboCountAtScoring: input.comboCountAtScoring,
    matchedBreakpointFrom: row.comboCountFrom,
    bonusPermil,
    multiplierPermil: 1_000 + bonusPermil,
    disabledBy: null,
    source: sourceRef(row.source),
  };
}

export function compileKnownNoteScoreKernel(
  input: KnownNoteScoreKernelInput,
): KnownNoteScoreKernel {
  assertNonnegativeInteger(input.comboCountAtScoring, "Combo count");
  const song = songById.get(input.songId);
  if (!song) throw new Error(`Unknown song ${input.songId}`);

  const music = resolveMusicScoreCoefficient(input.songId);
  const judgement = resolveJudgementCoefficient(input);
  const combo = resolveComboScoreBonus({
    groupId: song.comboGroupId,
    comboCountAtScoring: input.comboCountAtScoring,
    playMode: input.playMode,
  });
  const knownFactor = reduceFactor(
    music.coefficientPermil * judgement.appliedPermil * combo.multiplierPermil,
    1_000 ** 3,
  );

  return {
    status: "partial-known-kernel",
    canProduceAbsoluteScore: false,
    input,
    music,
    judgement,
    combo,
    autoRestrictions:
      input.playMode === "auto"
        ? {
            usesAutoJudgementRows: songContextData.rules.autoLive.usesAutoJudgementRows,
            comboScoreBonusEnabled: songContextData.rules.autoLive.comboScoreBonusEnabled,
            judgmentScoreDisplayed: songContextData.rules.autoLive.judgmentScoreDisplayed,
            judgmentBoostCanChangeAutoJudgement:
              songContextData.rules.autoLive.judgmentBoostCanChangeAutoJudgement,
            lifeRestoreEnabled: songContextData.rules.autoLive.lifeRestoreEnabled,
          }
        : null,
    knownFactor,
    unresolvedRuleIds: SCORE_KERNEL_RULE_STATES.filter(
      (rule) => rule.status === "unresolved",
    ).map((rule) => rule.id),
  };
}

/**
 * Projects the exact known-factor fraction onto caller-supplied integer base
 * units. It returns candidates instead of choosing the game's unresolved
 * runtime rounding policy or claiming the base units are a validated Unit Score.
 */
export function projectKnownKernelIntegerCandidates(
  baseUnits: bigint,
  kernel: KnownNoteScoreKernel,
): KernelIntegerProjection {
  if (baseUnits < 0n) throw new Error("Base units must be nonnegative");
  const exactNumerator = baseUnits * BigInt(kernel.knownFactor.numerator);
  const exactDenominator = BigInt(kernel.knownFactor.denominator);
  const quotient = exactNumerator / exactDenominator;
  const remainder = exactNumerator % exactDenominator;

  return {
    status: "rounding-unresolved",
    canProduceAbsoluteScore: false,
    baseUnits,
    exactNumerator,
    exactDenominator,
    floorCandidate: quotient,
    nearestHalfUpCandidate:
      (exactNumerator * 2n + exactDenominator) / (exactDenominator * 2n),
    ceilCandidate: remainder === 0n ? quotient : quotient + 1n,
    selectedValue: null,
    unresolvedRuleIds: [
      "unit-score-equation",
      "score-factor-operation-order",
      "runtime-integer-rounding",
    ],
  };
}
