"use client";

import type { HolomemBoardResult } from "@yagoo-dori/core/holomem-board-contract";

import { boardEffectLabel } from "@/lib/board-effect-labels";

export type SuggestionResultsProps = Readonly<{
  result: HolomemBoardResult | null;
  stale: boolean;
  talentNameByTalentId: ReadonlyMap<string, string>;
  onSelectMember: (talentId: string) => void;
  onSelectSuggestion: (talentId: string, groupId: string) => void;
  onRunAgain: () => void;
}>;

const CLAIM_CHIPS = [
  ["kind", "bounded suggestion"],
  ["conditionalOn", "conditional on this team"],
  ["adjacencyBasis", "derived adjacency"],
  ["stackingModel", "envelope stacking"],
] as const;

function formatUnits(value: number): string {
  return value.toLocaleString("en-US");
}

function formatParameterValue(microUnits: number): string {
  return (microUnits / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function SuggestionResults({
  result,
  stale,
  talentNameByTalentId,
  onSelectMember,
  onSelectSuggestion,
  onRunAgain,
}: SuggestionResultsProps) {
  if (!result) return null;
  const claimChipValues = {
    kind: result.claim.kind === "bounded-suggestion" ? "bounded suggestion" : "suggestion",
    conditionalOn: result.claim.conditionalOn === "current-team-and-declared-board-state" ? "conditional on this team" : "declared state",
    adjacencyBasis: result.claim.adjacencyBasis === "derived-orthogonal-grid-adjacency" ? "derived adjacency" : "derived board path",
    stackingModel: result.claim.stackingModel === "additive-envelope-not-jointly-attainable" ? "envelope stacking" : "declared stacking",
  } as const;
  return (
    <section className={`hb-results ${stale ? "hb-results--stale" : ""}`} aria-labelledby="hb-results-title">
      <div className="hb-results-stale" aria-live="polite">
        {stale && <><strong>Inputs changed</strong><button onClick={onRunAgain} type="button">Run suggestions again</button></>}
      </div>
      <div className="hb-claim-banner">
        <div>
          <p className="hb-eyebrow">Suggestion claim</p>
          <h2 id="hb-results-title">{claimChipValues.kind === "bounded suggestion" ? "A bounded plan for the declared boards" : "Plan for the declared boards"}</h2>
        </div>
        <div className="hb-claim-chips">
          {CLAIM_CHIPS.map(([key]) => <span className="hb-claim-chip" key={key}>{claimChipValues[key]}</span>)}
        </div>
        <p className="hb-note">These suggestions serve the declared team only. A team imported from the Team calculator was chosen without Board or Connect value, so the team choice and the Board plan are separate recommendations, not a joint one.</p>
      </div>
      <div className="hb-member-results">
        {result.perMember.map((member) => (
          <details className="hb-member-result" key={member.talentId} onToggle={(event) => { if (event.currentTarget.open) onSelectMember(member.talentId); }}>
            <summary>
              <span className="hb-result-number">{member.position === "leader" ? "L" : "M"}</span>
              <strong>{talentNameByTalentId.get(member.talentId) ?? member.talentId}</strong>
              <span>{member.suggestions.length} suggested unlocks</span>
            </summary>
            <div className="hb-ledger" aria-label="Budget ledger">
              <span>Rank income <b>{formatUnits(member.ledger.rankIncome)}</b></span>
              <span>Extra points <b>{formatUnits(member.ledger.extraPoints)}</b></span>
              <span>Available <b>{formatUnits(member.ledger.totalAvailable)}</b></span>
              <span>Already spent <b>{formatUnits(member.ledger.alreadySpent)}</b></span>
              <span>Remaining <b>{formatUnits(member.ledger.remainingAvailable)}</b></span>
              <span>Suggested cost <b>{formatUnits(member.ledger.suggestedCost)}</b></span>
            </div>
            <p className="hb-result-note">Modeled parameter value: {formatParameterValue(member.claimedMicroUnits)} (greedy baseline {formatParameterValue(member.greedyBaselineMicroUnits)}). Parameter-point equivalents under the envelope model, not a projected Live Score.</p>
            <ol className="hb-suggestion-list">
              {member.suggestions.map((suggestion) => (
                <li key={suggestion.nodeGroupId}>
                  <button className="hb-suggestion-row" onClick={() => onSelectSuggestion(member.talentId, suggestion.nodeGroupId)} type="button">
                    <span className="hb-suggestion-badge">{suggestion.order}</span>
                    <span>
                      <strong>{suggestion.nodeGroupId}</strong>
                      <span>{boardEffectLabel({ ...suggestion.effect, valueClass: suggestion.valueClass, appliesWhen: suggestion.appliesWhen })}</span>
                      <small>Prerequisite: {suggestion.pathParentGroupId === "start" ? "Board root" : suggestion.pathParentGroupId}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}
