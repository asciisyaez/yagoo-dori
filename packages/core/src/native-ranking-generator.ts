import { z } from "zod";

import {
  applyFrozenNativeBaseline,
  buildFrozenNativeBaseline,
  classifyNativeTier,
  integerInterval,
  type FrozenNativeBaseline,
  type IntegerInterval,
  type NativeCardMetrics,
  type NativeTier,
} from "./native-metrics";
import {
  buildNativeRankingBenchmarkContexts,
  frozenCohortCardIds,
  NativeCurrentContextExtensionSchema,
  nativeRankingBenchmark,
  type NativeCurrentContextExtension,
  type NativeLeaderBenchmarkContext,
  type NativeMemberBenchmarkContext,
} from "./native-ranking-benchmark";
import {
  completeNativeMatchedMetrics,
  completeNativeMatchedMetricsForIndexes,
  nativePairedBootstrapSampleIndexes,
  prepareNativeMatchedComparison,
  stableNativeSeed,
  type NativeLensSamples,
  type NativePreparedComparisonSample,
} from "./native-ranking-scoring";
import {
  gatedModelBandForIndex,
  modelBandForIndex,
  nativeCompetitionRanks,
  NativeLensSchema,
  NativeRankingEntityKindSchema,
  NativeRankingSnapshotSchema,
  type NativeLens,
  type NativeRankingEntityKind,
  type NativeRankingSnapshot,
  type SerializableInterval,
} from "./native-ranking-schema";
import { memberTierForIndex, nativeMemberTierCalibration } from "./native-tier-calibration";
import {
  AGGREGATE_SPECIAL_COVERAGE_MODEL_ID,
  AGGREGATE_UNIFORM_NOTE_TIMING_MODEL_ID,
  evaluateNativeRelativeUtility,
  type NativeUtilityResult,
  type UtilityInterval,
} from "./native-utility";
import { mechanicsData } from "./mechanics";
import { publicCardById, publicCards, publicData, type PublicCard } from "./public-data";
import { songContextData } from "./song-contexts";

const INDEX_SCALE = 1_000_000;
const METRIC_PERCENT_DIVISOR = 10_000;
const BREADTH_PERCENT_DIVISOR = 100;
const BOOTSTRAP_REPLICATES = 400;
const DEFAULT_SEED = 0x5eed;
const LENSES = [
  "low-investment",
  "one-copy-maximum",
  "duplicate-enabled-ceiling",
] as const satisfies readonly NativeLens[];
const ENTITY_KINDS = ["member", "leader-outfit"] as const satisfies readonly NativeRankingEntityKind[];
const NEUTRAL_BOARD = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "methodology:neutral-board-v1",
  },
} as const;

export type NativeBaselineKey = `${NativeRankingEntityKind}|${NativeLens}`;
export const NATIVE_FROZEN_BASELINE_ROSTER_COMMIT =
  nativeRankingBenchmark.sources.roster.commit;

type RawEntity = Readonly<{
  cardId: string;
  entityKind: NativeRankingEntityKind;
  samplesByLens: NativeLensSamples;
  metricsByLens: Readonly<Record<NativeLens, NativeCardMetrics>>;
}>;

type BootstrapLensDistribution = {
  index: SerializableInterval[];
  G: IntegerInterval[];
  P: IntegerInterval[];
  B: IntegerInterval[];
  E: IntegerInterval[];
  topDecileCount: number;
};

type BootstrapEntity = Readonly<{
  cardId: string;
  entityKind: NativeRankingEntityKind;
  byLens: Record<NativeLens, BootstrapLensDistribution>;
}>;

type InternalEntry = Readonly<{
  cardId: string;
  pointIndex: number;
  entry: Omit<NativeRankingSnapshot["lenses"][number]["entries"][number], "rank">;
}>;

const SerializedRobustScaleSchema = z
  .object({
    median: z.string().regex(/^-?\d+$/),
    mad: z.string().regex(/^\d+$/),
  })
  .strict();

export const SerializedFrozenNativeBaselineSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: z.string().min(1),
    createdAt: z.iso.datetime({ offset: true }),
    rosterCommit: z.string().regex(/^[a-f0-9]{40}$/),
    methodologyVersion: z.literal("yd-native-ranking-2.0.0"),
    entityKind: NativeRankingEntityKindSchema,
    lens: NativeLensSchema,
    scales: z
      .object({
        G: SerializedRobustScaleSchema,
        P: SerializedRobustScaleSchema,
        B: SerializedRobustScaleSchema,
        E: SerializedRobustScaleSchema,
        C: SerializedRobustScaleSchema,
      })
      .strict(),
  })
  .strict();

export type SerializedFrozenNativeBaseline = z.infer<
  typeof SerializedFrozenNativeBaselineSchema
>;

export type NativeRankingGeneration = Readonly<{
  snapshot: NativeRankingSnapshot;
  baselines: readonly SerializedFrozenNativeBaseline[];
}>;

export function nativeBaselineKey(
  entityKind: NativeRankingEntityKind,
  lens: NativeLens,
): NativeBaselineKey {
  return `${entityKind}|${lens}`;
}

export function deserializeFrozenNativeBaseline(
  input: unknown,
): FrozenNativeBaseline {
  if (
    typeof input === "object" &&
    input !== null &&
    (Reflect.get(input, "schemaVersion") !== 2 ||
      Reflect.get(input, "methodologyVersion") !== "yd-native-ranking-2.0.0")
  ) {
    throw new Error("Unsupported frozen native baseline");
  }
  const serialized = SerializedFrozenNativeBaselineSchema.parse(input);
  if (serialized.rosterCommit !== NATIVE_FROZEN_BASELINE_ROSTER_COMMIT) {
    throw new Error("Frozen baseline roster commit does not match the pinned benchmark cohort");
  }
  const scales = Object.fromEntries(
    Object.entries(serialized.scales).map(([key, scale]) => {
      const median = BigInt(scale.median);
      const mad = BigInt(scale.mad);
      if (mad <= 0n) throw new Error(`Frozen ${key} scale requires a positive MAD`);
      return [key, { median, mad }];
    }),
  ) as FrozenNativeBaseline["scales"];
  return { id: serialized.id, scales };
}

function serializeBaseline(
  baseline: FrozenNativeBaseline,
  entityKind: NativeRankingEntityKind,
  lens: NativeLens,
  createdAt: string,
): SerializedFrozenNativeBaseline {
  return {
    schemaVersion: 2,
    id: baseline.id,
    createdAt,
    rosterCommit: NATIVE_FROZEN_BASELINE_ROSTER_COMMIT,
    methodologyVersion: "yd-native-ranking-2.0.0",
    entityKind,
    lens,
    scales: Object.fromEntries(
      Object.entries(baseline.scales).map(([key, scale]) => [
        key,
        { median: scale.median.toString(), mad: scale.mad.toString() },
      ]),
    ) as SerializedFrozenNativeBaseline["scales"],
  };
}

function emptySamples(): Record<NativeLens, NativePreparedComparisonSample[]> {
  return {
    "low-investment": [],
    "one-copy-maximum": [],
    "duplicate-enabled-ceiling": [],
  };
}

function asTeam(ids: readonly string[]): readonly [string, string, string, string, string] {
  if (ids.length !== 5) throw new Error(`A ranking formation requires five Members, received ${ids.length}`);
  return ids as unknown as readonly [string, string, string, string, string];
}

function insertMember(
  context: NativeMemberBenchmarkContext,
  cardId: string,
): readonly [string, string, string, string, string] {
  const members = [...context.partnerCardIds];
  members.splice(context.insertionSlot, 0, cardId);
  return asTeam(members);
}

function evaluateUtility(
  chartKey: string,
  leaderOutfitCardId: string,
  memberCardIds: readonly string[],
  lens: NativeLens,
): NativeUtilityResult {
  return evaluateNativeRelativeUtility({
    formation: {
      leaderOutfitCardId,
      members: memberCardIds.map((cardId) => ({ cardId, investment: lens })),
    },
    chartKey,
    seed: DEFAULT_SEED,
    accountState: NEUTRAL_BOARD,
  });
}

function frozenComparisonCards(): PublicCard[] {
  const cards = frozenCohortCardIds.map((cardId) => {
    const card = publicCardById.get(cardId);
    if (!card) throw new Error(`Frozen ranking cohort card is missing: ${cardId}`);
    return card;
  });
  if (new Set(cards.map((card) => card.id)).size !== 113) {
    throw new Error("Native ranking v2 requires the complete frozen 113-card comparison cohort");
  }
  return cards;
}

function collectMatchedSamples(
  onProgress?: (message: string) => void,
  currentContextExtension?: NativeCurrentContextExtension,
): ReadonlyMap<NativeRankingEntityKind, readonly RawEntity[]> {
  const comparisonCards = frozenComparisonCards();
  const evaluatedCards = publicCards;
  const contexts = buildNativeRankingBenchmarkContexts(publicCards, currentContextExtension);
  const memberSamples = new Map(evaluatedCards.map((card) => [card.id, emptySamples()]));
  const leaderSamples = new Map(evaluatedCards.map((card) => [card.id, emptySamples()]));

  for (const lens of LENSES) {
    for (const [contextIndex, context] of contexts.memberContexts.entries()) {
      const partnerTalents = new Set(
        context.partnerCardIds.map((cardId) => publicCardById.get(cardId)!.talentId),
      );
      const eligibleCandidates = evaluatedCards.filter(
        (card) => !partnerTalents.has(card.talentId),
      );
      const eligibleAlternatives = comparisonCards.filter(
        (card) => !partnerTalents.has(card.talentId),
      );
      const utilityByCardId = new Map<string, UtilityInterval>();
      for (const card of eligibleCandidates) {
        utilityByCardId.set(
          card.id,
          evaluateUtility(
            context.chartKey,
            context.leaderOutfitCardId,
            insertMember(context, card.id),
            lens,
          ).relativeUtility,
        );
      }
      for (const card of eligibleCandidates) {
        memberSamples.get(card.id)![lens].push(
          prepareNativeMatchedComparison({
            contextId: context.id,
            chartKey: context.chartKey,
            segment: context.segment,
            formationSlot: context.insertionSlot,
            candidate: utilityByCardId.get(card.id)!,
            alternatives: eligibleAlternatives
              .filter((alternative) => alternative.id !== card.id)
              .map((alternative) => utilityByCardId.get(alternative.id)!),
          }),
        );
      }
      if ((contextIndex + 1) % 10 === 0) {
        onProgress?.(`${lens}: Member benchmark ${contextIndex + 1}/${contexts.memberContexts.length}.`);
      }
    }

    for (const [contextIndex, context] of contexts.leaderContexts.entries()) {
      const utilityByCardId = new Map(
        evaluatedCards.map((card) => [
          card.id,
          evaluateUtility(
            context.chartKey,
            card.id,
            context.memberCardIds,
            lens,
          ).relativeUtility,
        ]),
      );
      for (const card of evaluatedCards) {
        leaderSamples.get(card.id)![lens].push(
          prepareNativeMatchedComparison({
            contextId: context.id,
            chartKey: context.chartKey,
            segment: context.segment,
            formationSlot: contextIndex % 5,
            candidate: utilityByCardId.get(card.id)!,
            alternatives: comparisonCards
              .filter((alternative) => alternative.id !== card.id)
              .map((alternative) => utilityByCardId.get(alternative.id)!),
          }),
        );
      }
      if ((contextIndex + 1) % 10 === 0) {
        onProgress?.(`${lens}: Leader/Outfit benchmark ${contextIndex + 1}/${contexts.leaderContexts.length}.`);
      }
    }
  }

  const finalize = (
    entityKind: NativeRankingEntityKind,
    source: ReadonlyMap<string, Record<NativeLens, NativePreparedComparisonSample[]>>,
  ): RawEntity[] =>
    evaluatedCards.map((card) => {
      const samplesByLens = source.get(card.id)!;
      return {
        cardId: card.id,
        entityKind,
        samplesByLens,
        metricsByLens: completeNativeMatchedMetrics(samplesByLens),
      };
    });

  return new Map([
    ["member", finalize("member", memberSamples)],
    ["leader-outfit", finalize("leader-outfit", leaderSamples)],
  ]);
}

function validateFrozenBaselineSet(
  frozen: ReadonlyMap<NativeBaselineKey, SerializedFrozenNativeBaseline>,
): void {
  const expectedKeys = new Set(
    ENTITY_KINDS.flatMap((entityKind) =>
      LENSES.map((lens) => nativeBaselineKey(entityKind, lens)),
    ),
  );
  if (frozen.size !== 0 && frozen.size !== expectedKeys.size) {
    throw new Error(`Expected zero or six frozen baselines, found ${frozen.size}`);
  }
  const baselineIds = new Set<string>();
  for (const [key, baseline] of frozen) {
    if (!expectedKeys.has(key)) throw new Error(`Unexpected frozen baseline key: ${key}`);
    deserializeFrozenNativeBaseline(baseline);
    if (nativeBaselineKey(baseline.entityKind, baseline.lens) !== key) {
      throw new Error(`Frozen baseline key mismatch for ${key}`);
    }
    if (baseline.rosterCommit !== NATIVE_FROZEN_BASELINE_ROSTER_COMMIT) {
      throw new Error(`Frozen baseline roster commit mismatch for ${key}`);
    }
    if (baselineIds.has(baseline.id)) {
      throw new Error(`Duplicate frozen baseline ID: ${baseline.id}`);
    }
    baselineIds.add(baseline.id);
  }
}

function buildBaselines(
  rawByKind: ReadonlyMap<NativeRankingEntityKind, readonly RawEntity[]>,
  generatedAt: string,
  frozen: ReadonlyMap<NativeBaselineKey, SerializedFrozenNativeBaseline>,
): Readonly<{
  parsed: ReadonlyMap<NativeBaselineKey, FrozenNativeBaseline>;
  serialized: readonly SerializedFrozenNativeBaseline[];
}> {
  const parsed = new Map<NativeBaselineKey, FrozenNativeBaseline>();
  const serialized: SerializedFrozenNativeBaseline[] = [];
  for (const entityKind of ENTITY_KINDS) {
    const rows = rawByKind.get(entityKind)!;
    for (const lens of LENSES) {
      const key = nativeBaselineKey(entityKind, lens);
      const existing = frozen.get(key);
      if (existing && (existing.entityKind !== entityKind || existing.lens !== lens)) {
        throw new Error(`Frozen baseline key mismatch for ${key}`);
      }
      const baselineId = `launch-${publicData.retrievedAt}-${entityKind}-${lens}-yd2`;
      const baseline = existing
        ? deserializeFrozenNativeBaseline(existing)
        : buildFrozenNativeBaseline(
            baselineId,
            frozenCohortCardIds.map((cardId) => {
              const row = rows.find((candidate) => candidate.cardId === cardId);
              if (!row) throw new Error(`Frozen baseline row is missing: ${cardId}`);
              return { cardId, metrics: row.metricsByLens[lens] };
            }),
          );
      parsed.set(key, baseline);
      serialized.push(
        existing ?? serializeBaseline(baseline, entityKind, lens, generatedAt),
      );
    }
  }
  return { parsed, serialized };
}

function emptyBootstrapLens(): BootstrapLensDistribution {
  return { index: [], G: [], P: [], B: [], E: [], topDecileCount: 0 };
}

export function nativeTopDecileCardIdsWithTies(
  rows: readonly Readonly<{ cardId: string; index: number }>[],
): ReadonlySet<string> {
  if (rows.length === 0) throw new Error("Top-decile classification requires at least one row");
  if (
    new Set(rows.map((row) => row.cardId)).size !== rows.length ||
    rows.some((row) => !Number.isFinite(row.index))
  ) {
    throw new Error("Top-decile classification requires unique card IDs and finite indices");
  }
  const ordered = [...rows].sort(
    (left, right) => right.index - left.index || left.cardId.localeCompare(right.cardId),
  );
  const topCount = Math.ceil(ordered.length / 10);
  const cutoff = ordered[topCount - 1]!.index;
  return new Set(ordered.filter((row) => row.index >= cutoff).map((row) => row.cardId));
}

function bootstrapDistributions(
  rawByKind: ReadonlyMap<NativeRankingEntityKind, readonly RawEntity[]>,
  baselines: ReadonlyMap<NativeBaselineKey, FrozenNativeBaseline>,
  onProgress?: (message: string) => void,
  currentContextExtension?: NativeCurrentContextExtension,
): ReadonlyMap<NativeRankingEntityKind, ReadonlyMap<string, BootstrapEntity>> {
  const result = new Map<NativeRankingEntityKind, ReadonlyMap<string, BootstrapEntity>>();
  const contexts = buildNativeRankingBenchmarkContexts(publicCards, currentContextExtension);
  for (const entityKind of ENTITY_KINDS) {
    const rows = rawByKind.get(entityKind)!;
    const contextIds = (
      entityKind === "member" ? contexts.memberContexts : contexts.leaderContexts
    ).map((context) => context.id);
    const byCard = new Map<string, BootstrapEntity>(
      rows.map((row) => [
        row.cardId,
        {
          cardId: row.cardId,
          entityKind,
          byLens: {
            "low-investment": emptyBootstrapLens(),
            "one-copy-maximum": emptyBootstrapLens(),
            "duplicate-enabled-ceiling": emptyBootstrapLens(),
          },
        },
      ]),
    );
    for (let replicate = 0; replicate < BOOTSTRAP_REPLICATES; replicate += 1) {
      const seed = stableNativeSeed(`${entityKind}|paired-bootstrap-${replicate}`);
      for (const row of rows) {
        const indexes = nativePairedBootstrapSampleIndexes(
          contextIds,
          row.samplesByLens["one-copy-maximum"].map((sample) => sample.contextId),
          seed,
        );
        const metrics = completeNativeMatchedMetricsForIndexes(row.samplesByLens, indexes);
        for (const lens of LENSES) {
          const distribution = byCard.get(row.cardId)!.byLens[lens];
          distribution.G.push(metrics[lens].G);
          distribution.P.push(metrics[lens].P);
          distribution.B.push(metrics[lens].B);
          distribution.E.push(metrics[lens].E);
          const index = applyFrozenNativeBaseline(
            metrics[lens],
            baselines.get(nativeBaselineKey(entityKind, lens))!,
          ).index;
          distribution.index.push({
            lower: Number(index.lower) / INDEX_SCALE,
            central: Number(index.central) / INDEX_SCALE,
            upper: Number(index.upper) / INDEX_SCALE,
          });
        }
      }
      for (const lens of LENSES) {
        const topDecileIds = nativeTopDecileCardIdsWithTies(
          rows.map((row) => ({
            cardId: row.cardId,
            index: byCard.get(row.cardId)!.byLens[lens].index[replicate]!.central,
          })),
        );
        for (const cardId of topDecileIds) {
          byCard.get(cardId)!.byLens[lens].topDecileCount += 1;
        }
      }
      if ((replicate + 1) % 50 === 0 || replicate + 1 === BOOTSTRAP_REPLICATES) {
        onProgress?.(`${entityKind}: paired bootstrap ${replicate + 1}/${BOOTSTRAP_REPLICATES}.`);
      }
    }
    result.set(entityKind, byCard);
  }
  return result;
}

function quantileNumber(values: readonly number[], probability: number): number {
  if (values.length === 0) throw new Error("A quantile requires at least one value");
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor((ordered.length - 1) * probability)]!;
}

function quantileBigInt(values: readonly bigint[], probability: number): bigint {
  if (values.length === 0) throw new Error("A quantile requires at least one value");
  const ordered = [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return ordered[Math.floor((ordered.length - 1) * probability)]!;
}

function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  return Math.sqrt(
    values.reduce((total, value) => total + (value - average) ** 2, 0) /
      (values.length - 1),
  );
}

function permilFraction(count: number, total: number): number {
  return Math.round((count / total) * 1_000);
}

function serializeMetricDistribution(
  distribution: readonly IntegerInterval[],
  point: IntegerInterval,
  kind: "ratio" | "breadth",
): SerializableInterval {
  const lower = quantileBigInt(distribution.map((value) => value.lower), 0.05);
  const upper = quantileBigInt(distribution.map((value) => value.upper), 0.95);
  const divisor = kind === "breadth" ? BREADTH_PERCENT_DIVISOR : METRIC_PERCENT_DIVISOR;
  return {
    lower: Number(lower < point.lower ? lower : point.lower) / divisor,
    central: Number(point.central) / divisor,
    upper: Number(upper > point.upper ? upper : point.upper) / divisor,
  };
}

function indexInterval(
  distribution: readonly SerializableInterval[],
  point: IntegerInterval,
): SerializableInterval {
  const pointLower = Number(point.lower) / INDEX_SCALE;
  const pointCentral = Number(point.central) / INDEX_SCALE;
  const pointUpper = Number(point.upper) / INDEX_SCALE;
  return {
    lower: Math.min(
      pointLower,
      quantileNumber(distribution.map((value) => value.lower), 0.05),
    ),
    central: pointCentral,
    upper: Math.max(
      pointUpper,
      quantileNumber(distribution.map((value) => value.upper), 0.95),
    ),
  };
}

function contextDispersion(samples: readonly NativePreparedComparisonSample[]): number {
  const percentages = samples.map((sample) => Number(sample.marginal.central) / METRIC_PERCENT_DIVISOR);
  return Math.round(standardDeviation(percentages) * 1_000) / 1_000;
}

function samplingSummary(
  entityKind: NativeRankingEntityKind,
  samples: readonly NativePreparedComparisonSample[],
) {
  const referenceContexts = samples.filter((sample) => sample.segment === "reference").length;
  const currentContexts = samples.length - referenceContexts;
  const alternativeCounts = samples.map((sample) => sample.alternativeCount);
  const slotCounts = [0, 0, 0, 0, 0] as [number, number, number, number, number];
  for (const sample of samples) {
    if (
      !Number.isInteger(sample.formationSlot) ||
      sample.formationSlot < 0 ||
      sample.formationSlot > 4
    ) {
      throw new Error(`Invalid matched formation slot: ${sample.formationSlot}`);
    }
    const slot = sample.formationSlot as 0 | 1 | 2 | 3 | 4;
    slotCounts[slot] += 1;
  }
  return {
    method: "frozen-matched-substitution" as const,
    status: "complete" as const,
    matchedContexts: samples.length,
    referenceContexts,
    currentContexts,
    frozenComparisonCohortSize: 113 as const,
    minimumAlternativesPerContext: Math.min(...alternativeCounts),
    maximumAlternativesPerContext: Math.max(...alternativeCounts),
    formationSlotCounts: entityKind === "member" ? slotCounts : null,
  };
}

function provisionalReasons(
  stableTier: NativeTier,
  index: SerializableInterval,
  samplingError: number,
): string[] {
  const reasons = [
    "The complete runtime score equation remains unvalidated.",
    "Rainbow-marker timestamps are unavailable; Specials use duration coverage.",
    "Capped recipient selection uses the guaranteed-value decision scenario.",
  ];
  if (stableTier === "Provisional") {
    if (index.upper - index.lower > 10) {
      reasons.push("The 90% matched-context index interval is wider than ten points.");
    }
    if (samplingError > 0.5) {
      reasons.push("Bootstrap sampling error exceeds 0.5 index points.");
    }
  }
  return reasons;
}

function createEntries(
  entityKind: NativeRankingEntityKind,
  rawRows: readonly RawEntity[],
  baselines: ReadonlyMap<NativeBaselineKey, FrozenNativeBaseline>,
  bootstrapByCard: ReadonlyMap<string, BootstrapEntity>,
  lens: NativeLens,
): InternalEntry[] {
  return rawRows.map((row) => {
    const pointMetrics = row.metricsByLens[lens];
    const pointIndexInterval = applyFrozenNativeBaseline(
      pointMetrics,
      baselines.get(nativeBaselineKey(entityKind, lens))!,
    ).index;
    const pointIndex = Number(pointIndexInterval.central) / INDEX_SCALE;
    const distribution = bootstrapByCard.get(row.cardId)!.byLens[lens];
    const index = indexInterval(distribution.index, pointIndexInterval);
    const samplingError =
      Math.round(
        standardDeviation(distribution.index.map((value) => value.central)) * 1_000,
      ) / 1_000;
    const probabilityAbove120Permil = permilFraction(
      distribution.index.filter((value) => value.lower >= 120).length,
      BOOTSTRAP_REPLICATES,
    );
    const probabilityTopDecilePermil = permilFraction(
      distribution.topDecileCount,
      BOOTSTRAP_REPLICATES,
    );
    const probabilityBelow80Permil = permilFraction(
      distribution.index.filter((value) => value.upper < 80).length,
      BOOTSTRAP_REPLICATES,
    );
    const samples = row.samplesByLens[lens];
    const definitelyNegativeMarginalPermil = permilFraction(
      samples.filter((sample) => sample.marginal.upper < 0n).length,
      samples.length,
    );
    const rawBand = modelBandForIndex(pointIndex);
    const boundaryConfidencePermil = permilFraction(
      distribution.index.filter(
        (value) =>
          modelBandForIndex(value.lower) === rawBand &&
          modelBandForIndex(value.upper) === rawBand,
      ).length,
      BOOTSTRAP_REPLICATES,
    );
    const stableTier = classifyNativeTier({
      interval: integerInterval(
        BigInt(Math.round(index.lower * INDEX_SCALE)),
        BigInt(Math.round(index.central * INDEX_SCALE)),
        BigInt(Math.round(index.upper * INDEX_SCALE)),
      ),
      samplingErrorMicro: BigInt(Math.round(samplingError * INDEX_SCALE)),
      sourceComplete: mechanicsData.coverage.unresolvedReferences.length === 0,
      metricCoverageComplete: samples.length >= 250,
      evaluationComplete: true,
      probabilityAbove120Permil,
      probabilityTopDecilePermil,
      probabilityBelow80Permil,
      definitelyNegativeMarginalPermil,
      boundaryConfidencePermil,
    });
    const metrics = {
      G: serializeMetricDistribution(distribution.G, pointMetrics.G, "ratio"),
      P: serializeMetricDistribution(distribution.P, pointMetrics.P, "ratio"),
      B: serializeMetricDistribution(distribution.B, pointMetrics.B, "breadth"),
      E: serializeMetricDistribution(distribution.E, pointMetrics.E, "ratio"),
    };
    const bootstrap = {
      replicates: BOOTSTRAP_REPLICATES,
      confidenceLevelPermil: 900 as const,
      probabilityAbove120Permil,
      probabilityTopDecilePermil,
      probabilityBelow80Permil,
      definitelyNegativeMarginalPermil,
    };
    const modelBand = gatedModelBandForIndex(pointIndex, bootstrap);
    return {
      cardId: row.cardId,
      pointIndex,
      entry: {
        cardId: row.cardId,
        modelBand,
        tier: entityKind === "member" ? memberTierForIndex(lens, pointIndex) : modelBand,
        stableTier,
        publicationState: "theorycraft-beta" as const,
        index,
        metrics,
        boundaryConfidencePermil,
        samplingError,
        contextDispersion: contextDispersion(samples),
        bootstrap,
        evaluation: samplingSummary(entityKind, samples),
        provisionalReasons: provisionalReasons(stableTier, index, samplingError),
      },
    };
  });
}

function lensLabel(lens: NativeLens): string {
  if (lens === "one-copy-maximum") return "Standard Manual";
  if (lens === "low-investment") return "Low Investment";
  return "Max Ceiling";
}

export function generateNativeRankingSnapshot(
  generatedAt: string,
  onProgress?: (message: string) => void,
  frozenBaselines: ReadonlyMap<NativeBaselineKey, SerializedFrozenNativeBaseline> = new Map(),
  currentContextExtension?: NativeCurrentContextExtension,
): NativeRankingGeneration {
  const parsedGeneratedAt = new Date(generatedAt);
  if (Number.isNaN(parsedGeneratedAt.valueOf())) throw new Error("generatedAt must be an ISO timestamp");
  const generatedAtIso = parsedGeneratedAt.toISOString();
  const extension = currentContextExtension
    ? {
        ...NativeCurrentContextExtensionSchema.parse(currentContextExtension),
        appendedCardIds: [...currentContextExtension.appendedCardIds].sort(),
      }
    : undefined;
  validateFrozenBaselineSet(frozenBaselines);
  if (extension && frozenBaselines.size !== 6) {
    throw new Error("A current-context extension requires all six frozen launch baselines");
  }
  const rawByKind = collectMatchedSamples(onProgress, extension);
  const baselineState = buildBaselines(rawByKind, generatedAtIso, frozenBaselines);
  const bootstraps = bootstrapDistributions(
    rawByKind,
    baselineState.parsed,
    onProgress,
    extension,
  );

  const buildLenses = (entityKind: NativeRankingEntityKind) =>
    LENSES.map((lens) => {
      const sortedEntries = createEntries(
        entityKind,
        rawByKind.get(entityKind)!,
        baselineState.parsed,
        bootstraps.get(entityKind)!,
        lens,
      ).sort(
        (left, right) =>
          right.pointIndex - left.pointIndex || left.cardId.localeCompare(right.cardId),
      );
      const competitionRanks = nativeCompetitionRanks(
        sortedEntries.map((row) => row.pointIndex),
      );
      const entries = sortedEntries.map((row, index) => ({
        ...row.entry,
        rank: competitionRanks[index]!,
      }));
      return {
        id: `${entityKind}-manual-ap-${lens}`,
        label: lensLabel(lens),
        entityKind,
        investment: lens,
        frozenBaselineId: baselineState.parsed.get(nativeBaselineKey(entityKind, lens))!.id,
        entries,
      };
    });

  const chartByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));
  const songById = new Map(songContextData.songs.map((song) => [song.id, song]));
  const corpus = [
    ...nativeRankingBenchmark.corpus.reference.map((entry) => ({ segment: "reference" as const, ...entry })),
    ...nativeRankingBenchmark.corpus.current.map((entry) => ({ segment: "current" as const, ...entry })),
  ].map((entry) => {
    const chart = chartByKey.get(entry.chartKey)!;
    const song = songById.get(chart.songId)!;
    return {
      chartKey: chart.key,
      songId: song.id,
      songTitle: song.title,
      durationMilliseconds: song.playingMilliseconds,
      noteCount: chart.fullComboNoteCount,
      chartHash: chart.chartHash,
      segment: entry.segment,
    };
  });

  const snapshot = NativeRankingSnapshotSchema.parse({
    schemaVersion: 2,
    snapshotId: `${publicData.retrievedAt}-yd-native-2${extension ? `-${extension.version}` : ""}`,
    generatedAt: generatedAtIso,
    dataRetrievedAt: publicData.retrievedAt,
    rosterCommit: mechanicsData.sourceSnapshot.commit,
    mechanicsVersion: mechanicsData.methodologyVersion,
    methodologyVersion: "yd-native-ranking-2.0.0",
    evaluatorVersion: "yd-native-utility-1.0.0",
    benchmarkId: nativeRankingBenchmark.benchmarkId,
    currentContextExtension: extension ?? null,
    tierCalibrationId: nativeMemberTierCalibration.id,
    theorycraftBeta: true,
    absoluteScoreAvailable: false,
    context: {
      platform: "mobile",
      playMode: "manual",
      judgement: "perfect",
      life: 1_000,
      board: "declared-neutral",
      timingModel: AGGREGATE_UNIFORM_NOTE_TIMING_MODEL_ID,
      specialTimingModel: AGGREGATE_SPECIAL_COVERAGE_MODEL_ID,
    },
    corpus,
    lenses: buildLenses("member"),
    leaderOutfitLenses: buildLenses("leader-outfit"),
  });

  return { snapshot, baselines: baselineState.serialized };
}
