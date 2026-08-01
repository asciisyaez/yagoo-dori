import { describe, expect, it } from "vitest";

import { nativeRankingBenchmark } from "./native-ranking-benchmark";
import {
  deserializeFrozenNativeBaseline,
  generateNativeRankingSnapshot,
  NATIVE_FROZEN_BASELINE_ROSTER_COMMIT,
  nativeBaselineKey,
  nativeTopDecileCardIdsWithTies,
  SerializedFrozenNativeBaselineSchema,
  type SerializedFrozenNativeBaseline,
} from "./native-ranking-generator";

const serialized: SerializedFrozenNativeBaseline = {
  schemaVersion: 2,
  id: "launch-fixture-member-one-copy",
  createdAt: "2026-07-31T16:00:00.000Z",
  rosterCommit: nativeRankingBenchmark.sources.roster.commit,
  methodologyVersion: "yd-native-ranking-2.0.0",
  entityKind: "member",
  lens: "one-copy-maximum",
  scales: {
    G: { median: "10", mad: "2" },
    P: { median: "20", mad: "3" },
    B: { median: "30", mad: "4" },
    E: { median: "40", mad: "5" },
    C: { median: "50", mad: "6" },
  },
};

describe("frozen native baseline persistence", () => {
  it("includes every card tied at the top-decile cutoff", () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      cardId: `card-${String(index + 1).padStart(2, "0")}`,
      index: index === 0 ? 120 : index < 4 ? 110 : 100 - index,
    }));

    expect([...nativeTopDecileCardIdsWithTies(rows)].sort()).toEqual([
      "card-01",
      "card-02",
      "card-03",
      "card-04",
    ]);
    expect(() =>
      nativeTopDecileCardIdsWithTies([
        { cardId: "duplicate", index: 100 },
        { cardId: "duplicate", index: 90 },
      ]),
    ).toThrow(/unique card IDs/i);
  });

  it("keys all six v2 baseline identities by entity kind and investment lens", () => {
    expect(nativeBaselineKey("member", "one-copy-maximum")).toBe(
      "member|one-copy-maximum",
    );
    expect(nativeBaselineKey("leader-outfit", "one-copy-maximum")).toBe(
      "leader-outfit|one-copy-maximum",
    );
  });

  it("restores integer robust scales exactly instead of recomputing them", () => {
    expect(deserializeFrozenNativeBaseline(serialized)).toEqual({
      id: serialized.id,
      scales: {
        G: { median: 10n, mad: 2n },
        P: { median: 20n, mad: 3n },
        B: { median: 30n, mad: 4n },
        E: { median: 40n, mad: 5n },
        C: { median: 50n, mad: 6n },
      },
    });
  });

  it("pins normalization to the frozen benchmark commit, not the current mechanics commit", () => {
    expect(NATIVE_FROZEN_BASELINE_ROSTER_COMMIT).toBe(
      nativeRankingBenchmark.sources.roster.commit,
    );
    expect(() =>
      deserializeFrozenNativeBaseline({ ...serialized, rosterCommit: "a".repeat(40) }),
    ).toThrow(/pinned benchmark cohort/i);
  });

  it("rejects a corrupt non-positive robust scale", () => {
    expect(() =>
      deserializeFrozenNativeBaseline({
        ...serialized,
        scales: { ...serialized.scales, C: { median: "50", mad: "0" } },
      }),
    ).toThrow(/positive MAD/i);
  });

  it("validates serialized v2 metadata and refuses partial six-baseline sets", () => {
    expect(SerializedFrozenNativeBaselineSchema.safeParse(serialized).success).toBe(true);
    expect(
      SerializedFrozenNativeBaselineSchema.safeParse({ ...serialized, entityKind: "leader" })
        .success,
    ).toBe(false);
    expect(() =>
      generateNativeRankingSnapshot(
        "2026-07-31T16:00:00.000Z",
        undefined,
        new Map([[nativeBaselineKey(serialized.entityKind, serialized.lens), serialized]]),
      ),
    ).toThrow(/zero or six frozen baselines/i);
    expect(() =>
      generateNativeRankingSnapshot(
        "2026-07-31T16:00:00.000Z",
        undefined,
        new Map(),
        { version: "future-v1", appendedCardIds: ["card-future"] },
      ),
    ).toThrow(/requires all six frozen launch baselines/i);
  });

  it("rejects a v1 baseline rather than silently mixing methodologies", () => {
    expect(() =>
      deserializeFrozenNativeBaseline({
        ...serialized,
        schemaVersion: 1,
        methodologyVersion: "yd-native-ranking-1.0.0",
      } as unknown as SerializedFrozenNativeBaseline),
    ).toThrow(/unsupported frozen native baseline/i);
  });
});
