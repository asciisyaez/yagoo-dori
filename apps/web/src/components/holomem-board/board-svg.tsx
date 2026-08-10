import {
  boardAdjacency,
  resolveBoardNodeForTalent,
  treeModelIdForTalent,
  type BoardGridCell,
} from "@yagoo-dori/core/holomem-board";
import { mechanicsData } from "@yagoo-dori/core/mechanics";
import type { HolomemBoardContractSuggestion } from "@yagoo-dori/core/holomem-board-contract";
import type { KeyboardEvent } from "react";

import { boardEffectLabel, type BoardEffectLabelInput } from "@/lib/board-effect-labels";
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
  interactive?: boolean;
  onToggleNode?: (groupId: string) => void;
  onInspectNode?: (groupId: string) => void;
  onFocusNode?: (groupId: string) => void;
  onConnectHover?: (groupId: string | null) => void;
  onConnectPin?: (groupId: string) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}>;

const CELL_SIZE = 36;
const PADDING = 24;

type BoardGeometry = Readonly<{
  minX: number;
  maxY: number;
  width: number;
  height: number;
}>;

function boardGeometry(positions: ReadonlyMap<string, BoardGridCell>): BoardGeometry {
  const cells = [...positions.values()];
  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  const maxY = Math.max(...cells.map((cell) => cell.y));
  return {
    minX,
    maxY,
    width: (maxX - minX + 1) * CELL_SIZE + 2 * PADDING,
    height: (maxY - minY + 1) * CELL_SIZE + 2 * PADDING,
  };
}

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

// Upstream grid coordinates are y-up (positive y is toward the top of the
// in-game board); SVG user space is y-down, so the y axis flips here.
function center(cell: BoardGridCell, geometry: BoardGeometry): { x: number; y: number } {
  return {
    x: PADDING + (cell.x - geometry.minX) * CELL_SIZE + CELL_SIZE / 2,
    y: PADDING + (geometry.maxY - cell.y) * CELL_SIZE + CELL_SIZE / 2,
  };
}

const ARROW_KEYS: readonly ArrowKey[] = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

function handleKeyDown(
  event: KeyboardEvent<SVGGElement>,
  treeModelId: string,
  groupId: string,
  isEligible: (candidateGroupId: string) => boolean,
  onFocusNode: (groupId: string) => void,
): void {
  if (!(ARROW_KEYS as readonly string[]).includes(event.key)) return;
  event.preventDefault();
  const target = movementTarget(treeModelId, groupId, event.key as ArrowKey, isEligible);
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

function parameterForEffectKind(kind: string | null): BoardEffectLabelInput["parameter"] {
  if (kind === null) return null;
  if (kind.startsWith("performance-")) return "performance";
  if (kind.startsWith("technique-")) return "technique";
  if (kind.startsWith("sense-")) return "sense";
  if (kind.startsWith("all-parameter-")) return "all";
  return null;
}

function nodeEffectSummary(
  groupId: string,
  talentId: string,
  suggestion: HolomemBoardContractSuggestion | undefined,
): string | null {
  if (suggestion) {
    return boardEffectLabel({ ...suggestion.effect, valueClass: suggestion.valueClass, appliesWhen: suggestion.appliesWhen });
  }
  try {
    const node = resolveBoardNodeForTalent(groupId, talentId);
    const effect = node.effectId === null
      ? null
      : mechanicsData.catalogs.boardEffects.find((candidate) => candidate.id === node.effectId) ?? null;
    const isPermil = effect?.kind.endsWith("-permil-up") === true;
    const valueClass: BoardEffectLabelInput["valueClass"] = node.kind === "connection"
      ? "connector"
      : node.kind !== "leader" && node.kind !== "card"
        ? "out-of-scope"
        : effect?.value === null || effect === null
          ? "unquantified"
          : isPermil
            ? "permil"
            : "flat";
    if (!effect && node.kind !== "connection") return null;
    return boardEffectLabel({
      kind: effect?.kind ?? null,
      trigger: effect?.characterTrigger ?? null,
      parameter: parameterForEffectKind(effect?.kind ?? null),
      flatValue: !isPermil && typeof effect?.value === "number" && Number.isInteger(effect.value) && effect.value >= 0 ? effect.value : null,
      valuePermil: isPermil && typeof effect?.value === "number" && Number.isInteger(effect.value) && effect.value >= 0 ? effect.value : null,
      valueClass,
      appliesWhen: node.kind === "leader" ? "while-leading" : node.kind === "card" ? "always" : null,
    });
  } catch {
    return null;
  }
}

function nodeStatus(
  state: BoardNodeVisualState,
  unlocked: boolean,
  gateLabel: string | undefined,
): string {
  if (unlocked) return "unlocked";
  if (state === "gated") return `gated${gateLabel ? ` (${gateLabel})` : ""}`;
  if (state === "dimmed") return "not evaluated";
  return "locked";
}

function nodeTitle(
  groupId: string,
  talentId: string,
  state: BoardNodeVisualState,
  unlocked: boolean,
  gateLabel: string | undefined,
  suggestion: HolomemBoardContractSuggestion | undefined,
): string {
  try {
    const node = resolveBoardNodeForTalent(groupId, talentId);
    const effectSummary = nodeEffectSummary(groupId, talentId, suggestion);
    const parts = [
      `${groupId}: ${NODE_KIND_LABELS[node.kind] ?? "Board node"}`,
      `${node.pointCost} point${node.pointCost === 1 ? "" : "s"}`,
    ];
    if (effectSummary && !(state === "dimmed" && effectSummary === "Not evaluated in suggestions.")) {
      parts.push(effectSummary);
    }
    parts.push(nodeStatus(state, unlocked, gateLabel));
    const title = parts.join(", ");
    return state === "dimmed" ? `${title}. Not evaluated in suggestions.` : title;
  } catch {
    const title = `${groupId}: Board node, ${nodeStatus(state, unlocked, gateLabel)}`;
    return state === "dimmed" ? `${title}. Not evaluated in suggestions.` : title;
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
  interactive = false,
  onToggleNode,
  onInspectNode,
  onFocusNode,
  onConnectHover,
  onConnectPin,
  onZoomIn,
  onZoomOut,
}: BoardSvgProps) {
  const treeModelId = treeModelIdForTalent(talentId);
  const positions = boardAdjacency.cellByGroupIdByTreeModel.get(treeModelId);
  if (!positions) return null;
  const geometry = boardGeometry(positions);
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
    interactive && (nodeStates.get(candidateGroupId) ?? "locked") !== "dimmed";
  const initialTabStopGroupId = interactive ? firstEligibleGroupId(groups, isEligible) : null;

  return (
    <div className="hb-board hb-board-viewport" aria-label="Holomem Board grid">
      {interactive && <div className="hb-board-controls" aria-label="Board zoom controls">
        <button onClick={onZoomOut} type="button" aria-label="Zoom out">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={onZoomIn} type="button" aria-label="Zoom in">+</button>
      </div>}
      <svg
        aria-label="Holomem Board skill grid"
        className="hb-board-svg"
        height={geometry.height * zoom}
        role="group"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        width={geometry.width * zoom}
      >
        <title>Holomem Board skill grid</title>
        <defs>
          <pattern
            height={CELL_SIZE}
            id={`hb-grid-dots-${talentId}`}
            patternUnits="userSpaceOnUse"
            width={CELL_SIZE}
            x={PADDING}
            y={PADDING}
          >
            <circle className="hb-grid-dot" cx={CELL_SIZE / 2} cy={CELL_SIZE / 2} r="1.4" />
          </pattern>
        </defs>
        <rect
          aria-hidden="true"
          fill={`url(#hb-grid-dots-${talentId})`}
          height={geometry.height}
          width={geometry.width}
          x="0"
          y="0"
        />
        <g className="hb-board-edges" aria-hidden="true">
          {edges.map(([left, right]) => {
            const leftCell = positions.get(left);
            const rightCell = positions.get(right);
            if (!leftCell || !rightCell) return null;
            const a = center(leftCell, geometry);
            const b = center(rightCell, geometry);
            return <line key={`${left}-${right}`} x1={a.x} x2={b.x} y1={a.y} y2={b.y} />;
          })}
        </g>
        <g className="hb-connect-overlay" aria-hidden="true">
          {connectOverlay && groups.map((groupId) => {
            if (!overlayRenderGroups.has(groupId)) return null;
            const cell = positions.get(groupId);
            if (!cell) return null;
            const point = center(cell, geometry);
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
            const point = center(cell, geometry);
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
            const unlocked = unlockedNodeGroups.has(groupId);
            const title = nodeTitle(groupId, talentId, state, unlocked, gateLabelByGroupId.get(groupId), suggestion);
            // A node inside a pinned Connect overlay activates the overlay
            // pin, not an unlock toggle — checkbox semantics would lie there.
            const overlayPin = overlayGroups.has(groupId);
            const role = interactive ? editMode && !overlayPin ? "checkbox" : "button" : undefined;
            const dimmed = state === "dimmed";
            const activate = () => {
              if (overlayGroups.has(groupId)) onConnectPin?.(groupId);
              else if (editMode) onToggleNode?.(groupId);
              else onInspectNode?.(groupId);
            };
            return (
              <g
                aria-checked={role === "checkbox" ? unlocked : undefined}
                aria-label={title}
                aria-disabled={dimmed || undefined}
                className="hb-board-node"
                data-group-id={groupId}
                key={groupId}
                onClick={interactive && !dimmed ? activate : undefined}
                onFocus={interactive && !dimmed ? () => onFocusNode?.(groupId) : undefined}
                onKeyDown={interactive && !dimmed ? (event) => {
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    activate();
                    return;
                  }
                  handleKeyDown(event, treeModelId, groupId, isEligible, (target) => onFocusNode?.(target));
                } : undefined}
                onMouseEnter={interactive && !dimmed ? () => onConnectHover?.(groupId) : undefined}
                onMouseLeave={interactive && !dimmed ? () => onConnectHover?.(null) : undefined}
                pointerEvents={dimmed ? "none" : undefined}
                role={role}
                tabIndex={interactive ? dimmed ? -1 : focusedGroupId === groupId || (!focusedGroupId && groupId === initialTabStopGroupId) ? 0 : -1 : undefined}
              >
                <title>{title}</title>
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
