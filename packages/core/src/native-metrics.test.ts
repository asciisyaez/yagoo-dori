import { describe, expect, it } from "vitest";

import {
  INDEX_SCALE,
  aggregateNativeCardMetrics,
  applyFrozenNativeBaseline,
  areaUnderInvestmentCurve,
  attributeNativeIndexDelta,
  buildFrozenNativeBaseline,
  classifyNativeTier,
  deriveRobustScale,
  exactInterval,
  integerInterval,
  matchedLegalReplacementMarginal,
  stabilizeNativeTier,
  type FrozenNativeBaseline,
  type NativeCardMetrics,
} from "./native-metrics";

const exact = (value: number) => exactInterval(BigInt(value));

const baseline: FrozenNativeBaseline = {
  id: "fixture-baseline-v1",
  scales: {
    G: { median: 50n, mad: 10n },
    P: { median: 70n, mad: 10n },
    B: { median: 7_000n, mad: 1_000n },
    E: { median: 45n, mad: 10n },
    C: { median: 0n, mad: 500_000n },
  },
};

const centeredMetrics: NativeCardMetrics = {
  G: exact(50),
  P: exact(70),
  B: exact(7_000),
  E: exact(45),
};

describe("native integer intervals and legal replacement marginals", () => {
  it("subtracts the strongest legal replacement conservatively", () => {
    expect(
      matchedLegalReplacementMarginal(
        integerInterval(120n, 130n, 145n),
        [integerInterval(90n, 100n, 115n), integerInterval(95n, 105n, 110n)],
      ),
    ).toEqual(integerInterval(5n, 25n, 50n));
  });

  it("credits an older card when a real synergy partner raises its formation utility", () => {
    const replacements = [exact(100)];
    const before = matchedLegalReplacementMarginal(exact(120), replacements);
    const after = matchedLegalReplacementMarginal(exact(140), replacements);

    expect(before.central).toBe(20n);
    expect(after.central).toBe(40n);
    expect(after.central).toBeGreaterThan(before.central);
  });
});

describe("G, P, B, and E", () => {
  it("aggregates hand-worked matched contexts and breadth bounds", () => {
    const contexts = Array.from({ length: 10 }, (_, index) => ({
      contextId: `chart-${index + 1}`,
      weight: 1n,
      marginal: exact((index + 1) * 10),
      anchoredOptimum:
        index < 3
          ? exact(96)
          : index < 7
            ? integerInterval(94n, 96n, 98n)
            : exact(90),
      globalOptimum: exact(100),
    }));

    const metrics = aggregateNativeCardMetrics(contexts, [
      { positionPermil: 0, contribution: exact(10) },
      { positionPermil: 500, contribution: exact(20) },
      { positionPermil: 1_000, contribution: exact(30) },
    ]);

    expect(metrics.G).toEqual(exact(55));
    expect(metrics.P).toEqual(exact(100));
    expect(metrics.B).toEqual(integerInterval(3_000n, 7_000n, 7_000n));
    expect(metrics.E).toEqual(exact(20));
  });

  it("calculates normalized trapezoidal investment AUC", () => {
    expect(
      areaUnderInvestmentCurve([
        { positionPermil: 0, contribution: integerInterval(0n, 10n, 20n) },
        { positionPermil: 1_000, contribution: integerInterval(20n, 30n, 40n) },
      ]),
    ).toEqual(integerInterval(10n, 20n, 30n));
  });
});

describe("frozen robust baseline", () => {
  it("maps the frozen center to an index of exactly 100", () => {
    expect(applyFrozenNativeBaseline(centeredMetrics, baseline).index).toEqual(
      exactInterval(100n * INDEX_SCALE),
    );
  });

  it("does not rescale an existing card when an unrelated card is evaluated", () => {
    const before = applyFrozenNativeBaseline(centeredMetrics, baseline);
    applyFrozenNativeBaseline(
      { G: exact(9_000), P: exact(12_000), B: exact(10_000), E: exact(8_000) },
      baseline,
    );
    const after = applyFrozenNativeBaseline(centeredMetrics, baseline);

    expect(after).toEqual(before);
  });

  it("uses median and MAD rather than allowing one outlier to dominate the scale", () => {
    expect(deriveRobustScale([90n, 95n, 100n, 100n, 105n, 110n, 1_000_000n])).toEqual({
      median: 100n,
      mad: 5n,
    });
  });

  it("uses the nearest non-zero deviation when a discrete metric has zero MAD", () => {
    expect(deriveRobustScale([0n, 0n, 0n, 0n, 2_000n])).toEqual({
      median: 0n,
      mad: 2_000n,
    });
    expect(deriveRobustScale([7n, 7n, 7n])).toEqual({ median: 7n, mad: 1n });
  });

  it("freezes baseline values from raw metric rows without card editorial fields", () => {
    const rows = [0, 1, 2, 3, 4].map((offset) => ({
      cardId: `card-${offset}`,
      metrics: {
        G: exact(40 + offset * 5),
        P: exact(60 + offset * 5),
        B: exact(6_000 + offset * 500),
        E: exact(35 + offset * 5),
      },
    }));

    const frozen = buildFrozenNativeBaseline("real-fixture-v1", rows);

    expect(frozen.id).toBe("real-fixture-v1");
    expect(frozen.scales.G).toEqual({ median: 50n, mad: 5n });
    expect(frozen.scales.B).toEqual({ median: 7_000n, mad: 500n });
    expect(frozen.scales.C.mad).toBeGreaterThan(0n);
  });
});

describe("tier confidence, hysteresis, and provisional behavior", () => {
  const eligible = {
    interval: exactInterval(105n * INDEX_SCALE),
    samplingErrorMicro: 100_000n,
    sourceComplete: true,
    metricCoverageComplete: true,
    evaluationComplete: true,
    probabilityAbove120Permil: 0,
    probabilityTopDecilePermil: 0,
    probabilityBelow80Permil: 0,
    definitelyNegativeMarginalPermil: 0,
    boundaryConfidencePermil: 900,
  } as const;

  it("enforces SS and D confidence controls", () => {
    expect(
      classifyNativeTier({
        ...eligible,
        interval: integerInterval(121n * INDEX_SCALE, 125n * INDEX_SCALE, 129n * INDEX_SCALE),
        probabilityAbove120Permil: 920,
        probabilityTopDecilePermil: 810,
      }),
    ).toBe("SS");

    expect(
      classifyNativeTier({
        ...eligible,
        interval: integerInterval(72n * INDEX_SCALE, 75n * INDEX_SCALE, 78n * INDEX_SCALE),
        probabilityBelow80Permil: 800,
        definitelyNegativeMarginalPermil: 800,
      }),
    ).toBe("D");

    expect(
      classifyNativeTier({
        ...eligible,
        interval: integerInterval(72n * INDEX_SCALE, 75n * INDEX_SCALE, 78n * INDEX_SCALE),
        probabilityBelow80Permil: 790,
        definitelyNegativeMarginalPermil: 900,
      }),
    ).toBe("C");
  });

  it("keeps incomplete, wide, noisy, or unfinished searches provisional", () => {
    expect(classifyNativeTier({ ...eligible, sourceComplete: false })).toBe("Provisional");
    expect(
      classifyNativeTier({
        ...eligible,
        interval: integerInterval(99n * INDEX_SCALE, 105n * INDEX_SCALE, 110n * INDEX_SCALE + 1n),
      }),
    ).toBe("Provisional");
    expect(classifyNativeTier({ ...eligible, samplingErrorMicro: 500_001n })).toBe(
      "Provisional",
    );
    expect(classifyNativeTier({ ...eligible, evaluationComplete: false })).toBe("Provisional");
  });

  it("retains the previous tier below 80% boundary confidence", () => {
    expect(
      classifyNativeTier({
        ...eligible,
        interval: exactInterval(111n * INDEX_SCALE),
        previousTier: "A",
        boundaryConfidencePermil: 799,
      }),
    ).toBe("A");
    expect(
      classifyNativeTier({
        ...eligible,
        interval: exactInterval(111n * INDEX_SCALE),
        previousTier: "A",
        boundaryConfidencePermil: 800,
      }),
    ).toBe("S");
  });

  it("applies completeness and hysteresis to a calibrated tier candidate", () => {
    const calibrated = {
      candidateTier: "B" as const,
      interval: integerInterval(98n * INDEX_SCALE, 100n * INDEX_SCALE, 102n * INDEX_SCALE),
      samplingErrorMicro: 400_000n,
      sourceComplete: true,
      metricCoverageComplete: true,
      evaluationComplete: true,
      boundaryConfidencePermil: 799,
      previousTier: "A" as const,
    };
    expect(stabilizeNativeTier(calibrated)).toBe("A");
    expect(stabilizeNativeTier({ ...calibrated, boundaryConfidencePermil: 800 })).toBe("B");
    expect(stabilizeNativeTier({ ...calibrated, sourceComplete: false })).toBe("Provisional");
  });
});

describe("exact changelog attribution", () => {
  it("requires integer parts to sum exactly to the displayed delta", () => {
    expect(
      attributeNativeIndexDelta(4_200_000n, [
        { reason: "new-synergy", deltaMicro: 2_700_000n },
        { reason: "chart-meta", deltaMicro: 1_500_000n },
      ]),
    ).toEqual({
      totalDeltaMicro: 4_200_000n,
      parts: [
        { reason: "new-synergy", deltaMicro: 2_700_000n },
        { reason: "chart-meta", deltaMicro: 1_500_000n },
      ],
    });

    expect(() =>
      attributeNativeIndexDelta(4_200_000n, [
        { reason: "new-synergy", deltaMicro: 2_600_000n },
        { reason: "chart-meta", deltaMicro: 1_500_000n },
      ]),
    ).toThrow(/sum exactly/i);
  });
});
