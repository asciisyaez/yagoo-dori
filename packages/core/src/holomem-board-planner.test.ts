import { describe, expect, it } from "vitest";

import {
  HOLOMEM_BOARD_CONTRACT_SCHEMA_VERSION,
  HolomemBoardResultSchema,
  type HolomemBoardRequest,
} from "./holomem-board-contract";
import { planHolomemBoard } from "./holomem-board-planner";
import { publicCards } from "./public-data";

function realRequest(): HolomemBoardRequest {
  const members = [...new Map(
    publicCards
      .slice()
      .sort((left, right) => left.talentId.localeCompare(right.talentId) || left.id.localeCompare(right.id))
      .map((card) => [card.talentId, {
        talentId: card.talentId,
        cardId: card.id,
        lens: "one-copy-max" as const,
      }]),
  ).values()].slice(0, 5);
  return {
    schemaVersion: HOLOMEM_BOARD_CONTRACT_SCHEMA_VERSION,
    rosterCommit: "a".repeat(40),
    playerLevel: 50,
    team: { leader: members[0]!, members },
    connectCandidates: members.map((member) => ({ cardId: member.cardId, bloomStage: 0 as const })),
    boards: Object.fromEntries(members.map((member) => [member.talentId, {
      rank: 10,
      pointMode: "estimate-from-rank" as const,
      extraPoints: 0,
      directPoints: null,
      unlockedNodeGroupIds: ["S-001"],
      connectPlacements: {},
    }])),
  };
}

describe("Holomem Board planner", () => {
  it("plans all five real-catalog members, parses its own result, and is deterministic", () => {
    const request = realRequest();
    const first = planHolomemBoard(request);
    const second = planHolomemBoard(structuredClone(request));

    expect(first).toEqual(second);
    expect(HolomemBoardResultSchema.safeParse(first).success).toBe(true);
    expect(first.perMember).toHaveLength(5);
    expect(first.perMember.map((member) => member.position)).toEqual([
      "leader",
      "member",
      "member",
      "member",
      "member",
    ]);
    expect(first.perMember.every((member) => member.claimedMicroUnits >= member.greedyBaselineMicroUnits)).toBe(true);
    expect(first.connect.assignment).toBe("hungarian-complete");
  });

  it("uses direct points as the total budget while retaining catalog rank income", () => {
    const request = realRequest();
    const firstTalentId = request.team.members[0]!.talentId;
    request.boards[firstTalentId] = {
      ...request.boards[firstTalentId]!,
      pointMode: "direct",
      directPoints: 1,
    };

    const result = planHolomemBoard(request);
    const member = result.perMember.find((candidate) => candidate.talentId === firstTalentId)!;
    expect(member.ledger.pointMode).toBe("direct");
    expect(member.ledger.directPoints).toBe(1);
    expect(member.ledger.rankIncome).toBe(26);
    expect(member.ledger.totalAvailable).toBe(1);
    expect(member.ledger.suggestedCost).toBeLessThanOrEqual(1);

    const estimateMember = result.perMember.find((candidate) => candidate.talentId !== firstTalentId)!;
    expect(estimateMember.ledger.pointMode).toBe("estimate-from-rank");
    expect(estimateMember.ledger.directPoints).toBeNull();
  });
});
