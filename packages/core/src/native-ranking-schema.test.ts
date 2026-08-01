import { describe, expect, it } from "vitest";

import {
  NativeRankingEntrySchema,
  NativeRankingSnapshotSchema,
  SerializableIntervalSchema,
  gatedModelBandForIndex,
  modelBandForIndex,
  nativeCompetitionRanks,
  type NativeLens,
  type NativeRankingEntityKind,
} from "./native-ranking-schema";
import { memberTierForIndex } from "./native-tier-calibration";

const lenses = [
  "low-investment",
  "one-copy-maximum",
  "duplicate-enabled-ceiling",
] as const satisfies readonly NativeLens[];

function entry(
  cardId: string,
  rank: number,
  entityKind: NativeRankingEntityKind,
  centralIndex = 100,
  lens: NativeLens = "one-copy-maximum",
) {
  return {
    cardId,
    rank,
    modelBand: "A" as const,
    tier: entityKind === "member" ? memberTierForIndex(lens, centralIndex) : ("A" as const),
    stableTier: "Provisional" as const,
    publicationState: "theorycraft-beta" as const,
    index: { lower: centralIndex - 2, central: centralIndex, upper: centralIndex + 2 },
    metrics: {
      G: { lower: -2, central: 0, upper: 2 },
      P: { lower: 3, central: 5, upper: 7 },
      B: { lower: 40, central: 50, upper: 60 },
      E: { lower: -1, central: 1, upper: 3 },
    },
    boundaryConfidencePermil: 800,
    samplingError: 0.4,
    contextDispersion: 2.5,
    bootstrap: {
      replicates: 400,
      confidenceLevelPermil: 900 as const,
      probabilityAbove120Permil: 0,
      probabilityTopDecilePermil: 100,
      probabilityBelow80Permil: 0,
      definitelyNegativeMarginalPermil: 0,
    },
    evaluation: {
      method: "frozen-matched-substitution" as const,
      status: "complete" as const,
      matchedContexts: 300,
      referenceContexts: 210,
      currentContexts: 90,
      frozenComparisonCohortSize: 113 as const,
      minimumAlternativesPerContext: 108,
      maximumAlternativesPerContext: 112,
      formationSlotCounts: entityKind === "member" ? [60, 60, 60, 60, 60] : null,
    },
    provisionalReasons: ["The runtime score equation remains unvalidated."],
  };
}

function snapshotFixture(cardCount = 113) {
  const cardIds = Array.from({ length: cardCount }, (_, index) =>
    `card-${String(index + 1).padStart(3, "0")}`,
  );
  const buildLenses = (entityKind: NativeRankingEntityKind) =>
    lenses.map((lens) => ({
      id: `${entityKind}-${lens}`,
      label: lens,
      entityKind,
      investment: lens,
      frozenBaselineId: `baseline-${entityKind}-${lens}`,
      entries: cardIds.map((cardId, index) =>
        entry(cardId, index + 1, entityKind, 105 - index / 1_000, lens),
      ),
    }));
  return {
    schemaVersion: 2 as const,
    snapshotId: "fixture-native-v2",
    generatedAt: "2026-07-31T16:00:00.000Z",
    dataRetrievedAt: "2026-07-31",
    rosterCommit: "a".repeat(40),
    mechanicsVersion: "fixture-mechanics-v1",
    methodologyVersion: "yd-native-ranking-2.0.0" as const,
    evaluatorVersion: "yd-native-utility-1.0.0" as const,
    benchmarkId: "fixture-benchmark-v1",
    currentContextExtension: null,
    tierCalibrationId: "launch-2026-07-31-member-tier-calibration-v1" as const,
    theorycraftBeta: true as const,
    absoluteScoreAvailable: false as const,
    context: {
      platform: "mobile" as const,
      playMode: "manual" as const,
      judgement: "perfect" as const,
      life: 1_000 as const,
      board: "declared-neutral" as const,
      timingModel: "aggregate-uniform-note-timing-v1" as const,
      specialTimingModel: "aggregate-special-duration-coverage-v1" as const,
    },
    corpus: Array.from({ length: 30 }, (_, index) => ({
      chartKey: `m${String(index + 1).padStart(4, "0")}:expert`,
      songId: `m${String(index + 1).padStart(4, "0")}`,
      songTitle: `Song ${index + 1}`,
      durationMilliseconds: 120_000 + index,
      noteCount: 500 + index,
      chartHash: index.toString(16).padStart(32, "0"),
      segment: index < 21 ? ("reference" as const) : ("current" as const),
    })),
    lenses: buildLenses("member"),
    leaderOutfitLenses: buildLenses("leader-outfit"),
  };
}

describe("native ranking publication schema", () => {
  it("keeps the frozen tier boundaries exact", () => {
    expect([79.999, 80, 90, 100, 110, 120].map(modelBandForIndex)).toEqual([
      "D",
      "C",
      "B",
      "A",
      "S",
      "SS",
    ]);
  });

  it("gates SS and D model bands with the published confidence controls", () => {
    const base = {
      probabilityAbove120Permil: 900,
      probabilityTopDecilePermil: 800,
      probabilityBelow80Permil: 800,
      definitelyNegativeMarginalPermil: 800,
    };
    expect(gatedModelBandForIndex(125, base)).toBe("SS");
    expect(
      gatedModelBandForIndex(125, { ...base, probabilityTopDecilePermil: 799 }),
    ).toBe("S");
    expect(gatedModelBandForIndex(75, base)).toBe("D");
    expect(
      gatedModelBandForIndex(75, { ...base, definitelyNegativeMarginalPermil: 799 }),
    ).toBe("C");
  });

  it("rejects inverted or non-finite intervals", () => {
    expect(SerializableIntervalSchema.safeParse({ lower: 1, central: 2, upper: 3 }).success).toBe(true);
    expect(SerializableIntervalSchema.safeParse({ lower: 3, central: 2, upper: 1 }).success).toBe(false);
    expect(SerializableIntervalSchema.safeParse({ lower: 1, central: Number.NaN, upper: 3 }).success).toBe(false);
  });

  it("keeps breadth intervals inside their percentage domain", () => {
    const fixture = entry("card-fixture", 1, "member");
    expect(
      NativeRankingEntrySchema.safeParse({
        ...fixture,
        metrics: { ...fixture.metrics, B: { lower: -1, central: 50, upper: 60 } },
      }).success,
    ).toBe(false);
    expect(
      NativeRankingEntrySchema.safeParse({
        ...fixture,
        metrics: { ...fixture.metrics, B: { lower: 40, central: 50, upper: 101 } },
      }).success,
    ).toBe(false);
  });

  it("requires a reason for Provisional entries and a model band derived from evidence", () => {
    const fixture = entry("card-fixture", 1, "member");
    expect(NativeRankingEntrySchema.safeParse(fixture).success).toBe(true);
    expect(
      NativeRankingEntrySchema.safeParse({ ...fixture, provisionalReasons: [] }).success,
    ).toBe(false);
    expect(
      NativeRankingEntrySchema.safeParse({ ...fixture, modelBand: "S" }).success,
    ).toBe(false);
  });

  it("accepts the complete v2 Member and Leader/Outfit snapshot contract", () => {
    expect(NativeRankingSnapshotSchema.safeParse(snapshotFixture()).success).toBe(true);
    expect(NativeRankingSnapshotSchema.safeParse(snapshotFixture(114)).success).toBe(true);
  });

  it("uses competition ranks instead of inventing an order for equal indices", () => {
    expect(nativeCompetitionRanks([112, 112, 108, 101, 101])).toEqual([1, 1, 3, 4, 4]);
    expect(() => nativeCompetitionRanks([100, 101])).toThrow(/descending order/i);

    const tied = snapshotFixture();
    tied.lenses[0]!.entries[1]!.index = { ...tied.lenses[0]!.entries[0]!.index };
    tied.lenses[0]!.entries[1]!.tier = tied.lenses[0]!.entries[0]!.tier;
    tied.lenses[0]!.entries[1]!.rank = 1;
    expect(NativeRankingSnapshotSchema.safeParse(tied).success).toBe(true);

    tied.lenses[0]!.entries[1]!.rank = 2;
    expect(NativeRankingSnapshotSchema.safeParse(tied).success).toBe(false);
  });

  it("rejects incorrect competition ranks, duplicate charts, and cross-context roster drift", () => {
    const badRanks = snapshotFixture();
    badRanks.lenses[0]!.entries[0]!.rank = 114;
    expect(NativeRankingSnapshotSchema.safeParse(badRanks).success).toBe(false);

    const duplicateChart = snapshotFixture();
    duplicateChart.corpus[1]!.chartKey = duplicateChart.corpus[0]!.chartKey;
    expect(NativeRankingSnapshotSchema.safeParse(duplicateChart).success).toBe(false);

    const rosterDrift = snapshotFixture();
    rosterDrift.leaderOutfitLenses[0]!.entries[0]!.cardId = "different-card";
    expect(NativeRankingSnapshotSchema.safeParse(rosterDrift).success).toBe(false);
  });
});
