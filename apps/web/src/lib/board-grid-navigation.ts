import { boardAdjacency, type BoardGridCell } from "@yagoo-dori/core/holomem-board";

export type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

// Upstream grid coordinates are y-up (positive y is toward the top of the
// rendered board), matching the y-flip in the board SVG renderer.
const DIRECTIONS: Readonly<Record<ArrowKey, { x: number; y: number }>> = {
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

function cellKey(cell: BoardGridCell): string {
  return `${cell.x},${cell.y}`;
}

// Roving-tabindex arrow movement follows the requested grid ray. Only eligible
// (non-disabled) occupied cells may receive focus: an ineligible node is
// skipped so the roving tab stop never lands on a tabIndex=-1 element.
export function movementTarget(
  treeModelId: string,
  groupId: string,
  key: ArrowKey,
  isEligible: (candidateGroupId: string) => boolean,
): string | null {
  const positions = boardAdjacency.cellByGroupIdByTreeModel.get(treeModelId);
  if (!positions) return null;
  const current = positions.get(groupId);
  if (!current) return null;

  const groupIdByCell = new Map<string, string>();
  let minX = current.x;
  let maxX = current.x;
  let minY = current.y;
  let maxY = current.y;
  for (const [candidateGroupId, cell] of positions) {
    groupIdByCell.set(cellKey(cell), candidateGroupId);
    minX = Math.min(minX, cell.x);
    maxX = Math.max(maxX, cell.x);
    minY = Math.min(minY, cell.y);
    maxY = Math.max(maxY, cell.y);
  }

  const direction = DIRECTIONS[key];
  let x = current.x + direction.x;
  let y = current.y + direction.y;
  while (x >= minX && x <= maxX && y >= minY && y <= maxY) {
    const candidateGroupId = groupIdByCell.get(cellKey({ x, y }));
    if (candidateGroupId !== undefined && isEligible(candidateGroupId)) return candidateGroupId;
    x += direction.x;
    y += direction.y;
  }
  return null;
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
