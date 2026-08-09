import { describe, expect, it } from "vitest";

import { firstEligibleGroupId, movementTarget } from "./board-grid-navigation";

// Real derived-adjacency facts: S-001 sits at (0,0) with neighbors
// B-001 (-1,0), G-001 (0,-1), R-001 (0,1), Y-001 (1,0).
describe("board grid keyboard navigation", () => {
  it("moves to the directed neighbor when it is eligible", () => {
    expect(movementTarget("S-001", "ArrowUp", () => true)).toBe("G-001");
    expect(movementTarget("S-001", "ArrowDown", () => true)).toBe("R-001");
    expect(movementTarget("S-001", "ArrowLeft", () => true)).toBe("B-001");
    expect(movementTarget("S-001", "ArrowRight", () => true)).toBe("Y-001");
  });

  it("never targets an ineligible (dimmed) node", () => {
    // The review's stranding case: ArrowUp from the root toward dimmed G-001
    // must fall back to an eligible neighbor instead of stranding focus on a
    // tabIndex=-1 element.
    const eligible = (groupId: string) => groupId !== "G-001";
    const target = movementTarget("S-001", "ArrowUp", eligible);
    expect(target).not.toBe("G-001");
    expect(target).toBe("B-001");
  });

  it("returns null when no neighbor is eligible", () => {
    expect(movementTarget("S-001", "ArrowUp", () => false)).toBeNull();
  });

  it("selects the first eligible group as the initial roving tab stop", () => {
    expect(firstEligibleGroupId(["B-001", "B-002", "G-001"], (groupId) => groupId !== "B-001")).toBe("B-002");
    expect(firstEligibleGroupId(["B-001"], () => false)).toBeNull();
  });
});
