import {
  boardAdjacency,
  resolveBoardNodeForTalent,
  type BoardGridCell,
} from "@yagoo-dori/core/holomem-board";
import type { HolomemBoardContractSuggestion } from "@yagoo-dori/core/holomem-board-contract";
import type { KeyboardEvent } from "react";

import { firstEligibleGroupId, movementTarget, type ArrowKey } from "@/lib/board-grid-navigation";

export type BoardNodeVisualState = "locked" | "unlocked" | "suggested" | "gated" | "dimmed" | "selected";

export type BoardConnectOverlay = Readonly<{
  hostSlot: string;
  footprintNodeGroupIds: readonly string[];
  amplifiedNodeGroupIds: readonly string[];
  pinned: boolean;
}>;

export type BoardSvgProps = Readonly<{
  talentId: string;
  unlockedNodeGroupIds: readonly string[];
  suggestions: readonly HolomemBoardContractSuggestion[];
  nodeStates: ReadonlyMap<string, BoardNodeVisualState>;
  focusedGroupId: string | null;
  selectedGroupId: string | null;
  highlightedPathGroupIds: ReadonlySet<string>;
  connectOverlay: BoardConnectOverlay | null;
  gateLabelByGroupId: ReadonlyMap<string, string>;
  zoom: number;
  editMode: boolean;
  onToggleNode: (groupId: string) => void;
  onInspectNode: (groupId: string) => void;
  onFocusNode: (groupId: string) => void;
  onConnectHover: (groupId: string | null) => void;
  onConnectPin: (groupId: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}>;

const TREE_MODEL_ID = "tree-model-001";
const CELL_SIZE = 36;
const ORIGIN = 24;

const NODE_KIND_LABELS: Readonly<Record<string, string>> = {
  "all-member": "All-member node",
  leader: "Leader node",
  content: "Content node",
  card: "Card node",
  connection: "Connection node",
};

const GLYPHS: Readonly<Record<string, string>> = {
  "all-member": "◆",
  leader: "L",
  content: "♪",
  card: "C",
  connection: "↔",
};

function center(cell: BoardGridCell): { x: number; y: number } {
  return {
    x: ORIGIN + cell.x * CELL_SIZE + CELL_SIZE / 2,
    y: ORIGIN + cell.y * CELL_SIZE + CELL_SIZE / 2,
  };
}

const ARROW_KEYS: readonly ArrowKey[] = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

function handleKeyDown(
  event: KeyboardEvent<SVGGElement>,
  groupId: string,
  isEligible: (candidateGroupId: string) => boolean,
  onFocusNode: (groupId: string) => void,
): void {
  if (!(ARROW_KEYS as readonly string[]).includes(event.key)) return;
  event.preventDefault();
  const target = movementTarget(groupId, event.key as ArrowKey, isEligible);
  if (target) {
    onFocusNode(target);
    const nextElement = event.currentTarget.parentElement?.querySelector<SVGGElement>(`[data-group-id="${target}"]`);
    nextElement?.focus();
  }
}

function shapeForNode(kind: string, point: { x: number; y: number }, className: string) {
  if (kind === "all-member") {
    return <rect className={className} height="25" rx="4" transform={`rotate(45 ${point.x} ${point.y})`} width="25" x={point.x - 12.5} y={point.y - 12.5} />;
  }
  if (kind === "content") {
    return <polygon className={className} points={`${point.x},${point.y - 15} ${point.x + 14},${point.y + 10} ${point.x - 14},${point.y + 10}`} />;
  }
  if (kind === "connection") {
    return <rect className={className} height="25" rx="12" width="30" x={point.x - 15} y={point.y - 12.5} />;
  }
  return <circle className={className} cx={point.x} cy={point.y} r="14" />;
}

function nodeTitle(groupId: string, talentId: string): string {
  try {
    const node = resolveBoardNodeForTalent(groupId, talentId);
    return `${NODE_KIND_LABELS[node.kind] ?? "Board node"}, ${node.pointCost} point${node.pointCost === 1 ? "" : "s"}`;
  } catch {
    return "Board node";
  }
}

export function BoardSvg({
  talentId,
  suggestions,
  nodeStates,
  focusedGroupId,
  selectedGroupId,
  highlightedPathGroupIds,
  connectOverlay,
  gateLabelByGroupId,
  unlockedNodeGroupIds,
  zoom,
  editMode,
  onToggleNode,
  onInspectNode,
  onFocusNode,
  onConnectHover,
  onConnectPin,
  onZoomIn,
  onZoomOut,
}: BoardSvgProps) {
  const positions = boardAdjacency.cellByGroupIdByTreeModel.get(TREE_MODEL_ID);
  if (!positions) return null;
  const suggestionByGroupId = new Map(suggestions.map((suggestion) => [suggestion.nodeGroupId, suggestion]));
  const overlayGroups = new Set(connectOverlay?.footprintNodeGroupIds ?? []);
  const overlayRenderGroups = new Set(connectOverlay ? [...overlayGroups, connectOverlay.hostSlot] : []);
  const unlockedNodeGroups = new Set(["S-001", ...unlockedNodeGroupIds]);
  const amplifiedNodeGroups = new Set(
    (connectOverlay?.amplifiedNodeGroupIds ?? []).filter((groupId) => unlockedNodeGroups.has(groupId)),
  );
  const groups = [...positions.keys()].sort();
  const edges = groups.flatMap((groupId) =>
    (boardAdjacency.neighborsByGroupId.get(groupId) ?? [])
      .filter((neighbor) => groupId < neighbor)
      .map((neighbor) => [groupId, neighbor] as const),
  );
  const isEligible = (candidateGroupId: string) =>
    (nodeStates.get(candidateGroupId) ?? "locked") !== "dimmed";
  const initialTabStopGroupId = firstEligibleGroupId(groups, isEligible);

  return (
    <div className="hb-board hb-board-viewport" aria-label="Holomem Board grid">
      <div className="hb-board-controls" aria-label="Board zoom controls">
        <button onClick={onZoomOut} type="button" aria-label="Zoom out">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={onZoomIn} type="button" aria-label="Zoom in">+</button>
      </div>
      <svg
        aria-label="Holomem Board skill grid"
        className="hb-board-svg"
        height={912 * zoom}
        role="group"
        viewBox="0 0 804 912"
        width={804 * zoom}
      >
        <title>Holomem Board skill grid</title>
        <g className="hb-board-edges" aria-hidden="true">
          {edges.map(([left, right]) => {
            const leftCell = positions.get(left);
            const rightCell = positions.get(right);
            if (!leftCell || !rightCell) return null;
            const a = center(leftCell);
            const b = center(rightCell);
            return <line key={`${left}-${right}`} x1={a.x} x2={b.x} y1={a.y} y2={b.y} />;
          })}
        </g>
        <g className="hb-connect-overlay" aria-hidden="true">
          {connectOverlay && groups.map((groupId) => {
            if (!overlayRenderGroups.has(groupId)) return null;
            const cell = positions.get(groupId);
            if (!cell) return null;
            const point = center(cell);
            return (
              <g key={groupId}>
                {overlayGroups.has(groupId) && <rect className="hb-connect-cell" height="34" rx="4" width="34" x={point.x - 17} y={point.y - 17} />}
                {groupId === connectOverlay.hostSlot && <circle className={connectOverlay.pinned ? "hb-connect-ring hb-connect-ring--pinned" : "hb-connect-ring"} cx={point.x} cy={point.y} r="20" />}
                {amplifiedNodeGroups.has(groupId) && <text className="hb-connect-tick" x={point.x} y={point.y - 22}>▲</text>}
              </g>
            );
          })}
        </g>
        <g className="hb-board-nodes">
          {groups.map((groupId) => {
            const cell = positions.get(groupId);
            if (!cell) return null;
            const point = center(cell);
            const state = nodeStates.get(groupId) ?? "locked";
            const suggestion = suggestionByGroupId.get(groupId);
            const selected = selectedGroupId === groupId || state === "selected";
            const path = highlightedPathGroupIds.has(groupId);
            const nodeClass = [
              "hb-node",
              `hb-node--${state}`,
              selected ? "hb-node--selected" : "",
              path ? "hb-node--path" : "",
            ].filter(Boolean).join(" ");
            const nodeKind = (() => {
              try { return resolveBoardNodeForTalent(groupId, talentId).kind; } catch { return "content"; }
            })();
            const node = shapeForNode(nodeKind, point, nodeClass);
            const title = nodeTitle(groupId, talentId);
            const accessibleTitle = state === "dimmed" ? `${title}. Not evaluated in suggestions.` : title;
            const dimmed = state === "dimmed";
            return (
              <g
                aria-checked={state === "unlocked" || state === "selected"}
                aria-label={accessibleTitle}
                aria-disabled={dimmed || undefined}
                className="hb-board-node"
                data-group-id={groupId}
                key={groupId}
                onClick={dimmed ? undefined : () => {
                  if (overlayGroups.has(groupId)) onConnectPin(groupId);
                  else if (editMode) onToggleNode(groupId);
                  else onInspectNode(groupId);
                }}
                onFocus={dimmed ? undefined : () => onFocusNode(groupId)}
                onKeyDown={dimmed ? undefined : (event) => {
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    if (overlayGroups.has(groupId)) onConnectPin(groupId);
                    else if (editMode) onToggleNode(groupId);
                    else onInspectNode(groupId);
                    return;
                  }
                  handleKeyDown(event, groupId, isEligible, onFocusNode);
                }}
                onMouseEnter={dimmed ? undefined : () => onConnectHover(groupId)}
                onMouseLeave={dimmed ? undefined : () => onConnectHover(null)}
                role="checkbox"
                tabIndex={dimmed ? -1 : focusedGroupId === groupId || (!focusedGroupId && groupId === initialTabStopGroupId) ? 0 : -1}
              >
                <title>{accessibleTitle}</title>
                {node}
                <text className="hb-node-glyph" x={point.x} y={point.y + 5}>{GLYPHS[nodeKind] ?? "·"}</text>
                {suggestion && <circle className="hb-suggested-ring" cx={point.x} cy={point.y} r="18" />}
                {suggestion && <text className="hb-node-order" x={point.x + 15} y={point.y - 13}>{suggestion.order}</text>}
                {state === "gated" && <text className="hb-node-gate" x={point.x} y={point.y + 25}>🔒 {gateLabelByGroupId.get(groupId) ?? "Gate"}</text>}
                {state === "dimmed" && <text className="hb-node-gate" x={point.x} y={point.y + 25}>N/E</text>}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
