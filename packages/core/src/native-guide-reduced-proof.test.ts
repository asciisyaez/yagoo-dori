import { describe, expect, it } from "vitest";

import { DEFAULT_GUIDE_ANCHOR_CARD_ID } from "./native-guide-generator";
import { mechanicsData } from "./mechanics";
import { searchNativeLegalTeams } from "./native-search";
import {
  evaluateNativeRelativeUtility,
  type NeutralBoardAccountState,
  type UtilityInterval,
} from "./native-utility";

const AZKI_FIVE_STAR = "card-00013-5-uniq-0002-00";
const REAL_MEMBER_ALLOWLIST = [
  "card-00004-5-uniq-0005-00", // Aki Rosenthal
  "card-00005-5-uniq-0006-00", // Akai Haato
  AZKI_FIVE_STAR,
  "card-00016-5-uniq-0014-00", // Nekomata Okayu
  "card-00018-5-uniq-0004-00", // Hoshimachi Suisei
  "card-00039-5-uniq-0032-00", // Kazama Iroha
] as const;
const REAL_LEADER_ALLOWLIST = [
  AZKI_FIVE_STAR,
  "card-00039-5-uniq-0032-00",
] as const;
const DEFAULT_AZKI_CHART = "m0074:expert";
const SEED = 0x5eed;
const EPSILON = 0.000_001;
const BOARD: NeutralBoardAccountState = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "fixture:reduced-real-roster-proof",
  },
};

type ExhaustiveCandidate = Readonly<{
  leaderOutfitCardId: string;
  memberCardIds: readonly string[];
  relativeUtility: UtilityInterval;
}>;

const mechanicsByCardId = new Map(
  mechanicsData.cards.map((card) => [card.cardId, card] as const),
);

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

function permutations(values: readonly string[]): string[][] {
  if (values.length <= 1) return [[...values]];
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((tail) => [
      value,
      ...tail,
    ]),
  );
}

function evaluate(leaderOutfitCardId: string, memberCardIds: readonly string[]): ExhaustiveCandidate {
  return {
    leaderOutfitCardId,
    memberCardIds: [...memberCardIds],
    relativeUtility: evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId,
        members: memberCardIds.map((cardId) => ({
          cardId,
          investment: "one-copy-maximum" as const,
        })),
      },
      chartKey: DEFAULT_AZKI_CHART,
      seed: SEED,
      accountState: BOARD,
    }).relativeUtility,
  };
}

function compareCandidates(left: ExhaustiveCandidate, right: ExhaustiveCandidate): number {
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

function sortedTeamKey(memberCardIds: readonly string[]): string {
  return [...memberCardIds].sort().join("|");
}

function exhaustiveReducedRoster(): ExhaustiveCandidate[] {
  const legalTeams = combinations([...REAL_MEMBER_ALLOWLIST].sort(), 5).filter((team) => {
    if (!team.includes(AZKI_FIVE_STAR)) return false;
    const talentIds = team.map((cardId) => mechanicsByCardId.get(cardId)!.talentId);
    return new Set(talentIds).size === 5;
  });

  return legalTeams
    .flatMap((team) =>
      [...REAL_LEADER_ALLOWLIST].sort().flatMap((leaderOutfitCardId) =>
        permutations(team).map((order) => evaluate(leaderOutfitCardId, order)),
      ),
    )
    .sort(compareCandidates);
}

describe("AZKi guide reduced-real-roster proof", () => {
  it("matches an independent exhaustive search across every legal team, Leader, and order", () => {
    expect(DEFAULT_GUIDE_ANCHOR_CARD_ID).toBe(AZKI_FIVE_STAR);
    expect(
      REAL_MEMBER_ALLOWLIST.every((cardId) => mechanicsByCardId.has(cardId)),
    ).toBe(true);

    const exhaustive = exhaustiveReducedRoster();
    const uniqueFormationKeys = new Set(
      exhaustive.map(
        (candidate) =>
          `${candidate.leaderOutfitCardId}|${candidate.memberCardIds.join("|")}`,
      ),
    );
    const independentWinner = exhaustive[0]!;

    // 5 anchor-containing teams x 2 Leaders x all 5! formation orders.
    expect(exhaustive).toHaveLength(5 * 2 * 120);
    expect(uniqueFormationKeys.size).toBe(exhaustive.length);

    const result = searchNativeLegalTeams({
      chartKey: DEFAULT_AZKI_CHART,
      seed: SEED,
      investmentLayer: "one-copy-maximum",
      accountState: BOARD,
      constraints: {
        anchorCardId: AZKI_FIVE_STAR,
        memberCardIds: REAL_MEMBER_ALLOWLIST,
        leaderOutfitCardIds: REAL_LEADER_ALLOWLIST,
      },
      strategy: {
        mode: "exact",
        maxTeamSets: 5,
        auditedFinalists: 10,
        alternativesPerSlot: REAL_MEMBER_ALLOWLIST.length,
      },
    });

    expect(result.counts).toMatchObject({
      legalTeamSetsInScope: 5,
      finalistTeamSets: 5,
      leaderTeamEvaluations: 10,
      formationOrdersAudited: 10 * 120,
    });
    expect(result.certificate).toMatchObject({
      kind: "certified",
      formationOrder: {
        auditedLeaderTeamCandidates: 10,
        totalLeaderTeamCandidates: 10,
        unauditedLeaderTeamCandidates: 0,
        globalBestOrderCertified: true,
      },
      localRefinement: {
        status: "globally-certified",
        scope: "one-member-swap-or-leader-change",
        globalOptimalityClaim: true,
      },
    });
    expect(result.best.leaderOutfitCardId).toBe(independentWinner.leaderOutfitCardId);
    expect(result.best.members.map((member) => member.cardId)).toEqual(
      independentWinner.memberCardIds,
    );
    expect(result.best.relativeUtility).toEqual(independentWinner.relativeUtility);

    const winningOrder = result.best.members.map((member) => member.cardId);
    const winningTeamKey = sortedTeamKey(winningOrder);
    for (const [slot, replacedCardId] of winningOrder.entries()) {
      if (replacedCardId === AZKI_FIVE_STAR) continue;
      const retained = winningOrder.filter((_, index) => index !== slot);
      const retainedTalents = new Set(
        retained.map((cardId) => mechanicsByCardId.get(cardId)!.talentId),
      );
      for (const replacementCardId of REAL_MEMBER_ALLOWLIST) {
        if (
          retained.includes(replacementCardId) ||
          retainedTalents.has(mechanicsByCardId.get(replacementCardId)!.talentId)
        ) {
          continue;
        }
        const neighborTeamKey = sortedTeamKey([...retained, replacementCardId]);
        if (neighborTeamKey === winningTeamKey) continue;
        const bestNeighbor = exhaustive.find(
          (candidate) =>
            candidate.leaderOutfitCardId === result.best.leaderOutfitCardId &&
            sortedTeamKey(candidate.memberCardIds) === neighborTeamKey,
        )!;
        expect(bestNeighbor.relativeUtility.central).toBeLessThanOrEqual(
          independentWinner.relativeUtility.central + EPSILON,
        );
      }
    }

    for (const leaderOutfitCardId of REAL_LEADER_ALLOWLIST) {
      const bestLeaderNeighbor = exhaustive.find(
        (candidate) =>
          candidate.leaderOutfitCardId === leaderOutfitCardId &&
          sortedTeamKey(candidate.memberCardIds) === winningTeamKey,
      )!;
      expect(bestLeaderNeighbor.relativeUtility.central).toBeLessThanOrEqual(
        independentWinner.relativeUtility.central + EPSILON,
      );
    }

    const replacementRows = result.replacementsBySlot.filter((slot) => !slot.anchored);
    expect(replacementRows).toHaveLength(4);
    expect(replacementRows.every((slot) => slot.alternatives.length === 1)).toBe(true);
    expect(
      replacementRows
        .flatMap((slot) => slot.alternatives)
        .every((alternative) => alternative.intervalLoss.central >= -EPSILON),
    ).toBe(true);
  }, 60_000);
});
