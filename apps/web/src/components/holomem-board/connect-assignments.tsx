"use client";

import type { HolomemBoardContractConnectResult } from "@yagoo-dori/core/holomem-board-contract";

import type { StoredTalentBoard } from "@/lib/team-roster-storage";

import type { PlannerCardOption } from "./team-source-panel";

export type ConnectAssignmentsProps = Readonly<{
  connect: HolomemBoardContractConnectResult;
  cards: readonly PlannerCardOption[];
  boards: Readonly<Record<string, StoredTalentBoard>>;
  stale: boolean;
}>;

const LOCKED_REASON_LABELS: Readonly<Record<string, string>> = {
  "player-level-gate": "Dream Rank gate",
  "slot-not-unlocked": "Slot not unlocked",
};

const EXCLUSION_LABELS: Readonly<Record<string, string>> = {
  "duplicate-card-id": "Card appears more than once",
  "star-3-no-connect-effect": "Star-3 cards have no Connect effect",
  "invalid-bloom-stage": "Bloom stage is not usable",
  "talent-mismatch": "Card does not match this board talent",
  "unknown-card": "Card is not in the catalog",
  "no-connect-effect": "No Connect effect is recorded",
  "assignment-not-selected": "Another assignment was selected",
  "no-positive-gain": "No positive board gain",
};

function cardName(cardId: string, cards: readonly PlannerCardOption[]): string {
  const card = cards.find((candidate) => candidate.id === cardId);
  return card ? `${card.talentName} · ${card.title}` : cardId;
}

function previousPlacement(cardId: string, boards: Readonly<Record<string, StoredTalentBoard>>): { boardTalentId: string; slot: string } | null {
  for (const [boardTalentId, board] of Object.entries(boards)) {
    const slot = Object.entries(board.connectPlacements).find(([, placedCardId]) => placedCardId === cardId)?.[0];
    if (slot) return { boardTalentId, slot };
  }
  return null;
}

export function ConnectAssignments({ connect, cards, boards, stale }: ConnectAssignmentsProps) {
  return (
    <section className={`hb-panel hb-connect-results ${stale ? "hb-results--stale" : ""}`} aria-labelledby="hb-connect-title">
      <div className="hb-section-heading">
        <div>
          <p className="hb-eyebrow">Connect</p>
          <h2 id="hb-connect-title">Suggested Connect placements</h2>
        </div>
        <span className="hb-status-chip">{connect.amplificationModel}</span>
      </div>
      <div className="hb-connect-table-wrap">
        <table className="hb-connect-table">
          <thead><tr><th>Card</th><th>Board / slot</th><th>Extent</th><th>Disposition</th></tr></thead>
          <tbody>
            {connect.assignments.map((assignment) => {
              const previous = previousPlacement(assignment.cardId, boards);
              const isKeep = previous?.boardTalentId === assignment.boardTalentId && previous.slot === assignment.slot;
              const disposition = isKeep ? "Keep" : previous ? `Move from ${previous.boardTalentId} / ${previous.slot}` : "New";
              return (
                <tr key={`${assignment.boardTalentId}-${assignment.slot}`}>
                  <th scope="row">{cardName(assignment.cardId, cards)}</th>
                  <td>{assignment.boardTalentId} / {assignment.slot}</td>
                  <td>{assignment.footprint.composition.quantifiedNodeCount} nodes × {(assignment.amplificationPermil / 10).toFixed(1)}%</td>
                  <td>{disposition}</td>
                </tr>
              );
            })}
            {connect.lockedSlots.map((locked) => (
              <tr className="hb-connect-locked" key={`${locked.boardTalentId}-${locked.slot}`}>
                <th scope="row">Locked slot</th>
                <td>{locked.boardTalentId} / {locked.slot}</td>
                <td>—</td>
                <td>{locked.reasonCodes.map((reason) => LOCKED_REASON_LABELS[reason] ?? "Slot unavailable").join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {connect.excludedCandidates.length > 0 && (
        <div className="hb-excluded-cards">
          <h3>Cards not placed</h3>
          <ul>
            {connect.excludedCandidates.map((candidate) => (
              <li key={candidate.cardId}><strong>{cardName(candidate.cardId, cards)}</strong><span>{candidate.reasonCodes.map((reason) => EXCLUSION_LABELS[reason] ?? "Not placed").join(" · ")}</span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
