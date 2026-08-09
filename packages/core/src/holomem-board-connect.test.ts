import { describe, expect, it } from "vitest";

import { boardAdjacency, type BoardAdjacency } from "./holomem-board";
import {
  gain,
  recommendHolomemBoardConnect,
  type BoardConnectCardMechanics,
  type HolomemBoardConnectBoard,
  type HolomemBoardConnectCard,
  type HolomemBoardConnectRequest,
} from "./holomem-board-connect";
import { mechanicsData, type MechanicsData } from "./mechanics";
import { publicCards } from "./public-data";

const teamMembers = [...new Map(
  publicCards
    .slice()
    .sort((left, right) => left.talentId.localeCompare(right.talentId) || left.id.localeCompare(right.id))
    .map((card) => [card.talentId, { talentId: card.talentId, cardId: card.id, lens: "one-copy-max" as const }]),
).values()].slice(0, 5);

function fixtureAdjacency(): BoardAdjacency {
  const cells = new Map([
    ["S-001", { x: 0, y: 0 }], ["S-002", { x: 10, y: 0 }],
    ["A-1", { x: 1, y: 0 }], ["B-1", { x: 2, y: 0 }],
    ["A-2", { x: 11, y: 0 }], ["B-2", { x: 12, y: 0 }],
  ]);
  return {
    ...boardAdjacency,
    treeModelIds: ["tree-model-001"],
    cellByGroupIdByTreeModel: new Map([["tree-model-001", cells]]),
    neighborsByGroupId: new Map([...cells.keys()].map((groupId) => [groupId, [] as readonly string[]])),
    nodeGroupCount: 152,
    edgeCount: 171,
  };
}

function fixtureObjective(values: Readonly<Record<string, number>>) {
  const nodes = Object.entries(values).map(([nodeGroupId, valueMicroUnits]) => {
    const isSlot = nodeGroupId.startsWith("S-");
    return {
      nodeGroupId,
      nodeId: `${nodeGroupId}:1`,
      kind: isSlot ? "connection" as const : "card" as const,
      pointCost: 0,
      effectId: null,
      effectKind: null,
      valueMicroUnits: isSlot ? 0 : valueMicroUnits,
      valueClass: isSlot ? "connector" as const : "flat" as const,
      appliesWhen: null,
    };
  });
  return {
    stackingModel: "additive-envelope-not-jointly-attainable" as const,
    focus: { talentId: "fixture-talent", position: "member" as const },
    nodes,
    objectiveByGroupId: new Map(nodes.map((node) => [node.nodeGroupId, node])),
    unquantifiedCandidates: [], inactiveAtPosition: [], connectEnablers: [],
  };
}

function fixtureCatalogs(): MechanicsData["catalogs"] {
  const catalogs = structuredClone(mechanicsData.catalogs);
  const extentTemplate = catalogs.connectExtents[0]!;
  catalogs.connectExtents = [
    { ...extentTemplate, id: "fixture-extent-a", positions: [{ x: 1, y: 0 }] },
    { ...extentTemplate, id: "fixture-extent-b", positions: [{ x: 2, y: 0 }] },
  ];
  return catalogs;
}

function fixtureCard(source: BoardConnectCardMechanics, extentId: string, levelOnePermil: number): BoardConnectCardMechanics {
  return {
    ...structuredClone(source),
    progression: {
      ...source.progression,
      connectEffect: {
        ...source.progression.connectEffect,
        levels: source.progression.connectEffect.levels.map((level) => ({
          ...level, extentId, valuePermil: level.level === 1 ? levelOnePermil : levelOnePermil + 500,
        })),
      },
    },
  };
}

function baseBoard(talentId: string, slot: "S-001" | "S-002", values: Readonly<Record<string, number>>, adjacency: BoardAdjacency): HolomemBoardConnectBoard {
  return {
    talentId, slotIds: [slot], unlockedNodeGroupIds: [slot, ...Object.keys(values)],
    objective: fixtureObjective(values), adjacency,
  };
}

function fixtureRequest(
  cards: readonly HolomemBoardConnectCard[],
  cardCatalog: readonly BoardConnectCardMechanics[],
  boards: readonly HolomemBoardConnectBoard[],
  amplificationModel?: HolomemBoardConnectRequest["amplificationModel"],
): HolomemBoardConnectRequest {
  const request = { cards, cardsCatalog: cardCatalog, catalogs: fixtureCatalogs(), adjacency: fixtureAdjacency(), boards, playerLevel: 50 };
  return amplificationModel === undefined ? request : { ...request, amplificationModel };
}

function assignmentTotal(result: ReturnType<typeof recommendHolomemBoardConnect>): number {
  return result.assignments.reduce((total, assignment) => total + assignment.gainMicroUnits, 0);
}

function exhaustiveTotal(request: HolomemBoardConnectRequest): number {
  const adjacency = request.adjacency ?? boardAdjacency;
  const catalogs = request.catalogs ?? mechanicsData.catalogs;
  const cards = request.cardsCatalog ?? mechanicsData.cards;
  const slots = request.boards.flatMap((board) => (board.slotIds ?? []).map((slot) => ({ board, slot })));
  const placed = new Set<string>();
  let best = 0;
  const visit = (index: number, total: number): void => {
    if (index === slots.length) { best = Math.max(best, total); return; }
    visit(index + 1, total);
    const { board, slot } = slots[index]!;
    for (const card of request.cards) {
      if (placed.has(card.cardId)) continue;
      const mechanics = cards.find((candidate) => candidate.cardId === card.cardId);
      if (!mechanics || (card.rarity !== undefined && card.rarity !== 4 && card.rarity !== 5)) continue;
      placed.add(card.cardId);
      const options = {
        adjacency, catalogs, cardsCatalog: cards,
        ...(request.amplificationModel === undefined ? {} : { amplificationModel: request.amplificationModel }),
        ...(request.treeModelIdByTalent === undefined ? {} : { treeModelIdByTalent: request.treeModelIdByTalent }),
      };
      visit(index + 1, total + gain(card, slot, board, options));
      placed.delete(card.cardId);
    }
  };
  visit(0, 0);
  return best;
}

describe("holomem Board Connect recommender", () => {
  it("matches exhaustive enumeration in integer micro-units on a small fixture", () => {
    const adjacency = fixtureAdjacency();
    const cardA = fixtureCard(mechanicsData.cards.find((card) => card.rarity === 5)!, "fixture-extent-a", 2_000);
    const cardB = fixtureCard(mechanicsData.cards.find((card) => card.rarity === 4)!, "fixture-extent-b", 1_500);
    const request = fixtureRequest(
      [{ cardId: cardA.cardId, bloomStage: 0 }, { cardId: cardB.cardId, bloomStage: 0 }], [cardA, cardB],
      [baseBoard("board-1", "S-001", { "A-1": 3_000_000, "B-1": 2_000_000 }, adjacency), baseBoard("board-2", "S-002", { "A-2": 1_000_000, "B-2": 4_000_000 }, adjacency)],
    );
    const result = recommendHolomemBoardConnect(request);
    expect(assignmentTotal(result)).toBe(exhaustiveTotal(request));
    expect(result.assignment).toBe("hungarian-complete");
    expect(result.assignments.every((assignment) => assignment.footprint.composition.nodes.length > 0)).toBe(true);
  });

  it("derives Connect level from Bloom stage 5 and is deterministic", () => {
    const adjacency = fixtureAdjacency();
    const card = fixtureCard(mechanicsData.cards.find((candidate) => candidate.rarity === 5)!, "fixture-extent-a", 2_000);
    const request = fixtureRequest([{ cardId: card.cardId, bloomStage: 5 }], [card], [baseBoard("board-1", "S-001", { "A-1": 2_000_000 }, adjacency)]);
    const first = recommendHolomemBoardConnect(request);
    const second = recommendHolomemBoardConnect(structuredClone(request));
    expect(first).toEqual(second);
    expect(first.assignments[0]!.connectLevel).toBe(2);
    expect(first.assignments[0]!.amplificationPermil).toBe(2_500);
  });

  it("allows an active-team card to win a slot", () => {
    const adjacency = fixtureAdjacency();
    const teamCard = fixtureCard(mechanicsData.cards.find((card) => card.rarity === 5)!, "fixture-extent-a", 2_000);
    const otherCard = fixtureCard(mechanicsData.cards.find((card) => card.rarity === 4)!, "fixture-extent-b", 1_100);
    const team = { leader: { ...teamMembers[0]!, cardId: teamCard.cardId }, members: [{ ...teamMembers[0]!, cardId: teamCard.cardId }, ...teamMembers.slice(1)] };
    const result = recommendHolomemBoardConnect({
      ...fixtureRequest([{ cardId: teamCard.cardId, bloomStage: 0 }, { cardId: otherCard.cardId, bloomStage: 0 }], [teamCard, otherCard], [baseBoard("board-1", "S-001", { "A-1": 2_000_000, "B-1": 2_000_000 }, adjacency)]),
      team,
    });
    expect(result.assignments[0]!.cardId).toBe(teamCard.cardId);
    expect(result.excludedCandidates.find((candidate) => candidate.cardId === teamCard.cardId)).toBeUndefined();
  });

  it("enforces cross-board exclusivity", () => {
    const adjacency = fixtureAdjacency();
    const card = fixtureCard(mechanicsData.cards.find((candidate) => candidate.rarity === 5)!, "fixture-extent-a", 2_000);
    const result = recommendHolomemBoardConnect(fixtureRequest([{ cardId: card.cardId, bloomStage: 0 }], [card], [
      baseBoard("board-1", "S-001", { "A-1": 2_000_000 }, adjacency), baseBoard("board-2", "S-002", { "A-2": 2_000_000 }, adjacency),
    ]));
    expect(result.assignments.filter((assignment) => assignment.cardId === card.cardId)).toHaveLength(1);
  });

  it("excludes star-3 cards and reports gated slots with reason codes", () => {
    const adjacency = fixtureAdjacency();
    const card = fixtureCard(mechanicsData.cards.find((candidate) => candidate.rarity === 5)!, "fixture-extent-a", 2_000);
    const result = recommendHolomemBoardConnect({
      ...fixtureRequest([{ cardId: "synthetic-star-3", rarity: 3, bloomStage: 5 }, { cardId: card.cardId, bloomStage: 0 }], [card], [
        { ...baseBoard("board-1", "S-002", { "A-1": 2_000_000 }, adjacency), playerLevel: 0 },
      ]),
      playerLevel: 0,
    });
    expect(result.excludedCandidates).toContainEqual({ cardId: "synthetic-star-3", reasonCodes: ["star-3-no-connect-effect"] });
    expect(result.lockedSlots[0]!.reasonCodes).toContain("player-level-gate");
    expect(result.assignments).toHaveLength(0);
  });

  it("treats the free Board root slot as implicitly unlocked", () => {
    const adjacency = fixtureAdjacency();
    const card = fixtureCard(mechanicsData.cards.find((candidate) => candidate.rarity === 5)!, "fixture-extent-a", 2_000);
    // S-001 deliberately absent from unlockedNodeGroupIds: the root is free
    // and ungated, and the node suggester treats it as implicitly unlocked.
    const board: HolomemBoardConnectBoard = {
      talentId: "board-1",
      slotIds: ["S-001"],
      unlockedNodeGroupIds: ["A-1"],
      objective: fixtureObjective({ "A-1": 2_000_000 }),
      adjacency,
    };
    const result = recommendHolomemBoardConnect(fixtureRequest([{ cardId: card.cardId, bloomStage: 0 }], [card], [board]));
    expect(result.lockedSlots).toHaveLength(0);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]!.slot).toBe("S-001");
  });

  it("assigns identically regardless of request array order on equal-weight ties", () => {
    const adjacency = fixtureAdjacency();
    // Two cards with identical extents and permil, two boards with identical
    // node values: every placement ties, so only canonical ordering can make
    // the assignment stable across input permutations.
    const cardA = fixtureCard(mechanicsData.cards.find((card) => card.rarity === 5)!, "fixture-extent-a", 2_000);
    const cardB = fixtureCard(mechanicsData.cards.find((card) => card.rarity === 4)!, "fixture-extent-a", 2_000);
    const boards = [
      baseBoard("board-1", "S-001", { "A-1": 2_000_000 }, adjacency),
      baseBoard("board-2", "S-002", { "A-2": 2_000_000 }, adjacency),
    ];
    const forward = recommendHolomemBoardConnect(fixtureRequest(
      [{ cardId: cardA.cardId, bloomStage: 0 }, { cardId: cardB.cardId, bloomStage: 0 }],
      [cardA, cardB],
      boards,
    ));
    const reversed = recommendHolomemBoardConnect(fixtureRequest(
      [{ cardId: cardB.cardId, bloomStage: 0 }, { cardId: cardA.cardId, bloomStage: 0 }],
      [cardB, cardA],
      [...boards].reverse(),
    ));
    expect(reversed.assignments).toEqual(forward.assignments);
    expect(reversed.excludedCandidates).toEqual(forward.excludedCandidates);
  });

  it("can reorder the exact assignment when the amplification model changes", () => {
    const adjacency = fixtureAdjacency();
    const cardA = fixtureCard(mechanicsData.cards.find((card) => card.rarity === 5)!, "fixture-extent-a", 1_500);
    const cardB = fixtureCard(mechanicsData.cards.find((card) => card.rarity === 4)!, "fixture-extent-b", 1_200);
    const request = fixtureRequest([{ cardId: cardA.cardId, bloomStage: 0 }, { cardId: cardB.cardId, bloomStage: 0 }], [cardA, cardB], [
      baseBoard("board-1", "S-001", { "A-1": 3_000_000, "B-1": 4_000_000 }, adjacency), baseBoard("board-2", "S-002", { "A-2": 1_000_000, "B-2": 1_000_000 }, adjacency),
    ]);
    const total = recommendHolomemBoardConnect(request);
    const additional = recommendHolomemBoardConnect({ ...request, amplificationModel: "multiplier-additional" });
    expect(total.assignments.map((assignment) => [assignment.cardId, assignment.boardTalentId])).toEqual([[cardA.cardId, "board-1"], [cardB.cardId, "board-2"]]);
    expect(additional.assignments.map((assignment) => [assignment.cardId, assignment.boardTalentId])).toEqual([[cardB.cardId, "board-1"], [cardA.cardId, "board-2"]]);
    expect(additional.amplificationModelNote).toMatch(/reorder assignments/);
  });
});
