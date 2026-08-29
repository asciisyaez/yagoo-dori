import { describe, expect, it } from "vitest";

import { nativeRankingData } from "./native-ranking-data";
import {
  memberTierForIndex,
  nativeMemberTierCalibration,
} from "./native-tier-calibration";

describe("frozen Member tier calibration", () => {
  it("maps every boundary deterministically from SS through D", () => {
    for (const [lens, boundaries] of Object.entries(nativeMemberTierCalibration.lenses)) {
      const typedLens = lens as keyof typeof nativeMemberTierCalibration.lenses;
      expect(memberTierForIndex(typedLens, boundaries.SS)).toBe("SS");
      expect(memberTierForIndex(typedLens, boundaries.SS - 0.000001)).toBe("S");
      expect(memberTierForIndex(typedLens, boundaries.S)).toBe("S");
      expect(memberTierForIndex(typedLens, boundaries.A)).toBe("A");
      expect(memberTierForIndex(typedLens, boundaries.B)).toBe("B");
      expect(memberTierForIndex(typedLens, boundaries.C)).toBe("C");
      expect(memberTierForIndex(typedLens, boundaries.C - 0.000001)).toBe("D");
    }
  });

  it("creates a useful launch-roster spread in every investment lens", () => {
    for (const lens of nativeRankingData.lenses) {
      const counts = Object.fromEntries(
        ["SS", "S", "A", "B", "C", "D"].map((tier) => [
          tier,
          lens.entries.filter(
            (entry) => memberTierForIndex(lens.investment, entry.index.central) === tier,
          ).length,
        ]),
      );
      expect(counts).toEqual(
        lens.investment === "one-copy-maximum"
          ? { SS: 6, S: 14, A: 26, B: 24, C: 27, D: 27 }
          : lens.investment === "duplicate-enabled-ceiling"
            ? { SS: 6, S: 13, A: 27, B: 24, C: 26, D: 28 }
            : { SS: 6, S: 14, A: 26, B: 24, C: 26, D: 28 },
      );
    }
  });

  it("only publishes extreme tiers when their additional confidence gates pass", () => {
    for (const lens of nativeRankingData.lenses) {
      const counts = Object.fromEntries(
        ["SS", "S", "A", "B", "C", "D"].map((tier) => [
          tier,
          lens.entries.filter((entry) => entry.tier === tier).length,
        ]),
      );
      expect(counts).toEqual(
        lens.investment === "duplicate-enabled-ceiling"
          ? { SS: 0, S: 19, A: 27, B: 24, C: 54, D: 0 }
          : { SS: 0, S: 20, A: 26, B: 24, C: 54, D: 0 },
      );
    }
  });

  it("does not depend on roster size or rank when classifying a future card", () => {
    const index = 105;
    const before = memberTierForIndex("one-copy-maximum", index);
    const unrelatedFutureIndexes = Array.from({ length: 500 }, (_, offset) => 80 + offset / 10);
    expect(unrelatedFutureIndexes).toHaveLength(500);
    expect(memberTierForIndex("one-copy-maximum", index)).toBe(before);
  });
});
