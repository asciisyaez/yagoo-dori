import { type CanonicalUtilityTuple } from "./exact-optimizer-arithmetic";

/**
 * Schema and validation boundary for the full deterministic trace-parity
 * corpus. The runner owns file I/O; this module keeps the coverage gate and
 * its tests independent of a Node-only artifact reader.
 */
export const EXACT_OPTIMIZER_TRACE_PARITY_VERSION =
  "yd-exact-optimizer-trace-parity-1.0.0" as const;

export type ExactOptimizerTraceParitySummary = Readonly<{
  methodologyVersion: typeof EXACT_OPTIMIZER_TRACE_PARITY_VERSION;
  sampleCount: number;
  compiledEvaluationCount: number;
  uncompressedEvaluationCount: number;
  sourceOrderCanonicalCaseCount: number;
  tupleCache: Readonly<{
    capacity: number;
    uniqueInputTuples: number;
    cacheHits: number;
    cacheMisses: number;
    evictions: number;
  }>;
  traceFallbackCount: number;
  referenceCorpusMismatchCount: number;
  compressedVsUncompressed: Readonly<{
    caseMismatchCount: number;
    endpointMismatchCounts: Readonly<{
      lower: number;
      central: number;
      upper: number;
    }>;
    firstMismatches: readonly Readonly<{
      caseId: number;
      compiled: CanonicalUtilityTuple;
      uncompressed: CanonicalUtilityTuple;
    }>[];
  }>;
  elapsedMilliseconds: number;
}>;

/** True only for a current complete corpus with zero compressed-path fallback. */
export function isFullExactOptimizerTraceParity(
  summary: ExactOptimizerTraceParitySummary,
  expectedSampleCount: number,
): boolean {
  return (
    summary.methodologyVersion === EXACT_OPTIMIZER_TRACE_PARITY_VERSION &&
    summary.sampleCount === expectedSampleCount &&
    summary.compiledEvaluationCount === expectedSampleCount &&
    summary.uncompressedEvaluationCount === expectedSampleCount &&
    summary.sourceOrderCanonicalCaseCount === expectedSampleCount &&
    summary.tupleCache.uniqueInputTuples > 0 &&
    summary.tupleCache.cacheMisses >= summary.tupleCache.uniqueInputTuples &&
    summary.traceFallbackCount === 0 &&
    summary.referenceCorpusMismatchCount === 0 &&
    summary.compressedVsUncompressed.caseMismatchCount === 0 &&
    summary.compressedVsUncompressed.endpointMismatchCounts.lower === 0 &&
    summary.compressedVsUncompressed.endpointMismatchCounts.central === 0 &&
    summary.compressedVsUncompressed.endpointMismatchCounts.upper === 0 &&
    Number.isFinite(summary.elapsedMilliseconds) &&
    summary.elapsedMilliseconds > 0
  );
}

export function validateFullExactOptimizerTraceParity(
  summary: ExactOptimizerTraceParitySummary,
  expectedSampleCount: number,
): void {
  if (!isFullExactOptimizerTraceParity(summary, expectedSampleCount)) {
    throw new Error("Exact optimizer trace parity is incomplete, fell back, or diverged");
  }
}
