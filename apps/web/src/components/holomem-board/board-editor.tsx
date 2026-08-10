"use client";

import {
  boardAdjacency,
  resolveBoardNodeForTalent,
} from "@yagoo-dori/core/holomem-board";
import { mechanicsData } from "@yagoo-dori/core/mechanics";
import type { HolomemBoardContractSuggestion } from "@yagoo-dori/core/holomem-board-contract";
import { comparePublicMemberCards } from "@yagoo-dori/core/member-card-order";

import { boardEffectLabel } from "@/lib/board-effect-labels";
import type { BoardConnectSlot, StoredTalentBoard } from "@/lib/team-roster-storage";

import { BoardSvg, type BoardConnectOverlay, type BoardNodeVisualState } from "./board-svg";
import type { PlannerCardOption } from "./team-source-panel";

export type BoardEditorProps = Readonly<{
  talentId: string;
  talentName: string;
  board: StoredTalentBoard;
  playerLevel: number | null;
  connectCards: readonly PlannerCardOption[];
  suggestions: readonly HolomemBoardContractSuggestion[];
  selectedGroupId: string | null;
  focusedGroupId: string | null;
  highlightedPathGroupIds: ReadonlySet<string>;
  connectOverlay: BoardConnectOverlay | null;
  toast: string | null;
  zoom: number;
  editMode: boolean;
  copySources: readonly { talentId: string; label: string }[];
  onBoardChange: (patch: Partial<StoredTalentBoard>) => void;
  onAutoUnlock: () => void;
  onToggleNode: (groupId: string) => void;
  onInspectNode: (groupId: string) => void;
  onFocusNode: (groupId: string) => void;
  onConnectHover: (groupId: string | null) => void;
  onConnectPin: (groupId: string) => void;
  onPlacement: (slot: BoardConnectSlot, cardId: string | undefined) => void;
  onCopyFrom: (talentId: string) => void;
  onClear: () => void;
  onUndo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onEditMode: (editMode: boolean) => void;
}>;

const SLOT_IDS: readonly BoardConnectSlot[] = ["S-001", "S-002", "S-003", "S-004"];

function nodeGateThreshold(groupId: string): number | null {
  try {
    const node = mechanicsData.catalogs.boardNodes.find((candidate) => candidate.groupId === groupId);
    const conditionId = node?.unlockConditionGroupId ?? node?.viewConditionGroupId;
    return mechanicsData.catalogs.boardNodeConditions.find((condition) => condition.id === conditionId)?.threshold ?? null;
  } catch {
    return null;
  }
}

function nodeStates(
  talentId: string,
  board: StoredTalentBoard,
  suggestions: readonly HolomemBoardContractSuggestion[],
  playerLevel: number | null,
  selectedGroupId: string | null,
): ReadonlyMap<string, BoardNodeVisualState> {
  const unlocked = new Set(["S-001", ...board.unlockedNodeGroupIds]);
  const suggested = new Map(suggestions.map((suggestion) => [suggestion.nodeGroupId, suggestion]));
  const states = new Map<string, BoardNodeVisualState>();
  for (const groupId of boardAdjacency.neighborsByGroupId.keys()) {
    let kind: string | null = null;
    try { kind = resolveBoardNodeForTalent(groupId, talentId).kind; } catch { /* catalog validation owns the failure */ }
    const isDimmed = kind === "all-member" || kind === "content";
    const threshold = nodeGateThreshold(groupId);
    const isGated = playerLevel !== null && threshold !== null && playerLevel < threshold;
    const state: BoardNodeVisualState = isDimmed
        ? "dimmed"
        : selectedGroupId === groupId
          ? "selected"
        : isGated && suggested.has(groupId)
          ? "gated"
          : unlocked.has(groupId)
            ? "unlocked"
            : suggested.has(groupId)
              ? "suggested"
              : "locked";
    states.set(groupId, state);
  }
  return states;
}

function suggestionByGroupId(
  suggestions: readonly HolomemBoardContractSuggestion[],
  selectedGroupId: string | null,
): HolomemBoardContractSuggestion | null {
  return suggestions.find((suggestion) => suggestion.nodeGroupId === selectedGroupId) ?? null;
}

export function BoardEditor({
  talentId,
  talentName,
  board,
  playerLevel,
  connectCards,
  suggestions,
  selectedGroupId,
  focusedGroupId,
  highlightedPathGroupIds,
  connectOverlay,
  toast,
  zoom,
  editMode,
  copySources,
  onBoardChange,
  onAutoUnlock,
  onToggleNode,
  onInspectNode,
  onFocusNode,
  onConnectHover,
  onConnectPin,
  onPlacement,
  onCopyFrom,
  onClear,
  onUndo,
  onZoomIn,
  onZoomOut,
  onEditMode,
}: BoardEditorProps) {
  const unlocked = new Set(["S-001", ...board.unlockedNodeGroupIds]);
  const alreadySpent = [...unlocked]
    .map((groupId) => mechanicsData.catalogs.boardNodes.find((node) => node.groupId === groupId)?.pointCost ?? 0)
    .reduce((sum, cost) => sum + cost, 0);
  const rankIncome = mechanicsData.catalogs.holomemRankPoints
    .filter((entry) => entry.rank <= board.rank)
    .reduce((sum, entry) => sum + entry.points, 0);
  const totalAvailable = board.pointMode === "direct" ? board.directPoints ?? 0 : rankIncome + board.extraPoints;
  const selectedSuggestion = suggestionByGroupId(suggestions, selectedGroupId);
  const placeableConnectCards = connectCards
    .filter((card) => card.rarity === 4 || card.rarity === 5)
    .sort(comparePublicMemberCards);
  const states = nodeStates(talentId, board, suggestions, playerLevel, selectedGroupId);
  const gateLabelByGroupId = new Map(
    [...boardAdjacency.neighborsByGroupId.keys()]
      .map((groupId) => [groupId, nodeGateThreshold(groupId)] as const)
      .filter((entry): entry is readonly [string, number] => entry[1] !== null)
      .map(([groupId, threshold]) => [groupId, `Lv ${threshold}`] as const),
  );

  return (
    <section className="hb-panel hb-editor" aria-labelledby={`hb-editor-${talentId}`}>
      <div className="hb-section-heading">
        <div>
          <p className="hb-eyebrow">Board editor</p>
          <h2 id={`hb-editor-${talentId}`}>{talentName}</h2>
        </div>
        <div className="hb-mode-switch" aria-label="Board editor mode">
          <button className={editMode ? "hb-toggle-active" : ""} onClick={() => onEditMode(true)} type="button">Edit</button>
          <button className={!editMode ? "hb-toggle-active" : ""} onClick={() => onEditMode(false)} type="button">Inspect</button>
        </div>
      </div>
      <div className="hb-board-fields">
        <label>
          Holomem Rank
          <input max={50} min={1} type="number" value={board.rank} onChange={(event) => onBoardChange({ rank: Math.min(50, Math.max(1, Number(event.target.value) || 1)) })} />
        </label>
        <fieldset>
          <legend>Point mode</legend>
          <label><input checked={board.pointMode === "estimate-from-rank"} name={`point-mode-${talentId}`} onChange={() => onBoardChange({ pointMode: "estimate-from-rank" })} type="radio" /> Estimate from rank</label>
          <label><input checked={board.pointMode === "direct"} name={`point-mode-${talentId}`} onChange={() => onBoardChange({ pointMode: "direct", directPoints: board.directPoints ?? 0 })} type="radio" /> Enter directly</label>
        </fieldset>
        {board.pointMode === "estimate-from-rank" ? (
          <label>Extra points<input min={0} type="number" value={board.extraPoints} onChange={(event) => onBoardChange({ extraPoints: Math.max(0, Number(event.target.value) || 0) })} /></label>
        ) : (
          <label>Direct points<input min={0} type="number" value={board.directPoints ?? 0} onChange={(event) => onBoardChange({ directPoints: Math.max(0, Number(event.target.value) || 0) })} /></label>
        )}
      </div>
      <div className="hb-board-summary">
        <span>Available: {totalAvailable}</span>
        <span>Declared cost: {alreadySpent}</span>
        {alreadySpent > totalAvailable && <span className="hb-plausibility-note">Declared cost is above the current estimate.</span>}
      </div>
      <div className="hb-board-actions">
        <button
          onClick={onAutoUnlock}
          title="Derived from the catalog's auto-unlock priority; affordable nodes are taken in priority order"
          type="button"
        >Auto-unlock by catalog priority</button>
        <label>Copy from
          <select defaultValue="" onChange={(event) => { if (event.target.value) onCopyFrom(event.target.value); event.currentTarget.value = ""; }}>
            <option value="">Choose a member</option>
            {copySources.map((source) => <option key={source.talentId} value={source.talentId}>{source.label}</option>)}
          </select>
        </label>
        <button onClick={onClear} type="button">Clear</button>
        <button onClick={onUndo} type="button">Undo</button>
      </div>
      <div className="hb-connect-slots" aria-label="Connect slots">
        {SLOT_IDS.map((slot) => (
          <label className="hb-slot-chip" key={slot}>
            <span>{slot}</span>
            <select value={board.connectPlacements[slot] ?? ""} onChange={(event) => onPlacement(slot, event.target.value || undefined)}>
              <option value="">Empty</option>
              {placeableConnectCards.map((card) => <option key={card.id} value={card.id}>{card.talentName} · {card.rarity}★ · B{card.bloomStage}</option>)}
            </select>
          </label>
        ))}
      </div>
      <BoardSvg
        connectOverlay={connectOverlay}
        editMode={editMode}
        focusedGroupId={focusedGroupId}
        gateLabelByGroupId={gateLabelByGroupId}
        highlightedPathGroupIds={highlightedPathGroupIds}
        nodeStates={states}
        onConnectHover={onConnectHover}
        onConnectPin={onConnectPin}
        onFocusNode={onFocusNode}
        onInspectNode={onInspectNode}
        onToggleNode={onToggleNode}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        interactive
        selectedGroupId={selectedGroupId}
        suggestions={suggestions}
        talentId={talentId}
        unlockedNodeGroupIds={board.unlockedNodeGroupIds}
        zoom={zoom}
      />
      <div className="hb-node-inspector" aria-live="polite">
        {selectedSuggestion ? (
          <>
            <strong>Node {selectedSuggestion.order}: {selectedSuggestion.pointCost} point{selectedSuggestion.pointCost === 1 ? "" : "s"}</strong>
            <span>{boardEffectLabel({ ...selectedSuggestion.effect, valueClass: selectedSuggestion.valueClass, appliesWhen: selectedSuggestion.appliesWhen })}</span>
            <small>Prerequisite: {selectedSuggestion.pathParentGroupId === "start" ? "Board root" : selectedSuggestion.pathParentGroupId}</small>
          </>
        ) : (
          <span>Select a node in Inspect mode to review its structured effect.</span>
        )}
      </div>
      {toast && <p className="hb-toast" role="status">{toast}</p>}
    </section>
  );
}
