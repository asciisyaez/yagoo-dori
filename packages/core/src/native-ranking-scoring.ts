import {
  areaUnderInvestmentCurve,
  integerInterval,
  type IntegerInterval,
  type NativeCardMetrics,
} from "./native-metrics";
import { type NativeBenchmarkSegment } from "./native-ranking-benchmark";
import { type NativeLens } from "./native-ranking-schema";
import {
  divideUtilityIntervals,
  type UtilityInterval,
} from "./native-utility";

export const NATIVE_MATCHED_RATIO_SCALE = 1_000_000;
const NATIVE_LENSES = [
  "low-investment",
  "one-copy-maximum",
  "duplicate-enabled-ceiling",
] as const satisfies readonly NativeLens[];

export type NativeMatchedBenchmarkSegment = NativeBenchmarkSegment;

export type NativeMatchedComparisonSample = Readonly<{
  contextId: string;
  chartKey: string;
  segment: NativeMatchedBenchmarkSegment;
  formationSlot: number;
  candidate: UtilityInterval;
  alternatives: readonly UtilityInterval[];
}>;

export type NativePreparedComparisonSample = Readonly<{
  contextId: string;
  chartKey: string;
  segment: NativeMatchedBenchmarkSegment;
  formationSlot: number;
  alternativeCount: number;
  marginal: IntegerInterval;
  candidate: IntegerInterval;
  bestInMatchedSet: IntegerInterval;
}>;

export type NativeLensSamples = Readonly<Record<NativeLens, readonly NativePreparedComparisonSample[]>>;

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Native matched scoring requires a positive denominator");
  if (numerator < 0n) return -roundDivide(-numerator, denominator);
  return (numerator + denominator / 2n) / denominator;
}

function floorDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Native matched scoring requires a positive denominator");
  const quotient = numerator / denominator;
  return numerator % denominator < 0n ? quotient - 1n : quotient;
}

function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Native matched scoring requires a positive denominator");
  const quotient = numerator / denominator;
  return numerator % denominator > 0n ? quotient + 1n : quotient;
}

function meanCoordinate(
  values: readonly UtilityInterval[],
  coordinate: keyof UtilityInterval,
): number {
  return values.reduce((total, value) => total + value[coordinate], 0) / values.length;
}

function meanUtilityInterval(values: readonly UtilityInterval[]): UtilityInterval {
  if (values.length === 0) throw new Error("A matched comparison requires at least one alternative");
  return {
    lower: meanCoordinate(values, "lower"),
    central: meanCoordinate(values, "central"),
    upper: meanCoordinate(values, "upper"),
  };
}

function maximumUtilityInterval(values: readonly UtilityInterval[]): UtilityInterval {
  if (values.length === 0) throw new Error("A matched comparison requires at least one utility");
  return {
    lower: Math.max(...values.map((value) => value.lower)),
    central: Math.max(...values.map((value) => value.central)),
    upper: Math.max(...values.map((value) => value.upper)),
  };
}

function utilityToInteger(value: UtilityInterval): IntegerInterval {
  return integerInterval(
    BigInt(Math.round(value.lower * NATIVE_MATCHED_RATIO_SCALE)),
    BigInt(Math.round(value.central * NATIVE_MATCHED_RATIO_SCALE)),
    BigInt(Math.round(value.upper * NATIVE_MATCHED_RATIO_SCALE)),
  );
}

/**
 * Compare one card or Leader/Outfit against the complete frozen alternative
 * cohort inside the same chart, team core, Leader, and formation slot.
 *
 * The returned marginal is a relative substitution value. It is deliberately
 * not called Shapley: no coalition game is inferred from unavailable runtime
 * behavior. Interactions are observed by repeating the matched substitution
 * across balanced partner contexts.
 */
export function prepareNativeMatchedComparison(
  sample: NativeMatchedComparisonSample,
): NativePreparedComparisonSample {
  if (sample.contextId.trim().length === 0 || sample.chartKey.trim().length === 0) {
    throw new Error("Matched comparison IDs must be nonempty");
  }
  if (!Number.isInteger(sample.formationSlot) || sample.formationSlot < 0 || sample.formationSlot > 4) {
    throw new Error("Matched formationSlot must be an integer from 0 to 4");
  }
  const reference = meanUtilityInterval(sample.alternatives);
  const best = maximumUtilityInterval([sample.candidate, ...sample.alternatives]);
  if (best.lower <= 0) throw new Error("Matched utility denominators must be strictly positive");
  const numerator: UtilityInterval = {
    lower: sample.candidate.lower - reference.upper,
    central: sample.candidate.central - reference.central,
    upper: sample.candidate.upper - reference.lower,
  };
  const ratio = divideUtilityIntervals(numerator, best);
  return {
    contextId: sample.contextId,
    chartKey: sample.chartKey,
    segment: sample.segment,
    formationSlot: sample.formationSlot,
    alternativeCount: sample.alternatives.length,
    marginal: integerInterval(
      BigInt(Math.round(ratio.lower * NATIVE_MATCHED_RATIO_SCALE)),
      BigInt(Math.round(ratio.central * NATIVE_MATCHED_RATIO_SCALE)),
      BigInt(Math.round(ratio.upper * NATIVE_MATCHED_RATIO_SCALE)),
    ),
    candidate: utilityToInteger(sample.candidate),
    bestInMatchedSet: utilityToInteger(best),
  };
}

function meanInterval(values: readonly IntegerInterval[]): IntegerInterval {
  if (values.length === 0) throw new Error("Native metrics require at least one sample");
  const count = BigInt(values.length);
  return integerInterval(
    floorDivide(values.reduce((total, value) => total + value.lower, 0n), count),
    roundDivide(values.reduce((total, value) => total + value.central, 0n), count),
    ceilDivide(values.reduce((total, value) => total + value.upper, 0n), count),
  );
}

function topCoordinateMean(
  values: readonly IntegerInterval[],
  coordinate: keyof IntegerInterval,
  count: number,
  rounding: "floor" | "nearest" | "ceil",
): bigint {
  const total = [...values]
    .sort((left, right) =>
      left[coordinate] > right[coordinate]
        ? -1
        : left[coordinate] < right[coordinate]
          ? 1
          : 0,
    )
    .slice(0, count)
    .reduce((sum, value) => sum + value[coordinate], 0n);
  if (rounding === "floor") return floorDivide(total, BigInt(count));
  if (rounding === "ceil") return ceilDivide(total, BigInt(count));
  return roundDivide(total, BigInt(count));
}

function topTenPercentMeanInterval(values: readonly IntegerInterval[]): IntegerInterval {
  if (values.length < 10) {
    throw new Error("Synergy ceiling P requires at least ten matched samples");
  }
  const count = Math.ceil(values.length / 10);
  return integerInterval(
    topCoordinateMean(values, "lower", count, "floor"),
    topCoordinateMean(values, "central", count, "nearest"),
    topCoordinateMean(values, "upper", count, "ceil"),
  );
}

function breadthInterval(samples: readonly NativePreparedComparisonSample[]): IntegerInterval {
  const definite = samples.filter(
    (sample) => sample.candidate.lower * 1_000n >= sample.bestInMatchedSet.upper * 950n,
  ).length;
  const point = samples.filter(
    (sample) => sample.candidate.central * 1_000n >= sample.bestInMatchedSet.central * 950n,
  ).length;
  const possible = samples.filter(
    (sample) => sample.candidate.upper * 1_000n >= sample.bestInMatchedSet.lower * 950n,
  ).length;
  const total = BigInt(samples.length);
  return integerInterval(
    floorDivide(BigInt(definite) * 10_000n, total),
    roundDivide(BigInt(point) * 10_000n, total),
    ceilDivide(BigInt(possible) * 10_000n, total),
  );
}

function aggregatePreparedMetrics(
  samples: readonly NativePreparedComparisonSample[],
): Omit<NativeCardMetrics, "E"> {
  const marginals = samples.map((sample) => sample.marginal);
  return {
    G: meanInterval(marginals),
    P: topTenPercentMeanInterval(marginals),
    B: breadthInterval(samples),
  };
}

export function aggregateNativeMatchedPointMetrics(
  samples: readonly NativePreparedComparisonSample[],
): Omit<NativeCardMetrics, "E"> {
  const ids = new Set(samples.map((sample) => sample.contextId));
  if (ids.size !== samples.length) throw new Error("Matched context IDs must be unique");
  return aggregatePreparedMetrics(samples);
}

export function completeNativeMatchedMetrics(
  samplesByLens: NativeLensSamples,
): Readonly<Record<NativeLens, NativeCardMetrics>> {
  const sampleIds = samplesByLens["low-investment"]
    .map((sample) => sample.contextId)
    .join("\0");
  for (const lens of NATIVE_LENSES.slice(1)) {
    if (samplesByLens[lens].map((sample) => sample.contextId).join("\0") !== sampleIds) {
      throw new Error("Every investment lens must use the same ordered matched contexts");
    }
  }
  const partial = Object.fromEntries(
    NATIVE_LENSES.map((lens) => [lens, aggregateNativeMatchedPointMetrics(samplesByLens[lens])]),
  ) as Record<NativeLens, Omit<NativeCardMetrics, "E">>;
  const investment = areaUnderInvestmentCurve(
    NATIVE_LENSES.map((lens, index) => ({
      positionPermil: index * 500,
      contribution: partial[lens].G,
    })),
  );
  return {
    "low-investment": { ...partial["low-investment"], E: investment },
    "one-copy-maximum": { ...partial["one-copy-maximum"], E: investment },
    "duplicate-enabled-ceiling": {
      ...partial["duplicate-enabled-ceiling"],
      E: investment,
    },
  };
}

function aggregateNativeMatchedIndexedMetrics(
  samples: readonly NativePreparedComparisonSample[],
  indexes: readonly number[],
): Omit<NativeCardMetrics, "E"> {
  if (indexes.length < 10) throw new Error("Indexed native metrics require at least ten samples");
  const selected = indexes.map((index) => {
    const sample = samples[index];
    if (!sample) throw new Error(`Bootstrap sample index ${index} is out of range`);
    return sample;
  });
  return aggregatePreparedMetrics(selected);
}

export function completeNativeMatchedMetricsForIndexes(
  samplesByLens: NativeLensSamples,
  indexes: readonly number[],
): Readonly<Record<NativeLens, NativeCardMetrics>> {
  const partial = {
    "low-investment": aggregateNativeMatchedIndexedMetrics(
      samplesByLens["low-investment"],
      indexes,
    ),
    "one-copy-maximum": aggregateNativeMatchedIndexedMetrics(
      samplesByLens["one-copy-maximum"],
      indexes,
    ),
    "duplicate-enabled-ceiling": aggregateNativeMatchedIndexedMetrics(
      samplesByLens["duplicate-enabled-ceiling"],
      indexes,
    ),
  };
  const investment = areaUnderInvestmentCurve(
    NATIVE_LENSES.map((lens, index) => ({
      positionPermil: index * 500,
      contribution: partial[lens].G,
    })),
  );
  return {
    "low-investment": { ...partial["low-investment"], E: investment },
    "one-copy-maximum": { ...partial["one-copy-maximum"], E: investment },
    "duplicate-enabled-ceiling": {
      ...partial["duplicate-enabled-ceiling"],
      E: investment,
    },
  };
}

export function resampleNativeLensSamples(
  samplesByLens: NativeLensSamples,
  indexes: readonly number[],
): NativeLensSamples {
  if (indexes.length === 0) throw new Error("Bootstrap resampling requires at least one index");
  const resample = (lens: NativeLens) => {
    const source = samplesByLens[lens];
    return indexes.map((sourceIndex, outputIndex) => {
      const sample = source[sourceIndex];
      if (!sample) throw new Error(`Bootstrap sample index ${sourceIndex} is out of range`);
          return { ...sample, contextId: `${sample.contextId}@bootstrap-${outputIndex}` };
    });
  };
  return {
    "low-investment": resample("low-investment"),
    "one-copy-maximum": resample("one-copy-maximum"),
    "duplicate-enabled-ceiling": resample("duplicate-enabled-ceiling"),
  };
}

export function nativeBootstrapIndexes(
  sampleCount: number,
  seed: number,
): number[] {
  if (!Number.isSafeInteger(sampleCount) || sampleCount <= 0) {
    throw new Error("Bootstrap sample count must be a positive safe integer");
  }
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  };
  return Array.from({ length: sampleCount }, () => next() % sampleCount);
}

export function nativePairedBootstrapSampleIndexes(
  masterContextIds: readonly string[],
  availableContextIds: readonly string[],
  seed: number,
): number[] {
  if (
    new Set(masterContextIds).size !== masterContextIds.length ||
    new Set(availableContextIds).size !== availableContextIds.length
  ) {
    throw new Error("Paired bootstrap context IDs must be unique");
  }
  const availableIndexById = new Map(
    availableContextIds.map((contextId, index) => [contextId, index]),
  );
  return nativeBootstrapIndexes(masterContextIds.length, seed).flatMap((masterIndex) => {
    const sampleIndex = availableIndexById.get(masterContextIds[masterIndex]!);
    return sampleIndex === undefined ? [] : [sampleIndex];
  });
}

export function stableNativeSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
