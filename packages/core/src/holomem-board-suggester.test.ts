import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BOARD_SUGGESTER_BEAM_WIDTH,
  BOARD_SUGGESTER_STACKING_MODEL,
  buildBoardNodeObjective,
  compareUnlockedMembership,
  computeBoardNodeObjective,
  suggestHolomemBoardNodes,
} from "./holomem-board-suggester";
import { boardAdjacency } from "./holomem-board";
import { mechanicsData, type MechanicsData } from "./mechanics";
import { publicCards } from "./public-data";

const teamMembers = [...new Map(
  publicCards
    .slice()
    .sort((left, right) => left.talentId.localeCompare(right.talentId) || left.id.localeCompare(right.id))
    .map((card) => [card.talentId, { talentId: card.talentId, cardId: card.id, lens: "one-copy-max" as const }]),
).values()].slice(0, 5);

const baseInput = {
  talentId: teamMembers[0]!.talentId,
  holomemRank: 50,
  extraPointsOwned: 0,
  playerLevel: 50,
  unlockedNodeGroupIds: ["S-001"],
  focusPosition: "member" as const,
  team: {
    leader: teamMembers[0]!,
    members: teamMembers,
  },
};

const baseObjectiveInput = {
  team: baseInput.team,
  focus: { talentId: baseInput.talentId, position: baseInput.focusPosition },
  unlockedNodeGroupIds: baseInput.unlockedNodeGroupIds,
  playerLevel: baseInput.playerLevel,
};

function replaySuggestion(result: ReturnType<typeof suggestHolomemBoardNodes>, budget: number): void {
  const unlocked = new Set(baseInput.unlockedNodeGroupIds);
  let spent = result.budget.alreadySpent;
  for (const suggestion of result.suggestedUnlocks) {
    expect(unlocked.has(suggestion.nodeGroupId)).toBe(false);
    expect((boardAdjacency.neighborsByGroupId.get(suggestion.nodeGroupId) ?? []).some((neighbor) => unlocked.has(neighbor))).toBe(true);
    if (suggestion.pathParentGroupId === "start") {
      expect((boardAdjacency.neighborsByGroupId.get(suggestion.nodeGroupId) ?? [])).toContain("S-001");
    } else {
      expect((boardAdjacency.neighborsByGroupId.get(suggestion.nodeGroupId) ?? [])).toContain(suggestion.pathParentGroupId);
    }
    spent += suggestion.pointCost;
    expect(spent).toBeLessThanOrEqual(budget);
    unlocked.add(suggestion.nodeGroupId);
  }
}

describe("Holomem Board node objective", () => {
  it("uses focus-aware pinned parameter values and labels the envelope", () => {
    const cardStats = publicCards.find((card) => card.id === teamMembers[0]!.cardId)!.parameters.oneCopyMaxLevel;
    const blue = computeBoardNodeObjective("B-001", baseObjectiveInput);
    expect(blue.valueMicroUnits).toBe(50 * 3 * 1_000_000);
    expect(blue.valueClass).toBe("flat");
    expect(blue.appliesWhen).toBe("always");

    const leaderInput = { ...baseObjectiveInput, focus: { talentId: baseInput.talentId, position: "leader" as const } };
    const red = computeBoardNodeObjective("R-001", leaderInput);
    expect(red.valueMicroUnits).toBe(50 * 3 * 5 * 1_000_000);
    expect(red.appliesWhen).toBe("while-leading");
    expect(cardStats.performance + cardStats.technique + cardStats.sense).toBeGreaterThan(0);

    const inactive = computeBoardNodeObjective("R-001", baseObjectiveInput);
    expect(inactive.valueMicroUnits).toBeNull();
    expect(inactive.valueClass).toBe("inactive");

    const objective = buildBoardNodeObjective(baseObjectiveInput);
    expect(objective.stackingModel).toBe(BOARD_SUGGESTER_STACKING_MODEL);
    expect(objective.objectiveByGroupId.size).toBe(152);
    expect(objective.connectEnablers).toHaveLength(4);
  });

  it("is deterministic and returns a connectivity-preserving affordable order", () => {
    const first = suggestHolomemBoardNodes(baseInput);
    const second = suggestHolomemBoardNodes(structuredClone(baseInput));
    expect(first).toEqual(second);
    expect(first.search.beamWidth).toBe(BOARD_SUGGESTER_BEAM_WIDTH);
    expect(first.claim).toBe("bounded-search");
    expect(first.stackingModel).toBe(BOARD_SUGGESTER_STACKING_MODEL);
    expect(first.search.selectedMicroUnits).toBeGreaterThanOrEqual(first.search.greedyBaselineMicroUnits);
    replaySuggestion(first, first.budget.totalBudget);
    expect(first.boardDiagnostics.declaredStateConsistentWithDerivedAdjacency).toBe(true);
  });

  it("keeps selected value monotone across the pinned rank budgets", () => {
    const ranks = [1, 10, 30, 50];
    const results = ranks.map((holomemRank) => suggestHolomemBoardNodes({ ...baseInput, holomemRank }));
    for (const result of results) replaySuggestion(result, result.budget.totalBudget);
    for (let index = 1; index < results.length; index += 1) {
      expect(results[index]!.search.selectedMicroUnits).toBeGreaterThanOrEqual(results[index - 1]!.search.selectedMicroUnits);
    }
    expect(results.map((result) => result.budget.rankPointIncome)).toEqual([0, 26, 161, 361]);
  });

  it("throws when a newly encountered in-scope effect kind is not in the pinned partition", () => {
    const catalogs: MechanicsData["catalogs"] = structuredClone(mechanicsData.catalogs);
    const node = catalogs.boardNodes.find((candidate) => candidate.kind === "card")!;
    const effect = catalogs.boardEffects.find((candidate) => candidate.id === node.effectId)!;
    effect.kind = "unclassified-effect-kind";
    expect(() => buildBoardNodeObjective({ ...baseObjectiveInput, catalogs })).toThrow(/Unclassified in-scope Board effect kind/);
  });

  it("rejects a team member without a declared card identity or lens", () => {
    const missingCard = {
      ...baseInput,
      team: {
        leader: baseInput.team.leader,
        members: baseInput.team.members.map((member, index) =>
          index === 0 ? ({ talentId: member.talentId } as unknown as typeof member) : member,
        ),
      },
    };
    expect(() => suggestHolomemBoardNodes(missingCard)).toThrow(/must declare its cardId/);

    const missingLens = {
      ...baseInput,
      team: {
        leader: baseInput.team.leader,
        members: baseInput.team.members.map((member, index) =>
          index === 0
            ? ({ talentId: member.talentId, cardId: member.cardId } as unknown as typeof member)
            : member,
        ),
      },
    };
    expect(() => suggestHolomemBoardNodes(missingLens)).toThrow(/must declare a parameter lens/);
  });

  it("prices permil objectives from the declared card, not a talent default", () => {
    const byTalent = new Map<string, typeof publicCards[number][]>();
    for (const card of publicCards) {
      const list = byTalent.get(card.talentId) ?? [];
      list.push(card);
      byTalent.set(card.talentId, list);
    }
    const statSum = (card: typeof publicCards[number]) =>
      card.parameters.oneCopyMaxLevel.performance +
      card.parameters.oneCopyMaxLevel.technique +
      card.parameters.oneCopyMaxLevel.sense;
    const pair = [...byTalent.values()]
      .map((cards) => cards.slice().sort((left, right) => left.id.localeCompare(right.id)))
      .find((cards) => cards.length >= 2 && statSum(cards[0]!) !== statSum(cards[1]!));
    expect(pair).toBeDefined();
    const [firstCard, secondCard] = pair!;

    const teamFor = (cardId: string) => {
      const others = teamMembers.filter((member) => member.talentId !== firstCard!.talentId).slice(0, 4);
      const focusMember = { talentId: firstCard!.talentId, cardId, lens: "one-copy-max" as const };
      return { leader: focusMember, members: [focusMember, ...others] };
    };
    const objectiveFor = (cardId: string) =>
      buildBoardNodeObjective({
        team: teamFor(cardId),
        focus: { talentId: firstCard!.talentId, position: "member" },
        unlockedNodeGroupIds: ["S-001"],
        playerLevel: 50,
      });

    const firstObjective = objectiveFor(firstCard!.id);
    const permilNode = firstObjective.nodes.find(
      (node) => node.valueClass === "permil" && node.appliesWhen === "always",
    );
    expect(permilNode).toBeDefined();
    const secondObjective = objectiveFor(secondCard!.id);
    const counterpart = secondObjective.objectiveByGroupId.get(permilNode!.nodeGroupId)!;
    expect(counterpart.valueMicroUnits).not.toBe(permilNode!.valueMicroUnits);
  });

  it("flags a declared board state that is disconnected under the derived adjacency", () => {
    const startNeighbors = new Set(boardAdjacency.neighborsByGroupId.get("S-001") ?? []);
    const detachedGroupId = [...boardAdjacency.neighborsByGroupId.keys()].find(
      (groupId) => groupId !== "S-001" && !startNeighbors.has(groupId),
    );
    expect(detachedGroupId).toBeDefined();
    const result = suggestHolomemBoardNodes({
      ...baseInput,
      unlockedNodeGroupIds: ["S-001", detachedGroupId!],
    });
    expect(result.boardDiagnostics.declaredStateConsistentWithDerivedAdjacency).toBe(false);
  });

  it("is independent of declared-state ordering", () => {
    const someNeighbor = (boardAdjacency.neighborsByGroupId.get("S-001") ?? [])[0]!;
    const forward = suggestHolomemBoardNodes({
      ...baseInput,
      unlockedNodeGroupIds: ["S-001", someNeighbor],
    });
    const reversed = suggestHolomemBoardNodes({
      ...baseInput,
      unlockedNodeGroupIds: [someNeighbor, "S-001"],
    });
    expect(forward).toEqual(reversed);
  });

  it("routes bundles through paid zero-value nodes and breaks exact ties lexicographically", () => {
    const catalogs: MechanicsData["catalogs"] = structuredClone(mechanicsData.catalogs);
    const template = (kind: string) => {
      const node = catalogs.boardNodes.find((candidate) => {
        if (candidate.kind !== kind || candidate.characterIds.length > 0) return false;
        if (kind !== "card") return true;
        const effect = catalogs.boardEffects.find((row) => row.id === candidate.effectId);
        return effect !== undefined && effect.kind === "all-parameter-up";
      });
      expect(node, `template for ${kind}`).toBeDefined();
      return node!;
    };
    const effectTemplate = catalogs.boardEffects.find((row) => row.kind === "all-parameter-up");
    expect(effectTemplate).toBeDefined();
    const fixtureEffect = (id: string, value: number) => ({
      ...structuredClone(effectTemplate!),
      id,
      value,
    });
    catalogs.boardEffects.push(fixtureEffect("fx-small", 10), fixtureEffect("fx-big", 500));
    const fixtureNode = (groupId: string, kind: string, pointCost: number, effectId?: string) => ({
      ...structuredClone(template(kind)),
      id: `${groupId}:1`,
      groupId,
      number: 1,
      characterIds: [],
      pointCost,
      viewConditionGroupId: null,
      unlockConditionGroupId: null,
      ...(effectId === undefined ? {} : { effectId }),
    });
    catalogs.boardNodes = [
      fixtureNode("S-001", "connection", 0),
      fixtureNode("F-AAA", "card", 2, "fx-small"),
      fixtureNode("F-BBB", "card", 2, "fx-small"),
      fixtureNode("F-MID", "content", 2),
      fixtureNode("F-FAR", "card", 1, "fx-big"),
    ];
    const adjacency = {
      ...boardAdjacency,
      startGroupId: "S-001",
      neighborsByGroupId: new Map(Object.entries({
        "S-001": ["F-AAA", "F-BBB", "F-MID"],
        "F-AAA": ["S-001"],
        "F-BBB": ["S-001"],
        "F-MID": ["S-001", "F-FAR"],
        "F-FAR": ["F-MID"],
      })),
    } as typeof boardAdjacency;

    const run = (extraPointsOwned: number) =>
      suggestHolomemBoardNodes({
        ...baseInput,
        holomemRank: 1,
        extraPointsOwned,
        catalogs,
        adjacency,
      });

    // Budget 2: exactly one of the two identical-value, identical-cost frontier
    // nodes is affordable - the lexicographically first must win the tie.
    const tie = run(2);
    expect(tie.suggestedUnlocks.map((unlock) => unlock.nodeGroupId)).toEqual(["F-AAA"]);

    // Budget 3: the only reachable value inside the budget sits behind a paid
    // zero-value content node - the bundle must route through it.
    const bundle = run(3);
    expect(bundle.suggestedUnlocks.map((unlock) => unlock.nodeGroupId)).toEqual(["F-MID", "F-FAR"]);
    const midUnlock = bundle.suggestedUnlocks.find((unlock) => unlock.nodeGroupId === "F-MID")!;
    expect(midUnlock.valueMicroUnits ?? 0).toBe(0);
  });

  it("breaks state ties in sorted group-index order, matching a naive comparison exhaustively", () => {
    // Indices straddle word boundaries and include bit 31, the signed-word edge.
    const universe = [0, 1, 30, 31, 32, 33, 62, 63];
    const wordsFor = (indices: readonly number[]): number[] => {
      const words = [0, 0];
      for (const index of indices) words[index >>> 5] = (words[index >>> 5]! | (1 << (index & 31))) | 0;
      return words;
    };
    const naive = (left: readonly number[], right: readonly number[]): number => {
      for (let position = 0; ; position += 1) {
        const leftIndex = left[position];
        const rightIndex = right[position];
        if (leftIndex === undefined && rightIndex === undefined) return 0;
        if (leftIndex === undefined) return -1;
        if (rightIndex === undefined) return 1;
        if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      }
    };
    const subsets: number[][] = [];
    for (let mask = 0; mask < 1 << universe.length; mask += 1) {
      subsets.push(universe.filter((_, position) => (mask & (1 << position)) !== 0));
    }
    for (const left of subsets) {
      for (const right of subsets) {
        const expected = Math.sign(naive(left, right));
        const actual = Math.sign(compareUnlockedMembership(wordsFor(left), wordsFor(right)));
        if (actual !== expected) {
          throw new Error(`membership comparison diverged for [${left.join()}] vs [${right.join()}]`);
        }
      }
    }
  });

  it("exposes the required architectural boundary in source text", () => {
    const source = readFileSync(new URL("./holomem-board-suggester.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from\s+["']\.\/(native-utility|formation-evaluator|team-calculator|exact-optimizer-[a-z-]+)["']/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/toBeCloseTo/);
  });
});
