import { boardAdjacency } from "@yagoo-dori/core";
import type { HolomemBoardResult } from "@yagoo-dori/core/holomem-board-contract";

import type { BoardConnectOverlay } from "@/components/holomem-board/board-svg";
import type { StoredTalentBoard } from "@/lib/team-roster-storage";

export type ConnectAssignment = HolomemBoardResult["connect"]["assignments"][number];

// A Connect overlay must faithfully represent the computed placement: the
// host ring belongs only to the assignment's slot, and amplification ticks
// only to footprint nodes that are both unlocked and quantified positive.
export function overlayForAssignment(
  assignment: ConnectAssignment,
  board: StoredTalentBoard,
): BoardConnectOverlay {
  const unlocked = new Set(["S-001", ...board.unlockedNodeGroupIds]);
  return {
    hostSlot: assignment.slot,
    footprintNodeGroupIds: assignment.footprint.nodeGroupIds,
    amplifiedNodeGroupIds: assignment.footprint.composition.nodes
      .filter((node) => node.valueMicroUnits !== null && node.valueMicroUnits > 0 && unlocked.has(node.nodeGroupId))
      .map((node) => node.nodeGroupId),
    pinned: false,
  };
}

// Fewest-node connecting path from the currently unlocked set to a target
// group, walking the derived orthogonal adjacency (BFS). Returns the locked
// groups to add in unlock order (target included); empty when the target is
// already unlocked or unreachable.
export function shortestConnectionPath(
  targetGroupId: string,
  unlockedGroups: ReadonlySet<string>,
): string[] {
  const startGroups = [...unlockedGroups].filter((groupId) => boardAdjacency.neighborsByGroupId.has(groupId));
  if (startGroups.includes(targetGroupId)) return [];
  const queue = [...startGroups];
  const previous = new Map<string, string | null>(startGroups.map((groupId) => [groupId, null]));
  while (queue.length > 0) {
    const groupId = queue.shift()!;
    for (const neighbor of boardAdjacency.neighborsByGroupId.get(groupId) ?? []) {
      if (previous.has(neighbor)) continue;
      previous.set(neighbor, groupId);
      if (neighbor === targetGroupId) {
        const path: string[] = [];
        let cursor: string | null = neighbor;
        while (cursor !== null && !unlockedGroups.has(cursor)) {
          path.push(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        return path.reverse();
      }
      queue.push(neighbor);
    }
  }
  return [];
}

// The subset of the given groups still connected to the board root; used for
// the cut-vertex cascade when a node is unmarked.
export function reachableGroups(groups: ReadonlySet<string>): Set<string> {
  const reachable = new Set<string>(["S-001"]);
  const queue = ["S-001"];
  while (queue.length > 0) {
    const groupId = queue.shift()!;
    for (const neighbor of boardAdjacency.neighborsByGroupId.get(groupId) ?? []) {
      if (!groups.has(neighbor) || reachable.has(neighbor)) continue;
      reachable.add(neighbor);
      queue.push(neighbor);
    }
  }
  return reachable;
}
