"use client";

import type { TeamCalculatorRequest, TeamCalculatorResult } from "@yagoo-dori/core/team-calculator-contract";
import { ArrowRight, Check, CircleAlert, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import {
  type BloomStage,
  loadTeamRoster,
  type StoredOshiRole,
} from "@/lib/team-roster-storage";
import {
  buildTeamCalculatorRequest,
  startTeamCalculation,
  type TeamCalculatorTask,
  TeamCalculatorWorkerError,
} from "@/lib/team-calculator-worker-client";
import {
  formatSignedPercent,
  formatSignedUtility,
  formatUtility,
  normalizeRequiredMemberCardIds,
  savedOshiStillOwned,
} from "@/lib/team-result-format";

import { selectAcquisitionTeam } from "@/lib/roll-comparison";

import styles from "@/app/roll-compare/roll-compare.module.css";

export type RollCompareCard = {
  id: string;
  slug: string;
  talentId: string;
  talentName: string;
  title: string;
  rarity: 4 | 5;
  artPath: string;
  isNew: boolean;
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
  joinedAsMember: boolean;
  joinedAsLeader: boolean;
  delta: number;
  deltaPercent: number | null;
  displaced: TeamCalculatorResult["members"];
  stayed: TeamCalculatorResult["members"];
  forcedMember?: boolean;
  memberTrial?: ComparisonResult;
  memberTrialReason?: string;
};

type CalculationState =
  | { status: "idle" }
  | { status: "calculating" }
  | { status: "done"; comparison: ComparisonResult }
  | { status: "error"; message: string };

function cardMatchesParam(card: RollCompareCard, value: string | null): boolean {
  return value !== null && (card.id === value || card.slug === value);
}

function buildComparison(
  baseline: TeamCalculatorResult,
  hypothetical: TeamCalculatorResult,
  pickedCardId: string,
  forcedMember = false,
): ComparisonResult {
  hypothetical = forcedMember ? hypothetical : selectAcquisitionTeam(baseline, hypothetical, pickedCardId);
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
    joinedAsMember,
    joinedAsLeader,
    delta,
    deltaPercent: baselineCentral === 0 ? null : (delta / baselineCentral) * 100,
    displaced: baseline.members.filter((member) => !hypotheticalMemberIds.has(member.cardId)),
    stayed: baseline.members.filter((member) => hypotheticalMemberIds.has(member.cardId)),
    forcedMember,
  };
}

function verdictDetail(comparison: ComparisonResult): string {
  if (comparison.forcedMember) {
    return "This run requires the picked card as a Member. Acquiring it is optional: you can keep your owned team instead.";
  }
  const pickedCardJoined = comparison.joinedAsMember || comparison.joinedAsLeader;
  if (pickedCardJoined && comparison.delta <= 0) {
    return "The swap is neutral or worse under the model.";
  }
  if (!pickedCardJoined) {
    return "The second run did not use the picked card as a Member or Leader Outfit.";
  }
  if (comparison.joinedAsMember && comparison.joinedAsLeader) {
    return "The second run fielded the picked card as a Member and led with its Leader Outfit.";
  }
  if (comparison.joinedAsMember) {
    return "The second run included the picked card in its five-Member lineup.";
  }
  return "The second run led with the picked card's Leader Outfit.";
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

function DiffSection({
  heading,
  members,
  emptyLabel,
}: {
  heading: string;
  members: TeamCalculatorResult["members"];
  emptyLabel: string;
}) {
  return (
    <div className={styles.diffSection}>
      <h3>{heading}</h3>
      <ul className={styles.diffList}>
        {members.length > 0 ? members.map((member) => (
          <li key={member.cardId}>{member.talentName}</li>
        )) : <li data-empty="true">{emptyLabel}</li>}
      </ul>
    </div>
  );
}

function ComparisonView({ comparison, pickedCard }: { comparison: ComparisonResult; pickedCard: RollCompareCard }) {
  comparison = comparison.memberTrial ?? comparison;
  const pickedCardJoined = comparison.joinedAsMember || comparison.joinedAsLeader;
  const improves = pickedCardJoined && comparison.delta > 0;
  const verdict = improves
    ? `${pickedCard.talentName} joins your strongest found team`
    : `${pickedCard.talentName} does not strengthen your team`;

  return (
    <section className={styles.resultPanel} aria-live="polite" aria-labelledby="roll-compare-result-heading">
      <div className={styles.verdict} data-improves={improves}>
        <div>
          <span id="roll-compare-result-heading">Verdict</span>
          {comparison.forcedMember && <small>Required Member comparison · signed swap difference</small>}
          <strong>{verdict}</strong>
          <small>{verdictDetail(comparison)}</small>
        </div>
        <b>{formatSignedUtility(comparison.delta)} · {formatSignedPercent(comparison.deltaPercent)}</b>
      </div>

      <div className={styles.comparisonDisclosure}>
        <p className={styles.disclosure}>Average performance across {comparison.baseline.corpus.chartCount} Expert charts · Board and Connect effects are not part of this objective</p>
        {(comparison.baseline.search.resultClaim === "bounded-search" || comparison.hypothetical.search.resultClaim === "bounded-search") && (
          <p className={styles.disclosure}>Both teams come from bounded standard-effort searches; treat very small differences as a tie.</p>
        )}
        <p className={styles.disclosure}>Relative team value, not a projected Live Score.</p>
      </div>

      <div className={styles.columns}>
        <ResultTeam label="Saved roster" pickedCardId={comparison.pickedCardId} result={comparison.baseline} />
        <ResultTeam label={`With ${pickedCard.talentName}`} pickedCardId={comparison.pickedCardId} result={comparison.hypothetical} />
      </div>

      <div className={styles.diff}>
        <DiffSection heading="Displaced from the five Members" members={comparison.displaced} emptyLabel="No Member displaced" />
        <DiffSection heading="Stayed in the five Members" members={comparison.stayed} emptyLabel="No baseline Member stayed" />
      </div>
    </section>
  );
}

export function RollCompare({ cards, rosterCommit }: RollCompareProps) {
  const searchParams = useSearchParams();
  const requestedCardParam = searchParams.get("card");
  const [ownedCards, setOwnedCards] = useState<Record<string, BloomStage>>({});
  const [oshi, setOshi] = useState<{ talentId: string; role: StoredOshiRole }>();
  const [requiredMemberCardIds, setRequiredMemberCardIds] = useState<string[]>([]);
  const [respectRestrictions, setRespectRestrictions] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [calculationState, setCalculationState] = useState<CalculationState>({ status: "idle" });
  const activeTask = useRef<TeamCalculatorTask | null>(null);
  const calculationGeneration = useRef(0);
  const baselineResultCache = useRef<{ key: string; result: TeamCalculatorResult } | null>(null);
  const [rankings, setRankings] = useState<ComparisonResult[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchBaseline, setBatchBaseline] = useState<TeamCalculatorResult | null>(null);
  const resultAnchor = useRef<HTMLDivElement | null>(null);

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const validCardIds = useMemo(() => new Set(cardById.keys()), [cardById]);
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
  const recentlyAddedCards = filteredCards.filter((card) => card.isNew);
  const generationCards = filteredCards.filter((card) => !card.isNew);
  const ownedTalentCount = new Set(
    Object.keys(ownedCards)
      .map((cardId) => cardById.get(cardId)?.talentId)
      .filter((talentId): talentId is string => talentId !== undefined),
  ).size;

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      try {
        const loaded = loadTeamRoster(window.localStorage, rosterCommit, validCardIds);
        const loadedCards = loaded.roster.cards;
        const loadedOwnedCardIds = new Set(Object.keys(loadedCards));
        const oshiStillOwned = savedOshiStillOwned(loaded.roster.oshi, loadedOwnedCardIds, cardById);
        setOwnedCards(loadedCards);
        setRequiredMemberCardIds(normalizeRequiredMemberCardIds(
          loaded.roster.requiredMemberCardIds,
          cardById,
          loadedOwnedCardIds,
        ));
        setOshi(
          oshiStillOwned && loaded.roster.oshi.enabled && loaded.roster.oshi.talentId
            ? { talentId: loaded.roster.oshi.talentId, role: loaded.roster.oshi.role }
            : undefined,
        );
        const requestedCard = cards.find((card) => cardMatchesParam(card, requestedCardParam));
        setSelectedCardId(requestedCard && !(requestedCard.id in loadedCards) ? requestedCard.id : null);
        setHydrated(true);
      } catch {
        setOwnedCards({});
        setRequiredMemberCardIds([]);
        setOshi(undefined);
        setSelectedCardId(null);
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [cardById, cards, requestedCardParam, rosterCommit, validCardIds]);

  useEffect(() => () => {
    calculationGeneration.current += 1;
    activeTask.current?.cancel();
    activeTask.current = null;
  }, []);

  const writeCardParam = (cardId: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (cardId === null) next.delete("card");
    else next.set("card", cardId);
    const queryString = next.toString();
    window.history.replaceState(
      window.history.state,
      "",
      queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname,
    );
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    const next = new URLSearchParams(window.location.search);
    if (value) next.set("q", value);
    else next.delete("q");
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${next.size ? `?${next}` : ""}`);
  };

  const selectCard = (card: RollCompareCard) => {
    if (card.id in ownedCards) return;
    cancelCalculation();
    setSelectedCardId(card.id);
    writeCardParam(card.id);
  };

  const cancelCalculation = () => {
    calculationGeneration.current += 1;
    activeTask.current?.cancel();
    activeTask.current = null;
    setCalculationState({ status: "idle" });
    setBatchRunning(false);
  };

  const calculateCardComparison = async (
    baseline: TeamCalculatorResult,
    baselineRequest: TeamCalculatorRequest,
    card: RollCompareCard,
    generation: number,
  ): Promise<ComparisonResult> => {
    const run = async (request: TeamCalculatorRequest) => {
      const task = startTeamCalculation(request);
      activeTask.current = task;
      const result = await task.result;
      if (calculationGeneration.current !== generation) {
        throw new TeamCalculatorWorkerError("cancelled", "The team calculation was cancelled.");
      }
      return result;
    };
    const request = { ...baselineRequest, ownedCards: [...baselineRequest.ownedCards, { cardId: card.id, bloomStage: 0 as const }] };
    const hypothetical = await run({ ...request, seedCandidates: [{ leaderOutfitCardId: baseline.leader.cardId, memberCardIds: baseline.members.map((member) => member.cardId) }] });
    const comparison = buildComparison(baseline, hypothetical, card.id);
    if (comparison.delta > 0) return comparison;

    const requiredIds = baselineRequest.requiredMemberCardIds;
    const requiredTalents = requiredIds.map((id) => cardById.get(id)?.talentId);
    const oshiMember = baselineRequest.oshi && baselineRequest.oshi.role !== "leader" ? baselineRequest.oshi.talentId : null;
    if (requiredIds.length === 5 || requiredTalents.includes(card.talentId) ||
      (requiredIds.length === 4 && oshiMember && ![...requiredTalents, card.talentId].includes(oshiMember))) {
      return { ...comparison, memberTrialReason: "Saved restrictions prevent this Member swap. Uncheck saved restrictions to compare it." };
    }
    // Evaluate the card even when acquiring it would leave the best team unchanged.
    // Legal incumbent swaps seed the required-card search; all are evaluated under
    // the same full-corpus objective. Illegal seeds are rejected by the optimizer.
    const forced = await run({
      ...request,
      requiredMemberCardIds: [...requiredIds, card.id],
      seedCandidates: baseline.members.map((replaced) => ({
        leaderOutfitCardId: baseline.leader.cardId,
        memberCardIds: baseline.members.map((member) => member.cardId === replaced.cardId ? card.id : member.cardId),
      })),
    });
    if (forced.score.relativeUtility.central > baseline.score.relativeUtility.central) {
      return buildComparison(baseline, forced, card.id);
    }
    return { ...comparison, memberTrial: buildComparison(baseline, forced, card.id, true) };
  };

  const runComparison = () => {
    if (calculationState.status === "calculating") {
      cancelCalculation();
      return;
    }
    if (!selectedCard || ownedTalentCount < 5) return;
    cancelCalculation();

    const generation = calculationGeneration.current + 1;
    calculationGeneration.current = generation;
    setCalculationState({ status: "calculating" });

    const ownedEntries = cards
      .filter((card) => card.id in ownedCards)
      .map((card) => ({ cardId: card.id, bloomStage: ownedCards[card.id] ?? 0 }));
    const makeRequest = (nextOwnedCards: typeof ownedEntries) => buildTeamCalculatorRequest({
      rosterCommit,
      ownedCards: nextOwnedCards,
      requiredMemberCardIds: respectRestrictions ? [...requiredMemberCardIds].sort() : [],
      searchEffort: "standard",
      ...(respectRestrictions && oshi ? { oshi: { ...oshi, enabled: true } } : {}),
    });
    const baselineRequest = makeRequest(ownedEntries);
    const baselineKey = JSON.stringify(baselineRequest);

    void (async () => {
      try {
        let baseline: TeamCalculatorResult;
        const cachedBaseline = baselineResultCache.current;
        if (cachedBaseline?.key === baselineKey) {
          baseline = cachedBaseline.result;
        } else {
          const baselineTask = startTeamCalculation(baselineRequest);
          activeTask.current = baselineTask;
          baseline = await baselineTask.result;
          if (calculationGeneration.current !== generation || activeTask.current !== baselineTask) return;
          baselineResultCache.current = { key: baselineKey, result: baseline };
        }

        const comparison = await calculateCardComparison(baseline, baselineRequest, selectedCard, generation);
        if (calculationGeneration.current !== generation) return;
        activeTask.current = null;
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

  const runAllComparisons = async () => {
    if (batchRunning) { cancelCalculation(); return; }
    cancelCalculation();
    const generation = calculationGeneration.current;
    setBatchRunning(true);
    setBatchError(null);
    const ownedEntries = cards.filter((card) => card.id in ownedCards)
      .map((card) => ({ cardId: card.id, bloomStage: ownedCards[card.id] ?? 0 }));
    const baselineRequest = buildTeamCalculatorRequest({
      rosterCommit, ownedCards: ownedEntries, requiredMemberCardIds: respectRestrictions ? [...requiredMemberCardIds].sort() : [],
      searchEffort: "standard", ...(respectRestrictions && oshi ? { oshi: { ...oshi, enabled: true } } : {}),
    });
    const key = JSON.stringify(baselineRequest);
    try {
      let baseline = baselineResultCache.current?.key === key ? baselineResultCache.current.result : null;
      if (!baseline) {
        const task = startTeamCalculation(baselineRequest);
        activeTask.current = task;
        baseline = await task.result;
        if (calculationGeneration.current !== generation) return;
        baselineResultCache.current = { key, result: baseline };
      }
      setBatchBaseline(baseline);
      // Each acquisition is independent: never carry another unowned card into a run.
      const completed = new Set(rankings.map((row) => row.pickedCardId));
      for (const card of [...availableCards].sort((a, b) => Number(b.isNew) - Number(a.isNew))) {
        if (completed.has(card.id)) continue;
        const comparison = await calculateCardComparison(baseline, baselineRequest, card, generation);
        if (calculationGeneration.current !== generation) return;
        setRankings((rows) => [...rows, comparison].sort((a, b) => b.delta - a.delta ||
          (b.memberTrial?.delta ?? 0) - (a.memberTrial?.delta ?? 0) || a.pickedCardId.localeCompare(b.pickedCardId)));

      }
    } catch (error: unknown) {
      if (calculationGeneration.current !== generation) return;
      setBatchError(error instanceof Error ? error.message : "Comparison could not finish. Resume to retry.");
    } finally {
      if (calculationGeneration.current === generation) {
        activeTask.current = null;
        setBatchRunning(false);
      }
    }
  };

  if (!hydrated) {
    return <div className={styles.loading}>Loading saved roster…</div>;
  }

  if (ownedTalentCount < 5) {
    return (
      <section className={styles.emptyState} aria-labelledby="roll-compare-empty-heading">
        <CircleAlert aria-hidden="true" />
        <h2 id="roll-compare-empty-heading">Add more cards to compare a roll</h2>
        <p>
          This tool compares against the saved roster on this device. Add at least five distinct talents in the team calculator, then return here to compare unowned cards.
        </p>
        <Link href="/team-builder"><ArrowRight aria-hidden="true" /> Build your saved roster</Link>
      </section>
    );
  }

  const compareLabel = calculationState.status === "calculating" ? "Cancel comparison" : "Compare teams";
  const renderPickerCard = (card: RollCompareCard) => (
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
        {card.isNew && <b className={styles.newChip}>New</b>}
      </span>
      <span className={styles.pickerCopy}><strong>{card.talentName}</strong><span>{card.title}</span></span>
    </button>
  );

  return (
    <>
      <section className={styles.targets} aria-labelledby="upgrade-targets-heading">
        <header className={styles.pickerHeader}>
          <div>
            <p className={styles.panelEyebrow}>Your upgrade targets</p>
            <h2 id="upgrade-targets-heading">Find your next team upgrade</h2>
            <p>Compare every unowned card against your strongest found owned team. Each card is tested separately at Bloom 0, using the restriction settings below.</p>
          </div>
          <button className={styles.compareButton} onClick={() => void runAllComparisons()} disabled={availableCards.length === 0 || (!batchRunning && rankings.length === availableCards.length)} type="button">
            {batchRunning ? "Pause comparisons" : rankings.length > 0 && rankings.length < availableCards.length ? "Resume comparisons" : rankings.length === availableCards.length && availableCards.length > 0 ? "All cards compared" : "Compare all unowned cards"}
          </button>
        </header>
        <div className={styles.restrictions}>
          <label>
            <input type="checkbox" checked={respectRestrictions} onChange={(event) => {
              cancelCalculation();
              setRankings([]);
              setBatchBaseline(null);
              setBatchError(null);
              baselineResultCache.current = null;
              setRespectRestrictions(event.target.checked);
            }} /> Respect saved Oshi and Member locks
          </label>
          <p>{respectRestrictions ? `${requiredMemberCardIds.length} of 5 Member slots locked` : "All Member slots open; saved Oshi restriction ignored"}{respectRestrictions && oshi ? ` · Oshi: ${cards.find((card) => card.talentId === oshi.talentId)?.talentName ?? oshi.talentId} (${oshi.role === "member" ? "Member" : oshi.role === "leader" ? "Leader Outfit" : "Member and Leader Outfit"})` : ""}.</p>
          {respectRestrictions && requiredMemberCardIds.length > 0 && <p>Locked: {requiredMemberCardIds.map((id) => cardById.get(id)?.talentName).join(", ")}.</p>}
          {respectRestrictions && requiredMemberCardIds.length === 5 && <p role="note">All five Members are locked. New cards can only improve the Leader Outfit. Uncheck this option to search for Member replacements; your saved team settings will be kept.</p>}
          <p>Owned cards keep their saved Bloom levels. Every unowned card is tested at Bloom 0; a fresh copy may lose to your invested cards.</p>
        </div>
        <p className={styles.disclosure}>Team utility across 30 Expert charts; Board and Connect effects excluded. Bounded searches find upgrades, but do not prove the global best. Small differences may be a tie. For non-upgrades, signed differences show the best found team requiring that card as a Member. You can keep your owned team instead.</p>
        <div className={styles.pickerControls}>
          <label className={styles.search}>
            <Search aria-hidden="true" />
            <span className="sr-only">Search unowned cards</span>
            <input
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search talent or card title…"
              type="search"
              value={query}
            />
            {query && <button aria-label="Clear card search" onClick={() => updateQuery("")} type="button"><X aria-hidden="true" /></button>}
          </label>
        </div>
        <p role="status">{rankings.length} / {availableCards.length} compared{batchRunning ? " · Working in the background; you can pause at any time." : ""}</p>
        {batchRunning && <progress aria-label="Unowned cards compared" max={availableCards.length} value={rankings.length} />}
        {batchError && <p role="alert">{batchError} Completed comparisons are kept; resume to retry.</p>}
        {batchBaseline && <details><summary>Your owned team · {formatUtility(batchBaseline.score.relativeUtility.central)} utility</summary><ResultTeam label="Owned baseline" result={batchBaseline} pickedCardId="" /></details>}
        {rankings.length > 0 && <div className={styles.targetList}>
          <p>{batchRunning || rankings.length < availableCards.length ? "Partial ranking · " : ""}{rankings.filter((row) => row.delta > 0).length} upgrades found. Largest team gains first. Select a result to pause and see the lineup and replacements.</p>
          {!rankings.some((row) => {
            const card = cardById.get(row.pickedCardId);
            return card && `${card.talentName} ${card.title}`.toLowerCase().includes(normalizedQuery);
          }) && <p>No compared cards match your search yet.</p>}
          {rankings.filter((row) => {
            const card = cardById.get(row.pickedCardId);
            return card && `${card.talentName} ${card.title}`.toLowerCase().includes(normalizedQuery);
          }).map((row) => {
            const card = cardById.get(row.pickedCardId)!;
            const shown = row.memberTrial ?? row;
            return <button className={styles.targetRow} key={card.id} type="button" onClick={() => {
              cancelCalculation();
              setSelectedCardId(card.id);
              writeCardParam(card.id);
              setCalculationState({ status: "done", comparison: row });
              window.requestAnimationFrame(() => resultAnchor.current?.scrollIntoView({ behavior: "auto", block: "start" }));
            }}>
              <span className={styles.targetArt}><Image alt="" fill sizes="64px" src={card.artPath} /></span>
              <span><strong>{card.talentName}</strong><small>{card.rarity}★ · {card.title}</small><small>{row.delta > 0 ? `Replaces: ${shown.displaced.map((member) => member.talentName).join(", ") || "Leader Outfit only"}` : row.memberTrial ? `If used: replaces ${shown.displaced.map((member) => member.talentName).join(", ")}` : "Keep your owned team"}</small></span>
              <span data-improves={row.delta > 0}><strong>{formatSignedPercent(shown.deltaPercent)}</strong><small>{formatSignedUtility(shown.delta)} utility</small><small>{row.delta > 0 ? "Upgrade found" : "No upgrade found"}</small>
                {row.memberTrial && <small>{shown.delta < 0 ? "Weaker if used as Member" : "Ties if used as Member"}</small>}
                {row.memberTrialReason && <small>{row.memberTrialReason}</small>}</span>
            </button>;
          })}
        </div>}
        {availableCards.length === 0 && <p>You own every available card.</p>}
      </section>
      <section className={styles.picker} aria-labelledby="roll-compare-picker-heading">
        <header className={styles.pickerHeader}>
          <div>
            <p className={styles.panelEyebrow}>Step 1 · Pick a card</p>
            <h2 id="roll-compare-picker-heading">Choose an unowned Member card</h2>
            <p>Recently added cards appear first, then cards in generation order. Search by talent or card title.</p>
          </div>
          <div className={styles.pickerCount}><strong>{availableCards.length}</strong> available</div>
        </header>


        <div className={styles.cardList}>
          {filteredCards.length > 0 ? (
            <>
              {recentlyAddedCards.length > 0 && (
                <section aria-labelledby="recently-added-heading" className={styles.cardGroup}>
                  <h3 className={styles.cardGroupHeading} id="recently-added-heading">Recently added</h3>
                  <div className={styles.cardGroupGrid}>{recentlyAddedCards.map(renderPickerCard)}</div>
                </section>
              )}
              {generationCards.length > 0 && (
                <div className={styles.cardGroupGrid}>{generationCards.map(renderPickerCard)}</div>
              )}
            </>
          ) : <p className={styles.noMatches}>No unowned cards match that search.</p>}
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
              writeCardParam(null);
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
