import { boardAdjacency, type BoardGridCell } from "@yagoo-dori/core/holomem-board";

function cellFor(treeModelId: string, groupId: string): BoardGridCell | null {
  return boardAdjacency.cellByGroupIdByTreeModel.get(treeModelId)?.get(groupId) ?? null;
}

export type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

// Upstream grid coordinates are y-up (positive y is toward the top of the
// rendered board), matching the y-flip in the board SVG renderer.
const DIRECTIONS: Readonly<Record<ArrowKey, { x: number; y: number }>> = {
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

// Roving-tabindex arrow movement along the derived board adjacency. Only
// eligible (non-disabled) neighbors may receive focus: landing on a disabled
// node would strand the roving tab stop on a tabIndex=-1 element.
export function movementTarget(
  treeModelId: string,
  groupId: string,
  key: ArrowKey,
  isEligible: (candidateGroupId: string) => boolean,
): string | null {
  const current = cellFor(treeModelId, groupId);
  if (!current) return null;
  const candidates = (boardAdjacency.neighborsByGroupId.get(groupId) ?? [])
    .filter((neighbor) => isEligible(neighbor))
    .map((neighbor) => ({ groupId: neighbor, cell: cellFor(treeModelId, neighbor) }))
    .filter((candidate): candidate is { groupId: string; cell: BoardGridCell } => candidate.cell !== null);
  const direction = DIRECTIONS[key];
  const directed = candidates
    .filter(({ cell }) => cell.x - current.x === direction.x && cell.y - current.y === direction.y)
    .sort((left, right) => left.groupId.localeCompare(right.groupId));
  if (directed[0]) return directed[0].groupId;
  return candidates.sort((left, right) => left.groupId.localeCompare(right.groupId))[0]?.groupId ?? null;
}

// The initial roving tab stop must also be an eligible node.
export function firstEligibleGroupId(
  groupIds: readonly string[],
  isEligible: (candidateGroupId: string) => boolean,
): string | null {
  for (const groupId of groupIds) {
    if (isEligible(groupId)) return groupId;
  }
  return null;
}
