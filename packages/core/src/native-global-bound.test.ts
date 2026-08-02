import { describe, expect, it } from "vitest";

import { mechanicsCardById } from "./mechanics";
import {
  boundNativeAggregateCentralUtility,
  compileNativeLeaderRootBounds,
  compileNativeGlobalBoundContext,
  type NativeGlobalBoundInput,
} from "./native-global-bound";
import { evaluateNativeRelativeUtility } from "./native-utility";

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

const LEADERS = [CARD.sora4, CARD.pekora5, CARD.flare5, CARD.iroha5] as const;
const CHARTS = ["m0206:expert", "m0309:expert"] as const;
const BOARD = {
  board: {
    mode: "declared-neutral" as const,
    evidenceGrade: "verified" as const,
    evidenceRef: "fixture:native-global-bound",
  },
};

function combinations(values: readonly string[], count: number): string[][] {
  if (count === 0) return [[]];
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

function hasUniqueTalents(cardIds: readonly string[]): boolean {
  return new Set(cardIds.map((cardId) => mechanicsCardById.get(cardId)!.talentId)).size ===
    cardIds.length;
}

const LEGAL_TEAMS = combinations(MEMBERS, 5).filter(hasUniqueTalents);
const LEGAL_PARTIALS = Array.from({ length: 5 }, (_, count) =>
  combinations(MEMBERS, count).filter(hasUniqueTalents),
).flat();

type Scenario = Pick<
  NativeGlobalBoundInput,
  "investmentLayer" | "bloomStageByCardId" | "maxFiveStarMembers"
>;

const SCENARIOS: readonly Scenario[] = [
  { investmentLayer: "low-investment" },
  { investmentLayer: "duplicate-enabled-ceiling" },
  {
    investmentLayer: "one-copy-maximum",
    maxFiveStarMembers: 3,
    bloomStageByCardId: {
      [CARD.sora4]: 0,
      [CARD.aki5]: 1,
      [CARD.haato5]: 2,
      [CARD.azki4]: 3,
      [CARD.azki5]: 4,
      [CARD.okayu5]: 5,
      [CARD.suisei5]: 2,
      [CARD.pekora5]: 1,
    },
  },
];

function averageCentral(
  team: readonly string[],
  leaderOutfitCardId: string,
  scenario: Scenario,
): number {
  return (
    CHARTS.reduce(
      (total, chartKey) =>
        total +
        evaluateNativeRelativeUtility({
          formation: {
            leaderOutfitCardId,
            members: team.map((cardId) => ({
              cardId,
              investment: scenario.investmentLayer,
              ...(scenario.bloomStageByCardId
                ? { bloomStage: scenario.bloomStageByCardId[cardId] }
                : {}),
            })),
          },
          chartKey,
          seed: 0x5eed,
          accountState: BOARD,
        }).relativeUtility.central,
      0,
    ) / CHARTS.length
  );
}

function respectsFiveStarCap(team: readonly string[], scenario: Scenario): boolean {
  const cap = scenario.maxFiveStarMembers ?? 5;
  return team.filter((cardId) => mechanicsCardById.get(cardId)!.rarity === 5).length <= cap;
}

describe("native global optimistic bound", () => {
  it("reuses a compiled context without changing one-shot bounds", () => {
    const base = {
      eligibleMemberCardIds: MEMBERS,
      eligibleLeaderOutfitCardIds: LEADERS,
      investmentLayer: "one-copy-maximum" as const,
      maxFiveStarMembers: 3,
      chartKeys: CHARTS,
    };
    const compiled = compileNativeGlobalBoundContext(base);
    for (const partialMemberCardIds of [[], [CARD.sora4], [CARD.sora4, CARD.azki4]]) {
      const oneShot = boundNativeAggregateCentralUtility({
        ...base,
        partialMemberCardIds,
      });
      expect(compiled.bound({ partialMemberCardIds })).toEqual(oneShot);
    }
    expect(() =>
      compiled.bound({
        partialMemberCardIds: [],
        eligibleMemberCardIds: [...MEMBERS, CARD.iroha5],
      }),
    ).toThrow(/cannot expand/i);
  });

  it("keeps B0 as an outward maximum of whole fixed-Leader B1 bounds", () => {
    const root = compileNativeLeaderRootBounds({
      partialMemberCardIds: [],
      eligibleMemberCardIds: MEMBERS,
      eligibleLeaderOutfitCardIds: LEADERS,
      investmentLayer: "one-copy-maximum",
      chartKeys: CHARTS,
    });
    expect(root.b1).toHaveLength(LEADERS.length);
    expect(root.b1.every((entry) => entry.multiplicity === entry.eligibleOutfitCardIds.length)).toBe(
      true,
    );
    expect(root.b0.upperCentralMicroUnits).toBe(
      Math.max(...root.b1.map((entry) => entry.upperCentralMicroUnits)),
    );
    for (const entry of root.b1) {
      const one = boundNativeAggregateCentralUtility({
        partialMemberCardIds: [],
        eligibleMemberCardIds: MEMBERS,
        eligibleLeaderOutfitCardIds: [entry.representativeCardId],
        investmentLayer: "one-copy-maximum",
        chartKeys: CHARTS,
      });
      expect(entry.upperCentralUtility).toBe(one.upperCentralUtility);
      expect(one.leaderConditioning.consideredLeaderOutfitCardIds).toEqual([
        entry.representativeCardId,
      ]);
    }
  }, 30_000);

  it("upper-bounds every legal completion and Leader across a reduced real roster", () => {
    for (const scenario of SCENARIOS) {
      const legalTeams = LEGAL_TEAMS.filter((team) => respectsFiveStarCap(team, scenario));
      const exactByFormation = new Map<string, number>();
      for (const team of legalTeams) {
        for (const leaderOutfitCardId of LEADERS) {
          exactByFormation.set(
            `${team.join("|")}|${leaderOutfitCardId}`,
            averageCentral(team, leaderOutfitCardId, scenario),
          );
        }
      }

      for (const partialMemberCardIds of LEGAL_PARTIALS) {
        const completions = legalTeams.filter((team) =>
          partialMemberCardIds.every((cardId) => team.includes(cardId)),
        );
        if (completions.length === 0) continue;
        const bound = boundNativeAggregateCentralUtility({
          partialMemberCardIds,
          eligibleMemberCardIds: MEMBERS,
          eligibleLeaderOutfitCardIds: LEADERS,
          chartKeys: CHARTS,
          ...scenario,
        });
        expect(Number.isFinite(bound.upperCentralUtility)).toBe(true);
        expect(bound.remainingFiveStarSlots).toBe(
          (scenario.maxFiveStarMembers ?? 5) -
            partialMemberCardIds.filter(
              (cardId) => mechanicsCardById.get(cardId)!.rarity === 5,
            ).length,
        );
        for (const team of completions) {
          for (const leaderOutfitCardId of LEADERS) {
            const exact = exactByFormation.get(`${team.join("|")}|${leaderOutfitCardId}`)!;
            expect(
              bound.upperCentralUtility,
              `${scenario.investmentLayer}: ${partialMemberCardIds.join(",")} -> ${team.join(",")} + ${leaderOutfitCardId}`,
            ).toBeGreaterThanOrEqual(exact);
          }
        }
      }
    }
  }, 30_000);

  it("bounds every formation order for a complete real team", () => {
    const team = [CARD.aki5, CARD.haato5, CARD.azki5, CARD.okayu5, CARD.suisei5];
    const bound = boundNativeAggregateCentralUtility({
      partialMemberCardIds: team,
      eligibleMemberCardIds: MEMBERS,
      eligibleLeaderOutfitCardIds: LEADERS,
      investmentLayer: "one-copy-maximum",
      chartKeys: [CHARTS[0]],
    });
    const orders = combinations(team, 5).flatMap(() => {
      const visit = (values: readonly string[]): string[][] =>
        values.length <= 1
          ? [[...values]]
          : values.flatMap((value, index) =>
              visit([...values.slice(0, index), ...values.slice(index + 1)]).map((tail) => [
                value,
                ...tail,
              ]),
            );
      return visit(team);
    });
    expect(orders).toHaveLength(120);
    for (const order of orders) {
      for (const leaderOutfitCardId of LEADERS) {
        const exact = evaluateNativeRelativeUtility({
          formation: {
            leaderOutfitCardId,
            members: order.map((cardId) => ({
              cardId,
              investment: "one-copy-maximum" as const,
            })),
          },
          chartKey: CHARTS[0],
          seed: 0x5eed,
          accountState: BOARD,
        }).relativeUtility.central;
        expect(bound.upperCentralUtility).toBeGreaterThanOrEqual(exact);
      }
    }
  }, 15_000);

  it("rejects partials without a legal unique-talent completion", () => {
    expect(() =>
      boundNativeAggregateCentralUtility({
        partialMemberCardIds: [CARD.azki4, CARD.azki5],
        eligibleMemberCardIds: MEMBERS,
        eligibleLeaderOutfitCardIds: LEADERS,
        investmentLayer: "one-copy-maximum",
        chartKeys: [CHARTS[0]],
      }),
    ).toThrow(/unique talents/i);

    expect(() =>
      boundNativeAggregateCentralUtility({
        partialMemberCardIds: [],
        eligibleMemberCardIds: MEMBERS.slice(0, 4),
        eligibleLeaderOutfitCardIds: LEADERS,
        investmentLayer: "one-copy-maximum",
        chartKeys: [CHARTS[0]],
      }),
    ).toThrow(/no legal five-talent completion/i);

    expect(() =>
      boundNativeAggregateCentralUtility({
        partialMemberCardIds: [CARD.aki5, CARD.haato5, CARD.okayu5],
        eligibleMemberCardIds: MEMBERS,
        eligibleLeaderOutfitCardIds: LEADERS,
        investmentLayer: "one-copy-maximum",
        maxFiveStarMembers: 2,
        chartKeys: [CHARTS[0]],
      }),
    ).toThrow(/exceeds maxFiveStarMembers/i);
  });

  it("rejects negative effect values before applying the monotonic relaxation", () => {
    const mechanics = mechanicsCardById.get(CARD.sora4)!;
    const application = mechanics.skills.passive.find(
      (skill) => skill.level === mechanics.progression.oneCopy.passiveSkillLevel,
    )!.applications[0]! as { effect: { value: number | null } };
    const original = application.effect.value;
    try {
      application.effect.value = -1;
      expect(() =>
        boundNativeAggregateCentralUtility({
          partialMemberCardIds: [],
          eligibleMemberCardIds: MEMBERS,
          eligibleLeaderOutfitCardIds: LEADERS,
          investmentLayer: "one-copy-maximum",
          chartKeys: [CHARTS[0]],
        }),
      ).toThrow(/non-negative finite effect values/i);
    } finally {
      application.effect.value = original;
    }
  });
});
