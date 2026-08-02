import { describe, expect, it } from "vitest";

import {
  buildExactOptimizerCoverageLedger,
  validateExactOptimizerCoverageLedger,
} from "./exact-optimizer-coverage";

describe("exact optimizer coverage ledger", () => {
  it("records nonzero independent coverage for every required current axis", async () => {
    const ledger = await buildExactOptimizerCoverageLedger();
    validateExactOptimizerCoverageLedger(ledger);

    expect(ledger.requiredZeroCoverage).toEqual([]);
    expect(ledger.coverage.find((axis) => axis.id === "member-cards")!.entries).toHaveLength(113);
    expect(ledger.coverage.find((axis) => axis.id === "leader-sources")!.entries).toHaveLength(113);
    expect(ledger.coverage.find((axis) => axis.id === "application-records")!.entries.length).toBeGreaterThan(0);
    expect(ledger.gates).toMatchObject({
      compression: {
        authorized: true,
        corpusCaseCount: 100_000,
        traceFallbackCount: 0,
        endpointMismatchCounts: { lower: 0, central: 0, upper: 0 },
      },
      rootBounds: {
        authorized: true,
        classCount: 113,
        singletonSafeClassCount: 113,
        fullScopeChartCount: 30,
      },
      leaderEquivalence: { authorized: true, multiplicityReconciled: true },
      reducedBounds: { verified: true, scope: "reduced-fixture-only", strictPruneOnly: true },
      parallel: { authorized: true, workerCount: 2 },
      coverageAuthorization: { authorized: true },
    });
  }, 30_000);
});
