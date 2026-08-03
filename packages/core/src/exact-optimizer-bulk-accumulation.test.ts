import { describe, expect, it } from "vitest";

import {
  certifyCanonicalMicroUnitEnclosure,
  certifyCanonicalUtilityInterval,
  nextDown,
  nextUp,
  pointBinary64Enclosure,
  replayOrderedRepeatedBinary64Addition,
  transformRepeatedBinary64Addition,
} from "./exact-optimizer-bulk-accumulation";
import { toCanonicalMicroUnits } from "./exact-optimizer-arithmetic";

describe("certified bulk binary64 accumulation", () => {
  it("encloses the ordered RN-even recurrence and certifies a singleton canonical result", () => {
    const transformed = transformRepeatedBinary64Addition({
      incoming: pointBinary64Enclosure(17.25),
      contribution: 0.125,
      multiplicity: 128,
      expectedContribution: 0.125,
    });
    expect(transformed.kind).toBe("bulk-run-enclosure");
    if (transformed.kind === "ordered-replay-required") return;
    const reference = replayOrderedRepeatedBinary64Addition(17.25, 0.125, 128);
    expect(transformed.enclosure.lower).toBeLessThanOrEqual(reference);
    expect(transformed.enclosure.upper).toBeGreaterThanOrEqual(reference);
    const canonical = certifyCanonicalMicroUnitEnclosure(transformed.enclosure);
    expect(canonical.kind).toBe("bulk-certified-reference-equivalent");
    if (canonical.kind === "ordered-replay-required") return;
    expect(canonical.canonicalMicroUnits).toBe(toCanonicalMicroUnits(reference));
  });

  it("falls back instead of certifying an enclosure that straddles a JavaScript micro boundary", () => {
    const result = certifyCanonicalMicroUnitEnclosure({
      lower: 4.12500049,
      upper: 4.12500051,
    });
    expect(result).toMatchObject({
      kind: "ordered-replay-required",
      fallbackReason: "canonical-boundary-overlap",
    });
  });

  it("rejects non-finite, subnormal, signed-zero, and contribution-mismatch preconditions", () => {
    expect(
      transformRepeatedBinary64Addition({
        incoming: pointBinary64Enclosure(1),
        contribution: Number.POSITIVE_INFINITY,
        multiplicity: 2,
      }),
    ).toMatchObject({ fallbackReason: "unsupported-nonfinite-value" });
    expect(
      transformRepeatedBinary64Addition({
        incoming: pointBinary64Enclosure(1),
        contribution: Number.MIN_VALUE,
        multiplicity: 2,
      }),
    ).toMatchObject({ fallbackReason: "subnormal-assumption-not-proven" });
    expect(
      transformRepeatedBinary64Addition({
        incoming: { lower: -0, upper: 0 },
        contribution: 1,
        multiplicity: 2,
      }),
    ).toMatchObject({ fallbackReason: "signed-zero-sensitive" });
    expect(
      transformRepeatedBinary64Addition({
        incoming: pointBinary64Enclosure(1),
        contribution: 0.25,
        expectedContribution: 0.5,
        multiplicity: 2,
      }),
    ).toMatchObject({ fallbackReason: "contribution-mismatch" });
  });

  it("keeps the signed JavaScript Math.round tie rule distinct from RN-even", () => {
    const negative = certifyCanonicalMicroUnitEnclosure(pointBinary64Enclosure(-1.2345005));
    expect(negative.kind).toBe("bulk-certified-reference-equivalent");
    if (negative.kind === "ordered-replay-required") return;
    expect(negative.canonicalMicroUnits).toBe(-1_234_500);
  });

  it("models interval clamp plus every six-decimal boundary", () => {
    const interval = certifyCanonicalUtilityInterval({
      lower: pointBinary64Enclosure(0.00000049),
      central: pointBinary64Enclosure(0.00000051),
      upper: pointBinary64Enclosure(0.00000149),
    });
    expect(interval.kind).toBe("bulk-certified-reference-equivalent");
    if (interval.kind === "ordered-replay-required") return;
    expect(interval.canonicalMicroUnits).toEqual({ lower: 0, central: 1, upper: 1 });
  });

  it("has correct adjacent-float primitives at zero and around a normal value", () => {
    expect(nextUp(0)).toBe(Number.MIN_VALUE);
    expect(nextDown(0)).toBe(-Number.MIN_VALUE);
    expect(nextDown(nextUp(1))).toBe(1);
  });
});
