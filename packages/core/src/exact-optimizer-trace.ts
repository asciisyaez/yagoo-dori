/**
 * Arithmetic-trace primitives for the exact-optimizer research path.
 *
 * These helpers deliberately do not turn repeated values into a multiplication.
 * The native evaluator accumulates IEEE-754 values in note order and rounds at
 * its documented boundaries.  Reassociating `a + a + a` into `a * 3` is not a
 * proof-preserving replacement, even when the mathematical real result is the
 * same.  A compressed run therefore means "compute invariant state once, then
 * replay every addition in the original order", never a parallel reduction.
 */

export const EXACT_OPTIMIZER_TRACE_VERSION = "yd-exact-arithmetic-trace-1.0.0" as const;

export type ExactArithmeticTrace = Readonly<{
  kind: "exact-arithmetic-trace";
  methodologyVersion: typeof EXACT_OPTIMIZER_TRACE_VERSION;
  operationOrder: readonly [
    "source-order",
    "per-note-expected-maximum",
    "ordered-note-accumulation",
    "per-chart-rounding",
    "final-aggregate-rounding",
  ];
  /** The executor must preserve this sequence exactly. */
  noteOrdinals: Uint32Array;
}>;

export type ExactStateRun = Readonly<{
  stateId: number;
  startInclusive: number;
  endExclusive: number;
  multiplicity: number;
}>;

export type ExactCompressionAdmissibility = Readonly<{
  kind: "exact-compression-admissibility";
  methodologyVersion: typeof EXACT_OPTIMIZER_TRACE_VERSION;
  admissible: boolean;
  mode: "trace-preserving-state-runs" | "uncompressed-fallback";
  reasons: readonly string[];
}>;

function assertStateIds(stateIds: Uint32Array): void {
  if (stateIds.length === 0) throw new Error("A state-run trace requires at least one note");
}

/**
 * Build maximal adjacent equal-state runs.  State IDs must have been derived
 * from every utility-relevant field (including all five Member Active states),
 * not merely from the chart timestamp.
 */
export function compileExactStateRuns(stateIds: Uint32Array): readonly ExactStateRun[] {
  assertStateIds(stateIds);
  const runs: ExactStateRun[] = [];
  let start = 0;
  let current = stateIds[0]!;
  for (let index = 1; index <= stateIds.length; index += 1) {
    const next = index === stateIds.length ? Number.NaN : stateIds[index]!;
    if (next === current) continue;
    runs.push({
      stateId: current,
      startInclusive: start,
      endExclusive: index,
      multiplicity: index - start,
    });
    start = index;
    current = next;
  }
  return Object.freeze(runs);
}

/** Compile the immutable note ordinal ledger used by a trace-safe executor. */
export function compileExactArithmeticTrace(noteCount: number): ExactArithmeticTrace {
  if (!Number.isSafeInteger(noteCount) || noteCount <= 0) {
    throw new Error("Exact arithmetic trace noteCount must be a positive safe integer");
  }
  const noteOrdinals = new Uint32Array(noteCount);
  for (let index = 0; index < noteCount; index += 1) noteOrdinals[index] = index;
  return Object.freeze({
    kind: "exact-arithmetic-trace",
    methodologyVersion: EXACT_OPTIMIZER_TRACE_VERSION,
    operationOrder: [
      "source-order",
      "per-note-expected-maximum",
      "ordered-note-accumulation",
      "per-chart-rounding",
      "final-aggregate-rounding",
    ] as const,
    noteOrdinals,
  });
}

/**
 * Admission is intentionally narrow.  The caller must prove that a state ID
 * captures every value consumed by the per-note expected maximum.  A run is
 * still replayed addition-by-addition, so `parallel` is a rejection rather
 * than an optimization knob.
 */
export function assessExactCompressionAdmissibility(input: Readonly<{
  trace: ExactArithmeticTrace;
  stateIds: Uint32Array;
  stateCapturesAllInputs: boolean;
  preservesSourceOrder: boolean;
  reduction: "none" | "multiplicity" | "parallel";
}>): ExactCompressionAdmissibility {
  const reasons: string[] = [];
  if (input.trace.methodologyVersion !== EXACT_OPTIMIZER_TRACE_VERSION) {
    reasons.push("unknown-trace-methodology");
  }
  if (input.stateIds.length !== input.trace.noteOrdinals.length) {
    reasons.push("state-count-does-not-match-note-trace");
  }
  if (!input.stateCapturesAllInputs) reasons.push("state-key-is-not-complete");
  if (!input.preservesSourceOrder) reasons.push("source-order-is-not-preserved");
  if (input.reduction !== "none") reasons.push(`reassociation-forbidden:${input.reduction}`);
  return {
    kind: "exact-compression-admissibility",
    methodologyVersion: EXACT_OPTIMIZER_TRACE_VERSION,
    admissible: reasons.length === 0,
    mode: reasons.length === 0 ? "trace-preserving-state-runs" : "uncompressed-fallback",
    reasons: Object.freeze(reasons),
  };
}

/**
 * Execute state-dependent work once per run and replay its contribution in
 * original note order.  `contributionForState` must be referentially stable
 * over its run; this is the fact asserted by the admissibility gate.
 */
export function replayExactStateRuns(
  trace: ExactArithmeticTrace,
  runs: readonly ExactStateRun[],
  contributionForState: (stateId: number) => number,
): number {
  let expectedOrdinal = 0;
  let accumulated = 0;
  for (const run of runs) {
    if (
      run.startInclusive !== expectedOrdinal ||
      run.endExclusive - run.startInclusive !== run.multiplicity ||
      run.multiplicity <= 0
    ) {
      throw new Error("State runs do not form a contiguous exact note trace");
    }
    // This call is intentionally outside the replay loop.  It is the only
    // compressed part of the kernel: expected maximum is computed once for a
    // proven-invariant state, while additions remain serial and ordered.
    const contribution = contributionForState(run.stateId);
    if (!Number.isFinite(contribution)) throw new Error("State contribution must be finite");
    for (let ordinal = run.startInclusive; ordinal < run.endExclusive; ordinal += 1) {
      if (trace.noteOrdinals[ordinal] !== ordinal) {
        throw new Error("Arithmetic trace ordinal corruption");
      }
      accumulated += contribution;
    }
    expectedOrdinal = run.endExclusive;
  }
  if (expectedOrdinal !== trace.noteOrdinals.length) {
    throw new Error("State runs do not cover the complete exact note trace");
  }
  return accumulated;
}
