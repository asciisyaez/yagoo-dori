export const INDEX_SCALE = 1_000_000n;
const ROBUST_NORMALIZATION_NUMERATOR = 14_826n;
const ROBUST_NORMALIZATION_DENOMINATOR = 10_000n;
const Z_SCALE = 1_000_000n;
const COMPOSITE_WEIGHT_TOTAL = 10_000n;

export type IntegerInterval = Readonly<{
  lower: bigint;
  central: bigint;
  upper: bigint;
}>;

export type RobustScale = Readonly<{
  median: bigint;
  mad: bigint;
}>;

export type NativeCardMetrics = Readonly<{
  G: IntegerInterval;
  P: IntegerInterval;
  B: IntegerInterval;
  E: IntegerInterval;
}>;

export type FrozenNativeBaseline = Readonly<{
  id: string;
  scales: Readonly<{
    G: RobustScale;
    P: RobustScale;
    B: RobustScale;
    E: RobustScale;
    C: RobustScale;
  }>;
}>;

export type MatchedContextMetric = Readonly<{
  contextId: string;
  weight: bigint;
  marginal: IntegerInterval;
  anchoredOptimum: IntegerInterval;
  globalOptimum: IntegerInterval;
}>;

export type InvestmentContributionPoint = Readonly<{
  positionPermil: number;
  contribution: IntegerInterval;
}>;

export type NativeBaselineApplication = Readonly<{
  standardized: Readonly<{
    G: IntegerInterval;
    P: IntegerInterval;
    B: IntegerInterval;
    E: IntegerInterval;
  }>;
  composite: IntegerInterval;
  standardizedComposite: IntegerInterval;
  index: IntegerInterval;
}>;

export type NativeTier = "SS" | "S" | "A" | "B" | "C" | "D" | "Provisional";
type StableNativeTier = Exclude<NativeTier, "Provisional">;

export type NativeTierInput = Readonly<{
  interval: IntegerInterval;
  samplingErrorMicro: bigint;
  sourceComplete: boolean;
  metricCoverageComplete: boolean;
  evaluationComplete: boolean;
  probabilityAbove120Permil: number;
  probabilityTopDecilePermil: number;
  probabilityBelow80Permil: number;
  definitelyNegativeMarginalPermil: number;
  boundaryConfidencePermil: number;
  previousTier?: NativeTier;
}>;

export type NativeDeltaReason =
  | "direct-change"
  | "new-synergy"
  | "chart-meta"
  | "new-evidence"
  | "methodology-correction";

export type NativeDeltaPart = Readonly<{
  reason: NativeDeltaReason;
  deltaMicro: bigint;
}>;

function floorDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Division requires a positive denominator");
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder < 0n ? quotient - 1n : quotient;
}

function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Division requires a positive denominator");
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder > 0n ? quotient + 1n : quotient;
}

function roundDivideNearest(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Division requires a positive denominator");
  if (numerator < 0n) {
    return -roundDivideNearest(-numerator, denominator);
  }
  return (numerator + denominator / 2n) / denominator;
}

export function integerInterval(
  lower: bigint,
  central: bigint,
  upper: bigint,
): IntegerInterval {
  if (lower > central || central > upper) {
    throw new Error("An integer interval must satisfy lower <= central <= upper");
  }
  return { lower, central, upper };
}

export function exactInterval(value: bigint): IntegerInterval {
  return integerInterval(value, value, value);
}

export function addIntegerIntervals(
  left: IntegerInterval,
  right: IntegerInterval,
): IntegerInterval {
  return integerInterval(
    left.lower + right.lower,
    left.central + right.central,
    left.upper + right.upper,
  );
}

export function subtractIntegerIntervals(
  left: IntegerInterval,
  right: IntegerInterval,
): IntegerInterval {
  return integerInterval(
    left.lower - right.upper,
    left.central - right.central,
    left.upper - right.lower,
  );
}

export function scaleIntegerInterval(
  value: IntegerInterval,
  numerator: bigint,
  denominator: bigint,
): IntegerInterval {
  if (numerator < 0n) throw new Error("Interval scaling requires a nonnegative numerator");
  return integerInterval(
    floorDivide(value.lower * numerator, denominator),
    roundDivideNearest(value.central * numerator, denominator),
    ceilDivide(value.upper * numerator, denominator),
  );
}

export function matchedLegalReplacementMarginal(
  selectedFormation: IntegerInterval,
  legalReplacements: readonly IntegerInterval[],
): IntegerInterval {
  if (legalReplacements.length === 0) {
    throw new Error("A matched marginal requires at least one legal replacement");
  }
  const strongestReplacement = integerInterval(
    legalReplacements.reduce(
      (maximum, replacement) =>
        replacement.lower > maximum ? replacement.lower : maximum,
      legalReplacements[0]!.lower,
    ),
    legalReplacements.reduce(
      (maximum, replacement) =>
        replacement.central > maximum ? replacement.central : maximum,
      legalReplacements[0]!.central,
    ),
    legalReplacements.reduce(
      (maximum, replacement) =>
        replacement.upper > maximum ? replacement.upper : maximum,
      legalReplacements[0]!.upper,
    ),
  );
  return subtractIntegerIntervals(selectedFormation, strongestReplacement);
}

type WeightedInterval = Readonly<{ interval: IntegerInterval; weight: bigint }>;

function validateWeightedIntervals(samples: readonly WeightedInterval[]): bigint {
  if (samples.length === 0) throw new Error("At least one weighted interval is required");
  let totalWeight = 0n;
  for (const sample of samples) {
    if (sample.weight <= 0n) throw new Error("Metric weights must be positive integers");
    totalWeight += sample.weight;
  }
  return totalWeight;
}

function weightedMeanInterval(samples: readonly WeightedInterval[]): IntegerInterval {
  const totalWeight = validateWeightedIntervals(samples);
  const lower = samples.reduce(
    (sum, sample) => sum + sample.interval.lower * sample.weight,
    0n,
  );
  const central = samples.reduce(
    (sum, sample) => sum + sample.interval.central * sample.weight,
    0n,
  );
  const upper = samples.reduce(
    (sum, sample) => sum + sample.interval.upper * sample.weight,
    0n,
  );
  return integerInterval(
    floorDivide(lower, totalWeight),
    roundDivideNearest(central, totalWeight),
    ceilDivide(upper, totalWeight),
  );
}

function topWeightedCoordinateMean(
  samples: readonly WeightedInterval[],
  coordinate: keyof IntegerInterval,
  selectedWeight: bigint,
  rounding: "floor" | "nearest" | "ceil",
): bigint {
  const ordered = samples
    .map((sample, index) => ({ ...sample, index }))
    .sort((left, right) => {
      const leftValue = left.interval[coordinate];
      const rightValue = right.interval[coordinate];
      if (leftValue !== rightValue) return leftValue > rightValue ? -1 : 1;
      return left.index - right.index;
    });
  let remaining = selectedWeight;
  let sum = 0n;
  for (const sample of ordered) {
    if (remaining === 0n) break;
    const usedWeight = sample.weight < remaining ? sample.weight : remaining;
    sum += sample.interval[coordinate] * usedWeight;
    remaining -= usedWeight;
  }
  if (rounding === "floor") return floorDivide(sum, selectedWeight);
  if (rounding === "ceil") return ceilDivide(sum, selectedWeight);
  return roundDivideNearest(sum, selectedWeight);
}

function topFractionWeightedMean(
  samples: readonly WeightedInterval[],
  numerator: bigint,
  denominator: bigint,
): IntegerInterval {
  const totalWeight = validateWeightedIntervals(samples);
  if (numerator <= 0n || numerator > denominator) {
    throw new Error("Top fraction must be greater than zero and at most one");
  }
  const selectedWeight = ceilDivide(totalWeight * numerator, denominator);
  return integerInterval(
    topWeightedCoordinateMean(samples, "lower", selectedWeight, "floor"),
    topWeightedCoordinateMean(samples, "central", selectedWeight, "nearest"),
    topWeightedCoordinateMean(samples, "upper", selectedWeight, "ceil"),
  );
}

function calculateBreadth(contexts: readonly MatchedContextMetric[]): IntegerInterval {
  if (contexts.length === 0) throw new Error("Breadth requires at least one context");
  const totalWeight = contexts.reduce((sum, context) => {
    if (context.weight <= 0n) throw new Error("Metric weights must be positive integers");
    return sum + context.weight;
  }, 0n);
  let definiteWeight = 0n;
  let pointWeight = 0n;
  let possibleWeight = 0n;
  for (const context of contexts) {
    if (context.anchoredOptimum.lower * 1_000n >= context.globalOptimum.upper * 950n) {
      definiteWeight += context.weight;
    }
    if (
      context.anchoredOptimum.central * 1_000n >=
      context.globalOptimum.central * 950n
    ) {
      pointWeight += context.weight;
    }
    if (context.anchoredOptimum.upper * 1_000n >= context.globalOptimum.lower * 950n) {
      possibleWeight += context.weight;
    }
  }
  return integerInterval(
    floorDivide(definiteWeight * 10_000n, totalWeight),
    roundDivideNearest(pointWeight * 10_000n, totalWeight),
    ceilDivide(possibleWeight * 10_000n, totalWeight),
  );
}

export function areaUnderInvestmentCurve(
  points: readonly InvestmentContributionPoint[],
): IntegerInterval {
  if (points.length < 2) throw new Error("Investment AUC requires at least two points");
  const ordered = [...points].sort((left, right) => left.positionPermil - right.positionPermil);
  for (const [index, point] of ordered.entries()) {
    if (!Number.isInteger(point.positionPermil) || point.positionPermil < 0) {
      throw new Error("Investment positions must be nonnegative integer permil values");
    }
    if (index > 0 && point.positionPermil === ordered[index - 1]!.positionPermil) {
      throw new Error("Investment positions must be unique");
    }
  }
  const range = BigInt(ordered.at(-1)!.positionPermil - ordered[0]!.positionPermil);
  if (range <= 0n) throw new Error("Investment positions must span a positive range");

  let lowerArea = 0n;
  let pointArea = 0n;
  let upperArea = 0n;
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const left = ordered[index]!;
    const right = ordered[index + 1]!;
    const width = BigInt(right.positionPermil - left.positionPermil);
    lowerArea += (left.contribution.lower + right.contribution.lower) * width;
    pointArea += (left.contribution.central + right.contribution.central) * width;
    upperArea += (left.contribution.upper + right.contribution.upper) * width;
  }
  const denominator = 2n * range;
  return integerInterval(
    floorDivide(lowerArea, denominator),
    roundDivideNearest(pointArea, denominator),
    ceilDivide(upperArea, denominator),
  );
}

export function aggregateNativeCardMetrics(
  contexts: readonly MatchedContextMetric[],
  investmentCurve: readonly InvestmentContributionPoint[],
): NativeCardMetrics {
  const ids = new Set<string>();
  for (const context of contexts) {
    if (context.contextId.length === 0 || ids.has(context.contextId)) {
      throw new Error("Matched context IDs must be nonempty and unique");
    }
    ids.add(context.contextId);
  }
  const marginals = contexts.map((context) => ({
    interval: context.marginal,
    weight: context.weight,
  }));
  return {
    G: weightedMeanInterval(marginals),
    P: topFractionWeightedMean(marginals, 1n, 10n),
    B: calculateBreadth(contexts),
    E: areaUnderInvestmentCurve(investmentCurve),
  };
}

function median(values: readonly bigint[]): bigint {
  if (values.length === 0) throw new Error("Median requires at least one value");
  const ordered = [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]!
    : roundDivideNearest(ordered[middle - 1]! + ordered[middle]!, 2n);
}

export function deriveRobustScale(values: readonly bigint[]): RobustScale {
  const center = median(values);
  const deviations = values.map((value) => (value >= center ? value - center : center - value));
  const rawMad = median(deviations);
  // Discrete metrics such as breadth can legitimately have a zero MAD when at
  // least half the roster shares one value. Preserve robust centering and use
  // the smallest observed non-zero deviation; a completely constant metric
  // receives unit scale and therefore contributes zero for every roster row.
  const mad = rawMad > 0n
    ? rawMad
    : deviations
        .filter((value) => value > 0n)
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))[0] ?? 1n;
  return { median: center, mad };
}

function robustZInterval(value: IntegerInterval, scale: RobustScale): IntegerInterval {
  if (scale.mad <= 0n) throw new Error("A frozen robust scale requires a positive MAD");
  const denominator = scale.mad * ROBUST_NORMALIZATION_NUMERATOR;
  const factor = Z_SCALE * ROBUST_NORMALIZATION_DENOMINATOR;
  return integerInterval(
    floorDivide((value.lower - scale.median) * factor, denominator),
    roundDivideNearest((value.central - scale.median) * factor, denominator),
    ceilDivide((value.upper - scale.median) * factor, denominator),
  );
}

function compositeInterval(standardized: NativeCardMetrics): IntegerInterval {
  const weighted = [
    scaleIntegerInterval(standardized.G, 5_500n, COMPOSITE_WEIGHT_TOTAL),
    scaleIntegerInterval(standardized.P, 2_500n, COMPOSITE_WEIGHT_TOTAL),
    scaleIntegerInterval(standardized.B, 1_000n, COMPOSITE_WEIGHT_TOTAL),
    scaleIntegerInterval(standardized.E, 1_000n, COMPOSITE_WEIGHT_TOTAL),
  ];
  return weighted.reduce(addIntegerIntervals, exactInterval(0n));
}

function standardizeMetrics(
  metrics: NativeCardMetrics,
  scales: Pick<FrozenNativeBaseline["scales"], "G" | "P" | "B" | "E">,
): NativeCardMetrics {
  return {
    G: robustZInterval(metrics.G, scales.G),
    P: robustZInterval(metrics.P, scales.P),
    B: robustZInterval(metrics.B, scales.B),
    E: robustZInterval(metrics.E, scales.E),
  };
}

export function applyFrozenNativeBaseline(
  metrics: NativeCardMetrics,
  baseline: FrozenNativeBaseline,
): NativeBaselineApplication {
  const standardized = standardizeMetrics(metrics, baseline.scales);
  const composite = compositeInterval(standardized);
  const standardizedComposite = robustZInterval(composite, baseline.scales.C);
  const index = integerInterval(
    100n * INDEX_SCALE + 10n * standardizedComposite.lower,
    100n * INDEX_SCALE + 10n * standardizedComposite.central,
    100n * INDEX_SCALE + 10n * standardizedComposite.upper,
  );
  return { standardized, composite, standardizedComposite, index };
}

export function buildFrozenNativeBaseline(
  id: string,
  rows: readonly Readonly<{ cardId: string; metrics: NativeCardMetrics }>[],
): FrozenNativeBaseline {
  if (id.trim().length === 0) throw new Error("A frozen baseline requires an ID");
  if (rows.length < 3) throw new Error("A frozen baseline requires at least three card rows");
  const cardIds = new Set(rows.map((row) => row.cardId));
  if (cardIds.size !== rows.length || [...cardIds].some((cardId) => cardId.length === 0)) {
    throw new Error("Frozen baseline card IDs must be nonempty and unique");
  }
  const primaryScales = {
    G: deriveRobustScale(rows.map((row) => row.metrics.G.central)),
    P: deriveRobustScale(rows.map((row) => row.metrics.P.central)),
    B: deriveRobustScale(rows.map((row) => row.metrics.B.central)),
    E: deriveRobustScale(rows.map((row) => row.metrics.E.central)),
  };
  const composites = rows.map((row) =>
    compositeInterval(standardizeMetrics(row.metrics, primaryScales)).central,
  );
  return {
    id,
    scales: {
      ...primaryScales,
      C: deriveRobustScale(composites),
    },
  };
}

function validatePermil(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 1_000) {
    throw new Error(`${label} must be an integer from 0 to 1000`);
  }
}

function candidateTier(central: bigint, input: NativeTierInput): StableNativeTier {
  if (central >= 120n * INDEX_SCALE) {
    return input.probabilityAbove120Permil >= 900 &&
      input.probabilityTopDecilePermil >= 800
      ? "SS"
      : "S";
  }
  if (central >= 110n * INDEX_SCALE) return "S";
  if (central >= 100n * INDEX_SCALE) return "A";
  if (central >= 90n * INDEX_SCALE) return "B";
  if (central >= 80n * INDEX_SCALE) return "C";
  return input.probabilityBelow80Permil >= 800 &&
    input.definitelyNegativeMarginalPermil >= 800
    ? "D"
    : "C";
}

export function classifyNativeTier(input: NativeTierInput): NativeTier {
  validatePermil(input.probabilityAbove120Permil, "Probability above 120");
  validatePermil(input.probabilityTopDecilePermil, "Top-decile probability");
  validatePermil(input.probabilityBelow80Permil, "Probability below 80");
  validatePermil(input.definitelyNegativeMarginalPermil, "Negative marginal fraction");
  validatePermil(input.boundaryConfidencePermil, "Boundary confidence");
  if (input.samplingErrorMicro < 0n) throw new Error("Sampling error cannot be negative");

  if (
    !input.sourceComplete ||
    !input.metricCoverageComplete ||
    !input.evaluationComplete ||
    input.interval.upper - input.interval.lower > 10n * INDEX_SCALE ||
    input.samplingErrorMicro > INDEX_SCALE / 2n
  ) {
    return "Provisional";
  }

  const candidate = candidateTier(input.interval.central, input);
  if (
    input.previousTier &&
    input.previousTier !== "Provisional" &&
    input.previousTier !== candidate &&
    input.boundaryConfidencePermil < 800
  ) {
    return input.previousTier;
  }
  return candidate;
}

export function attributeNativeIndexDelta(
  totalDeltaMicro: bigint,
  parts: readonly NativeDeltaPart[],
): Readonly<{ totalDeltaMicro: bigint; parts: NativeDeltaPart[] }> {
  const attributed = parts.reduce((sum, part) => sum + part.deltaMicro, 0n);
  if (attributed !== totalDeltaMicro) {
    throw new Error(
      `Attributed integer deltas must sum exactly to the displayed delta (${attributed} != ${totalDeltaMicro})`,
    );
  }
  return { totalDeltaMicro, parts: [...parts] };
}
