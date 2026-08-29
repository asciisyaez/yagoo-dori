import { describe, expect, it } from "vitest";

import {
  assertExactOptimizerScopeValid,
  computeExactOptimizerScopeHash,
  exactOptimizerScope,
  type ExactOptimizerScope,
} from "./exact-optimizer-scope";
import { mechanicsData } from "./mechanics";
import { publicCards } from "./public-data";

function resignedScope(mutate: (scope: ExactOptimizerScope) => void): ExactOptimizerScope {
  const scope = structuredClone(exactOptimizerScope);
  mutate(scope);
  const { scopeHash: _scopeHash, ...scopeWithoutHash } = scope;
  return { ...scope, scopeHash: computeExactOptimizerScopeHash(scopeWithoutHash) };
}

describe("exact optimizer scope manifest", () => {
  it("pins the canonical full-roster tuple without implicit defaults", () => {
    expect(exactOptimizerScope.roster.cardCount).toBe(124);
    expect(exactOptimizerScope.eligibility.eligibleMemberCardIds).toHaveLength(124);
    expect(exactOptimizerScope.eligibility.eligibleLeaderOutfitCardIds).toHaveLength(124);
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

  it("rejects a scope with a stale canonical hash", () => {
    const staleHash = { ...exactOptimizerScope, scopeHash: "0".repeat(64) };

    expect(() => assertExactOptimizerScopeValid(staleHash, publicCards, mechanicsData)).toThrow(
      "Exact optimizer scope hash does not match its canonical manifest",
    );
  });

  it("rejects an unknown eligible Member card after the scope is re-signed", () => {
    const mutated = resignedScope((scope) => {
      scope.eligibility.eligibleMemberCardIds[0] = "card-not-in-pinned-roster";
    });

    expect(() => assertExactOptimizerScopeValid(mutated, publicCards, mechanicsData)).toThrow(
      "Exact optimizer eligibility does not match the pinned public roster",
    );
  });

  it.each([
    {
      name: "Bloom-map key drift",
      mutate: (scope: ExactOptimizerScope) => {
        const firstCardId = scope.eligibility.eligibleMemberCardIds[0]!;
        const { [firstCardId]: _removed, ...remainingBloomStages } = scope.investment.bloomStageByCardId;
        scope.investment.bloomStageByCardId = remainingBloomStages;
      },
    },
    {
      name: "roster-commit drift",
      mutate: (scope: ExactOptimizerScope) => {
        scope.roster.sourceCommit = "0".repeat(40);
      },
    },
  ])("rejects re-signed $name through the shared mechanics drift guard", ({ mutate }) => {
    const mutated = resignedScope(mutate);

    expect(() => assertExactOptimizerScopeValid(mutated, publicCards, mechanicsData)).toThrow(
      "Exact optimizer investment or roster source drifted from the mechanics catalog",
    );
  });
});
