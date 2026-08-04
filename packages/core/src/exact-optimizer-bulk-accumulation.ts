/**
 * Certified bulk accumulation for the exact-optimizer research path.
 *
 * The reference recurrence is deliberately narrow and non-negotiable:
 *
 *   s(0) = a
 *   s(i + 1) = RN-even-binary64(s(i) + x)
 *
 * This module never replaces that recurrence with `a + n * x` as an answer.
 * It uses the exact dyadic value of `a + n*x` only to bound every possible
 * sequence of `n` round-to-nearest-even additions.  A caller may use the
 * fast path only when the resulting canonical image is a singleton; otherwise
 * it must replay the ordered additions for the affected component.
 */

import {
  fromCanonicalMicroUnits,
  toCanonicalMicroUnits,
  type MicroUnits,
} from "./exact-optimizer-arithmetic";

export const EXACT_OPTIMIZER_BULK_ACCUMULATION_VERSION =
  "yd-exact-optimizer-bulk-accumulation-1.0.0" as const;

export const EXACT_OPTIMIZER_BULK_FALLBACK_REASONS = [
  "canonical-boundary-overlap",
  "unsupported-nonfinite-value",
  "subnormal-assumption-not-proven",
  "interval-width-overflow",
  "contribution-mismatch",
  "unsupported-operation-path",
  "signed-zero-sensitive",
  "invalid-multiplicity",
] as const;

export type ExactOptimizerBulkFallbackReason =
  (typeof EXACT_OPTIMIZER_BULK_FALLBACK_REASONS)[number];

export type Binary64Enclosure = Readonly<{
  lower: number;
  upper: number;
}>;

export type OrderedReplayRequired = Readonly<{
  kind: "ordered-replay-required";
  fallbackReason: ExactOptimizerBulkFallbackReason;
  enclosure: Binary64Enclosure | null;
}>;

export type BulkCertifiedReferenceEquivalent = Readonly<{
  kind: "bulk-certified-reference-equivalent";
  canonicalMicroUnits: MicroUnits;
  enclosure: Binary64Enclosure;
  proof: Readonly<{
    methodologyVersion: typeof EXACT_OPTIMIZER_BULK_ACCUMULATION_VERSION;
    canonicalLowerMicroUnits: MicroUnits;
    canonicalUpperMicroUnits: MicroUnits;
  }>;
}>;

export type BulkCanonicalResult =
  | BulkCertifiedReferenceEquivalent
  | OrderedReplayRequired;

export type BulkRunEnclosure = Readonly<{
  kind: "bulk-run-enclosure";
  enclosure: Binary64Enclosure;
  proof: Readonly<{
    multiplicity: number;
    exactUpperSumExponent: number;
    perAdditionErrorUpperBound: number;
    totalRoundingErrorUpperBound: number;
  }>;
}>;

export type BulkRunResult = BulkRunEnclosure | OrderedReplayRequired;

export type BulkCanonicalInterval = Readonly<{
  kind: "bulk-certified-reference-equivalent";
  canonicalMicroUnits: Readonly<{
    lower: MicroUnits;
    central: MicroUnits;
    upper: MicroUnits;
  }>;
  value: Readonly<{
    lower: number;
    central: number;
    upper: number;
  }>;
  enclosure: Readonly<{
    lower: Binary64Enclosure;
    central: Binary64Enclosure;
    upper: Binary64Enclosure;
  }>;
}>;

const MIN_NORMAL = 2 ** -1022;
const MAX_SAFE_MULTIPLICITY = Number.MAX_SAFE_INTEGER;
const binary64Buffer = new ArrayBuffer(8);
const binary64View = new DataView(binary64Buffer);

type ExactDyadic = Readonly<{
  significand: bigint;
  exponent: number;
}>;

function bitsOf(value: number): bigint {
  binary64View.setFloat64(0, value, false);
  return binary64View.getBigUint64(0, false);
}

function normalFiniteOrPositiveZero(value: number): boolean {
  return Number.isFinite(value) && (value === 0 || Math.abs(value) >= MIN_NORMAL);
}

function isNegativeZero(value: number): boolean {
  return Object.is(value, -0);
}

function validEnclosure(enclosure: Binary64Enclosure): boolean {
  return (
    Number.isFinite(enclosure.lower) &&
    Number.isFinite(enclosure.upper) &&
    enclosure.lower <= enclosure.upper
  );
}

function fallback(
  fallbackReason: ExactOptimizerBulkFallbackReason,
  enclosure: Binary64Enclosure | null,
): OrderedReplayRequired {
  return { kind: "ordered-replay-required", fallbackReason, enclosure };
}

function dyadicFromBinary64(value: number): ExactDyadic | null {
  if (!Number.isFinite(value) || isNegativeZero(value)) return null;
  if (value === 0) return { significand: 0n, exponent: 0 };
  const bits = bitsOf(value);
  const negative = (bits >> 63n) === 1n;
  const exponentBits = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  if (exponentBits === 0) {
    return {
      significand: negative ? -fraction : fraction,
      exponent: -1074,
    };
  }
  const significand = (1n << 52n) | fraction;
  return {
    significand: negative ? -significand : significand,
    exponent: exponentBits - 1023 - 52,
  };
}

function scaleDyadicBySafeInteger(value: ExactDyadic, multiplier: number): ExactDyadic {
  return { significand: value.significand * BigInt(multiplier), exponent: value.exponent };
}

function addNonNegativeDyadics(left: ExactDyadic, right: ExactDyadic): ExactDyadic {
  const exponent = Math.min(left.exponent, right.exponent);
  return {
    significand:
      (left.significand << BigInt(left.exponent - exponent)) +
      (right.significand << BigInt(right.exponent - exponent)),
    exponent,
  };
}

function binaryExponentOfPositiveDyadic(value: ExactDyadic): number | null {
  if (value.significand <= 0n) return null;
  return value.significand.toString(2).length - 1 + value.exponent;
}

function powerOfTwo(exponent: number): number | null {
  const value = 2 ** exponent;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** The adjacent binary64 value in the positive direction. */
export function nextUp(value: number): number {
  if (Number.isNaN(value) || value === Number.POSITIVE_INFINITY) return value;
  if (value === 0) return Number.MIN_VALUE;
  binary64View.setFloat64(0, value, false);
  let bits = binary64View.getBigUint64(0, false);
  bits += value > 0 ? 1n : -1n;
  binary64View.setBigUint64(0, bits, false);
  return binary64View.getFloat64(0, false);
}

/** The adjacent binary64 value in the negative direction. */
export function nextDown(value: number): number {
  if (Number.isNaN(value) || value === Number.NEGATIVE_INFINITY) return value;
  if (value === 0) return -Number.MIN_VALUE;
  binary64View.setFloat64(0, value, false);
  let bits = binary64View.getBigUint64(0, false);
  bits += value > 0 ? -1n : 1n;
  binary64View.setBigUint64(0, bits, false);
  return binary64View.getFloat64(0, false);
}

export function pointBinary64Enclosure(value: number): Binary64Enclosure {
  return { lower: value, upper: value };
}

/** Outward enclosure of one native binary64 `+` operation. */
export function outwardBinary64Add(
  left: Binary64Enclosure,
  right: Binary64Enclosure,
): Binary64Enclosure | null {
  if (!validEnclosure(left) || !validEnclosure(right)) return null;
  const lower = nextDown(left.lower + right.lower);
  const upper = nextUp(left.upper + right.upper);
  return Number.isFinite(lower) && Number.isFinite(upper) && lower <= upper ? { lower, upper } : null;
}

/** Outward enclosure of one native binary64 `-` operation. */
export function outwardBinary64Subtract(
  left: Binary64Enclosure,
  right: Binary64Enclosure,
): Binary64Enclosure | null {
  if (!validEnclosure(left) || !validEnclosure(right)) return null;
  const lower = nextDown(left.lower - right.upper);
  const upper = nextUp(left.upper - right.lower);
  return Number.isFinite(lower) && Number.isFinite(upper) && lower <= upper ? { lower, upper } : null;
}

/** Outward enclosure of one native binary64 multiplication. */
export function outwardBinary64Multiply(
  left: Binary64Enclosure,
  right: Binary64Enclosure,
): Binary64Enclosure | null {
  if (!validEnclosure(left) || !validEnclosure(right)) return null;
  const products = [
    left.lower * right.lower,
    left.lower * right.upper,
    left.upper * right.lower,
    left.upper * right.upper,
  ];
  if (products.some((value) => !Number.isFinite(value))) return null;
  return {
    lower: nextDown(Math.min(...products)),
    upper: nextUp(Math.max(...products)),
  };
}

/** Outward enclosure of division by a known-positive native binary64 scalar. */
export function outwardBinary64DividePositive(
  source: Binary64Enclosure,
  divisor: number,
): Binary64Enclosure | null {
  if (!validEnclosure(source) || !Number.isFinite(divisor) || divisor <= 0) return null;
  const lower = nextDown(source.lower / divisor);
  const upper = nextUp(source.upper / divisor);
  return Number.isFinite(lower) && Number.isFinite(upper) && lower <= upper ? { lower, upper } : null;
}

export function outwardBinary64Min(
  left: Binary64Enclosure,
  right: Binary64Enclosure,
): Binary64Enclosure | null {
  if (!validEnclosure(left) || !validEnclosure(right)) return null;
  return {
    lower: Math.min(left.lower, right.lower),
    upper: Math.min(left.upper, right.upper),
  };
}

export function outwardBinary64Max(
  left: Binary64Enclosure,
  right: Binary64Enclosure,
): Binary64Enclosure | null {
  if (!validEnclosure(left) || !validEnclosure(right)) return null;
  return {
    lower: Math.max(left.lower, right.lower),
    upper: Math.max(left.upper, right.upper),
  };
}

/**
 * Enclose a run of source-order repeated RN-even additions without evaluating
 * each addition.  The input enclosure may be wide because an earlier run was
 * also bulk-transformed; its width is included in the resulting enclosure.
 */
export function transformRepeatedBinary64Addition(input: Readonly<{
  incoming: Binary64Enclosure;
  contribution: number;
  multiplicity: number;
  expectedContribution?: number;
}>): BulkRunResult {
  if (!validEnclosure(input.incoming) || !Number.isFinite(input.contribution)) {
    return fallback("unsupported-nonfinite-value", validEnclosure(input.incoming) ? input.incoming : null);
  }
  if (
    !Number.isSafeInteger(input.multiplicity) ||
    input.multiplicity <= 0 ||
    input.multiplicity > MAX_SAFE_MULTIPLICITY
  ) {
    return fallback("invalid-multiplicity", input.incoming);
  }
  if (
    input.expectedContribution !== undefined &&
    !Object.is(input.expectedContribution, input.contribution)
  ) {
    return fallback("contribution-mismatch", input.incoming);
  }
  if (
    isNegativeZero(input.incoming.lower) ||
    isNegativeZero(input.incoming.upper) ||
    isNegativeZero(input.contribution) ||
    (input.expectedContribution !== undefined && isNegativeZero(input.expectedContribution))
  ) {
    return fallback("signed-zero-sensitive", input.incoming);
  }
  if (
    !normalFiniteOrPositiveZero(input.incoming.lower) ||
    !normalFiniteOrPositiveZero(input.incoming.upper) ||
    !normalFiniteOrPositiveZero(input.contribution)
  ) {
    return fallback("subnormal-assumption-not-proven", input.incoming);
  }
  // The current native Active paths are non-negative.  Cancellation needs a
  // materially different proof and is deliberately replayed instead.
  if (input.incoming.lower < 0 || input.contribution < 0) {
    return fallback("unsupported-operation-path", input.incoming);
  }
  if (input.contribution === 0) {
    return {
      kind: "bulk-run-enclosure",
      enclosure: input.incoming,
      proof: {
        multiplicity: input.multiplicity,
        exactUpperSumExponent: binaryExponentOfPositiveDyadic(
          dyadicFromBinary64(input.incoming.upper)!,
        ) ?? 0,
        perAdditionErrorUpperBound: 0,
        totalRoundingErrorUpperBound: 0,
      },
    };
  }
  if (input.multiplicity === 1 && Object.is(input.incoming.lower, input.incoming.upper)) {
    const result = input.incoming.lower + input.contribution;
    if (!normalFiniteOrPositiveZero(result) || isNegativeZero(result)) {
      return fallback("subnormal-assumption-not-proven", input.incoming);
    }
    return {
      kind: "bulk-run-enclosure",
      enclosure: pointBinary64Enclosure(result),
      proof: {
        multiplicity: 1,
        exactUpperSumExponent: binaryExponentOfPositiveDyadic(
          addNonNegativeDyadics(
            dyadicFromBinary64(input.incoming.upper)!,
            dyadicFromBinary64(input.contribution)!,
          ),
        ) ?? 0,
        perAdditionErrorUpperBound: 0,
        totalRoundingErrorUpperBound: 0,
      },
    };
  }

  const upperDyadic = dyadicFromBinary64(input.incoming.upper);
  const contributionDyadic = dyadicFromBinary64(input.contribution);
  if (!upperDyadic || !contributionDyadic) {
    return fallback("unsupported-operation-path", input.incoming);
  }
  const exactUpper = addNonNegativeDyadics(
    upperDyadic,
    scaleDyadicBySafeInteger(contributionDyadic, input.multiplicity),
  );
  const exactUpperSumExponent = binaryExponentOfPositiveDyadic(exactUpper);
  if (exactUpperSumExponent === null) {
    return fallback("unsupported-operation-path", input.incoming);
  }

  // For every normal addition whose exact magnitude is below 2^(e+4), RN-even
  // incurs at most 2^(e+4-53) absolute error.  The factor-16 headroom holds
  // for every admitted n <= 2^53 by the multiplicative growth bound: each
  // rounded partial sum is at most (1 + 2^-53) times its exact counterpart,
  // so after n additions the rounded sums stay below e * 2^(e+1) < 2^(e+4).
  // An absolute-error induction alone does not close near n = 2^53.
  const additionExponentUpper = exactUpperSumExponent + 4;
  const perAdditionErrorUpperBound = powerOfTwo(additionExponentUpper - 53);
  if (
    additionExponentUpper > 1023 ||
    perAdditionErrorUpperBound === null ||
    additionExponentUpper - 53 < -1074
  ) {
    return fallback("subnormal-assumption-not-proven", input.incoming);
  }
  const totalRoundingErrorUpperBound = nextUp(
    input.multiplicity * perAdditionErrorUpperBound,
  );
  if (!Number.isFinite(totalRoundingErrorUpperBound)) {
    return fallback("interval-width-overflow", input.incoming);
  }

  const repeatedContribution = outwardBinary64Multiply(
    pointBinary64Enclosure(input.contribution),
    pointBinary64Enclosure(input.multiplicity),
  );
  if (!repeatedContribution) return fallback("interval-width-overflow", input.incoming);
  const exactSumEnclosure = outwardBinary64Add(input.incoming, repeatedContribution);
  if (!exactSumEnclosure) return fallback("interval-width-overflow", input.incoming);
  const lower = Math.max(0, nextDown(exactSumEnclosure.lower - totalRoundingErrorUpperBound));
  const upper = nextUp(exactSumEnclosure.upper + totalRoundingErrorUpperBound);
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper) {
    return fallback("interval-width-overflow", input.incoming);
  }
  return {
    kind: "bulk-run-enclosure",
    enclosure: { lower, upper },
    proof: {
      multiplicity: input.multiplicity,
      exactUpperSumExponent,
      perAdditionErrorUpperBound,
      totalRoundingErrorUpperBound,
    },
  };
}

/**
 * Determine the exact image of the repository's `Math.round(value * 1e6)`
 * contract over a monotone binary64 enclosure.  JavaScript's ties go toward
 * positive infinity, which is intentionally delegated to the existing
 * canonicalizer rather than mistaken for RN-even.
 */
export function certifyCanonicalMicroUnitEnclosure(
  enclosure: Binary64Enclosure,
): BulkCanonicalResult {
  if (!validEnclosure(enclosure)) return fallback("unsupported-nonfinite-value", null);
  if (isNegativeZero(enclosure.lower) || isNegativeZero(enclosure.upper)) {
    return fallback("signed-zero-sensitive", enclosure);
  }
  if (
    (enclosure.lower < 0 && enclosure.upper > 0) ||
    !normalFiniteOrPositiveZero(enclosure.lower) ||
    !normalFiniteOrPositiveZero(enclosure.upper)
  ) {
    return fallback(
      enclosure.lower < 0 && enclosure.upper > 0
        ? "signed-zero-sensitive"
        : "subnormal-assumption-not-proven",
      enclosure,
    );
  }
  let canonicalLowerMicroUnits: MicroUnits;
  let canonicalUpperMicroUnits: MicroUnits;
  try {
    canonicalLowerMicroUnits = toCanonicalMicroUnits(enclosure.lower);
    canonicalUpperMicroUnits = toCanonicalMicroUnits(enclosure.upper);
  } catch {
    return fallback("unsupported-nonfinite-value", enclosure);
  }
  if (canonicalLowerMicroUnits !== canonicalUpperMicroUnits) {
    return fallback("canonical-boundary-overlap", enclosure);
  }
  return {
    kind: "bulk-certified-reference-equivalent",
    canonicalMicroUnits: canonicalLowerMicroUnits,
    enclosure,
    proof: {
      methodologyVersion: EXACT_OPTIMIZER_BULK_ACCUMULATION_VERSION,
      canonicalLowerMicroUnits,
      canonicalUpperMicroUnits,
    },
  };
}

/**
 * Model the exact `interval(lower, central, upper)` clamp and three explicit
 * six-decimal JavaScript rounding boundaries used by native-utility.ts.
 */
export function certifyCanonicalUtilityInterval(input: Readonly<{
  lower: Binary64Enclosure;
  central: Binary64Enclosure;
  upper: Binary64Enclosure;
}>): BulkCanonicalInterval | OrderedReplayRequired {
  const boundedCentral = outwardBinary64Max(
    input.lower,
    outwardBinary64Min(input.central, input.upper) ?? input.central,
  );
  if (!boundedCentral) return fallback("interval-width-overflow", null);
  const outputUpper = outwardBinary64Max(input.upper, boundedCentral);
  if (!outputUpper) return fallback("interval-width-overflow", null);
  const lower = certifyCanonicalMicroUnitEnclosure(input.lower);
  if (lower.kind === "ordered-replay-required") return lower;
  const central = certifyCanonicalMicroUnitEnclosure(boundedCentral);
  if (central.kind === "ordered-replay-required") return central;
  const upper = certifyCanonicalMicroUnitEnclosure(outputUpper);
  if (upper.kind === "ordered-replay-required") return upper;
  return {
    kind: "bulk-certified-reference-equivalent",
    canonicalMicroUnits: {
      lower: lower.canonicalMicroUnits,
      central: central.canonicalMicroUnits,
      upper: upper.canonicalMicroUnits,
    },
    value: {
      lower: fromCanonicalMicroUnits(lower.canonicalMicroUnits),
      central: fromCanonicalMicroUnits(central.canonicalMicroUnits),
      upper: fromCanonicalMicroUnits(upper.canonicalMicroUnits),
    },
    enclosure: {
      lower: input.lower,
      central: boundedCentral,
      upper: outputUpper,
    },
  };
}

/** Deliberate source-order fallback, retained independently of the fast path. */
export function replayOrderedRepeatedBinary64Addition(
  incoming: number,
  contribution: number,
  multiplicity: number,
): number {
  let result = incoming;
  for (let index = 0; index < multiplicity; index += 1) result += contribution;
  return result;
}
