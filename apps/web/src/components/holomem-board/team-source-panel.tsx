type TeamMember = Readonly<{ talentId: string; cardId: string; lens: "one-copy-max" | "max-potential" }>;

export type PlannerCardOption = Readonly<{
  id: string;
  talentId: string;
  talentName: string;
  title: string;
  rarity: 4 | 5;
  bloomStage: 0 | 1 | 2 | 3 | 4 | 5;
}>;

export type ManualTeamSelection = Readonly<{
  leaderCardId: string;
  memberCardIds: readonly string[];
}>;

export type TeamSourcePanelProps = Readonly<{
  cards: readonly PlannerCardOption[];
  team: Readonly<{
    leader: TeamMember;
    members: readonly TeamMember[];
  }> | null;
  rosterAvailable: boolean;
  loading: boolean;
  manualSelection: ManualTeamSelection;
  onUseCalculator: () => void;
  onManualSelection: (selection: ManualTeamSelection) => void;
}>;

function cardLabel(card: PlannerCardOption): string {
  return `${card.talentName} · ${card.title} · ${card.rarity}★`;
}

export function TeamSourcePanel({
  cards,
  team,
  rosterAvailable,
  loading,
  manualSelection,
  onUseCalculator,
  onManualSelection,
}: TeamSourcePanelProps) {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const teamNames = team
    ? [team.leader, ...team.members].map((member) => cardById.get(member.cardId)?.talentName ?? member.talentId).join(", ")
    : "Choose five talents below";

  return (
    <section className="hb-panel hb-source-panel" aria-labelledby="hb-team-source-title">
      <div className="hb-section-heading">
        <div>
          <p className="hb-eyebrow">Team source</p>
          <h2 id="hb-team-source-title">Start with your current team</h2>
        </div>
        <span className="hb-status-chip">{rosterAvailable ? "Stored roster" : "Manual setup"}</span>
      </div>
      <p className="hb-muted">{team ? `Current selection: ${teamNames}` : "No stored team was found. Pick one card for each talent."}</p>
      <button className="hb-primary-button" disabled={!rosterAvailable || loading} onClick={onUseCalculator} type="button">
        {loading ? "Loading team…" : "Use my Team calculator result"}
      </button>
      {!rosterAvailable && <p className="hb-note">The manual team stays in this planner until you use the Team calculator.</p>}
      <details className="hb-manual-source" open={!rosterAvailable}>
        <summary>Manual talent picker</summary>
        <div className="hb-manual-grid">
          <label>
            Leader
            <select
              value={manualSelection.leaderCardId}
              onChange={(event) => onManualSelection({ ...manualSelection, leaderCardId: event.target.value })}
            >
              <option value="">Choose a card</option>
              {cards.map((card) => <option key={card.id} value={card.id}>{cardLabel(card)}</option>)}
            </select>
          </label>
          {manualSelection.memberCardIds.map((cardId, index) => (
            <label key={index}>
              Member {index + 1}
              <select
                value={cardId}
                onChange={(event) => {
                  const next = [...manualSelection.memberCardIds];
                  next[index] = event.target.value;
                  onManualSelection({ ...manualSelection, memberCardIds: next });
                }}
              >
                <option value="">Choose a card</option>
                {cards.map((card) => <option key={card.id} value={card.id}>{cardLabel(card)}</option>)}
              </select>
            </label>
          ))}
        </div>
      </details>
    </section>
  );
}
