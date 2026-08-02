import { describe, expect, it } from "vitest";

import { mechanicsData } from "./mechanics";
import { groupNativeLeadersByResolvedApplications } from "./native-leader-resolution-cache";
import { evaluateNativeRelativeUtility } from "./native-utility";

const MEMBERS = [
  "card-00001-4-cmmn-0000-00",
  "card-00004-5-uniq-0005-00",
  "card-00005-5-uniq-0006-00",
  "card-00013-4-cmmn-0000-00",
  "card-00016-5-uniq-0014-00",
] as const;
const LEADERS = mechanicsData.cards.map((card) => card.cardId);
const BOARD = {
  board: {
    mode: "declared-neutral" as const,
    evidenceGrade: "verified" as const,
    evidenceRef: "fixture:leader-resolution-cache",
  },
};

describe("native Leader resolution cache", () => {
  it("only groups within structural classes and keeps the complete graph key", () => {
    const result = groupNativeLeadersByResolvedApplications({
      memberCardIds: MEMBERS,
      leaderOutfitCardIds: LEADERS,
      chartKey: "m0206:expert",
      investmentLayer: "one-copy-maximum",
    });

    expect(result.counts.eligibleLeaderOutfits).toBe(113);
    expect(result.counts.structuralClasses).toBeGreaterThan(0);
    expect(result.counts.structuralClasses).toBeLessThanOrEqual(113);
    expect(result.counts.resolvedGroups).toBeGreaterThanOrEqual(result.counts.structuralClasses);
    expect(result.counts.resolvedGroups).toBeLessThanOrEqual(result.counts.eligibleLeaderOutfits);
    expect(result.groups.every((group) => group.signature.length > 0)).toBe(true);
    expect(new Set(result.groups.map((group) => group.eligibleCardIds.flat()).flat()).size).toBe(113);
  });

  it("matches the reference utility for every member of each resolved group", () => {
    const result = groupNativeLeadersByResolvedApplications({
      memberCardIds: MEMBERS,
      leaderOutfitCardIds: LEADERS,
      chartKey: "m0206:expert",
      investmentLayer: "one-copy-maximum",
    });
    const members = MEMBERS.map((cardId) => ({ cardId, investment: "one-copy-maximum" as const }));

    for (const group of result.groups) {
      const expected = evaluateNativeRelativeUtility({
        formation: { leaderOutfitCardId: group.representativeCardId, members },
        chartKey: "m0206:expert",
        seed: 0x5eed,
        accountState: BOARD,
      }).relativeUtility;
      for (const leaderOutfitCardId of group.eligibleCardIds) {
        const actual = evaluateNativeRelativeUtility({
          formation: { leaderOutfitCardId, members },
          chartKey: "m0206:expert",
          seed: 0x5eed,
          accountState: BOARD,
        }).relativeUtility;
        expect(actual).toEqual(expected);
      }
    }
  }, 30_000);
});
