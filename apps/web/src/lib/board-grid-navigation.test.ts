import { describe, expect, it } from "vitest";

import { firstEligibleGroupId, movementTarget } from "./board-grid-navigation";

// Real derived-adjacency facts (grid coordinates are y-up, matching the
// in-game board): on tree-model-001, S-001 sits at (0,0) with neighbors
// B-001 (-1,0), G-001 (0,-1), R-001 (0,1), Y-001 (1,0), and the downward
// ray continues G-001, G-002, G-005, G-006, … On tree-model-004 (e.g.
// Usada Pekora) the x-axis is mirrored: B-001 (1,0) and Y-001 (-1,0).
describe("board grid keyboard navigation", () => {
  it("moves to the directed neighbor when it is eligible", () => {
    expect(movementTarget("tree-model-001", "S-001", "ArrowUp", () => true)).toBe("R-001");
    expect(movementTarget("tree-model-001", "S-001", "ArrowDown", () => true)).toBe("G-001");
    expect(movementTarget("tree-model-001", "S-001", "ArrowLeft", () => true)).toBe("B-001");
    expect(movementTarget("tree-model-001", "S-001", "ArrowRight", () => true)).toBe("Y-001");
  });

  it("follows each tree model's own geometry", () => {
    // Pekora's model: the card path starts to the RIGHT of the root and the
    // yellow path to the LEFT — mirrored against tree-model-001.
    expect(movementTarget("tree-model-004", "S-001", "ArrowRight", () => true)).toBe("B-001");
    expect(movementTarget("tree-model-004", "S-001", "ArrowLeft", () => true)).toBe("Y-001");
    expect(movementTarget("tree-model-004", "S-001", "ArrowUp", () => true)).toBe("R-001");
    // The remaining two models pair up with the first two around the root:
    // 003 matches 001 (blue left), 002 matches 004 (blue right).
    expect(movementTarget("tree-model-003", "S-001", "ArrowLeft", () => true)).toBe("B-001");
    expect(movementTarget("tree-model-003", "S-001", "ArrowRight", () => true)).toBe("Y-001");
    expect(movementTarget("tree-model-002", "S-001", "ArrowRight", () => true)).toBe("B-001");
    expect(movementTarget("tree-model-002", "S-001", "ArrowLeft", () => true)).toBe("Y-001");
  });

  it("applies the same same-ray policy on every tree model", () => {
    for (const treeModelId of ["tree-model-001", "tree-model-002", "tree-model-003", "tree-model-004"]) {
      // Skip the immediate downward node: focus continues along the down ray.
      const skipOne = (groupId: string) => groupId !== "G-001";
      expect(movementTarget(treeModelId, "S-001", "ArrowDown", skipOne)).toBe("G-002");
      // Only a perpendicular neighbor is eligible: no movement at all.
      const onlyUpNeighbor = (groupId: string) => groupId === "R-001";
      expect(movementTarget(treeModelId, "S-001", "ArrowDown", onlyUpNeighbor)).toBeNull();
    }
  });

  it("skips ineligible nodes along the same ray instead of changing direction", () => {
    // The pass-2 finding: a Down press must never resolve to a perpendicular
    // move. With G-001 dimmed, focus skips along the downward ray to G-002.
    const skipOne = (groupId: string) => groupId !== "G-001";
    expect(movementTarget("tree-model-001", "S-001", "ArrowDown", skipOne)).toBe("G-002");

    const skipTwo = (groupId: string) => groupId !== "G-001" && groupId !== "G-002";
    expect(movementTarget("tree-model-001", "S-001", "ArrowDown", skipTwo)).toBe("G-005");

    // Mirrored model, same policy on the horizontal axis.
    const skipRight = (groupId: string) => groupId !== "B-001";
    expect(movementTarget("tree-model-004", "S-001", "ArrowRight", skipRight)).toBe("B-002");
  });

  it("does not move at all when the requested ray has no eligible node", () => {
    // Only the perpendicular B-001 is eligible: Down must return null rather
    // than jump left.
    const onlyLeftNeighbor = (groupId: string) => groupId === "B-001";
    expect(movementTarget("tree-model-001", "S-001", "ArrowDown", onlyLeftNeighbor)).toBeNull();
    expect(movementTarget("tree-model-001", "S-001", "ArrowUp", () => false)).toBeNull();
  });

  it("selects the first eligible group as the initial roving tab stop", () => {
    expect(firstEligibleGroupId(["B-001", "B-002", "G-001"], (groupId) => groupId !== "B-001")).toBe("B-002");
    expect(firstEligibleGroupId(["B-001"], () => false)).toBeNull();
  });
});
