import { describe, expect, it } from "vitest";

import {
  HOLOMEM_BOARD_CONTRACT_SCHEMA_VERSION,
  HolomemBoardContractSchema,
  holomemRankIncome,
  parseHolomemBoardContract,
  type HolomemBoardRequest,
  type HolomemBoardResult,
} from "./holomem-board-contract";

const TALENTS = ["talent-a", "talent-b", "talent-c", "talent-d", "talent-e"] as const;

function baseRequest(): HolomemBoardRequest {
  const members = TALENTS.map((talentId) => ({
    talentId,
    cardId: `card-${talentId}`,
    lens: "one-copy-max" as const,
  }));
  return {
    schemaVersion: HOLOMEM_BOARD_CONTRACT_SCHEMA_VERSION,
    rosterCommit: "a".repeat(40),
    playerLevel: null,
    team: { leader: members[0]!, members },
    connectCandidates: [{ cardId: "connect-card", bloomStage: 0 }],
    boards: Object.fromEntries(TALENTS.map((talentId) => [talentId, {
      rank: 1,
      pointMode: "estimate-from-rank" as const,
      extraPoints: 0,
      directPoints: null,
      unlockedNodeGroupIds: [],
      connectPlacements: {},
    }])),
  };
}

function emptyResult(request: HolomemBoardRequest = baseRequest()): HolomemBoardResult {
  const rankIncome = holomemRankIncome(1);
  return {
    schemaVersion: HOLOMEM_BOARD_CONTRACT_SCHEMA_VERSION,
    claim: {
      kind: "bounded-suggestion",
      conditionalOn: "current-team-and-declared-board-state",
      adjacencyBasis: "derived-orthogonal-grid-adjacency",
      stackingModel: "additive-envelope-not-jointly-attainable",
      unitConnectRule: "independent-user-confirmed",
      globallyCertified: false,
    },
    perMember: request.team.members.map((member) => ({
      talentId: member.talentId,
      cardId: member.cardId,
      position: member.talentId === request.team.leader.talentId ? "leader" as const : "member" as const,
      ledger: {
        rankIncome,
        extraPoints: 0,
        totalAvailable: rankIncome,
        alreadySpent: 0,
        remainingAvailable: rankIncome,
        suggestedCost: 0,
      },
      claimedMicroUnits: 0,
      greedyBaselineMicroUnits: 0,
      suggestions: [],
    })),
    connect: {
      assignment: "hungarian-complete",
      unitConnectRule: "independent-user-confirmed",
      amplificationModel: "multiplier-total",
      assignments: [],
      lockedSlots: [],
      excludedCandidates: [],
    },
    noteCodes: [],
  };
}

function messagesFor(request: unknown, result: unknown): string[] {
  const parsed = HolomemBoardContractSchema.safeParse({ request, result });
  if (parsed.success) throw new Error("Expected the contract to reject the fixture");
  return parsed.error.issues.map((issue) => issue.message);
}

function suggestion(overrides: Record<string, unknown> = {}) {
  return {
    order: 1,
    nodeGroupId: "G-001",
    nodeId: "N-001",
    kind: "card" as const,
    pointCost: 0,
    valueMicroUnits: null,
    valueClass: "unquantified" as const,
    appliesWhen: "always" as const,
    pathParentGroupId: "S-001",
    effect: {
      kind: "life-up",
      trigger: "always",
      parameter: null,
      flatValue: null,
      valuePermil: null,
    },
    ...overrides,
  };
}

function placement(cardId: string, slot: string) {
  return {
    boardTalentId: "talent-a",
    slot,
    cardId,
    connectLevel: 1 as const,
    extentId: "extent-001",
    amplificationPermil: 1_000,
    gainMicroUnits: 0,
    overlapsWith: [],
    footprint: {
      nodeGroupIds: [],
      unlockedNodeGroupIds: [],
      composition: {
        nodeCount: 0,
        quantifiedNodeCount: 0,
        quantifiedMicroUnits: 0,
        byKind: [],
        nodes: [],
      },
    },
  };
}

describe("holomem Board worker contract", () => {
  it("parses the reconciled v1 request/result shape and wires rank income", () => {
    const request = baseRequest();
    const result = emptyResult(request);
    const parsed = parseHolomemBoardContract({ request, result });

    expect(parsed.request.schemaVersion).toBe(1);
    expect(parsed.request.connectCandidates[0]).toEqual({ cardId: "connect-card", bloomStage: 0 });
    expect(parsed.result.perMember).toHaveLength(5);
    expect(parsed.result.perMember[0]!.position).toBe("leader");
    expect(parsed.result.perMember[0]!.ledger.rankIncome).toBe(holomemRankIncome(1));
    expect(parsed.result.claim.globallyCertified).toBe(false);
  });

  it("rejects unreconciled ledger arithmetic", () => {
    const request = baseRequest();
    const result = emptyResult(request);
    result.perMember[0]!.ledger.totalAvailable += 1;

    expect(messagesFor(request, result).some((message) => message.includes("Ledger arithmetic"))).toBe(true);
  });

  it("rejects an unlock whose prerequisite is neither available nor earlier", () => {
    const request = baseRequest();
    // B-001 is a real 1-point catalog group; alreadySpent must reflect it.
    request.boards["talent-a"]!.unlockedNodeGroupIds = ["B-001"];
    const result = emptyResult(request);
    result.perMember[0]!.ledger.alreadySpent = 1;
    result.perMember[0]!.ledger.remainingAvailable = result.perMember[0]!.ledger.totalAvailable - 1;
    result.perMember[0]!.suggestions = [suggestion({ pathParentGroupId: "B-001" })];
    expect(parseHolomemBoardContract({ request, result }).result.perMember[0]!.suggestions[0]!.pathParentGroupId)
      .toBe("B-001");
    result.perMember[0]!.suggestions = [suggestion({ pathParentGroupId: "G-missing" })];

    expect(messagesFor(request, result).some((message) => message.includes("Unlock order prerequisite"))).toBe(true);
  });

  it("accepts the T3 'start' sentinel as an implicitly available parent", () => {
    const request = baseRequest();
    const result = emptyResult(request);
    result.perMember[0]!.suggestions = [suggestion({ pathParentGroupId: "start" })];

    expect(parseHolomemBoardContract({ request, result }).result.perMember[0]!.suggestions[0]!.pathParentGroupId)
      .toBe("start");
  });

  it("rejects an understated alreadySpent against the catalog cost of declared unlocks", () => {
    const request = baseRequest();
    request.boards["talent-a"]!.unlockedNodeGroupIds = ["B-001", "B-002"];
    const result = emptyResult(request);
    // Producer claims nothing was spent although the declared unlocks cost 2.
    expect(messagesFor(request, result).some((message) =>
      message.includes("alreadySpent must equal the catalog cost"),
    )).toBe(true);
  });

  it("rejects a plan that falls below the greedy baseline", () => {
    const request = baseRequest();
    const result = emptyResult(request);
    result.perMember[0]!.greedyBaselineMicroUnits = 5;

    expect(messagesFor(request, result).some((message) =>
      message.includes("must not fall below the greedy baseline"),
    )).toBe(true);
  });

  it("rejects prose in structured effect fields and unknown exclusion reasons", () => {
    const request = baseRequest();
    const proseResult = emptyResult(request);
    proseResult.perMember[0]!.suggestions = [suggestion({
      valueMicroUnits: null,
      valueClass: "unquantified" as const,
      effect: {
        kind: "Grants Live Score Bonus 150%",
        trigger: "always",
        parameter: null,
        flatValue: null,
        valuePermil: null,
      },
    })];
    expect(HolomemBoardContractSchema.safeParse({ request, result: proseResult }).success).toBe(false);

    const reasonResult = emptyResult(request);
    reasonResult.connect.excludedCandidates = [
      { cardId: "connect-card", reasonCodes: ["This card has no Connect effect."] as never },
    ];
    expect(HolomemBoardContractSchema.safeParse({ request, result: reasonResult }).success).toBe(false);
  });

  it("rejects an objective total that does not equal the suggestion sum", () => {
    const request = baseRequest();
    const result = emptyResult(request);
    result.perMember[0]!.suggestions = [suggestion({ valueMicroUnits: 1_000_000, valueClass: "flat" })];

    expect(messagesFor(request, result).some((message) => message.includes("Objective reconciliation"))).toBe(true);
  });

  it("rejects duplicate cards and invalid slots in Connect placements", () => {
    const request = baseRequest();
    const result = emptyResult(request);
    result.connect.assignments = [placement("connect-card", "S-001"), placement("connect-card", "S-099")];

    const messages = messagesFor(request, result);
    expect(messages.some((message) => message.includes("Connect placement structure"))).toBe(true);
  });

  it("rejects value-class mismatches and connector value", () => {
    const request = baseRequest();
    const result = emptyResult(request);
    result.perMember[0]!.suggestions = [suggestion({ valueMicroUnits: 1, valueClass: "connector" })];

    const messages = messagesFor(request, result);
    expect(messages.some((message) => message.includes("Value-class consistency"))).toBe(true);
  });

  it("accepts an overspent declared Board with no suggestions and pins max-rank income", () => {
    // The rank-based estimate undershoots real achievement/shop income, so a
    // user can legitimately declare more spent than the estimate covers: the
    // honest plan suggests nothing and remainingAvailable goes negative.
    const request = baseRequest();
    // Declare real unlocks costing more than the rank-1 estimate: B-001..B-005
    // cost 1 point each, and any extra achievement/shop income is unmodeled.
    const declared = ["B-001", "B-002", "B-003", "B-004", "B-005"];
    request.boards["talent-a"]!.unlockedNodeGroupIds = declared;
    const result = emptyResult(request);
    const ledger = result.perMember[0]!.ledger;
    ledger.alreadySpent = declared.length;
    ledger.remainingAvailable = ledger.totalAvailable - declared.length;
    expect(ledger.remainingAvailable).toBeLessThan(0);

    expect(parseHolomemBoardContract({ request, result }).result.perMember[0]!.ledger.remainingAvailable)
      .toBe(ledger.remainingAvailable);
    expect(holomemRankIncome(50)).toBe(361);
  });

  it("uses directPoints as the total when the Board state selects direct mode", () => {
    const request = baseRequest();
    const firstTalent = request.team.members[0]!.talentId;
    request.boards[firstTalent] = {
      ...request.boards[firstTalent]!,
      pointMode: "direct",
      directPoints: 17,
    };
    const result = emptyResult(request);
    result.perMember[0]!.ledger.totalAvailable = 17;
    result.perMember[0]!.ledger.remainingAvailable = 17;

    expect(parseHolomemBoardContract({ request, result }).result.perMember[0]!.ledger.totalAvailable).toBe(17);
  });
});
