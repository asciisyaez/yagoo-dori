import { describe, expect, it } from "vitest";

import {
  EXACT_OPTIMIZER_TRACE_PARITY_VERSION,
  isFullExactOptimizerTraceParity,
  validateFullExactOptimizerTraceParity,
} from "./exact-optimizer-parity";

const passingSummary = {
  methodologyVersion: EXACT_OPTIMIZER_TRACE_PARITY_VERSION,
  sampleCount: 100_000,
  compiledEvaluationCount: 100_000,
  uncompressedEvaluationCount: 100_000,
  sourceOrderCanonicalCaseCount: 100_000,
  tupleCache: {
    capacity: 4_096,
    uniqueInputTuples: 100_000,
    cacheHits: 0,
    cacheMisses: 100_000,
    evictions: 95_904,
  },
  traceFallbackCount: 0,
  referenceCorpusMismatchCount: 0,
  compressedVsUncompressed: {
    caseMismatchCount: 0,
    endpointMismatchCounts: { lower: 0, central: 0, upper: 0 },
    firstMismatches: [],
  },
  elapsedMilliseconds: 1,
} as const;

describe("exact optimizer full trace parity evidence", () => {
  it("requires all corpus endpoints, no fallback, and a full execution count", () => {
    expect(isFullExactOptimizerTraceParity(passingSummary, 100_000)).toBe(true);
    expect(() => validateFullExactOptimizerTraceParity(passingSummary, 100_000)).not.toThrow();

    const failed = {
      ...passingSummary,
      compressedVsUncompressed: {
        ...passingSummary.compressedVsUncompressed,
        endpointMismatchCounts: { lower: 0, central: 1, upper: 0 },
      },
    };
    expect(isFullExactOptimizerTraceParity(failed, 100_000)).toBe(false);
    expect(() => validateFullExactOptimizerTraceParity(failed, 100_000)).toThrow(/parity/i);
  });
});
