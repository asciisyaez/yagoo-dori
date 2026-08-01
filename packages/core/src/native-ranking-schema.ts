import { z } from "zod";

import { NativeCurrentContextExtensionSchema } from "./native-ranking-benchmark";
import { memberTierForIndex, nativeMemberTierCalibration } from "./native-tier-calibration";

export const NativeLensSchema = z.enum([
  "low-investment",
  "one-copy-maximum",
  "duplicate-enabled-ceiling",
]);

export const NativeRankingEntityKindSchema = z.enum(["member", "leader-outfit"]);
export const NativeModelBandSchema = z.enum(["SS", "S", "A", "B", "C", "D"]);
export const NATIVE_RANKING_METHODOLOGY_VERSION = "yd-native-ranking-2.1.0" as const;
export const NativeStableTierSchema = z.enum([
  "SS",
  "S",
  "A",
  "B",
  "C",
  "D",
  "Provisional",
]);

export const SerializableIntervalSchema = z
  .object({
    lower: z.number().finite(),
    central: z.number().finite(),
    upper: z.number().finite(),
  })
  .strict()
  .refine(
    ({ lower, central, upper }) => lower <= central && central <= upper,
    "Interval bounds must be ordered",
  );

const NativeMetricSetSchema = z
  .object({
    G: SerializableIntervalSchema,
    P: SerializableIntervalSchema,
    B: SerializableIntervalSchema.refine(
      ({ lower, upper }) => lower >= 0 && upper <= 100,
      "Breadth B must remain a percentage from zero through 100",
    ),
    E: SerializableIntervalSchema,
  })
  .strict();

const BootstrapSummarySchema = z
  .object({
    replicates: z.number().int().min(200),
    confidenceLevelPermil: z.literal(900),
    probabilityAbove120Permil: z.number().int().min(0).max(1_000),
    probabilityTopDecilePermil: z.number().int().min(0).max(1_000),
    probabilityBelow80Permil: z.number().int().min(0).max(1_000),
    definitelyNegativeMarginalPermil: z.number().int().min(0).max(1_000),
  })
  .strict();

const MatchedEvaluationSummarySchema = z
  .object({
    method: z.literal("frozen-matched-substitution"),
    status: z.literal("complete"),
    matchedContexts: z.number().int().min(250),
    referenceContexts: z.number().int().positive(),
    currentContexts: z.number().int().positive(),
    frozenComparisonCohortSize: z.literal(113),
    minimumAlternativesPerContext: z.number().int().positive(),
    maximumAlternativesPerContext: z.number().int().positive(),
    formationSlotCounts: z.tuple([
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
    ]).nullable(),
  })
  .strict()
  .refine(
    ({ matchedContexts, referenceContexts, currentContexts }) =>
      referenceContexts + currentContexts === matchedContexts,
    "Reference and current context counts must sum to matchedContexts",
  )
  .refine(
    ({ minimumAlternativesPerContext, maximumAlternativesPerContext }) =>
      minimumAlternativesPerContext <= maximumAlternativesPerContext,
    "Matched alternative bounds must be ordered",
  )
  .refine(
    ({ matchedContexts, formationSlotCounts }) =>
      formationSlotCounts === null ||
      formationSlotCounts.reduce((total, count) => total + count, 0) === matchedContexts,
    "Formation-slot counts must sum to matchedContexts",
  );

export const NativeRankingEntrySchema = z
  .object({
    cardId: z.string().min(1),
    rank: z.number().int().positive(),
    modelBand: NativeModelBandSchema,
    tier: NativeModelBandSchema,
    stableTier: NativeStableTierSchema,
    publicationState: z.literal("theorycraft-beta"),
    index: SerializableIntervalSchema,
    metrics: NativeMetricSetSchema,
    boundaryConfidencePermil: z.number().int().min(0).max(1_000),
    samplingError: z.number().nonnegative(),
    contextDispersion: z.number().nonnegative(),
    bootstrap: BootstrapSummarySchema,
    evaluation: MatchedEvaluationSummarySchema,
    provisionalReasons: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.stableTier === "Provisional" && entry.provisionalReasons.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["provisionalReasons"],
        message: "A Provisional tier requires at least one concrete reason",
      });
    }
    if (entry.stableTier !== "Provisional" && entry.provisionalReasons.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["provisionalReasons"],
        message: "A stable tier cannot retain provisional reasons",
      });
    }
    if (
      entry.stableTier !== "Provisional" &&
      entry.stableTier !== entry.tier &&
      entry.boundaryConfidencePermil >= 800
    ) {
      context.addIssue({
        code: "custom",
        path: ["stableTier"],
        message: "A previous tier can only be retained below 80% boundary confidence",
      });
    }
    const expectedModelBand = gatedModelBandForIndex(entry.index.central, entry.bootstrap);
    if (entry.modelBand !== expectedModelBand) {
      context.addIssue({
        code: "custom",
        path: ["modelBand"],
        message: `Model band must match the gated central index (${expectedModelBand})`,
      });
    }
  });

export const NativeRankingLensSnapshotSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    entityKind: NativeRankingEntityKindSchema,
    investment: NativeLensSchema,
    frozenBaselineId: z.string().min(1),
    entries: z.array(NativeRankingEntrySchema).min(113),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const ids = new Set(snapshot.entries.map((entry) => entry.cardId));
    if (ids.size !== snapshot.entries.length) {
      context.addIssue({ code: "custom", path: ["entries"], message: "Card IDs must be unique" });
    }

    let entriesAreOrdered = true;
    for (let index = 1; index < snapshot.entries.length; index += 1) {
      const previous = snapshot.entries[index - 1]!;
      const entry = snapshot.entries[index]!;
      if (
        previous.index.central < entry.index.central ||
        (previous.index.central === entry.index.central && previous.cardId > entry.cardId)
      ) {
        entriesAreOrdered = false;
        context.addIssue({
          code: "custom",
          path: ["entries", index],
          message: "Entries must be ordered by descending central index, then lexical card ID",
        });
      }
    }
    if (entriesAreOrdered) {
      const expectedRanks = nativeCompetitionRanks(
        snapshot.entries.map((entry) => entry.index.central),
      );
      for (const [entryIndex, entry] of snapshot.entries.entries()) {
        if (entry.rank !== expectedRanks[entryIndex]) {
          context.addIssue({
            code: "custom",
            path: ["entries", entryIndex, "rank"],
            message: "Rank must use competition ranking, with equal central indices tied",
          });
        }
      }
    }
    for (const [entryIndex, entry] of snapshot.entries.entries()) {
      const expectedTier = gatedNativeTierCandidate(
        snapshot.entityKind === "member"
          ? memberTierForIndex(snapshot.investment, entry.index.central)
          : modelBandForIndex(entry.index.central),
        entry.bootstrap,
      );
      if (entry.tier !== expectedTier) {
        context.addIssue({
          code: "custom",
          path: ["entries", entryIndex, "tier"],
          message: `Tier must match the frozen ${snapshot.entityKind} calibration (${expectedTier})`,
        });
      }
      const slots = entry.evaluation.formationSlotCounts;
      if (
        (snapshot.entityKind === "member" && slots === null) ||
        (snapshot.entityKind === "leader-outfit" && slots !== null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["entries", entryIndex, "evaluation", "formationSlotCounts"],
          message: `Formation-slot counts do not match ${snapshot.entityKind} evaluation`,
        });
      }
    }
  });

const NativeCorpusEntrySchema = z
  .object({
    chartKey: z.string().min(1),
    songId: z.string().min(1),
    songTitle: z.string().min(1),
    durationMilliseconds: z.number().int().positive(),
    noteCount: z.number().int().positive(),
    chartHash: z.string().regex(/^[a-f0-9]{32}$/),
    segment: z.enum(["reference", "current"]),
  })
  .strict();

export const NativeRankingSnapshotSchema = z
  .object({
    schemaVersion: z.literal(2),
    snapshotId: z.string().min(1),
    generatedAt: z.iso.datetime({ offset: true }),
    dataRetrievedAt: z.iso.date(),
    rosterCommit: z.string().regex(/^[a-f0-9]{40}$/),
    mechanicsVersion: z.string().min(1),
    methodologyVersion: z.literal(NATIVE_RANKING_METHODOLOGY_VERSION),
    evaluatorVersion: z.literal("yd-native-utility-1.0.0"),
    benchmarkId: z.string().min(1),
    currentContextExtension: NativeCurrentContextExtensionSchema.nullable(),
    tierCalibrationId: z.literal("launch-2026-07-31-member-tier-calibration-v1"),
    theorycraftBeta: z.literal(true),
    absoluteScoreAvailable: z.literal(false),
    context: z
      .object({
        platform: z.literal("mobile"),
        playMode: z.literal("manual"),
        judgement: z.literal("perfect"),
        life: z.literal(1_000),
        board: z.literal("declared-neutral"),
        timingModel: z.literal("aggregate-uniform-note-timing-v1"),
        specialTimingModel: z.literal("aggregate-special-duration-coverage-v1"),
      })
      .strict(),
    corpus: z.array(NativeCorpusEntrySchema).length(30),
    lenses: z.array(NativeRankingLensSnapshotSchema).length(3),
    leaderOutfitLenses: z.array(NativeRankingLensSnapshotSchema).length(3),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const referenceCount = snapshot.corpus.filter((entry) => entry.segment === "reference").length;
    const currentCount = snapshot.corpus.filter((entry) => entry.segment === "current").length;
    if (referenceCount !== 21 || currentCount !== 9) {
      context.addIssue({
        code: "custom",
        path: ["corpus"],
        message: "Ranking corpus must contain 21 reference and 9 current charts",
      });
    }
    if (new Set(snapshot.corpus.map((entry) => entry.chartKey)).size !== snapshot.corpus.length) {
      context.addIssue({
        code: "custom",
        path: ["corpus"],
        message: "Ranking corpus chart keys must be unique",
      });
    }
    const validateLenses = (
      lenses: readonly z.infer<typeof NativeRankingLensSnapshotSchema>[],
      expectedKind: NativeRankingEntityKind,
      path: "lenses" | "leaderOutfitLenses",
    ) => {
      const investments = new Set(lenses.map((lens) => lens.investment));
      if (investments.size !== 3 || lenses.some((lens) => lens.entityKind !== expectedKind)) {
        context.addIssue({
          code: "custom",
          path: [path],
          message: `All three ${expectedKind} investment lenses are required`,
        });
      }
      const expectedIds = lenses[0]?.entries.map((entry) => entry.cardId).sort().join("\0") ?? "";
      for (const [lensIndex, lens] of lenses.entries()) {
        if (lens.entries.map((entry) => entry.cardId).sort().join("\0") !== expectedIds) {
          context.addIssue({
            code: "custom",
            path: [path, lensIndex, "entries"],
            message: "Every lens must cover the same evaluated card roster",
          });
        }
      }
    };
    validateLenses(snapshot.lenses, "member", "lenses");
    validateLenses(snapshot.leaderOutfitLenses, "leader-outfit", "leaderOutfitLenses");
    const memberIds = snapshot.lenses[0]!.entries.map((entry) => entry.cardId).sort().join("\0");
    const leaderOutfitIds = snapshot.leaderOutfitLenses[0]!.entries
      .map((entry) => entry.cardId)
      .sort()
      .join("\0");
    if (memberIds !== leaderOutfitIds) {
      context.addIssue({
        code: "custom",
        path: ["leaderOutfitLenses"],
        message: "Member and Leader/Outfit lenses must cover the same evaluated card roster",
      });
    }
  });

export type NativeLens = z.infer<typeof NativeLensSchema>;
export type NativeRankingEntityKind = z.infer<typeof NativeRankingEntityKindSchema>;
export type NativeModelBand = z.infer<typeof NativeModelBandSchema>;
export type NativeStableTier = z.infer<typeof NativeStableTierSchema>;
export type SerializableInterval = z.infer<typeof SerializableIntervalSchema>;
export type NativeRankingEntry = z.infer<typeof NativeRankingEntrySchema>;
export type NativeRankingSnapshot = z.infer<typeof NativeRankingSnapshotSchema>;

export const NATIVE_MEMBER_TIER_CALIBRATION_ID = nativeMemberTierCalibration.id;

/**
 * Return standard competition ranks ("1224" ranking) for an already sorted
 * descending score list. Exact model ties therefore never acquire a false
 * ordering from the deterministic card-ID sort used for serialization.
 */
export function nativeCompetitionRanks(descendingIndexes: readonly number[]): number[] {
  const ranks: number[] = [];
  let previous = Number.POSITIVE_INFINITY;
  let currentRank = 0;
  for (const [index, value] of descendingIndexes.entries()) {
    if (!Number.isFinite(value) || value > previous) {
      throw new Error("Competition ranks require finite indices in descending order");
    }
    if (index === 0 || value < previous) currentRank = index + 1;
    ranks.push(currentRank);
    previous = value;
  }
  return ranks;
}

export function modelBandForIndex(index: number): NativeModelBand {
  if (index >= 120) return "SS";
  if (index >= 110) return "S";
  if (index >= 100) return "A";
  if (index >= 90) return "B";
  if (index >= 80) return "C";
  return "D";
}

export function gatedModelBandForIndex(
  index: number,
  evidence: Readonly<{
    probabilityAbove120Permil: number;
    probabilityTopDecilePermil: number;
    probabilityBelow80Permil: number;
    definitelyNegativeMarginalPermil: number;
  }>,
): NativeModelBand {
  return gatedNativeTierCandidate(modelBandForIndex(index), evidence);
}

export function gatedNativeTierCandidate(
  raw: NativeModelBand,
  evidence: Readonly<{
    probabilityAbove120Permil: number;
    probabilityTopDecilePermil: number;
    probabilityBelow80Permil: number;
    definitelyNegativeMarginalPermil: number;
  }>,
): NativeModelBand {
  if (
    raw === "SS" &&
    (evidence.probabilityAbove120Permil < 900 || evidence.probabilityTopDecilePermil < 800)
  ) {
    return "S";
  }
  if (
    raw === "D" &&
    (evidence.probabilityBelow80Permil < 800 || evidence.definitelyNegativeMarginalPermil < 800)
  ) {
    return "C";
  }
  return raw;
}
