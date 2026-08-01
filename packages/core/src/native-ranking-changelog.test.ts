import { describe, expect, it } from "vitest";

import {
  generateNativeRankingChangelog,
  nativeRankingTransitionKey,
  previousStableTierMap,
  type NativeComparableRankingSnapshot,
  type NativeRankingAttributionManifest,
} from "./native-ranking-changelog";
import type { NativeRankingSnapshot } from "./native-ranking-schema";

function snapshot(
  snapshotId: string,
  generatedAt: string,
  methodologyVersion: string,
  entry: Readonly<{
    cardId?: string;
    rank?: number;
    tier?: "SS" | "S" | "A" | "B" | "C" | "D";
    stableTier?: "SS" | "S" | "A" | "B" | "C" | "D" | "Provisional";
    index?: number;
  }> = {},
): NativeComparableRankingSnapshot {
  return {
    snapshotId,
    generatedAt,
    methodologyVersion,
    lenses: [
      {
        entityKind: "member",
        investment: "one-copy-maximum",
        entries: [
          {
            cardId: entry.cardId ?? "card-1",
            rank: entry.rank ?? 1,
            tier: entry.tier ?? "A",
            stableTier: entry.stableTier ?? "A",
            index: { central: entry.index ?? 100 },
          },
        ],
      },
    ],
    leaderOutfitLenses: [],
  };
}

function asCurrent(value: NativeComparableRankingSnapshot): NativeRankingSnapshot {
  return value as unknown as NativeRankingSnapshot;
}

function manifest(
  before: NativeComparableRankingSnapshot,
  after: NativeComparableRankingSnapshot,
  parts: NativeRankingAttributionManifest["entries"][number]["parts"],
): NativeRankingAttributionManifest {
  return {
    schemaVersion: 1,
    fromSnapshotId: before.snapshotId,
    fromGeneratedAt: before.generatedAt,
    toSnapshotId: after.snapshotId,
    toGeneratedAt: after.generatedAt,
    entries: [
      {
        entityKind: "member",
        investment: "one-copy-maximum",
        cardId: "card-1",
        parts,
      },
    ],
  };
}

describe("native ranking changelog", () => {
  const before = snapshot("before", "2026-07-31T16:00:00.000Z", "method-v1");
  const after = snapshot("after", "2026-08-01T14:00:00.000Z", "method-v1", {
    rank: 2,
    tier: "S",
    stableTier: "S",
    index: 104.2,
  });

  it("refuses a nonzero score change without exact reviewed attribution", () => {
    expect(() => generateNativeRankingChangelog(before, asCurrent(after))).toThrow(
      /missing exact score-delta attribution/i,
    );
  });

  it("records exact score, rank, candidate-tier, and stable-tier deltas separately", () => {
    const changelog = generateNativeRankingChangelog(
      before,
      asCurrent(after),
      manifest(before, after, [
        { reason: "new-synergy", deltaMicro: 2_700_000 },
        { reason: "chart-meta", deltaMicro: 1_500_000 },
      ]),
    );
    expect(changelog.entries).toHaveLength(1);
    expect(changelog.entries[0]).toMatchObject({
      scoreDeltaMicro: 4_200_000,
      scoreDelta: 4.2,
      rankDelta: -1,
      tierDelta: { from: "A", to: "S", steps: 1 },
      stableTierDelta: { from: "A", to: "S" },
    });
    expect(changelog.summary).toEqual({
      added: 0,
      removed: 0,
      scoreChanged: 1,
      rankChanged: 1,
      tierChanged: 1,
      stableTierChanged: 1,
    });
  });

  it("rejects attribution parts that do not sum to the exact micro-index delta", () => {
    expect(() =>
      generateNativeRankingChangelog(
        before,
        asCurrent(after),
        manifest(before, after, [{ reason: "new-synergy", deltaMicro: 4_199_999 }]),
      ),
    ).toThrow(/sum exactly/i);
  });

  it("attributes a score-neutral tier correction to the methodology transition", () => {
    const corrected = snapshot("corrected", "2026-08-01T14:00:00.000Z", "method-v2", {
      tier: "B",
      stableTier: "B",
    });
    const changelog = generateNativeRankingChangelog(before, asCurrent(corrected));
    expect(changelog.entries[0]?.attribution).toEqual([
      { reason: "methodology-correction", deltaMicro: 0, delta: 0 },
    ]);
  });

  it("only carries stable tiers across the same methodology", () => {
    const key = nativeRankingTransitionKey("member", "one-copy-maximum", "card-1");
    expect(previousStableTierMap(before, "method-v1").get(key)).toBe("A");
    expect(previousStableTierMap(before, "method-v2").size).toBe(0);
  });
});
