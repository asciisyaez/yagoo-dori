import { describe, expect, it } from "vitest";

import { applyFrozenNativeBaseline, type FrozenNativeBaseline } from "./native-metrics";
import {
  aggregateNativeMatchedPointMetrics,
  completeNativeMatchedMetrics,
  completeNativeMatchedMetricsForIndexes,
  nativeBootstrapIndexes,
  nativePairedBootstrapSampleIndexes,
  prepareNativeMatchedComparison,
  resampleNativeLensSamples,
  stableNativeSeed,
  type NativePreparedComparisonSample,
} from "./native-ranking-scoring";

function prepared(index: number, marginal: number, withinFive = true): NativePreparedComparisonSample {
  const best = 1_000_000_000n;
  return {
    contextId: `context-${index}`,
    chartKey: `m${String(index).padStart(4, "0")}:expert`,
    segment: index < 7 ? "reference" : "current",
    formationSlot: index % 5,
    alternativeCount: 10,
    marginal: { lower: BigInt(marginal), central: BigInt(marginal), upper: BigInt(marginal) },
    candidate: {
      lower: withinFive ? 960_000_000n : 900_000_000n,
      central: withinFive ? 960_000_000n : 900_000_000n,
      upper: withinFive ? 960_000_000n : 900_000_000n,
    },
    bestInMatchedSet: { lower: best, central: best, upper: best },
  };
}

describe("native matched ranking scoring", () => {
  it("computes a sign-aware relative substitution interval against the full matched mean", () => {
    const result = prepareNativeMatchedComparison({
      contextId: "fixture",
      chartKey: "m0001:expert",
      segment: "reference",
      formationSlot: 2,
      candidate: { lower: 90, central: 110, upper: 130 },
      alternatives: [
        { lower: 100, central: 100, upper: 100 },
        { lower: 120, central: 120, upper: 120 },
      ],
    });

    expect(result.marginal.central).toBe(0n);
    expect(result.marginal.lower).toBeLessThan(0n);
    expect(result.marginal.upper).toBeGreaterThan(0n);
    expect(result.bestInMatchedSet.central).toBe(120_000_000n);
  });

  it("uses at least ten samples so P is a top-decile mean rather than one maximum", () => {
    const samples = Array.from({ length: 20 }, (_, index) => prepared(index, index * 100));
    const metrics = aggregateNativeMatchedPointMetrics(samples);
    expect(metrics.G.central).toBe(950n);
    expect(metrics.P.central).toBe(1_850n);
    expect(metrics.B.central).toBe(10_000n);
  });

  it("preserves unresolved model bounds through G, P, B, E, and the normalized index", () => {
    const exact = Array.from({ length: 20 }, (_, index) => prepared(index, 1_000 + index));
    const widened = exact.map((sample) => ({
      ...sample,
      marginal: {
        lower: sample.marginal.central - 500n,
        central: sample.marginal.central,
        upper: sample.marginal.central + 500n,
      },
      candidate: {
        lower: 900_000_000n,
        central: 960_000_000n,
        upper: 1_020_000_000n,
      },
    }));
    const samples = {
      "low-investment": widened,
      "one-copy-maximum": widened,
      "duplicate-enabled-ceiling": widened,
    } as const;
    const metrics = completeNativeMatchedMetrics(samples)["one-copy-maximum"];

    expect(metrics.G.lower).toBeLessThan(metrics.G.central);
    expect(metrics.G.upper).toBeGreaterThan(metrics.G.central);
    expect(metrics.P.lower).toBeLessThan(metrics.P.central);
    expect(metrics.P.upper).toBeGreaterThan(metrics.P.central);
    expect(metrics.B).toEqual({ lower: 0n, central: 10_000n, upper: 10_000n });
    expect(metrics.E.lower).toBeLessThan(metrics.E.central);
    expect(metrics.E.upper).toBeGreaterThan(metrics.E.central);

    const baseline: FrozenNativeBaseline = {
      id: "interval-fixture",
      scales: {
        G: { median: 1_000n, mad: 100n },
        P: { median: 1_000n, mad: 100n },
        B: { median: 5_000n, mad: 1_000n },
        E: { median: 1_000n, mad: 100n },
        C: { median: 0n, mad: 100_000n },
      },
    };
    const index = applyFrozenNativeBaseline(metrics, baseline).index;
    expect(index.lower).toBeLessThan(index.central);
    expect(index.upper).toBeGreaterThan(index.central);
  });

  it("computes one investment AUC from the same ordered contexts in all three lenses", () => {
    const base = Array.from({ length: 10 }, (_, index) => prepared(index, 1_000 + index));
    const samples = {
      "low-investment": base,
      "one-copy-maximum": base.map((sample) => ({
        ...sample,
        marginal: { lower: 2_000n, central: 2_000n, upper: 2_000n },
      })),
      "duplicate-enabled-ceiling": base.map((sample) => ({
        ...sample,
        marginal: { lower: 3_000n, central: 3_000n, upper: 3_000n },
      })),
    } as const;
    const metrics = completeNativeMatchedMetrics(samples);
    expect(metrics["low-investment"].E.central).toBe(2_001n);
    expect(metrics["one-copy-maximum"].E).toEqual(metrics["low-investment"].E);
    expect(metrics["duplicate-enabled-ceiling"].E).toEqual(metrics["low-investment"].E);
  });

  it("resamples deterministically with a stable per-entity seed", () => {
    const base = Array.from({ length: 10 }, (_, index) => prepared(index, index));
    const samples = {
      "low-investment": base,
      "one-copy-maximum": base,
      "duplicate-enabled-ceiling": base,
    } as const;
    const seed = stableNativeSeed("member|card-00013|replicate-4");
    const first = nativeBootstrapIndexes(10, seed);
    expect(nativeBootstrapIndexes(10, seed)).toEqual(first);
    expect(new Set(first).size).toBeGreaterThan(1);
    const resampled = resampleNativeLensSamples(samples, first);
    expect(resampled["low-investment"]).toHaveLength(10);
    expect(resampled["low-investment"].map((sample) => sample.contextId)).toEqual(
      resampled["one-copy-maximum"].map((sample) => sample.contextId),
    );
    expect(completeNativeMatchedMetricsForIndexes(samples, first)).toEqual(
      completeNativeMatchedMetrics(resampled),
    );
  });

  it("uses one paired context draw when entities have different legal context subsets", () => {
    const master = ["a", "b", "c", "d"];
    const available = ["a", "c", "d"];
    const seed = stableNativeSeed("member|paired-bootstrap-12");
    const masterDraw = nativeBootstrapIndexes(master.length, seed).map((index) => master[index]!);
    const paired = nativePairedBootstrapSampleIndexes(master, available, seed);

    expect(paired.map((index) => available[index]!)).toEqual(
      masterDraw.filter((contextId) => available.includes(contextId)),
    );
  });
});
