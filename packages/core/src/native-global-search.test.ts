import { describe, expect, it } from "vitest";

import { mechanicsCardById, mechanicsData } from "./mechanics";
import { compileNativeLeaderEquivalence } from "./native-leader-equivalence";
import {
  NativeGlobalSearchTimeoutError,
  countNativeLegalTeamSets,
  reconcileNativeGlobalLeaderPairCounts,
  searchNativeGlobalTeams,
  type NativeGlobalSearchProgress,
} from "./native-global-search";
import {
  evaluateNativeRelativeUtility,
  type NeutralBoardAccountState,
  type UtilityInterval,
} from "./native-utility";

const CARD = {
  sora4: "card-00001-4-cmmn-0000-00",
  aki5: "card-00004-5-uniq-0005-00",
  haato5: "card-00005-5-uniq-0006-00",
  azki4: "card-00013-4-cmmn-0000-00",
  azki5: "card-00013-5-uniq-0002-00",
  okayu5: "card-00016-5-uniq-0014-00",
  suisei5: "card-00018-5-uniq-0004-00",
  pekora5: "card-00019-5-uniq-0016-00",
  flare5: "card-00021-5-uniq-0017-00",
  iroha5: "card-00039-5-uniq-0032-00",
} as const;

const MEMBERS = [
  CARD.sora4,
  CARD.aki5,
  CARD.haato5,
  CARD.azki4,
  CARD.azki5,
  CARD.okayu5,
  CARD.suisei5,
  CARD.pekora5,
] as const;

const fullLeaderClasses = compileNativeLeaderEquivalence({
  eligibleLeaderOutfitCardIds: mechanicsData.cards.map((card) => card.cardId),
});
const sameClassLeaders = fullLeaderClasses.classes.find((group) =>
  group.eligibleCardIds.includes(CARD.sora4),
)!.eligibleCardIds.slice(0, 2);
const LEADERS = [...sameClassLeaders, CARD.pekora5, CARD.flare5, CARD.iroha5] as const;
const BOARD: NeutralBoardAccountState = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "fixture:native-global-search",
  },
};

function combinations(values: readonly string[], count: number): string[][] {
  const result: string[][] = [];
  const visit = (start: number, selected: string[]): void => {
    if (selected.length === count) {
      result.push([...selected]);
      return;
    }
    for (let index = start; index <= values.length - (count - selected.length); index += 1) {
      selected.push(values[index]!);
      visit(index + 1, selected);
      selected.pop();
    }
  };
  visit(0, []);
  return result;
}

function legalTeams(maxFiveStarMembers = 5, fixedCardId?: string): string[][] {
  return combinations(MEMBERS, 5).filter((team) => {
    if (fixedCardId && !team.includes(fixedCardId)) return false;
    const cards = team.map((cardId) => mechanicsCardById.get(cardId)!);
    return (
      new Set(cards.map((card) => card.talentId)).size === 5 &&
      cards.filter((card) => card.rarity === 5).length <= maxFiveStarMembers
    );
  });
}

type BruteCandidate = Readonly<{
  leaderOutfitCardId: string;
  memberCardIds: readonly string[];
  relativeUtility: UtilityInterval;
}>;

function compare(left: BruteCandidate, right: BruteCandidate): number {
  if (left.relativeUtility.central !== right.relativeUtility.central) {
    return right.relativeUtility.central - left.relativeUtility.central;
  }
  if (left.relativeUtility.lower !== right.relativeUtility.lower) {
    return right.relativeUtility.lower - left.relativeUtility.lower;
  }
  if (left.relativeUtility.upper !== right.relativeUtility.upper) {
    return right.relativeUtility.upper - left.relativeUtility.upper;
  }
  return `${left.leaderOutfitCardId}|${left.memberCardIds.join("|")}`.localeCompare(
    `${right.leaderOutfitCardId}|${right.memberCardIds.join("|")}`,
  );
}

function bruteForce(maxFiveStarMembers = 5, fixedCardId?: string): BruteCandidate {
  return legalTeams(maxFiveStarMembers, fixedCardId)
    .flatMap((memberCardIds) =>
      LEADERS.map((leaderOutfitCardId) => ({
        leaderOutfitCardId,
        memberCardIds: [...memberCardIds].sort(),
        relativeUtility: evaluateNativeRelativeUtility({
          formation: {
            leaderOutfitCardId,
            members: [...memberCardIds]
              .sort()
              .map((cardId) => ({ cardId, investment: "one-copy-maximum" as const })),
          },
          chartKey: "m0206:expert",
          seed: 0x5eed,
          accountState: BOARD,
        }).relativeUtility,
      })),
    )
    .sort(compare)[0]!;
}

describe("native global team search", () => {
  it("is invariant to Member input permutation for aggregate utility", () => {
    // Keep the fixture legal: the roster contains two AZKi cards, but a team
    // may field only one card per talent.
    const members = [CARD.sora4, CARD.aki5, CARD.haato5, CARD.azki4, CARD.okayu5];
    const forward = evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId: LEADERS[0]!,
        members: members.map((cardId) => ({ cardId, investment: "one-copy-maximum" as const })),
      },
      chartKey: "m0206:expert",
      seed: 0x5eed,
      accountState: BOARD,
    });
    const reversed = evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId: LEADERS[0]!,
        members: [...members].reverse().map((cardId) => ({ cardId, investment: "one-copy-maximum" as const })),
      },
      chartKey: "m0206:expert",
      seed: 0x5eed,
      accountState: BOARD,
    });
    expect(reversed.relativeUtility).toEqual(forward.relativeUtility);
  });

  it("retains Leader identity when building the proof pair space", () => {
    const identities = compileNativeLeaderEquivalence({
      eligibleLeaderOutfitCardIds: LEADERS,
    });
    expect(identities.classes.flatMap((group) => group.eligibleCardIds).sort()).toEqual(
      [...LEADERS].sort(),
    );
    expect(identities.classes.every((group) => group.leaderTalentIds.length === 1)).toBe(true);
  });

  it("reconciles exact and pruned class and Outfit pairs, including class multiplicity", () => {
    const pairs = reconcileNativeGlobalLeaderPairCounts({
      legalTeamSets: 7,
      exactLeafEvaluations: 2,
      prunedTeamSets: 5,
      // Three classes represented by five actual Outfits proves that the
      // Outfit space is not inferred from the class count.
      leaderEquivalenceClasses: 3,
      eligibleLeaderOutfits: 5,
    });

    expect(pairs).toEqual({
      leaderClassTeamPairs: 21,
      leaderOutfitTeamPairs: 35,
      exactLeaderClassTeamPairs: 6,
      prunedLeaderClassTeamPairs: 15,
      exactLeaderOutfitTeamPairs: 10,
      prunedLeaderOutfitTeamPairs: 25,
      leaderClassPairCountsReconciled: true,
      leaderOutfitPairCountsReconciled: true,
      leaderPairCountsReconciled: true,
    });
    expect(() =>
      reconcileNativeGlobalLeaderPairCounts({
        legalTeamSets: 7,
        exactLeafEvaluations: 2,
        prunedTeamSets: 4,
        leaderEquivalenceClasses: 3,
        eligibleLeaderOutfits: 5,
      }),
    ).toThrow(/did not reconcile/i);
  });

  it("reconciles the declared unrestricted legal Member-team count", () => {
    expect(
      countNativeLegalTeamSets({
        eligibleMemberCardIds: [...mechanicsData.cards].map((card) => card.cardId),
        maxFiveStarMembers: 5,
      }),
    ).toBe(126_445_821);
  });

  it("reports counters without issuing a certificate when a runtime budget expires", () => {
    let observed: NativeGlobalSearchProgress | null = null;
    try {
      searchNativeGlobalTeams({
        eligibleMemberCardIds: MEMBERS,
        eligibleLeaderOutfitCardIds: LEADERS,
        investmentLayer: "one-copy-maximum",
        chartKeys: ["m0206:expert"],
        seed: 0x5eed,
        accountState: BOARD,
        maximumRuntimeMilliseconds: 1,
        progressIntervalNodes: 1,
        onProgress: (progress) => {
          observed = progress;
        },
      });
      throw new Error("Expected the one-millisecond proof budget to expire");
    } catch (error) {
      expect(error).toBeInstanceOf(NativeGlobalSearchTimeoutError);
      if (!(error instanceof NativeGlobalSearchTimeoutError)) throw error;
      expect(error.progress.elapsedMilliseconds).toBeGreaterThanOrEqual(1);
      expect(error.progress.nodesVisited).toBeGreaterThanOrEqual(0);
      expect(observed).toEqual(error.progress);
    }
  });

  it("matches independent brute force and reconciles exact plus pruned team sets", () => {
    const expected = bruteForce();
    const result = searchNativeGlobalTeams({
      eligibleMemberCardIds: MEMBERS,
      eligibleLeaderOutfitCardIds: LEADERS,
      investmentLayer: "one-copy-maximum",
      chartKeys: ["m0206:expert"],
      seed: 0x5eed,
      accountState: BOARD,
    });

    expect(result.best).toEqual(expected);
    expect(result.certificate).toMatchObject({
      kind: "certified",
      legalTeamSets: legalTeams().length,
      countsReconciled: true,
      optimalityGap: 0,
      eligibleLeaderOutfits: LEADERS.length,
      leaderEquivalenceClasses: compileNativeLeaderEquivalence({
        eligibleLeaderOutfitCardIds: LEADERS,
      }).counts.equivalenceClasses,
      collapsedLeaderOutfits: compileNativeLeaderEquivalence({
        eligibleLeaderOutfitCardIds: LEADERS,
      }).counts.collapsedLeaderOutfits,
      leaderClassTeamPairs:
        legalTeams().length *
        compileNativeLeaderEquivalence({
          eligibleLeaderOutfitCardIds: LEADERS,
        }).counts.equivalenceClasses,
      leaderOutfitTeamPairs: legalTeams().length * LEADERS.length,
      leaderClassPairCountsReconciled: true,
      leaderOutfitPairCountsReconciled: true,
      leaderPairCountsReconciled: true,
    });
    expect(result.certificate.prunedTeamSets).toBeGreaterThan(0);
    expect(result.certificate.nodesPruned).toBeGreaterThan(0);
    expect(
      result.certificate.exactLeafEvaluations + result.certificate.prunedTeamSets,
    ).toBe(result.certificate.legalTeamSets);
    expect(
      result.certificate.exactLeaderClassTeamPairs +
        result.certificate.prunedLeaderClassTeamPairs,
    ).toBe(result.certificate.leaderClassTeamPairs);
    expect(
      result.certificate.exactLeaderOutfitTeamPairs +
        result.certificate.prunedLeaderOutfitTeamPairs,
    ).toBe(result.certificate.leaderOutfitTeamPairs);
    expect(result.certificate.maximumPrunedUpperCentralUtility).toBeLessThan(
      result.best.relativeUtility.central,
    );
    expect(result.certificate.proofCascade.strictPrunes).toBeGreaterThan(0);
    expect(result.certificate.proofCascade.b3ExactLeafTeamSets).toBe(
      result.certificate.exactLeafEvaluations,
    );
  }, 30_000);

  it("retains exactness with a fixed Member and five-star cap", () => {
    const expected = bruteForce(3, CARD.sora4);
    const result = searchNativeGlobalTeams({
      eligibleMemberCardIds: MEMBERS,
      eligibleLeaderOutfitCardIds: LEADERS,
      fixedMemberCardIds: [CARD.sora4],
      investmentLayer: "one-copy-maximum",
      maxFiveStarMembers: 3,
      chartKeys: ["m0206:expert"],
      seed: 0x5eed,
      accountState: BOARD,
    });

    expect(result.best).toEqual(expected);
    expect(result.certificate.legalTeamSets).toBe(legalTeams(3, CARD.sora4).length);
    expect(
      result.certificate.exactLeafEvaluations + result.certificate.prunedTeamSets,
    ).toBe(result.certificate.legalTeamSets);
  }, 20_000);

  it("accepts a legal incumbent seed without weakening the exhaustive certificate", () => {
    const expected = bruteForce();
    const result = searchNativeGlobalTeams({
      eligibleMemberCardIds: MEMBERS,
      eligibleLeaderOutfitCardIds: LEADERS,
      initialCandidate: {
        leaderOutfitCardId: expected.leaderOutfitCardId,
        memberCardIds: expected.memberCardIds,
      },
      investmentLayer: "one-copy-maximum",
      chartKeys: ["m0206:expert"],
      seed: 0x5eed,
      accountState: BOARD,
    });

    expect(result.best).toEqual(expected);
    expect(result.certificate).toMatchObject({
      kind: "certified",
      incumbentSource: "provided-seed",
      incumbentSeedTeamSets: expect.any(Number),
      incumbentSeedLeaderTeamEvaluations: expect.any(Number),
      countsReconciled: true,
      optimalityGap: 0,
    });
    // Seed candidates tighten the incumbent but must not be credited as proof
    // coverage of exact/pruned legal pairs.
    expect(result.certificate.incumbentSeedLeaderTeamEvaluations).toBeGreaterThan(0);
    expect(result.certificate.exactLeaderTeamEvaluations).toBe(
      result.certificate.incumbentSeedLeaderTeamEvaluations +
        result.certificate.exactLeaderOutfitTeamPairs,
    );
    expect(
      result.certificate.exactLeaderOutfitTeamPairs +
        result.certificate.prunedLeaderOutfitTeamPairs,
    ).toBe(result.certificate.leaderOutfitTeamPairs);
  }, 30_000);
});
