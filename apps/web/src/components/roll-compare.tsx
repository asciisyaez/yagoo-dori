"use client";

import type { TeamCalculatorResult } from "@yagoo-dori/core/team-calculator-contract";
import { ArrowRight, Check, CircleAlert, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import {
  type BloomStage,
  emptyTeamRoster,
  loadTeamRoster,
} from "@/lib/team-roster-storage";
import {
  startTeamCalculation,
  type TeamCalculatorTask,
  TeamCalculatorWorkerError,
} from "@/lib/team-calculator-worker-client";

import styles from "@/app/roll-compare/roll-compare.module.css";

export type RollCompareCard = {
  id: string;
  slug: string;
  talentId: string;
  talentName: string;
  title: string;
  rarity: 4 | 5;
  attribute: "cute" | "pure" | "happy";
  artPath: string;
  modelTier: string | null;
};

type RollCompareProps = {
  cards: RollCompareCard[];
  rosterCommit: string;
};

type ComparisonResult = {
  baseline: TeamCalculatorResult;
  hypothetical: TeamCalculatorResult;
  pickedCardId: string;
  pickedCardJoined: boolean;
  joinedAsMember: boolean;
  joinedAsLeader: boolean;
  delta: number;
  deltaPercent: number | null;
  displaced: TeamCalculatorResult["members"];
  stayed: TeamCalculatorResult["members"];
};

type CalculationState =
  | { status: "idle" }
  | { status: "calculating" }
  | { status: "done"; comparison: ComparisonResult }
  | { status: "error"; message: string };

function formatUtility(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatSignedUtility(value: number): string {
  if (Math.abs(value) < 0.5) return "0";
  return `${value > 0 ? "+" : "−"}${formatUtility(Math.abs(value))}`;
}

function formatSignedPercent(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) < 0.05) return "Near tie (<0.05%)";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function cardMatchesParam(card: RollCompareCard, value: string | null): boolean {
  return value !== null && (card.id === value || card.slug === value);
}

function normalizeRequiredMemberCardIds(
  cardIds: readonly string[],
  cardById: ReadonlyMap<string, RollCompareCard>,
  ownedCardIds: ReadonlySet<string>,
): string[] {
  const selectedTalentIds = new Set<string>();
  return [...new Set(cardIds)]
    .filter((cardId) => ownedCardIds.has(cardId) && cardById.has(cardId))
    .sort()
    .filter((cardId) => {
      const talentId = cardById.get(cardId)!.talentId;
      if (selectedTalentIds.has(talentId)) return false;
      selectedTalentIds.add(talentId);
      return true;
    })
    .slice(0, 5);
}

function buildComparison(
  baseline: TeamCalculatorResult,
  hypothetical: TeamCalculatorResult,
  pickedCardId: string,
): ComparisonResult {
  const hypotheticalMemberIds = new Set(hypothetical.members.map((member) => member.cardId));
  const delta = hypothetical.score.relativeUtility.central - baseline.score.relativeUtility.central;
  const baselineCentral = baseline.score.relativeUtility.central;
  const joinedAsMember = hypotheticalMemberIds.has(pickedCardId);
  // The picked card can also participate purely as the Leader Outfit's
  // source card without occupying a Member slot.
  const joinedAsLeader = hypothetical.leader.cardId === pickedCardId;

  return {
    baseline,
    hypothetical,
    pickedCardId,
    pickedCardJoined: joinedAsMember || joinedAsLeader,
    joinedAsMember,
    joinedAsLeader,
    delta,
    deltaPercent: baselineCentral === 0 ? null : (delta / baselineCentral) * 100,
    displaced: baseline.members.filter((member) => !hypotheticalMemberIds.has(member.cardId)),
    stayed: baseline.members.filter((member) => hypotheticalMemberIds.has(member.cardId)),
  };
}

function ResultTeam({
  label,
  result,
  pickedCardId,
}: {
  label: string;
  result: TeamCalculatorResult;
  pickedCardId: string;
}) {
  return (
    <article className={styles.teamColumn}>
      <header className={styles.teamColumnHeader}>
        <div>
          <span>{label}</span>
          <h2>{result.leader.talentName} Leader Outfit</h2>
        </div>
        <div className={styles.utility}>
          <span>Model utility</span>
          <strong>{formatUtility(result.score.relativeUtility.central)}</strong>
          <small>
            {formatUtility(result.score.relativeUtility.lower)}–{formatUtility(result.score.relativeUtility.upper)} range
          </small>
        </div>
      </header>

      <div className={styles.leaderCard}>
        <Link
          aria-label={`${result.leader.outfitName} Leader Outfit from ${result.leader.talentName}`}
          className={styles.leaderArt}
          href={`/cards/${result.leader.slug}#leader-outfit`}
        >
          <Image alt="" fill sizes="132px" src={result.leader.illustrationPath} />
        </Link>
        <div className={styles.leaderCopy}>
          <small>{result.leader.rarity}★ source card · Bloom {result.leader.sourceCardBloomStage}</small>
          <strong>{result.leader.outfitName}</strong>
          <span>{result.leader.talentName}</span>
        </div>
      </div>

      <div className={styles.members}>
        <div className={styles.membersHeading}>
          <span>Five Members</span>
          <strong>Legal formation</strong>
        </div>
        <div className={styles.memberGrid}>
          {result.members.map((member) => (
            <Link
              className={styles.memberCard}
              data-attribute={member.attribute}
              data-picked={member.cardId === pickedCardId}
              href={`/cards/${member.slug}`}
              key={member.cardId}
            >
              <span className={styles.memberArt}>
                <Image alt="" fill sizes="(max-width: 560px) 28vw, 120px" src={member.artPath} />
                <i>{member.rarity}★</i>
                <b>B{member.bloomStage}</b>
              </span>
              <span className={styles.memberCopy}>
                <strong>{member.talentName}</strong>
                <small>{member.title}</small>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

function ComparisonView({ comparison, pickedCard }: { comparison: ComparisonResult; pickedCard: RollCompareCard }) {
  const improves = comparison.pickedCardJoined && comparison.delta > 0;
  const verdict = improves
    ? `${pickedCard.talentName} joins your strongest found team`
    : `${pickedCard.talentName} does not strengthen your team`;
  const joinedDetail = comparison.joinedAsMember && comparison.joinedAsLeader
    ? "The second run fielded the picked card as a Member and led with its Leader Outfit."
    : comparison.joinedAsMember
      ? "The second run included the picked card in its five-Member lineup."
      : "The second run led with the picked card's Leader Outfit.";
  const verdictDetail = comparison.pickedCardJoined && comparison.delta <= 0
    ? "The swap is neutral or worse under the model."
    : comparison.pickedCardJoined
      ? joinedDetail
      : "The second run did not use the picked card as a Member or Leader Outfit.";

  return (
    <section className={styles.resultPanel} aria-live="polite" aria-labelledby="roll-compare-result-heading">
      <div className={styles.verdict} data-improves={improves}>
        <div>
          <span id="roll-compare-result-heading">Verdict</span>
          <strong>{verdict}</strong>
          <small>{verdictDetail}</small>
        </div>
        <b>{formatSignedUtility(comparison.delta)} · {formatSignedPercent(comparison.deltaPercent)}</b>
      </div>

      <div className={styles.comparisonDisclosure}>
        <p className={styles.disclosure}>Average performance across 30 Expert charts · Board and Connect effects are not part of this objective</p>
        <p className={styles.disclosure}>Relative team value, not a projected Live Score.</p>
      </div>

      <div className={styles.columns}>
        <ResultTeam label="Saved roster" pickedCardId={comparison.pickedCardId} result={comparison.baseline} />
        <ResultTeam label={`With ${pickedCard.talentName}`} pickedCardId={comparison.pickedCardId} result={comparison.hypothetical} />
      </div>

      <div className={styles.diff}>
        <div className={styles.diffSection}>
          <h3>Displaced from the five Members</h3>
          <ul className={styles.diffList}>
            {comparison.displaced.length > 0 ? comparison.displaced.map((member) => (
              <li key={member.cardId}>{member.talentName}</li>
            )) : <li data-empty="true">No Member displaced</li>}
          </ul>
        </div>
        <div className={styles.diffSection}>
          <h3>Stayed in the five Members</h3>
          <ul className={styles.diffList}>
            {comparison.stayed.length > 0 ? comparison.stayed.map((member) => (
              <li key={member.cardId}>{member.talentName}</li>
            )) : <li data-empty="true">No baseline Member stayed</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function RollCompare({ cards, rosterCommit }: RollCompareProps) {
  const searchParams = useSearchParams();
  const requestedCardParam = searchParams.get("card");
  const [ownedCards, setOwnedCards] = useState<Record<string, BloomStage>>({});
  const [oshi, setOshi] = useState(emptyTeamRoster(rosterCommit).oshi);
  const [requiredMemberCardIds, setRequiredMemberCardIds] = useState<string[]>([]);
  const [storageStatus, setStorageStatus] = useState<"loading" | "ready" | "session">("loading");
  const [query, setQuery] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [calculationState, setCalculationState] = useState<CalculationState>({ status: "idle" });
  const activeTask = useRef<TeamCalculatorTask | null>(null);
  const calculationGeneration = useRef(0);
  const resultAnchor = useRef<HTMLDivElement | null>(null);

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const validCardIds = useMemo(() => new Set(cards.map((card) => card.id)), [cards]);
  const availableCards = useMemo(
    () => cards.filter((card) => !(card.id in ownedCards)),
    [cards, ownedCards],
  );
  const selectedCard = selectedCardId ? cardById.get(selectedCardId) ?? null : null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCards = availableCards.filter((card) =>
    normalizedQuery.length === 0
      ? true
      : `${card.talentName} ${card.title}`.toLowerCase().includes(normalizedQuery),
  );
  const ownedCount = Object.keys(ownedCards).length;

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      try {
        const loaded = loadTeamRoster(window.localStorage, rosterCommit, validCardIds);
        const loadedCards = loaded.roster.cards;
        const savedOshiStillOwned =
          loaded.roster.oshi.talentId === null ||
          Object.keys(loadedCards).some((cardId) => cardById.get(cardId)?.talentId === loaded.roster.oshi.talentId);
        setOwnedCards(loadedCards);
        setRequiredMemberCardIds(normalizeRequiredMemberCardIds(
          loaded.roster.requiredMemberCardIds,
          cardById,
          new Set(Object.keys(loadedCards)),
        ));
        setOshi(savedOshiStillOwned ? loaded.roster.oshi : { ...loaded.roster.oshi, talentId: null });
        const requestedCard = cards.find((card) => cardMatchesParam(card, requestedCardParam));
        setSelectedCardId(requestedCard && !(requestedCard.id in loadedCards) ? requestedCard.id : null);
        setStorageStatus("ready");
      } catch {
        setOwnedCards({});
        setRequiredMemberCardIds([]);
        setOshi(emptyTeamRoster(rosterCommit).oshi);
        setSelectedCardId(null);
        setStorageStatus("session");
      }
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [cardById, cards, requestedCardParam, rosterCommit, validCardIds]);

  useEffect(() => () => {
    calculationGeneration.current += 1;
    activeTask.current?.cancel();
    activeTask.current = null;
  }, []);

  const selectCard = (card: RollCompareCard) => {
    if (card.id in ownedCards) return;
    cancelCalculation();
    setSelectedCardId(card.id);
    const next = new URLSearchParams(window.location.search);
    next.set("card", card.id);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${next.toString()}`);
  };

  const cancelCalculation = () => {
    calculationGeneration.current += 1;
    activeTask.current?.cancel();
    activeTask.current = null;
    setCalculationState({ status: "idle" });
  };

  const runComparison = () => {
    if (calculationState.status === "calculating") {
      cancelCalculation();
      return;
    }
    if (!selectedCard || ownedCount < 6) return;

    const generation = calculationGeneration.current + 1;
    calculationGeneration.current = generation;
    setCalculationState({ status: "calculating" });

    const ownedEntries = cards
      .filter((card) => card.id in ownedCards)
      .map((card) => ({ cardId: card.id, bloomStage: ownedCards[card.id] ?? 0 }));
    const oshiRequest = oshi.enabled && oshi.talentId
      ? { talentId: oshi.talentId, role: oshi.role }
      : undefined;
    const makeRequest = (nextOwnedCards: typeof ownedEntries) => ({
      schemaVersion: 5 as const,
      rosterCommit,
      ownedCards: nextOwnedCards,
      requiredMemberCardIds: [...requiredMemberCardIds].sort(),
      searchEffort: "standard" as const,
      ...(oshiRequest ? { oshi: oshiRequest } : {}),
    });

    void (async () => {
      try {
        const baselineTask = startTeamCalculation(makeRequest(ownedEntries));
        activeTask.current = baselineTask;
        const baseline = await baselineTask.result;
        if (calculationGeneration.current !== generation || activeTask.current !== baselineTask) return;

        const hypotheticalTask = startTeamCalculation(makeRequest([
          ...ownedEntries,
          { cardId: selectedCard.id, bloomStage: 0 },
        ]));
        activeTask.current = hypotheticalTask;
        const hypothetical = await hypotheticalTask.result;
        if (calculationGeneration.current !== generation || activeTask.current !== hypotheticalTask) return;

        activeTask.current = null;
        const comparison = buildComparison(baseline, hypothetical, selectedCard.id);
        setCalculationState({ status: "done", comparison });
        window.requestAnimationFrame(() => resultAnchor.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "start",
        }));
      } catch (error: unknown) {
        if (calculationGeneration.current !== generation) return;
        activeTask.current = null;
        if (error instanceof TeamCalculatorWorkerError && error.code === "cancelled") {
          setCalculationState({ status: "idle" });
          return;
        }
        setCalculationState({
          status: "error",
          message: error instanceof Error ? error.message : "The team calculation could not finish.",
        });
        window.requestAnimationFrame(() => resultAnchor.current?.scrollIntoView({ behavior: "auto", block: "start" }));
      }
    })();
  };

  if (storageStatus === "loading") {
    return <div className={styles.loading}>Loading saved roster…</div>;
  }

  if (ownedCount < 6) {
    return (
      <section className={styles.emptyState} aria-labelledby="roll-compare-empty-heading">
        <CircleAlert aria-hidden="true" />
        <h2 id="roll-compare-empty-heading">Add more cards to compare a roll</h2>
        <p>
          This tool compares against the saved roster on this device. Add at least six owned cards in the team calculator, then return here to compare an unowned card.
        </p>
        <Link href="/team-builder"><ArrowRight aria-hidden="true" /> Build your saved roster</Link>
      </section>
    );
  }

  const compareLabel = calculationState.status === "calculating" ? "Cancel comparison" : "Compare teams";

  return (
    <>
      <section className={styles.picker} aria-labelledby="roll-compare-picker-heading">
        <header className={styles.pickerHeader}>
          <div>
            <p className={styles.panelEyebrow}>Step 1 · Pick a card</p>
            <h2 id="roll-compare-picker-heading">Choose an unowned Member card</h2>
            <p>Cards appear in generation order. Search by talent or card title.</p>
          </div>
          <div className={styles.pickerCount}><strong>{availableCards.length}</strong> available</div>
        </header>

        <div className={styles.pickerControls}>
          <label className={styles.search}>
            <Search aria-hidden="true" />
            <span className="sr-only">Search unowned cards</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search talent or card title…"
              type="search"
              value={query}
            />
            {query && <button aria-label="Clear card search" onClick={() => setQuery("")} type="button"><X aria-hidden="true" /></button>}
          </label>
        </div>

        <div className={styles.cardList}>
          {filteredCards.length > 0 ? filteredCards.map((card) => (
            <button
              aria-pressed={selectedCardId === card.id}
              className={styles.pickerCard}
              data-selected={selectedCardId === card.id}
              key={card.id}
              onClick={() => selectCard(card)}
              type="button"
            >
              <span className={styles.pickerArt}>
                <Image alt="" fill sizes="(max-width: 560px) 42vw, 150px" src={card.artPath} />
                <b className={styles.rarity}>{card.rarity}★</b>
              </span>
              <span className={styles.pickerCopy}><strong>{card.talentName}</strong><span>{card.title}</span></span>
            </button>
          )) : <p className={styles.noMatches}>No unowned cards match that search.</p>}
        </div>

        {selectedCard && (
          <div className={styles.selection}>
            <span className={styles.selectionArt}><Image alt="" fill sizes="96px" src={selectedCard.artPath} /></span>
            <div className={styles.selectionCopy}>
              <h3>{selectedCard.talentName}</h3>
              <p>{selectedCard.title}</p>
              <div className={styles.selectionMeta}>
                <span>{selectedCard.rarity}★ Member card</span>
                {selectedCard.modelTier && <b className={styles.tierBadge}>Provisional model tier {selectedCard.modelTier}</b>}
              </div>
            </div>
            <button aria-label="Clear picked card" className={styles.clearSelection} onClick={() => {
              cancelCalculation();
              setSelectedCardId(null);
              const next = new URLSearchParams(window.location.search);
              next.delete("card");
              const queryString = next.toString();
              window.history.replaceState(window.history.state, "", queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname);
            }} type="button"><X aria-hidden="true" /></button>
            {selectedCard.modelTier && (
              <p className={styles.tierDisclosure}>
                Model tiers, published as provisional theorycraft against a frozen launch benchmark — a relative comparison index, not an in-game Live Score rating. <Link href="/methodology">Methodology</Link>
              </p>
            )}
          </div>
        )}
      </section>

      <div className={styles.compareBar}>
        <p className={styles.compareNote}>Assumption: the picked card is one fresh copy at Bloom 0; it is added only for the second run.</p>
        <button
          className={styles.compareButton}
          disabled={!selectedCard && calculationState.status !== "calculating"}
          onClick={runComparison}
          type="button"
        >
          {calculationState.status === "calculating" ? <X aria-hidden="true" /> : <Check aria-hidden="true" />} {compareLabel}
        </button>
      </div>

      <div ref={resultAnchor}>
        {calculationState.status === "calculating" && (
          <section className={styles.calculatingPanel} aria-live="polite">
            <span className={styles.calculatingPulse} />
            <div><strong>Comparing your teams</strong><small>Running the saved roster first, then the picked card at Bloom 0…</small></div>
          </section>
        )}
        {calculationState.status === "error" && (
          <section className={styles.calculationError} role="alert">
            <strong>Calculation stopped</strong>
            <p>{calculationState.message}</p>
            <button className={styles.retryButton} onClick={runComparison} type="button">Try again</button>
          </section>
        )}
        {calculationState.status === "done" && selectedCard && (
          <ComparisonView comparison={calculationState.comparison} pickedCard={selectedCard} />
        )}
      </div>
    </>
  );
}
