/**
 * Comparator-safe arithmetic for the v0.2 exact optimizer.
 *
 * The native evaluator remains the reference implementation. Its published
 * six-decimal boundary is represented here as signed integer micro-units so
 * that comparison, pruning, and tie recording never depend on a floating
 * point epsilon.
 */

export const CANONICAL_MICRO_UNITS_PER_UNIT = 1_000_000;
export const CANONICAL_ARITHMETIC_METHODOLOGY = "yd-canonical-micro-units-1.0.0" as const;

export type MicroUnits = number & { readonly __microUnits: unique symbol };

function assertSafeInteger(value: number, label: string): MicroUnits {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} is outside the safe integer range: ${value}`);
  }
  return value as MicroUnits;
}

/** Preserve the native evaluator's Math.round(value * 1e6) boundary exactly. */
export function toCanonicalMicroUnits(value: number): MicroUnits {
  if (!Number.isFinite(value)) throw new Error("Cannot canonicalize a non-finite utility");
  return assertSafeInteger(
    Math.round(value * CANONICAL_MICRO_UNITS_PER_UNIT),
    "Canonical micro-unit value",
  );
}

/** Convert a canonical value back to the public six-decimal representation. */
export function fromCanonicalMicroUnits(value: MicroUnits): number {
  return value / CANONICAL_MICRO_UNITS_PER_UNIT;
}

/**
 * Outward rounding for an upper bound. A branch is safe only when this integer
 * bound is strictly below the incumbent central micro-unit value.
 */
export function upperBoundToCanonicalMicroUnits(value: number): MicroUnits {
  if (!Number.isFinite(value)) throw new Error("Cannot bound a non-finite utility");
  return assertSafeInteger(
    Math.ceil(value * CANONICAL_MICRO_UNITS_PER_UNIT),
    "Canonical upper-bound micro-unit value",
  );
}

export type CanonicalUtilityTuple = Readonly<{
  lower: MicroUnits;
  central: MicroUnits;
  upper: MicroUnits;
}>;

export type CanonicalCandidate = Readonly<{
  leaderCardId: string;
  memberCardIds: readonly string[];
  utility: CanonicalUtilityTuple;
}>;

export function canonicalCandidateKey(candidate: Pick<CanonicalCandidate, "leaderCardId" | "memberCardIds">): string {
  return `${candidate.leaderCardId}|${[...candidate.memberCardIds].sort().join("|")}`;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Positive when left is preferred by the aggregate lexicographic objective. */
export function compareCanonicalCandidates(left: CanonicalCandidate, right: CanonicalCandidate): number {
  if (left.utility.central !== right.utility.central) return left.utility.central - right.utility.central;
  if (left.utility.lower !== right.utility.lower) return left.utility.lower - right.utility.lower;
  if (left.utility.upper !== right.utility.upper) return left.utility.upper - right.utility.upper;
  return -compareStrings(canonicalCandidateKey(left), canonicalCandidateKey(right));
}

export function canonicalUtilityTie(left: CanonicalUtilityTuple, right: CanonicalUtilityTuple): boolean {
  return left.central === right.central && left.lower === right.lower && left.upper === right.upper;
}

/** Equality is intentionally not prunable: lower/upper and canonical ties can still decide. */
export function canPruneByStrictCentralUpperBound(
  upperCentral: MicroUnits,
  incumbentCentral: MicroUnits,
): boolean {
  return upperCentral < incumbentCentral;
}

