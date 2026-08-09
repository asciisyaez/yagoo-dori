import { describe, expect, it } from "vitest";

import {
  overlayForAssignment,
  reachableGroups,
  shortestConnectionPath,
  type ConnectAssignment,
} from "./board-planner-logic";
import type { StoredTalentBoard } from "./team-roster-storage";

const BOARD: StoredTalentBoard = {
  rank: 1,
  pointMode: "estimate-from-rank",
  extraPoints: 0,
  directPoints: null,
  unlockedNodeGroupIds: ["B-001"],
  connectPlacements: {},
};

function assignment(): ConnectAssignment {
  const node = (nodeGroupId: string, valueMicroUnits: number | null) => ({
    nodeGroupId,
    nodeId: `${nodeGroupId}:1`,
    kind: "card" as const,
    valueClass: valueMicroUnits === null ? ("unquantified" as const) : ("flat" as const),
    valueMicroUnits,
  });
  const nodes = [node("B-001", 2_000_000), node("G-001", 1_000_000), node("R-001", null)];
  return {
    boardTalentId: "talent-a",
    slot: "S-001",
    cardId: "card-one",
    connectLevel: 1,
    extentId: "extent-001",
    amplificationPermil: 1_500,
    gainMicroUnits: 1_000_000,
    overlapsWith: [],
    footprint: {
      nodeGroupIds: ["B-001", "G-001", "R-001"],
      unlockedNodeGroupIds: ["B-001"],
      composition: {
        nodeCount: 3,
        quantifiedNodeCount: 2,
        quantifiedMicroUnits: 3_000_000,
        byKind: [{ kind: "card", nodeCount: 3, quantifiedMicroUnits: 3_000_000 }],
        nodes,
      },
    },
  };
}

describe("board planner pure logic", () => {
  it("builds overlays with a separate host and only unlocked quantified amplification", () => {
    const overlay = overlayForAssignment(assignment(), BOARD);
    expect(overlay.hostSlot).toBe("S-001");
    expect(overlay.footprintNodeGroupIds).toEqual(["B-001", "G-001", "R-001"]);
    // G-001 is quantified but locked; R-001 is unlocked-agnostic but
    // unquantified; only B-001 qualifies for an amplification tick.
    expect(overlay.amplifiedNodeGroupIds).toEqual(["B-001"]);
  });

  it("finds the fewest-node connecting path along the derived adjacency", () => {
    expect(shortestConnectionPath("R-001", new Set(["S-001"]))).toEqual(["R-001"]);
    expect(shortestConnectionPath("S-001", new Set(["S-001"]))).toEqual([]);
  });

  it("cascades reachability from the board root", () => {
    // G-001 and R-001 are root-adjacent; G-015 is not adjacent to either.
    const reachable = reachableGroups(new Set(["G-001", "R-001", "G-015"]));
    expect(reachable.has("G-001")).toBe(true);
    expect(reachable.has("R-001")).toBe(true);
    expect(reachable.has("G-015")).toBe(false);
  });
});
