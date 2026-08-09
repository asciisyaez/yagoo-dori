import {
  boardAdjacency,
  mechanicsData,
  resolveBoardNodeForTalent,
} from "@yagoo-dori/core";

import { boardEffectLabel, type BoardEffectLabelInput } from "@/lib/board-effect-labels";

import { BoardSvg, type BoardNodeVisualState } from "./board-svg";

const VARIANT_GROUPS = ["G-008", "G-011", "G-021"] as const;
const SLOT_IDS = ["S-001", "S-002", "S-003", "S-004"] as const;

function parameterForEffectKind(kind: string | null): BoardEffectLabelInput["parameter"] {
  if (kind === null) return null;
  if (kind.startsWith("performance-")) return "performance";
  if (kind.startsWith("technique-")) return "technique";
  if (kind.startsWith("sense-")) return "sense";
  if (kind.startsWith("all-parameter-")) return "all";
  return null;
}

function structuredEffectForNode(groupId: string, talentId: string): BoardEffectLabelInput {
  const node = resolveBoardNodeForTalent(groupId, talentId);
  const effect = node.effectId === null
    ? null
    : mechanicsData.catalogs.boardEffects.find((candidate) => candidate.id === node.effectId) ?? null;
  const kind = effect?.kind ?? null;
  const isPermil = kind?.endsWith("-permil-up") === true;
  const isGroupingReference = kind === "all-parameter-up-for-character-grouping";
  return {
    kind,
    trigger: effect?.characterTrigger ?? null,
    parameter: parameterForEffectKind(kind),
    flatValue: !isPermil && typeof effect?.value === "number" && Number.isInteger(effect.value) && effect.value >= 0 ? effect.value : null,
    valuePermil: isPermil && typeof effect?.value === "number" && Number.isInteger(effect.value) && effect.value >= 0 ? effect.value : null,
    valueClass: node.kind === "connection" ? "connector" : kind === null || isGroupingReference ? "out-of-scope" : isPermil ? "permil" : "unquantified",
    appliesWhen: node.kind === "leader" ? "while-leading" : node.kind === "card" ? "always" : null,
  };
}

function staticNodeStates(talentId: string): ReadonlyMap<string, BoardNodeVisualState> {
  return new Map([...boardAdjacency.neighborsByGroupId.keys()].map((groupId) => {
    const node = resolveBoardNodeForTalent(groupId, talentId);
    const state: BoardNodeVisualState = groupId === "S-001"
      ? "unlocked"
      : node.kind === "all-member" || node.kind === "content"
        ? "dimmed"
        : "locked";
    return [groupId, state] as const;
  }));
}

export function BoardFigure({ talentId, talentName }: Readonly<{ talentId: string; talentName: string }>) {
  const nodeStates = staticNodeStates(talentId);
  const slotNodes = SLOT_IDS.map((slot) => resolveBoardNodeForTalent(slot, talentId));
  const variantRows = VARIANT_GROUPS.map((groupId) => {
    const node = resolveBoardNodeForTalent(groupId, talentId);
    return { groupId, node, label: boardEffectLabel(structuredEffectForNode(groupId, talentId)) };
  });

  return (
    <section className="talent-board-figure" id="holomem-board" aria-labelledby="holomem-board-title">
      <div className="section-title-row">
        <div>
          <p className="db-eyebrow">Holomem Board</p>
          <h2 id="holomem-board-title">{talentName}&apos;s Board grid</h2>
        </div>
        <span className="talent-board-static-chip">Reference view</span>
      </div>
      <p className="talent-board-intro">The grid uses the derived orthogonal adjacency model. Green and yellow nodes stay visible as reference nodes and are not evaluated in suggestions.</p>
      <BoardSvg
        connectOverlay={null}
        editMode={false}
        focusedGroupId={null}
        gateLabelByGroupId={new Map()}
        highlightedPathGroupIds={new Set()}
        nodeStates={nodeStates}
        selectedGroupId={null}
        suggestions={[]}
        talentId={talentId}
        unlockedNodeGroupIds={[]}
        zoom={0.72}
      />
      <div className="talent-board-reference-grid">
        <section aria-labelledby="talent-board-slots-title">
          <p className="db-eyebrow">Connect slots</p>
          <h3 id="talent-board-slots-title">Four Board connection slots</h3>
          <ul className="talent-board-slot-list">
            {slotNodes.map((node, index) => (
              <li key={SLOT_IDS[index]}><strong>{SLOT_IDS[index]}</strong><span>{node.pointCost} point{node.pointCost === 1 ? "" : "s"}</span></li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="talent-board-variants-title">
          <p className="db-eyebrow">Talent variants</p>
          <h3 id="talent-board-variants-title">Variant groups for {talentName}</h3>
          <ul className="talent-board-variant-list">
            {variantRows.map(({ groupId, node, label }) => (
              <li key={groupId}><strong>{groupId}</strong><span>{node.pointCost} points · {label}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
