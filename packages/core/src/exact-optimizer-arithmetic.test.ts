import { describe, expect, it } from "vitest";

import {
  canPruneByStrictCentralUpperBound,
  canonicalCandidateKey,
  compareCanonicalCandidates,
  canonicalUtilityTie,
  toCanonicalMicroUnits,
  upperBoundToCanonicalMicroUnits,
  type CanonicalCandidate,
} from "./exact-optimizer-arithmetic";

describe("canonical exact-optimizer arithmetic", () => {
  it("preserves native Math.round behavior on positive and negative half units", () => {
    expect(toCanonicalMicroUnits(1.0000005)).toBe(1_000_001);
    expect(toCanonicalMicroUnits(-1.2345005)).toBe(-1_234_500);
    expect(toCanonicalMicroUnits(0.00000049)).toBe(0);
    expect(toCanonicalMicroUnits(-0.00000051)).toBe(-1);
  });

  it("keeps values immediately around a micro-unit boundary distinct", () => {
    expect(toCanonicalMicroUnits(4.12500049)).toBe(4_125_000);
    expect(toCanonicalMicroUnits(4.12500051)).toBe(4_125_001);
    expect(upperBoundToCanonicalMicroUnits(4.125)).toBe(4_125_000);
    expect(upperBoundToCanonicalMicroUnits(4.12500001)).toBe(4_125_001);
  });

  it("never prunes an upper bound equal to the incumbent", () => {
    expect(canPruneByStrictCentralUpperBound(toCanonicalMicroUnits(10), toCanonicalMicroUnits(10))).toBe(
      false,
    );
    expect(canPruneByStrictCentralUpperBound(toCanonicalMicroUnits(9.999999), toCanonicalMicroUnits(10))).toBe(
      true,
    );
  });

  it("uses lower then upper as deterministic score tie-breaks", () => {
    const make = (central: number, lower: number, upper: number, leaderCardId: string): CanonicalCandidate => ({
      leaderCardId,
      memberCardIds: ["member-b", "member-a"],
      utility: {
        central: toCanonicalMicroUnits(central),
        lower: toCanonicalMicroUnits(lower),
        upper: toCanonicalMicroUnits(upper),
      },
    });
    expect(compareCanonicalCandidates(make(10, 4, 20, "leader-a"), make(10, 5, 20, "leader-b"))).toBeLessThan(0);
    expect(compareCanonicalCandidates(make(10, 5, 20, "leader-a"), make(10, 5, 21, "leader-b"))).toBeLessThan(0);
    expect(compareCanonicalCandidates(make(10, 5, 21, "leader-b"), make(10, 5, 21, "leader-a"))).toBeLessThan(0);
    expect(canonicalCandidateKey(make(10, 5, 21, "leader-a"))).toBe("leader-a|member-a|member-b");
  });

  it("records complete utility ties before the canonical card-id tie-break", () => {
    const utility = {
      central: toCanonicalMicroUnits(10),
      lower: toCanonicalMicroUnits(9),
      upper: toCanonicalMicroUnits(11),
    };
    expect(canonicalUtilityTie(utility, { ...utility })).toBe(true);
    expect(canonicalUtilityTie(utility, { ...utility, upper: toCanonicalMicroUnits(11.000001) })).toBe(false);
  });
});
