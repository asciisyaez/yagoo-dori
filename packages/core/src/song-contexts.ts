import songContextJson from "../../../data/generated/holodori-songs.json";
import { z } from "zod";

export const DifficultySchema = z.enum(["easy", "normal", "hard", "expert"]);
export const NoteTypeSchema = z.enum([
  "normal",
  "flick",
  "long-start",
  "long-end",
  "long-flick-end",
  "long-continuation",
  "long-relay",
  "damage",
]);
export const JudgementSchema = z.enum([
  "miss",
  "bad",
  "good",
  "great",
  "perfect",
  "perfect-plus",
  "auto",
]);

export const SongSourceStampSchema = z
  .object({
    repository: z.url(),
    url: z.url(),
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    masterVersion: z.string().regex(/^[a-f0-9]{64}$/),
    retrievedAt: z.iso.date(),
    table: z.string().endsWith(".json"),
    rowKey: z.string().min(1),
    transformVersion: z.string().min(1),
  })
  .strict();

const ChorusRangeSchema = z
  .object({
    startMilliseconds: z.number().int().nonnegative(),
    endMilliseconds: z.number().int().positive(),
  })
  .strict()
  .refine((range) => range.endMilliseconds > range.startMilliseconds, {
    message: "Chorus end must follow chorus start",
  });

export const SongContextSchema = z
  .object({
    id: z.string().regex(/^m\d{4}$/),
    title: z.string().min(1),
    playingMilliseconds: z.number().int().positive(),
    category: z.enum(["original", "cover"]),
    liveScoreCoefficientPermilRaw: z.number().int().nonnegative(),
    singleLiveScoreEvaluationRankGroupId: z.string().min(1),
    multiLiveScoreEvaluationRankGroupId: z.string().min(1),
    comboGroupId: z.string().min(1),
    scoreRatingEligible: z.boolean(),
    singerType: z.enum(["solo", "group", "all"]),
    singerTalentIds: z.array(z.string().min(1)),
    chorusRange: ChorusRangeSchema.nullable(),
    releaseTypeRaw: z.string().min(1),
    startTimeEpochMilliseconds: z.number().int().positive(),
    order: z.number().int().nonnegative(),
    source: SongSourceStampSchema,
    titleSource: SongSourceStampSchema,
  })
  .strict();

export const AggregateChartContextSchema = z
  .object({
    fidelity: z.literal("aggregate"),
    key: z.string().regex(/^m\d{4}:(easy|normal|hard|expert)$/),
    songId: z.string().regex(/^m\d{4}$/),
    difficulty: DifficultySchema,
    level: z.number().int().positive(),
    chartAssetId: z.string().min(1),
    chartHash: z.string().regex(/^[a-f0-9]{32}$/),
    fullComboNoteCount: z.number().int().positive(),
    normalNoteCount: z.number().int().nonnegative(),
    maxComboCountRewardThreshold: z.number().int().nonnegative(),
    animationComboInterval: z.number().int().positive(),
    sources: z
      .object({
        difficulty: SongSourceStampSchema,
        aggregate: SongSourceStampSchema,
        configuration: SongSourceStampSchema,
      })
      .strict(),
  })
  .strict()
  .refine((chart) => chart.key === `${chart.songId}:${chart.difficulty}`, {
    message: "Aggregate chart key must match its song and difficulty",
  });

export const TimedNoteEventSchema = z
  .object({
    atMilliseconds: z.number().int().nonnegative(),
    noteType: NoteTypeSchema,
    comboDelta: z.number().int().nonnegative(),
    scoreCoefficientPermilMultiply: z.number().int().nonnegative(),
    lifeReductionOnMiss: z.number().int().nonnegative(),
  })
  .strict();

export const TimedChartContextSchema = z
  .object({
    fidelity: z.literal("timed"),
    key: z.string().regex(/^m\d{4}:(easy|normal|hard|expert)$/),
    songId: z.string().regex(/^m\d{4}$/),
    difficulty: DifficultySchema,
    level: z.number().int().positive(),
    chartAssetId: z.string().min(1),
    chartHash: z.string().regex(/^[a-f0-9]{32}$/),
    events: z.array(TimedNoteEventSchema).min(1),
    specialMarkerMilliseconds: z.tuple([
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
    ]),
    source: SongSourceStampSchema,
  })
  .strict()
  .refine((chart) => chart.key === `${chart.songId}:${chart.difficulty}`, {
    message: "Timed chart key must match its song and difficulty",
  })
  .refine(
    (chart) =>
      chart.events.every(
        (event, index) => index === 0 || event.atMilliseconds >= chart.events[index - 1]!.atMilliseconds,
      ),
    { message: "Timed chart events must be chronological" },
  )
  .refine(
    (chart) =>
      chart.specialMarkerMilliseconds.every(
        (marker, index) => index === 0 || marker >= chart.specialMarkerMilliseconds[index - 1]!,
      ),
    { message: "Special markers must be chronological" },
  );

export const ChartContextSchema = z.discriminatedUnion("fidelity", [
  AggregateChartContextSchema,
  TimedChartContextSchema,
]);

const NullableCoefficientSchema = z.number().nullable();
const LiveRankTypeSchema = z.enum(["d", "c", "b", "a", "s"]);
const NoteJudgementRuleSchema = z
  .object({
    key: z.string().min(1),
    playMode: z.enum(["manual", "auto"]),
    noteType: NoteTypeSchema,
    judgement: JudgementSchema,
    acceptableBeforeFrameCount: NullableCoefficientSchema,
    acceptableAfterFrameCount: NullableCoefficientSchema,
    lifeReductionQuantity: NullableCoefficientSchema,
    scoreCoefficientPermilMultiply: NullableCoefficientSchema,
    pcScoreCoefficientPermilMultiply: NullableCoefficientSchema,
    feverPoint: NullableCoefficientSchema,
    creativeChartDifficultyWeightPermil: NullableCoefficientSchema,
    source: SongSourceStampSchema,
  })
  .strict();

const CorpusEntrySchema = z
  .object({
    chartKey: z.string().min(1),
    expectedChartHash: z.string().regex(/^[a-f0-9]{32}$/),
    reason: z.string().min(1),
  })
  .strict();

const RuleCatalogSchema = z
  .object({
    noteJudgements: z.array(NoteJudgementRuleSchema),
    technicalJudgementScores: z.array(
      z
        .object({
          judgement: JudgementSchema,
          score: z.number().nullable(),
          source: SongSourceStampSchema,
        })
        .strict(),
    ),
    comboBonuses: z.array(
      z
        .object({
          groupId: z.string().min(1),
          comboCountFrom: z.number().int().nonnegative(),
          scoreUpPermil: z.number().int().nonnegative().nullable(),
          source: SongSourceStampSchema,
        })
        .strict(),
    ),
    deckEvaluationBonusRanks: z.array(
      z
        .object({
          type: LiveRankTypeSchema,
          plus: z.number().int().nonnegative(),
          thresholdPermilUp: z.number().int().nonnegative(),
          source: SongSourceStampSchema,
        })
        .strict(),
    ),
    deckEvaluationRanks: z.array(
      z
        .object({
          type: LiveRankTypeSchema,
          plus: z.number().int().nonnegative(),
          threshold: z.number().int().nonnegative().nullable(),
          order: z.number().int().positive(),
          source: SongSourceStampSchema,
        })
        .strict(),
    ),
    deckPowerRanks: z.array(
      z
        .object({
          type: LiveRankTypeSchema,
          plus: z.number().int().nonnegative(),
          threshold: z.number().int().nonnegative().nullable(),
          source: SongSourceStampSchema,
        })
        .strict(),
    ),
    scoreEvaluationRanks: z.array(
      z
        .object({
          groupId: z.string().min(1),
          type: LiveRankTypeSchema,
          plus: z.number().int().nonnegative(),
          score: z.number().int().nonnegative().nullable(),
          source: SongSourceStampSchema,
        })
        .strict(),
    ),
    life: z
      .object({
        maximum: z.number().int().positive(),
        warningThreshold: z.number().int().nonnegative(),
        badAndMissReduceLife: z.literal(true),
        liveEndsAtZero: z.literal(true),
        sources: z.array(SongSourceStampSchema).min(1),
      })
      .strict(),
    manualLive: z
      .object({
        comboContinuesAtOrAbove: z.literal("great"),
        comboBreaksOn: z.tuple([z.literal("good"), z.literal("bad"), z.literal("miss")]),
        scoreDependsOnJudgementAndCombo: z.literal(true),
        source: SongSourceStampSchema,
      })
      .strict(),
    autoLive: z
      .object({
        usesAutoJudgementRows: z.literal(true),
        lowerMultiplierThanManual: z.literal(true),
        comboScoreBonusEnabled: z.literal(false),
        judgmentScoreDisplayed: z.literal(false),
        judgmentBoostCanChangeAutoJudgement: z.literal(false),
        lifeRestoreEnabled: z.literal(false),
        sources: z.array(SongSourceStampSchema).min(1),
      })
      .strict(),
    rating: z
      .object({
        aggregationSongCount: z.number().int().positive(),
        valueDenominator: z.number().int().positive(),
        scoreIsHighestAcrossDifficulties: z.literal(true),
        requiresTalentAsLeader: z.literal(true),
        steamEligible: z.literal(false),
        sources: z.array(SongSourceStampSchema).min(1),
      })
      .strict(),
    live: z
      .object({
        leaderCount: z.literal(1),
        memberCount: z.literal(5),
        specialUsesPerLive: z.literal(1),
        specialOrder: z.literal("formation-order"),
        activeActivation: z.literal("random-at-intervals"),
        passiveActivation: z.literal("constant-when-conditions-met"),
        musicStartIdleTimeMilliseconds: z.number().int().nonnegative(),
        sources: z.array(SongSourceStampSchema).min(1),
      })
      .strict(),
    scoreConstants: z
      .object({
        deckEvaluationCoefficientPermilMultiply: z.number().int().nonnegative(),
        deckPowerCoefficientPermilMultiply: z.number().int().nonnegative(),
        longNoteCountForContinuation: z.number().int().positive(),
        longNoteEndAcceptableWindowMilliseconds: z.number().int().nonnegative(),
        longRelayAcceptableWindowMilliseconds: z.number().int().nonnegative(),
        damageNoteInvincibilityTimeMilliseconds: z.number().int().nonnegative(),
        resultNoteCountTolerance: z.number().int().nonnegative(),
        source: SongSourceStampSchema,
      })
      .strict(),
  })
  .strict();

export const SongContextDataSchema = z
  .object({
    schemaVersion: z.literal(1),
    methodologyVersion: z.string().min(1),
    retrievedAt: z.iso.date(),
    sourceSnapshot: z
      .object({
        repository: z.url(),
        commit: z.string().regex(/^[a-f0-9]{40}$/),
        masterVersion: z.string().regex(/^[a-f0-9]{64}$/),
        files: z.array(z.string().endsWith(".json")).min(1),
        transformation: z.string().min(1),
      })
      .strict(),
    evidenceSources: z.array(
      z
        .object({ id: z.string().min(1), url: z.url(), role: z.string().min(1) })
        .strict(),
    ),
    counts: z
      .object({
        songs: z.number().int().nonnegative(),
        aggregateCharts: z.number().int().nonnegative(),
        timedCharts: z.number().int().nonnegative(),
        ratingEligibleSongs: z.number().int().nonnegative(),
      })
      .strict(),
    validation: z
      .object({
        chartTimeline: z.enum(["unavailable", "available"]),
        runtimeScoreEquation: z.enum(["unvalidated", "validated"]),
        absoluteScoreClaimsAllowed: z.boolean(),
        exactPerSongOptimizationClaimsAllowed: z.boolean(),
      })
      .strict(),
    songs: z.array(SongContextSchema),
    charts: z.array(AggregateChartContextSchema),
    timedCharts: z.array(TimedChartContextSchema),
    rules: RuleCatalogSchema,
    corpora: z
      .object({
        full: z
          .object({ id: z.string().min(1), entries: z.array(CorpusEntrySchema) })
          .strict(),
        compact: z
          .object({ id: z.string().min(1), entries: z.array(CorpusEntrySchema) })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.counts.songs !== data.songs.length) {
      context.addIssue({ code: "custom", path: ["counts", "songs"], message: "Song count mismatch" });
    }
    if (data.counts.aggregateCharts !== data.charts.length) {
      context.addIssue({ code: "custom", path: ["counts", "aggregateCharts"], message: "Aggregate chart count mismatch" });
    }
    if (data.counts.timedCharts !== data.timedCharts.length) {
      context.addIssue({ code: "custom", path: ["counts", "timedCharts"], message: "Timed chart count mismatch" });
    }
    if (data.counts.ratingEligibleSongs !== data.songs.filter((song) => song.scoreRatingEligible).length) {
      context.addIssue({ code: "custom", path: ["counts", "ratingEligibleSongs"], message: "Rating-song count mismatch" });
    }

    const songIds = new Set(data.songs.map((song) => song.id));
    const chartByKey = new Map(data.charts.map((chart) => [chart.key, chart]));
    if (songIds.size !== data.songs.length) {
      context.addIssue({ code: "custom", path: ["songs"], message: "Song IDs must be unique" });
    }
    if (chartByKey.size !== data.charts.length) {
      context.addIssue({ code: "custom", path: ["charts"], message: "Chart keys must be unique" });
    }
    for (const chart of data.charts) {
      if (!songIds.has(chart.songId)) {
        context.addIssue({ code: "custom", path: ["charts"], message: `Unknown song ${chart.songId}` });
      }
    }
    for (const song of data.songs) {
      const difficulties = new Set(
        data.charts.filter((chart) => chart.songId === song.id).map((chart) => chart.difficulty),
      );
      if (difficulties.size !== DifficultySchema.options.length) {
        context.addIssue({ code: "custom", path: ["charts"], message: `${song.id} must have four difficulties` });
      }
    }
    for (const corpus of [data.corpora.full, data.corpora.compact]) {
      for (const entry of corpus.entries) {
        const chart = chartByKey.get(entry.chartKey);
        if (!chart || chart.chartHash !== entry.expectedChartHash) {
          context.addIssue({ code: "custom", path: ["corpora"], message: `Corpus drift at ${entry.chartKey}` });
        }
      }
    }
    if (
      data.charts.some((chart) => chart.fidelity === "aggregate") &&
      (data.validation.absoluteScoreClaimsAllowed ||
        data.validation.exactPerSongOptimizationClaimsAllowed)
    ) {
      context.addIssue({
        code: "custom",
        path: ["validation"],
        message: "Aggregate chart snapshots cannot authorize exact or absolute claims",
      });
    }
  });

export type SongSourceStamp = z.infer<typeof SongSourceStampSchema>;
export type SongContext = z.infer<typeof SongContextSchema>;
export type AggregateChartContext = z.infer<typeof AggregateChartContextSchema>;
export type TimedChartContext = z.infer<typeof TimedChartContextSchema>;
export type ChartContext = z.infer<typeof ChartContextSchema>;
export type SongContextData = z.infer<typeof SongContextDataSchema>;
export type RuntimeScoreValidation = "unvalidated" | "validated";

export const songContextData: SongContextData = SongContextDataSchema.parse(songContextJson);

const songById = new Map(songContextData.songs.map((song) => [song.id, song]));
const chartByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));

export function ratingSongsForTalent(talentId: string): SongContext[] {
  return songContextData.songs.filter(
    (song) => song.scoreRatingEligible && song.singerTalentIds.includes(talentId),
  );
}

export type SelectedCorpusEntry = {
  chart: AggregateChartContext;
  song: SongContext;
  expectedChartHash: string;
  reason: string;
};

function selectCorpus(
  entries: SongContextData["corpora"]["full"]["entries"],
): SelectedCorpusEntry[] {
  return entries.map((entry) => {
    const chart = chartByKey.get(entry.chartKey);
    if (!chart || chart.chartHash !== entry.expectedChartHash) {
      throw new Error(`Frozen corpus drift at ${entry.chartKey}`);
    }
    const song = songById.get(chart.songId);
    if (!song) throw new Error(`Frozen corpus chart ${entry.chartKey} has no song`);
    return { chart, song, expectedChartHash: entry.expectedChartHash, reason: entry.reason };
  });
}

export function selectFullChartCorpus(): SelectedCorpusEntry[] {
  return selectCorpus(songContextData.corpora.full.entries);
}

export function selectCompactChartCorpus(): SelectedCorpusEntry[] {
  return selectCorpus(songContextData.corpora.compact.entries);
}

export type ChartClaimCapabilities = {
  canProduceAbsoluteScore: boolean;
  canClaimExactPerSongOptimum: boolean;
  reason:
    | "aggregate-chart-has-no-note-timeline"
    | "runtime-score-rules-unvalidated"
    | null;
};

export function chartClaimCapabilities(
  chart: ChartContext,
  runtimeValidation: RuntimeScoreValidation,
): ChartClaimCapabilities {
  if (chart.fidelity === "aggregate") {
    return {
      canProduceAbsoluteScore: false,
      canClaimExactPerSongOptimum: false,
      reason: "aggregate-chart-has-no-note-timeline",
    };
  }
  if (runtimeValidation !== "validated") {
    return {
      canProduceAbsoluteScore: false,
      canClaimExactPerSongOptimum: false,
      reason: "runtime-score-rules-unvalidated",
    };
  }
  return {
    canProduceAbsoluteScore: true,
    canClaimExactPerSongOptimum: true,
    reason: null,
  };
}

export function assertExactSongClaimsAllowed(
  chart: ChartContext,
  runtimeValidation: RuntimeScoreValidation,
): asserts chart is TimedChartContext {
  const capabilities = chartClaimCapabilities(chart, runtimeValidation);
  if (!capabilities.canClaimExactPerSongOptimum) {
    throw new Error(capabilities.reason ?? "Exact song claims are unavailable");
  }
}

export type ActiveIntervalInput = {
  memberCardId: string;
  firstCheckMilliseconds: number;
  cooldownMilliseconds: number;
};

export type ActiveIntervalBreakpoint = {
  memberCardId: string;
  checkNumber: number;
  atMilliseconds: number;
};

/**
 * Pure interval arithmetic for a caller-supplied first check. This deliberately
 * does not infer the game's unresolved first-check or collision behavior.
 */
export function calculateActiveIntervalBreakpoints(
  chartDurationMilliseconds: number,
  inputs: ActiveIntervalInput[],
): ActiveIntervalBreakpoint[] {
  if (!Number.isInteger(chartDurationMilliseconds) || chartDurationMilliseconds <= 0) {
    throw new Error("Chart duration must be a positive integer");
  }
  const breakpoints: ActiveIntervalBreakpoint[] = [];
  for (const input of inputs) {
    if (
      !input.memberCardId ||
      !Number.isInteger(input.firstCheckMilliseconds) ||
      input.firstCheckMilliseconds < 0 ||
      !Number.isInteger(input.cooldownMilliseconds) ||
      input.cooldownMilliseconds <= 0
    ) {
      throw new Error("Active interval inputs require a card ID and nonnegative first check with positive cooldown");
    }
    let checkNumber = 1;
    for (
      let atMilliseconds = input.firstCheckMilliseconds;
      atMilliseconds <= chartDurationMilliseconds;
      atMilliseconds += input.cooldownMilliseconds
    ) {
      breakpoints.push({ memberCardId: input.memberCardId, checkNumber, atMilliseconds });
      checkNumber += 1;
    }
  }
  return breakpoints.sort(
    (left, right) =>
      left.atMilliseconds - right.atMilliseconds ||
      left.memberCardId.localeCompare(right.memberCardId),
  );
}

export type SpecialOrderBreakpoint = {
  slot: number;
  memberCardId: string;
  startsAtMilliseconds: number;
  endsAtMilliseconds: number;
};

/** Calculate order-dependent Special windows only from an evidence-backed timed chart. */
export function calculateSpecialOrderBreakpoints(
  chart: TimedChartContext,
  memberOrder: readonly [string, string, string, string, string],
  durationByCardId: Readonly<Record<string, number>>,
): SpecialOrderBreakpoint[] {
  if (new Set(memberOrder).size !== 5) {
    throw new Error("Special order requires five unique Member card IDs");
  }
  return memberOrder.map((memberCardId, index) => {
    const durationMilliseconds = durationByCardId[memberCardId];
    if (
      durationMilliseconds === undefined ||
      !Number.isInteger(durationMilliseconds) ||
      durationMilliseconds < 0
    ) {
      throw new Error(`Missing nonnegative Special duration for ${memberCardId}`);
    }
    const startsAtMilliseconds = chart.specialMarkerMilliseconds[index]!;
    return {
      slot: index + 1,
      memberCardId,
      startsAtMilliseconds,
      endsAtMilliseconds: startsAtMilliseconds + durationMilliseconds,
    };
  });
}
