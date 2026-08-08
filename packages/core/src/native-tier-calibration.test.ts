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
      expect(counts).toEqual({ SS: 6, S: 12, A: 23, B: 20, C: 27, D: 27 });
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
      expect(counts).toEqual({ SS: 0, S: 18, A: 23, B: 20, C: 54, D: 0 });
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
