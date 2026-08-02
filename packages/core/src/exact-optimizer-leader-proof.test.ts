import { describe, expect, it } from "vitest";

import { mechanicsData } from "./mechanics";
import { proveNativeLeaderEquivalenceCoverage } from "./exact-optimizer-leader-proof";

describe("exact Leader equivalence coverage proof", () => {
  it("uses the complete deterministic chart corpus and preserves singleton fallback", () => {
    const proof = proveNativeLeaderEquivalenceCoverage({
      eligibleLeaderOutfitCardIds: mechanicsData.cards.map((card) => card.cardId),
      seed: 0x5eed,
      accountState: {
        board: {
          mode: "declared-neutral",
          evidenceGrade: "verified",
          evidenceRef: "fixture:exact-leader-proof",
        },
      },
    });
    expect(proof.caseCount).toBeGreaterThan(0);
    expect(proof.mismatchCount).toBe(0);
    expect(proof.corpusHash).toMatch(/^[a-f0-9]{64}$/);
  }, 30_000);
});
