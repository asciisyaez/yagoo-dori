import { createHash } from "node:crypto";

import benchmarkJson from "../../../data/native/ranking-benchmark-v1.json";
import { z } from "zod";

import { publicCards, type PublicCard } from "./public-data";
import { songContextData } from "./song-contexts";

const COHORT_SIZE = 113;
const REFERENCE_CHARTS = 21;
const CURRENT_CHARTS = 9;
const CONTEXTS_PER_CHART = 10;

const SourcePinSchema = z
  .object({
    repository: z.url(),
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    masterVersion: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const FrozenChartSchema = z
  .object({
    chartKey: z.string().regex(/^m\d{4}:expert$/),
    expectedChartHash: z.string().regex(/^[a-f0-9]{32}$/),
  })
  .strict();

function sha256Lines(lines: readonly string[]): string {
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = left;
  let b = right;
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

export const NativeRankingBenchmarkConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    benchmarkId: z.string().min(1),
    methodologyVersion: z.literal("yd-native-ranking-benchmark-1.0.0"),
    retrievedAt: z.iso.date(),
    sources: z
      .object({
        roster: SourcePinSchema,
        charts: SourcePinSchema,
      })
      .strict(),
    cohort: z
      .object({
        expectedCardCount: z.literal(COHORT_SIZE),
        orderedCardIdsSha256: z.string().regex(/^[a-f0-9]{64}$/),
        orderedCardIds: z.array(z.string().min(1)).length(COHORT_SIZE),
      })
      .strict(),
    corpus: z
      .object({
        difficulty: z.literal("expert"),
        contextsPerChart: z.literal(CONTEXTS_PER_CHART),
        referenceSharePermil: z.literal(700),
        currentSharePermil: z.literal(300),
        currentCutoffEpochMilliseconds: z.number().int().positive(),
        selection: z
          .object({
            reference: z.string().min(1),
            current: z.string().min(1),
          })
          .strict(),
        entriesSha256: z.string().regex(/^[a-f0-9]{64}$/),
        reference: z.array(FrozenChartSchema).length(REFERENCE_CHARTS),
        current: z.array(FrozenChartSchema).length(CURRENT_CHARTS),
      })
      .strict(),
    schedule: z
      .object({
        algorithm: z.literal("cyclic-coprime-v1"),
        cohortStep: z.number().int().min(1).max(COHORT_SIZE - 1),
        memberPartnerOffset: z.number().int().min(0).max(COHORT_SIZE - 1),
        memberLeaderStep: z.number().int().min(1).max(COHORT_SIZE - 1),
        memberLeaderOffset: z.number().int().min(0).max(COHORT_SIZE - 1),
        leaderMemberOffset: z.number().int().min(0).max(COHORT_SIZE - 1),
      })
      .strict(),
  })
  .strict()
  .superRefine((config, context) => {
    const ids = config.cohort.orderedCardIds;
    if (new Set(ids).size !== COHORT_SIZE) {
      context.addIssue({
        code: "custom",
        path: ["cohort", "orderedCardIds"],
        message: "Frozen cohort card IDs must be unique",
      });
    }
    if (ids.some((id, index) => index > 0 && id <= ids[index - 1]!)) {
      context.addIssue({
        code: "custom",
        path: ["cohort", "orderedCardIds"],
        message: "Frozen cohort card IDs must remain in lexical order",
      });
    }
    if (sha256Lines(ids) !== config.cohort.orderedCardIdsSha256) {
      context.addIssue({
        code: "custom",
        path: ["cohort", "orderedCardIdsSha256"],
        message: "Frozen cohort fingerprint drift",
      });
    }

    const segmentedEntries = [
      ...config.corpus.reference.map((entry) => ({ segment: "reference", ...entry })),
      ...config.corpus.current.map((entry) => ({ segment: "current", ...entry })),
    ] as const;
    if (new Set(segmentedEntries.map((entry) => entry.chartKey)).size !== segmentedEntries.length) {
      context.addIssue({
        code: "custom",
        path: ["corpus"],
        message: "Frozen benchmark charts must be unique across both segments",
      });
    }
    if (
      sha256Lines(
        segmentedEntries.map(
          (entry) => `${entry.segment}|${entry.chartKey}|${entry.expectedChartHash}`,
        ),
      ) !== config.corpus.entriesSha256
    ) {
      context.addIssue({
        code: "custom",
        path: ["corpus", "entriesSha256"],
        message: "Frozen chart corpus fingerprint drift",
      });
    }

    const totalCharts = config.corpus.reference.length + config.corpus.current.length;
    if (
      config.corpus.reference.length * 1_000 !==
        totalCharts * config.corpus.referenceSharePermil ||
      config.corpus.current.length * 1_000 !==
        totalCharts * config.corpus.currentSharePermil
    ) {
      context.addIssue({
        code: "custom",
        path: ["corpus"],
        message: "Frozen chart corpus must retain the exact 70:30 mix",
      });
    }
    if (
      greatestCommonDivisor(config.schedule.cohortStep, COHORT_SIZE) !== 1 ||
      greatestCommonDivisor(config.schedule.memberLeaderStep, COHORT_SIZE) !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["schedule"],
        message: "Schedule steps must be coprime with the frozen cohort size",
      });
    }
  });

export type NativeRankingBenchmarkConfig = z.infer<
  typeof NativeRankingBenchmarkConfigSchema
>;

function validatePinnedInputs(config: NativeRankingBenchmarkConfig): void {
  const availableCardIds = new Set(publicCards.map((card) => card.id));
  for (const cardId of config.cohort.orderedCardIds) {
    if (!availableCardIds.has(cardId)) {
      throw new Error(`Frozen benchmark cohort card is missing: ${cardId}`);
    }
  }

  const songById = new Map(songContextData.songs.map((song) => [song.id, song]));
  const chartByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));
  const allEntries = [...config.corpus.reference, ...config.corpus.current];
  for (const entry of allEntries) {
    const chart = chartByKey.get(entry.chartKey);
    if (!chart) throw new Error(`Frozen benchmark chart is missing: ${entry.chartKey}`);
    if (chart.difficulty !== config.corpus.difficulty) {
      throw new Error(`Frozen benchmark chart is not Expert: ${entry.chartKey}`);
    }
    if (chart.chartHash !== entry.expectedChartHash) {
      throw new Error(`Frozen benchmark chart hash drift: ${entry.chartKey}`);
    }
    const song = songById.get(chart.songId);
    if (!song || song.startTimeEpochMilliseconds > config.corpus.currentCutoffEpochMilliseconds) {
      throw new Error(`Frozen benchmark chart was unavailable at the cutoff: ${entry.chartKey}`);
    }
  }

  const expectedCurrent = songContextData.charts
    .filter((chart) => {
      const song = songById.get(chart.songId);
      return (
        chart.difficulty === config.corpus.difficulty &&
        song !== undefined &&
        song.startTimeEpochMilliseconds <= config.corpus.currentCutoffEpochMilliseconds
      );
    })
    .sort((left, right) => {
      const leftRelease = songById.get(left.songId)!.startTimeEpochMilliseconds;
      const rightRelease = songById.get(right.songId)!.startTimeEpochMilliseconds;
      return rightRelease - leftRelease || right.key.localeCompare(left.key);
    })
    .slice(0, CURRENT_CHARTS)
    .map((chart) => chart.key);
  const frozenCurrent = config.corpus.current.map((entry) => entry.chartKey);
  if (expectedCurrent.join("\0") !== frozenCurrent.join("\0")) {
    throw new Error("Frozen current-chart segment is not the newest nine at its cutoff");
  }
}

export function loadNativeRankingBenchmarkConfig(
  input: unknown,
): NativeRankingBenchmarkConfig {
  const config = NativeRankingBenchmarkConfigSchema.parse(input);
  validatePinnedInputs(config);
  return config;
}

export const nativeRankingBenchmark = loadNativeRankingBenchmarkConfig(benchmarkJson);

export const frozenCohortCardIds: readonly string[] = Object.freeze([
  ...nativeRankingBenchmark.cohort.orderedCardIds,
]);

export const NativeBenchmarkSegmentSchema = z.enum(["reference", "current"]);
export type NativeBenchmarkSegment = z.infer<typeof NativeBenchmarkSegmentSchema>;

const InsertionSlotSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const NativeMemberBenchmarkContextSchema = z
  .object({
    id: z.string().min(1),
    segment: NativeBenchmarkSegmentSchema,
    chartKey: z.string().regex(/^m\d{4}:expert$/),
    weight: z.literal(1),
    leaderOutfitCardId: z.string().min(1),
    partnerCardIds: z.tuple([
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
    ]),
    insertionSlot: InsertionSlotSchema,
  })
  .strict();

export const NativeLeaderBenchmarkContextSchema = z
  .object({
    id: z.string().min(1),
    segment: NativeBenchmarkSegmentSchema,
    chartKey: z.string().regex(/^m\d{4}:expert$/),
    weight: z.literal(1),
    memberCardIds: z.tuple([
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
    ]),
  })
  .strict();

export type NativeMemberBenchmarkContext = z.infer<
  typeof NativeMemberBenchmarkContextSchema
>;
export type NativeLeaderBenchmarkContext = z.infer<
  typeof NativeLeaderBenchmarkContextSchema
>;

export type NativeRankingBenchmarkContexts = Readonly<{
  memberContexts: readonly NativeMemberBenchmarkContext[];
  leaderContexts: readonly NativeLeaderBenchmarkContext[];
}>;

export type BenchmarkRosterCard = Pick<PublicCard, "id" | "talentId">;

export const NativeCurrentContextExtensionSchema = z
  .object({
    version: z.string().regex(/^[a-z0-9][a-z0-9.-]*$/),
    appendedCardIds: z.array(z.string().min(1)).min(1).max(30),
  })
  .strict()
  .refine(
    ({ appendedCardIds }) => new Set(appendedCardIds).size === appendedCardIds.length,
    "Current-context extension card IDs must be unique",
  );

export type NativeCurrentContextExtension = z.infer<
  typeof NativeCurrentContextExtensionSchema
>;

function asPartnerTuple(
  cardIds: readonly string[],
): [string, string, string, string] {
  if (cardIds.length !== 4) throw new Error("Member benchmark context requires four partners");
  return [cardIds[0]!, cardIds[1]!, cardIds[2]!, cardIds[3]!];
}

function asMemberTuple(
  cardIds: readonly string[],
): [string, string, string, string, string] {
  if (cardIds.length !== 5) throw new Error("Leader benchmark context requires five Members");
  return [cardIds[0]!, cardIds[1]!, cardIds[2]!, cardIds[3]!, cardIds[4]!];
}

function frozenCardAt(position: number): string {
  const normalized = ((position % COHORT_SIZE) + COHORT_SIZE) % COHORT_SIZE;
  return frozenCohortCardIds[normalized]!;
}

function assertUniqueTalentCards(
  label: string,
  cardIds: readonly string[],
  talentByCardId: ReadonlyMap<string, string>,
): void {
  if (new Set(cardIds).size !== cardIds.length) {
    throw new Error(`${label} repeats a Member card`);
  }
  const talents = cardIds.map((cardId) => {
    const talentId = talentByCardId.get(cardId);
    if (!talentId) throw new Error(`Frozen benchmark cohort card is missing: ${cardId}`);
    return talentId;
  });
  if (new Set(talents).size !== talents.length) {
    throw new Error(`${label} repeats a Member talent`);
  }
}

type ExposureStats = Readonly<{ minimum: number; maximum: number; covered: number }>;

function exposureStats(
  cardIds: readonly string[],
  expectedIds: ReadonlySet<string>,
): ExposureStats {
  const counts = new Map(frozenCohortCardIds.map((cardId) => [cardId, 0]));
  for (const cardId of cardIds) {
    if (!expectedIds.has(cardId)) throw new Error(`Context uses a non-cohort card: ${cardId}`);
    counts.set(cardId, counts.get(cardId)! + 1);
  }
  const values = [...counts.values()];
  return {
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    covered: values.filter((value) => value > 0).length,
  };
}

function assertExposureBalanced(label: string, stats: ExposureStats): void {
  if (stats.maximum - stats.minimum > 1) {
    throw new Error(
      `${label} exposure is imbalanced (${stats.minimum}..${stats.maximum})`,
    );
  }
}

function contextsForSegment<T extends { segment: NativeBenchmarkSegment }>(
  contexts: readonly T[],
  segment: NativeBenchmarkSegment,
): T[] {
  return contexts.filter((context) => context.segment === segment);
}

function validateAndDescribeContexts(
  contexts: NativeRankingBenchmarkContexts,
  talentByCardId: ReadonlyMap<string, string>,
) {
  const expectedIds = new Set(frozenCohortCardIds);
  const totalCharts = REFERENCE_CHARTS + CURRENT_CHARTS;
  const expectedContextCount = totalCharts * CONTEXTS_PER_CHART;
  if (
    contexts.memberContexts.length !== expectedContextCount ||
    contexts.leaderContexts.length !== expectedContextCount
  ) {
    throw new Error("Native ranking benchmark must contain 300 contexts of each type");
  }

  const memberIds = new Set<string>();
  const leaderIds = new Set<string>();
  for (const context of contexts.memberContexts) {
    NativeMemberBenchmarkContextSchema.parse(context);
    if (memberIds.has(context.id)) throw new Error(`Duplicate member context ID: ${context.id}`);
    memberIds.add(context.id);
    assertUniqueTalentCards(`Member context ${context.id}`, context.partnerCardIds, talentByCardId);
    if (!expectedIds.has(context.leaderOutfitCardId)) {
      throw new Error(`Context uses a non-cohort Leader/Outfit: ${context.leaderOutfitCardId}`);
    }
  }
  for (const context of contexts.leaderContexts) {
    NativeLeaderBenchmarkContextSchema.parse(context);
    if (leaderIds.has(context.id)) throw new Error(`Duplicate leader context ID: ${context.id}`);
    leaderIds.add(context.id);
    assertUniqueTalentCards(`Leader context ${context.id}`, context.memberCardIds, talentByCardId);
  }

  const chartKeys = [
    ...nativeRankingBenchmark.corpus.reference.map((entry) => entry.chartKey),
    ...nativeRankingBenchmark.corpus.current.map((entry) => entry.chartKey),
  ];
  for (const chartKey of chartKeys) {
    const memberCount = contexts.memberContexts.filter(
      (context) => context.chartKey === chartKey,
    ).length;
    const leaderCount = contexts.leaderContexts.filter(
      (context) => context.chartKey === chartKey,
    ).length;
    if (memberCount !== CONTEXTS_PER_CHART || leaderCount !== CONTEXTS_PER_CHART) {
      throw new Error(`${chartKey} does not have ten contexts of each type`);
    }
  }

  const referenceMember = contextsForSegment(contexts.memberContexts, "reference");
  const currentMember = contextsForSegment(contexts.memberContexts, "current");
  const referenceLeader = contextsForSegment(contexts.leaderContexts, "reference");
  const currentLeader = contextsForSegment(contexts.leaderContexts, "current");
  for (const [label, reference, current] of [
    ["member", referenceMember.length, currentMember.length],
    ["leader", referenceLeader.length, currentLeader.length],
  ] as const) {
    if (
      reference * 1_000 !== expectedContextCount * 700 ||
      current * 1_000 !== expectedContextCount * 300
    ) {
      throw new Error(`${label} benchmark contexts do not retain the exact 70:30 mix`);
    }
  }

  const insertionSlotCounts = [0, 0, 0, 0, 0] as [number, number, number, number, number];
  for (const context of contexts.memberContexts) insertionSlotCounts[context.insertionSlot] += 1;
  if (insertionSlotCounts.some((count) => count !== expectedContextCount / 5)) {
    throw new Error("Member insertion slots are imbalanced");
  }

  const memberPartnerExposure = exposureStats(
    contexts.memberContexts.flatMap((context) => context.partnerCardIds),
    expectedIds,
  );
  const memberLeaderExposure = exposureStats(
    contexts.memberContexts.map((context) => context.leaderOutfitCardId),
    expectedIds,
  );
  const leaderMemberExposure = exposureStats(
    contexts.leaderContexts.flatMap((context) => context.memberCardIds),
    expectedIds,
  );
  assertExposureBalanced("Member partner", memberPartnerExposure);
  assertExposureBalanced("Member-context Leader/Outfit", memberLeaderExposure);
  assertExposureBalanced("Leader-context Member", leaderMemberExposure);
  if (
    memberPartnerExposure.covered !== COHORT_SIZE ||
    memberLeaderExposure.covered !== COHORT_SIZE ||
    leaderMemberExposure.covered !== COHORT_SIZE
  ) {
    throw new Error("Every frozen cohort card must receive benchmark exposure");
  }

  const memberPartnerSlotExposure = [0, 1, 2, 3].map((slot) =>
    exposureStats(
      contexts.memberContexts.map((context) => context.partnerCardIds[slot]!),
      expectedIds,
    ),
  );
  const leaderMemberSlotExposure = [0, 1, 2, 3, 4].map((slot) =>
    exposureStats(
      contexts.leaderContexts.map((context) => context.memberCardIds[slot]!),
      expectedIds,
    ),
  );
  memberPartnerSlotExposure.forEach((stats, slot) =>
    assertExposureBalanced(`Member partner slot ${slot}`, stats),
  );
  leaderMemberSlotExposure.forEach((stats, slot) =>
    assertExposureBalanced(`Leader Member slot ${slot}`, stats),
  );

  for (const segment of NativeBenchmarkSegmentSchema.options) {
    const memberSegment = contextsForSegment(contexts.memberContexts, segment);
    const leaderSegment = contextsForSegment(contexts.leaderContexts, segment);
    assertExposureBalanced(
      `${segment} Member partner`,
      exposureStats(memberSegment.flatMap((context) => context.partnerCardIds), expectedIds),
    );
    assertExposureBalanced(
      `${segment} Member-context Leader/Outfit`,
      exposureStats(memberSegment.map((context) => context.leaderOutfitCardId), expectedIds),
    );
    assertExposureBalanced(
      `${segment} Leader-context Member`,
      exposureStats(leaderSegment.flatMap((context) => context.memberCardIds), expectedIds),
    );
    for (const slot of [0, 1, 2, 3] as const) {
      assertExposureBalanced(
        `${segment} Member partner slot ${slot}`,
        exposureStats(memberSegment.map((context) => context.partnerCardIds[slot]), expectedIds),
      );
    }
    for (const slot of [0, 1, 2, 3, 4] as const) {
      assertExposureBalanced(
        `${segment} Leader Member slot ${slot}`,
        exposureStats(leaderSegment.map((context) => context.memberCardIds[slot]), expectedIds),
      );
    }
  }

  return Object.freeze({
    cohortCards: COHORT_SIZE,
    charts: Object.freeze({
      total: totalCharts,
      reference: REFERENCE_CHARTS,
      current: CURRENT_CHARTS,
    }),
    contextsPerChart: CONTEXTS_PER_CHART,
    memberContexts: contexts.memberContexts.length,
    leaderContexts: contexts.leaderContexts.length,
    segmentContexts: Object.freeze({
      reference: referenceMember.length,
      current: currentMember.length,
    }),
    insertionSlotCounts: Object.freeze(insertionSlotCounts),
    exposure: Object.freeze({
      memberPartners: Object.freeze(memberPartnerExposure),
      memberContextLeaders: Object.freeze(memberLeaderExposure),
      leaderContextMembers: Object.freeze(leaderMemberExposure),
      memberPartnerSlots: Object.freeze(memberPartnerSlotExposure.map(Object.freeze)),
      leaderMemberSlots: Object.freeze(leaderMemberSlotExposure.map(Object.freeze)),
    }),
  });
}

export function buildNativeRankingBenchmarkContexts(
  availableCards: readonly BenchmarkRosterCard[] = publicCards,
  currentExtension?: NativeCurrentContextExtension,
): NativeRankingBenchmarkContexts {
  const availableById = new Map(availableCards.map((card) => [card.id, card]));
  const talentByCardId = new Map<string, string>();
  for (const cardId of frozenCohortCardIds) {
    const card = availableById.get(cardId);
    if (!card) throw new Error(`Frozen benchmark cohort card is missing: ${cardId}`);
    talentByCardId.set(cardId, card.talentId);
  }

  const chartEntries = [
    ...nativeRankingBenchmark.corpus.reference.map((entry) => ({
      segment: "reference" as const,
      ...entry,
    })),
    ...nativeRankingBenchmark.corpus.current.map((entry) => ({
      segment: "current" as const,
      ...entry,
    })),
  ];
  const memberContexts: NativeMemberBenchmarkContext[] = [];
  const leaderContexts: NativeLeaderBenchmarkContext[] = [];
  let contextIndex = 0;

  for (const entry of chartEntries) {
    for (let chartContextIndex = 0; chartContextIndex < CONTEXTS_PER_CHART; chartContextIndex += 1) {
      const partnerCardIds = asPartnerTuple(
        Array.from({ length: 4 }, (_, partnerIndex) =>
          frozenCardAt(
            nativeRankingBenchmark.schedule.memberPartnerOffset +
              (contextIndex * 4 + partnerIndex) * nativeRankingBenchmark.schedule.cohortStep,
          ),
        ),
      );
      const memberCardIds = asMemberTuple(
        Array.from({ length: 5 }, (_, memberIndex) =>
          frozenCardAt(
            nativeRankingBenchmark.schedule.leaderMemberOffset +
              (contextIndex * 5 + memberIndex) * nativeRankingBenchmark.schedule.cohortStep,
          ),
        ),
      );
      const suffix = String(chartContextIndex + 1).padStart(2, "0");
      memberContexts.push({
        id: `${nativeRankingBenchmark.benchmarkId}:member:${entry.segment}:${entry.chartKey}:${suffix}`,
        segment: entry.segment,
        chartKey: entry.chartKey,
        weight: 1,
        leaderOutfitCardId: frozenCardAt(
          nativeRankingBenchmark.schedule.memberLeaderOffset +
            contextIndex * nativeRankingBenchmark.schedule.memberLeaderStep,
        ),
        partnerCardIds,
        insertionSlot: (contextIndex % 5) as 0 | 1 | 2 | 3 | 4,
      });
      leaderContexts.push({
        id: `${nativeRankingBenchmark.benchmarkId}:leader:${entry.segment}:${entry.chartKey}:${suffix}`,
        segment: entry.segment,
        chartKey: entry.chartKey,
        weight: 1,
        memberCardIds,
      });
      contextIndex += 1;
    }
  }

  const contexts: NativeRankingBenchmarkContexts = {
    memberContexts: Object.freeze(memberContexts.map((context) => Object.freeze(context))),
    leaderContexts: Object.freeze(leaderContexts.map((context) => Object.freeze(context))),
  };
  validateAndDescribeContexts(contexts, talentByCardId);
  return currentExtension
    ? extendNativeRankingCurrentContexts(contexts, availableCards, currentExtension)
    : Object.freeze(contexts);
}

/**
 * Versioned hook for a future roster snapshot. Reference contexts and frozen
 * baseline inputs stay byte-for-byte unchanged; appended cards receive three
 * balanced partner-core placements plus one Leader/Outfit placement only in
 * the 30% current segment. The generator must opt into a reviewed extension.
 */
export function extendNativeRankingCurrentContexts(
  base: NativeRankingBenchmarkContexts,
  availableCards: readonly BenchmarkRosterCard[],
  input: NativeCurrentContextExtension,
): NativeRankingBenchmarkContexts {
  const extension = NativeCurrentContextExtensionSchema.parse(input);
  const availableById = new Map(availableCards.map((card) => [card.id, card]));
  const frozenIds = new Set(frozenCohortCardIds);
  const appended = [...extension.appendedCardIds]
    .sort()
    .map((cardId) => {
      const card = availableById.get(cardId);
      if (!card) throw new Error(`Current-context extension card is missing: ${cardId}`);
      if (frozenIds.has(cardId)) {
        throw new Error(`Current-context extension card is already frozen: ${cardId}`);
      }
      return card;
    });
  const talentByCardId = new Map(availableCards.map((card) => [card.id, card.talentId]));
  const suffix = `:current-extension:${extension.version}`;
  const memberContexts = base.memberContexts.map((context) =>
    context.segment === "current" ? { ...context, id: `${context.id}${suffix}` } : context,
  );
  const leaderContexts = base.leaderContexts.map((context) =>
    context.segment === "current" ? { ...context, id: `${context.id}${suffix}` } : context,
  );
  const currentMemberIndexes = memberContexts.flatMap((context, index) =>
    context.segment === "current" ? [index] : [],
  );
  const currentLeaderIndexes = leaderContexts.flatMap((context, index) =>
    context.segment === "current" ? [index] : [],
  );
  const usedMemberContexts = new Set<number>();
  const usedLeaderContexts = new Set<number>();

  const placeCard = (
    card: BenchmarkRosterCard,
    cardIndex: number,
    placement: number,
    kind: "member" | "leader",
  ): void => {
    const indexes = kind === "member" ? currentMemberIndexes : currentLeaderIndexes;
    const used = kind === "member" ? usedMemberContexts : usedLeaderContexts;
    const slotCount = kind === "member" ? 4 : 5;
    const start = (cardIndex * 3 + placement) % indexes.length;
    for (let offset = 0; offset < indexes.length; offset += 1) {
      const contextIndex = indexes[(start + offset) % indexes.length]!;
      if (used.has(contextIndex)) continue;
      const sourceIds = kind === "member"
        ? memberContexts[contextIndex]!.partnerCardIds
        : leaderContexts[contextIndex]!.memberCardIds;
      for (let slotOffset = 0; slotOffset < slotCount; slotOffset += 1) {
        const slot = (contextIndex + slotOffset) % slotCount;
        const candidateIds = [...sourceIds];
        candidateIds[slot] = card.id;
        const talents = candidateIds.map((cardId) => talentByCardId.get(cardId));
        if (talents.some((talent) => talent === undefined) || new Set(talents).size !== slotCount) {
          continue;
        }
        if (kind === "member") {
          memberContexts[contextIndex] = {
            ...memberContexts[contextIndex]!,
            partnerCardIds: asPartnerTuple(candidateIds),
          };
        } else {
          leaderContexts[contextIndex] = {
            ...leaderContexts[contextIndex]!,
            memberCardIds: asMemberTuple(candidateIds),
          };
        }
        used.add(contextIndex);
        return;
      }
    }
    throw new Error(`No legal ${kind} current-context placement for ${card.id}`);
  };

  for (const [cardIndex, card] of appended.entries()) {
    for (let placement = 0; placement < 3; placement += 1) {
      placeCard(card, cardIndex, placement, "member");
      placeCard(card, cardIndex, placement, "leader");
    }
    const leaderContextIndex = currentMemberIndexes[cardIndex]!;
    memberContexts[leaderContextIndex] = {
      ...memberContexts[leaderContextIndex]!,
      leaderOutfitCardId: card.id,
    };
  }

  for (const context of memberContexts) {
    NativeMemberBenchmarkContextSchema.parse(context);
    assertUniqueTalentCards(`Member context ${context.id}`, context.partnerCardIds, talentByCardId);
  }
  for (const context of leaderContexts) {
    NativeLeaderBenchmarkContextSchema.parse(context);
    assertUniqueTalentCards(`Leader context ${context.id}`, context.memberCardIds, talentByCardId);
  }
  return Object.freeze({
    memberContexts: Object.freeze(memberContexts.map((context) => Object.freeze(context))),
    leaderContexts: Object.freeze(leaderContexts.map((context) => Object.freeze(context))),
  });
}

const validationContexts = buildNativeRankingBenchmarkContexts();
const validationTalentByCardId = new Map(
  publicCards
    .filter((card) => frozenCohortCardIds.includes(card.id))
    .map((card) => [card.id, card.talentId]),
);

export const nativeRankingBenchmarkValidationStats = validateAndDescribeContexts(
  validationContexts,
  validationTalentByCardId,
);
