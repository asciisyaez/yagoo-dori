import { describe, expect, it } from "vitest";

import {
  computeExactOptimizerScopeHash,
  exactOptimizerScope,
} from "./exact-optimizer-scope";

describe("exact optimizer scope manifest", () => {
  it("pins the canonical full-roster tuple without implicit defaults", () => {
    expect(exactOptimizerScope.roster.cardCount).toBe(113);
    expect(exactOptimizerScope.eligibility.eligibleMemberCardIds).toHaveLength(113);
    expect(exactOptimizerScope.eligibility.eligibleLeaderOutfitCardIds).toHaveLength(113);
    expect(exactOptimizerScope.investment.bloomStageByCardId).toEqual(
      expect.objectContaining({
        "card-00001-4-cmmn-0000-00": 0,
        "card-00019-5-uniq-0016-00": 0,
      }),
    );
    expect(exactOptimizerScope.chartCorpus.entries).toHaveLength(30);
    expect(exactOptimizerScope.objective.formationOrderIncluded).toBe(false);
  });

  it("recomputes the content address exactly", () => {
    const { scopeHash, ...scopeWithoutHash } = exactOptimizerScope;
    expect(computeExactOptimizerScopeHash(scopeWithoutHash)).toBe(scopeHash);
  });
});

