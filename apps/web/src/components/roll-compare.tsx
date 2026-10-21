"use client";

import type { TeamCalculatorRequest, TeamCalculatorResult } from "@yagoo-dori/core/team-calculator-contract";
import { ArrowRight, Check, CircleAlert, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import { useTranslation } from "@/lib/i18n";
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

function verdictDetail(
  comparison: ComparisonResult,
  t: (key: import("@/lib/i18n").TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  if (comparison.forcedMember) {
    return t("rollCompare.verdictForcedDetail");
  }
  const pickedCardJoined = comparison.joinedAsMember || comparison.joinedAsLeader;
  if (pickedCardJoined && comparison.delta <= 0) {
    return t("rollCompare.verdictNeutralOrWorse");
  }
  if (!pickedCardJoined) {
    return t("rollCompare.verdictNotUsed");
  }
  if (comparison.joinedAsMember && comparison.joinedAsLeader) {
    return t("rollCompare.verdictBoth");
  }
  if (comparison.joinedAsMember) {
    return t("rollCompare.verdictMember");
  }
  return t("rollCompare.verdictLeader");
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
  const { t } = useTranslation();
  return (
    <article className={styles.teamColumn}>
      <header className={styles.teamColumnHeader}>
        <div>
          <span>{label}</span>
          <h2>{result.leader.talentName} Leader Outfit</h2>
        </div>
        <div className={styles.utility}>
          <span>{t("rollCompare.modelUtility")}</span>
          <strong>{formatUtility(result.score.relativeUtility.central)}</strong>
          <small>
            {t("rollCompare.utilityRange", {
              lower: formatUtility(result.score.relativeUtility.lower),
              upper: formatUtility(result.score.relativeUtility.upper),
            })}
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
          <small>
            {t("rollCompare.sourceCard", {
              rarity: result.leader.rarity,
              bloom: result.leader.sourceCardBloomStage,
            })}
          </small>
          <strong>{result.leader.outfitName}</strong>
          <span>{result.leader.talentName}</span>
        </div>
      </div>

      <div className={styles.members}>
        <div className={styles.membersHeading}>
          <span>{t("rollCompare.fiveMembers")}</span>
          <strong>{t("rollCompare.legalFormation")}</strong>
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
  const { t } = useTranslation();
  comparison = comparison.memberTrial ?? comparison;
  const pickedCardJoined = comparison.joinedAsMember || comparison.joinedAsLeader;
  const improves = pickedCardJoined && comparison.delta > 0;
  const verdict = improves
    ? t("rollCompare.verdictImproves", { talent: pickedCard.talentName })
    : t("rollCompare.verdictDoesNotImprove", { talent: pickedCard.talentName });

  return (
    <section className={styles.resultPanel} aria-live="polite" aria-labelledby="roll-compare-result-heading">
      <div className={styles.verdict} data-improves={improves}>
        <div>
          <span id="roll-compare-result-heading">{t("rollCompare.verdictHeading")}</span>
          {comparison.forcedMember && <small>{t("rollCompare.verdictForcedMember")}</small>}
          <strong>{verdict}</strong>
          <small>{verdictDetail(comparison, t)}</small>
        </div>
        <b>{formatSignedUtility(comparison.delta)} · {formatSignedPercent(comparison.deltaPercent)}</b>
      </div>

      <div className={styles.comparisonDisclosure}>
        <p className={styles.disclosure}>
          {t("rollCompare.disclosureCharts", { count: comparison.baseline.corpus.chartCount })}
        </p>
        {(comparison.baseline.search.resultClaim === "bounded-search" || comparison.hypothetical.search.resultClaim === "bounded-search") && (
          <p className={styles.disclosure}>{t("rollCompare.disclosureBounded")}</p>
        )}
        <p className={styles.disclosure}>{t("rollCompare.disclosureRelative")}</p>
      </div>

      <div className={styles.columns}>
        <ResultTeam label={t("rollCompare.savedRoster")} pickedCardId={comparison.pickedCardId} result={comparison.baseline} />
        <ResultTeam label={t("rollCompare.withCard", { talent: pickedCard.talentName })} pickedCardId={comparison.pickedCardId} result={comparison.hypothetical} />
      </div>

      <div className={styles.diff}>
        <DiffSection
          heading={t("rollCompare.displacedHeading")}
          members={comparison.displaced}
          emptyLabel={t("rollCompare.noDisplaced")}
        />
        <DiffSection
          heading={t("rollCompare.stayedHeading")}
          members={comparison.stayed}
          emptyLabel={t("rollCompare.noStayed")}
        />
      </div>
    </section>
  );
}

export function RollCompare({ cards, rosterCommit }: RollCompareProps) {
  const { t } = useTranslation();
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
  const comparedCardIds = new Set(rankings.map((row) => row.pickedCardId));
  const pendingCards = filteredCards.filter((card) => !comparedCardIds.has(card.id));
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
      return { ...comparison, memberTrialReason: t("rollCompare.memberTrialReason") };
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

  const runComparison = (pickedCard = selectedCard) => {
    if (calculationState.status === "calculating" && pickedCard?.id === selectedCard?.id) {
      cancelCalculation();
      return;
    }
    if (!pickedCard || ownedTalentCount < 5) return;
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

        const comparison = await calculateCardComparison(baseline, baselineRequest, pickedCard, generation);
        if (calculationGeneration.current !== generation) return;
        activeTask.current = null;
        setBatchBaseline(baseline);
        setRankings((rows) => [...rows.filter((row) => row.pickedCardId !== comparison.pickedCardId), comparison].sort((a, b) => b.delta - a.delta ||
          (b.memberTrial?.delta ?? 0) - (a.memberTrial?.delta ?? 0) || a.pickedCardId.localeCompare(b.pickedCardId)));
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
      const matchesSearch = (card: RollCompareCard) => Number(`${card.talentName} ${card.title}`.toLowerCase().includes(normalizedQuery));
      for (const card of [...availableCards].sort((a, b) => matchesSearch(b) - matchesSearch(a) || Number(b.isNew) - Number(a.isNew))) {
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
    return <div className={styles.loading}>{t("rollCompare.loading")}</div>;
  }

  if (ownedTalentCount < 5) {
    return (
      <section className={styles.emptyState} aria-labelledby="roll-compare-empty-heading">
        <CircleAlert aria-hidden="true" />
        <h2 id="roll-compare-empty-heading">{t("rollCompare.emptyHeading")}</h2>
        <p>
          {t("rollCompare.emptyDesc")}
        </p>
        <Link className="cursor-pointer" href="/team-builder"><ArrowRight aria-hidden="true" /> {t("rollCompare.buildRosterLink")}</Link>
      </section>
    );
  }

  const compareLabel = calculationState.status === "calculating" ? t("rollCompare.btnCancel") : t("rollCompare.btnCompare");
  const renderPickerCard = (card: RollCompareCard) => (
    <button
      aria-pressed={selectedCardId === card.id}
      className={`${styles.pickerCard} cursor-pointer`}
      data-selected={selectedCardId === card.id}
      data-picker-card-id={card.id}
      key={card.id}
      onClick={() => selectCard(card)}
      type="button"
    >
      <span className={styles.pickerArt}>
        <Image alt="" fill sizes="(max-width: 560px) 42vw, 150px" src={card.artPath} />
        <b className={styles.rarity}>{card.rarity}★</b>
        {card.isNew && <b className={styles.newChip}>{t("common.new")}</b>}
      </span>
      <span className={styles.pickerCopy}><strong>{card.talentName}</strong><span>{card.title}</span></span>
    </button>
  );

  return (
    <>
      <section className={styles.targets} aria-labelledby="upgrade-targets-heading">
        <header className={styles.pickerHeader}>
          <div>
            <p className={styles.panelEyebrow}>{t("rollCompare.targetsEyebrow")}</p>
            <h2 id="upgrade-targets-heading">{t("rollCompare.targetsHeading")}</h2>
            <p>{t("rollCompare.targetsDesc")}</p>
          </div>
          <button className={`${styles.compareButton} cursor-pointer`} onClick={() => void runAllComparisons()} disabled={availableCards.length === 0 || (!batchRunning && rankings.length === availableCards.length)} type="button">
            {batchRunning ? t("rollCompare.btnPause") : rankings.length > 0 && rankings.length < availableCards.length ? t("rollCompare.btnResume") : rankings.length === availableCards.length && availableCards.length > 0 ? t("rollCompare.btnAllDone") : t("rollCompare.btnCompareAll")}
          </button>
        </header>
        <div className={styles.restrictions}>
          <label className="cursor-pointer">
            <input type="checkbox" checked={respectRestrictions} onChange={(event) => {
              cancelCalculation();
              setRankings([]);
              setBatchBaseline(null);
              setBatchError(null);
              baselineResultCache.current = null;
              setRespectRestrictions(event.target.checked);
            }} /> {t("rollCompare.respectLocks")}
          </label>
          <p>
            {respectRestrictions
              ? t("rollCompare.slotsLocked", { count: requiredMemberCardIds.length })
              : t("rollCompare.allSlotsOpen")}
            {respectRestrictions && oshi
              ? ` · Oshi: ${cards.find((card) => card.talentId === oshi.talentId)?.talentName ?? oshi.talentId} (${
                  oshi.role === "member"
                    ? "Member"
                    : oshi.role === "leader"
                      ? "Leader Outfit"
                      : "Member and Leader Outfit"
                })`
              : ""}.
          </p>
          {respectRestrictions && requiredMemberCardIds.length > 0 && (
            <p>
              {t("rollCompare.lockedList", {
                names: requiredMemberCardIds.map((id) => cardById.get(id)?.talentName).join(", "),
              })}
            </p>
          )}
          {respectRestrictions && requiredMemberCardIds.length === 5 && (
            <p role="note">{t("rollCompare.allSlotsLockedWarning")}</p>
          )}
          <p>{t("rollCompare.bloomNote")}</p>
        </div>
        <p className={styles.disclosure}>{t("rollCompare.targetsDisclosure")}</p>
        <div className={styles.pickerControls}>
          <label className={styles.search}>
            <Search aria-hidden="true" />
            <span className="sr-only">{t("rollCompare.searchAria")}</span>
            <input
              onChange={(event) => updateQuery(event.target.value)}
              placeholder={t("rollCompare.searchPlaceholder")}
              type="search"
              value={query}
            />
            {query && (
              <button aria-label={t("common.clearSearch")} className="cursor-pointer" onClick={() => updateQuery("")} type="button">
                <X aria-hidden="true" />
              </button>
            )}
          </label>
        </div>
        <p>
          {t("rollCompare.catalogStats", {
            total: cards.length,
            owned: cards.length - availableCards.length,
            unowned: availableCards.length,
          })}
        </p>
        <p role="status">
          {t("rollCompare.comparisonProgress", {
            compared: rankings.length,
            total: availableCards.length,
            awaiting: availableCards.length - rankings.length,
            suffix: batchRunning ? t("rollCompare.backgroundProgressSuffix") : "",
          })}
        </p>
        {query && (
          <p>
            {t("rollCompare.searchMatchesNotice", {
              count: filteredCards.length,
              query,
            })}
          </p>
        )}
        {batchRunning && <progress aria-label="Unowned cards compared" max={availableCards.length} value={rankings.length} />}
        {batchError && <p role="alert">{batchError} Completed comparisons are kept; resume to retry.</p>}
        {batchBaseline && (
          <details>
            <summary>
              {t("rollCompare.ownedTeamSummary", {
                utility: formatUtility(batchBaseline.score.relativeUtility.central),
              })}
            </summary>
            <ResultTeam label={t("rollCompare.ownedBaseline")} result={batchBaseline} pickedCardId="" />
          </details>
        )}
        {rankings.length > 0 && (
          <div className={styles.targetList}>
            <p>
              {t("rollCompare.upgradesFound", {
                prefix: batchRunning || rankings.length < availableCards.length ? t("rollCompare.partialRanking") : "",
                count: rankings.filter((row) => row.delta > 0).length,
              })}
            </p>
            {!rankings.some((row) => {
              const card = cardById.get(row.pickedCardId);
              return card && `${card.talentName} ${card.title}`.toLowerCase().includes(normalizedQuery);
            }) && <p>{t("rollCompare.noSearchMatchesYet")}</p>}
            {rankings
              .filter((row) => {
                const card = cardById.get(row.pickedCardId);
                return card && `${card.talentName} ${card.title}`.toLowerCase().includes(normalizedQuery);
              })
              .map((row) => {
                const card = cardById.get(row.pickedCardId)!;
                const shown = row.memberTrial ?? row;
                return (
                  <button
                    className={`${styles.targetRow} cursor-pointer`}
                    data-comparison-card-id={card.id}
                    key={card.id}
                    type="button"
                    onClick={() => {
                      cancelCalculation();
                      setSelectedCardId(card.id);
                      writeCardParam(card.id);
                      setCalculationState({ status: "done", comparison: row });
                      window.requestAnimationFrame(() => resultAnchor.current?.scrollIntoView({ behavior: "auto", block: "start" }));
                    }}
                  >
                    <span className={styles.targetArt}><Image alt="" fill sizes="64px" src={card.artPath} /></span>
                    <span>
                      <strong>{card.talentName}</strong>
                      <small>{card.rarity}★ · {card.title}</small>
                      <small>
                        {row.delta > 0
                          ? t("rollCompare.replaces", {
                              names: shown.displaced.map((member) => member.talentName).join(", ") || t("rollCompare.leaderOutfitOnly"),
                            })
                          : row.memberTrial
                            ? t("rollCompare.ifUsedReplaces", {
                                names: shown.displaced.map((member) => member.talentName).join(", "),
                              })
                            : t("rollCompare.keepOwnedTeam")}
                      </small>
                    </span>
                    <span data-improves={row.delta > 0}>
                      <strong>{formatSignedPercent(shown.deltaPercent)}</strong>
                      <small>{formatSignedUtility(shown.delta)} utility</small>
                      <small>{row.delta > 0 ? t("rollCompare.upgradeFound") : t("rollCompare.noUpgradeFound")}</small>
                      {row.memberTrial && (
                        <small>{shown.delta < 0 ? t("rollCompare.weakerIfUsed") : t("rollCompare.tiesIfUsed")}</small>
                      )}
                      {row.memberTrialReason && <small>{row.memberTrialReason}</small>}
                    </span>
                  </button>
                );
              })}
          </div>
        )}
        {pendingCards.length > 0 && (
          <details className={styles.pendingList} open={query.length > 0}>
            <summary>
              {t("rollCompare.awaitingCount", {
                count: pendingCards.length,
                entity: query ? t("rollCompare.matchingCardsEntity") : t("rollCompare.cardsEntity"),
              })}
            </summary>
            <p>{t("rollCompare.awaitingDesc")}</p>
            <div className={styles.targetList}>
              {pendingCards.map((card) => (
                <button
                  className={`${styles.targetRow} cursor-pointer`}
                  data-pending-card-id={card.id}
                  disabled={calculationState.status === "calculating" && selectedCardId === card.id}
                  key={card.id}
                  type="button"
                  onClick={() => {
                    setSelectedCardId(card.id);
                    writeCardParam(card.id);
                    runComparison(card);
                  }}
                >
                  <span className={styles.targetArt}><Image alt="" fill sizes="64px" src={card.artPath} /></span>
                  <span><strong>{card.talentName}</strong><small>{card.rarity}★ · {card.title}</small></span>
                  <span>
                    <strong>{calculationState.status === "calculating" && selectedCardId === card.id ? t("rollCompare.comparing") : t("rollCompare.compareNow")}</strong>
                    <small>{t("rollCompare.notComparedYet")}</small>
                  </span>
                </button>
              ))}
            </div>
          </details>
        )}
        {availableCards.length === 0 && <p>{t("rollCompare.ownEveryCard")}</p>}
      </section>
      <section className={styles.picker} aria-labelledby="roll-compare-picker-heading">
        <header className={styles.pickerHeader}>
          <div>
            <p className={styles.panelEyebrow}>{t("rollCompare.step1Eyebrow")}</p>
            <h2 id="roll-compare-picker-heading">{t("rollCompare.step1Heading")}</h2>
            <p>{t("rollCompare.step1Desc")}</p>
          </div>
          <div className={styles.pickerCount}><strong>{availableCards.length}</strong> {t("rollCompare.availableCount", { count: availableCards.length })}</div>
        </header>

        <div className={styles.cardList}>
          {filteredCards.length > 0 ? (
            <>
              {recentlyAddedCards.length > 0 && (
                <section aria-labelledby="recently-added-heading" className={styles.cardGroup}>
                  <h3 className={styles.cardGroupHeading} id="recently-added-heading">{t("rollCompare.recentlyAdded")}</h3>
                  <div className={styles.cardGroupGrid}>{recentlyAddedCards.map(renderPickerCard)}</div>
                </section>
              )}
              {generationCards.length > 0 && (
                <div className={styles.cardGroupGrid}>{generationCards.map(renderPickerCard)}</div>
              )}
            </>
          ) : <p className={styles.noMatches}>{t("rollCompare.noUnownedMatches")}</p>}
        </div>

        {selectedCard && (
          <div className={styles.selection}>
            <span className={styles.selectionArt}><Image alt="" fill sizes="96px" src={selectedCard.artPath} /></span>
            <div className={styles.selectionCopy}>
              <h3>{selectedCard.talentName}</h3>
              <p>{selectedCard.title}</p>
              <div className={styles.selectionMeta}>
                <span>{t("rollCompare.memberCardBadge", { rarity: selectedCard.rarity })}</span>
                {selectedCard.modelTier && <b className={styles.tierBadge}>{t("rollCompare.tierBadge", { tier: selectedCard.modelTier })}</b>}
              </div>
            </div>
            <button
              aria-label={t("rollCompare.clearCard")}
              className={`${styles.clearSelection} cursor-pointer`}
              onClick={() => {
                cancelCalculation();
                setSelectedCardId(null);
                writeCardParam(null);
              }}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
            {selectedCard.modelTier && (
              <p className={styles.tierDisclosure}>
                {t("rollCompare.tierDisclaimer")}{" "}
                <Link className="cursor-pointer" href="/methodology">{t("tierList.howTiersWork")}</Link>
              </p>
            )}
          </div>
        )}
      </section>

      <div className={styles.compareBar}>
        <p className={styles.compareNote}>{t("rollCompare.compareAssumption")}</p>
        <button
          className={`${styles.compareButton} cursor-pointer`}
          disabled={!selectedCard && calculationState.status !== "calculating"}
          onClick={() => runComparison()}
          type="button"
        >
          {calculationState.status === "calculating" ? <X aria-hidden="true" /> : <Check aria-hidden="true" />} {compareLabel}
        </button>
      </div>

      <div ref={resultAnchor}>
        {calculationState.status === "calculating" && (
          <section className={styles.calculatingPanel} aria-live="polite">
            <span className={styles.calculatingPulse} />
            <div><strong>{t("rollCompare.comparingTitle")}</strong><small>{t("rollCompare.comparingDesc")}</small></div>
          </section>
        )}
        {calculationState.status === "error" && (
          <section className={styles.calculationError} role="alert">
            <strong>{t("rollCompare.calcStopped")}</strong>
            <p>{calculationState.message}</p>
            <button className={`${styles.retryButton} cursor-pointer`} onClick={() => runComparison()} type="button">{t("rollCompare.tryAgain")}</button>
          </section>
        )}
        {calculationState.status === "done" && selectedCard && (
          <ComparisonView comparison={calculationState.comparison} pickedCard={selectedCard} />
        )}
      </div>
    </>
  );
}
