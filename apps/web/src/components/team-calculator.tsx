"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { TeamCalculatorResult } from "@yagoo-dori/core/team-calculator-contract";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  Check,
  Heart,
  Search,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BLOOM_STAGES,
  type BloomStage,
  emptyTeamRoster,
  loadTeamRoster,
  saveTeamRoster,
  type StoredOshiPreference,
  type StoredOshiRole,
} from "@/lib/team-roster-storage";
import {
  startTeamCalculation,
  type TeamCalculatorTask,
  TeamCalculatorWorkerError,
} from "@/lib/team-calculator-worker-client";

import styles from "@/app/team-builder/team-builder.module.css";

export type TeamBuilderCard = {
  id: string;
  slug: string;
  talentId: string;
  talentName: string;
  title: string;
  rarity: 4 | 5;
  attribute: "cute" | "pure" | "happy";
  generation: string;
  artPath: string;
  color: string;
  outfitName: string;
};

type TeamCalculatorProps = {
  cards: TeamBuilderCard[];
  rosterCommit: string;
};

function formatUtility(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function formatSeconds(milliseconds: number) {
  const seconds = milliseconds / 1_000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

function effectLabel(effectKind: TeamCalculatorResult["synergies"][number]["effectKind"]) {
  switch (effectKind) {
    case "performance-up": return "Performance";
    case "technique-up": return "Technique";
    case "sense-up": return "Sense";
    case "all-parameters-up": return "All Stats";
  }
}

function oshiResultLabel(role: NonNullable<TeamCalculatorResult["oshi"]>["role"]) {
  if (role === "member") return "Locked into the five-Member lineup";
  if (role === "leader") return "Locked as the Leader Outfit";
  return "Locked as both Member and Leader Outfit";
}

function TeamResult({ result }: { result: TeamCalculatorResult }) {
  const teamCardById = new Map([
    [result.leader.cardId, result.leader.talentName],
    ...result.members.map((member) => [member.cardId, member.talentName] as const),
  ]);
  const alternatives = result.alternatives.filter((group) => group.cards.length > 0);
  const resultClaimLabel = result.search.resultClaim === "certified-within-canonical-corpus-scope"
    ? "All legal teams checked"
    : "Best evaluated result";

  const cardName = (cardId: string) => teamCardById.get(cardId) ?? "Matching Member";

  return (
    <section className={styles.resultPanel} aria-labelledby="team-result-heading" aria-live="polite">
      <header className={styles.resultHeading}>
        <div className={styles.resultHeadingIcon}><Trophy aria-hidden="true" /></div>
        <div>
          <p>Recommended formation</p>
          <h2 id="team-result-heading">Your strongest evaluated team</h2>
          <span>Average performance across {result.corpus.chartCount} Expert charts</span>
        </div>
        <div className={styles.resultScore}>
          <span>Relative utility</span>
          <strong>{formatUtility(result.score.relativeUtility.central)}</strong>
          <small>{formatUtility(result.score.relativeUtility.lower)}–{formatUtility(result.score.relativeUtility.upper)} range</small>
        </div>
      </header>

      {result.oshi && (
        <div className={styles.oshiResult} role="status">
          <Heart aria-hidden="true" />
          <div>
            <span>Oshi lock fulfilled</span>
            <strong>{result.oshi.talentName}</strong>
          </div>
          <p>{oshiResultLabel(result.oshi.role)}</p>
        </div>
      )}

      <div className={styles.teamFormation}>
        <article className={`${styles.leaderResult} ${styles[`result-${result.leader.attribute}`]} ${result.oshi?.resolution.leader.selectedCardId === result.leader.cardId ? styles.oshiSelectedResult : ""}`}>
          <Link
            aria-label={`${result.leader.outfitName} Leader Outfit from ${result.leader.talentName}`}
            className={styles.leaderArt}
            href={`/cards/${result.leader.slug}#leader-outfit`}
          >
            <Image alt="" fill sizes="(max-width: 700px) 100vw, 360px" src={result.leader.illustrationPath} />
            <span>Leader Outfit</span>
            {result.oshi?.resolution.leader.selectedCardId === result.leader.cardId && (
              <b className={styles.oshiResultBadge}><Heart aria-hidden="true" /> Oshi</b>
            )}
          </Link>
          <div>
            <small>{result.leader.rarity}★ source card · Bloom {result.leader.sourceCardBloomStage}</small>
            <h3>{result.leader.outfitName}</h3>
            <p>{result.leader.talentName}</p>
            <span>{result.leader.title}</span>
          </div>
        </article>

        <div className={styles.memberResultGroup}>
          <header>
            <div><span>Special activation order</span><strong>Left to right</strong></div>
            <small>{result.formationOrder.status === "indeterminate" ? "Timing tie" : "Timing modeled"}</small>
          </header>
          <div className={styles.memberResults}>
            {result.members.map((member, index) => {
              const timing = result.formationOrder.members[index]!;
              return (
              <Link className={`${styles.memberResult} ${styles[`result-${member.attribute}`]} ${result.oshi?.resolution.member.selectedCardId === member.cardId ? styles.oshiSelectedResult : ""}`} href={`/cards/${member.slug}`} key={member.cardId}>
                <span className={styles.memberResultArt}>
                  <Image alt="" fill sizes="(max-width: 560px) 30vw, 150px" src={member.artPath} />
                  <i>{member.rarity}★</i>
                  <b>B{member.bloomStage}</b>
                  <span className={styles.orderSlot}>Slot {timing.slot}</span>
                  {result.oshi?.resolution.member.selectedCardId === member.cardId && (
                    <em className={styles.oshiResultBadge}><Heart aria-hidden="true" /> Oshi</em>
                  )}
                </span>
                <span>
                  <strong>{member.talentName}</strong>
                  <small>{member.title}</small>
                  <span
                    className={styles.memberTiming}
                    title={`Active checks every ${formatSeconds(timing.active.cooldownMilliseconds)}; Special lasts ${formatSeconds(timing.special.durationMilliseconds)}`}
                  >
                    <b>A</b> {formatSeconds(timing.active.cooldownMilliseconds)}
                    <i aria-hidden="true" />
                    <b>SP</b> {formatSeconds(timing.special.durationMilliseconds)}
                  </span>
                </span>
              </Link>
              );
            })}
          </div>
          <p className={styles.orderSummary} data-status={result.formationOrder.status}>
            {result.formationOrder.status === "indeterminate"
              ? "Timing outcomes were effectively tied; this is a stable starting order."
              : `Skill timing at the selected Bloom levels · ${result.formationOrder.permutationsChecked} placements compared across ${result.formationOrder.corpusChartCount} Expert charts.`}
          </p>
        </div>
      </div>

      <div className={styles.resultDetailGrid}>
        <section className={styles.synergyPanel}>
          <header><div><span>Team links</span><h3>Active stat synergies</h3></div><strong>{result.synergies.length}</strong></header>
          <div>
            {result.synergies.map((synergy, index) => {
              const sourceName = cardName(synergy.sourceCardId);
              const recipients = synergy.recipientAlternatives
                .slice(0, 2)
                .map((alternative) => alternative.map(cardName).join(" + "))
                .join(" / ");
              const recipientLabel = recipients || "No matching recipients";
              const coverageLabel = synergy.activeChartCount === synergy.corpusChartCount
                ? null
                : `${synergy.activeChartCount}/${synergy.corpusChartCount} charts`;
              return (
                <article key={`${synergy.source}-${synergy.sourceCardId}-${synergy.effectGroupId}-${index}`}>
                  <span className={synergy.source === "leader" ? styles.leaderSource : styles.passiveSource}>{synergy.source}</span>
                  <div>
                    <strong>{sourceName}</strong>
                    <small>{effectLabel(synergy.effectKind)} +{synergy.valuePermil / 10}%{coverageLabel ? ` · ${coverageLabel}` : ""}</small>
                  </div>
                  <ArrowRight aria-hidden="true" />
                  <p title={synergy.resolution === "multiple-possible-recipients" ? `${recipientLabel} (possible targets)` : recipientLabel}>
                    {recipientLabel}{synergy.resolution === "multiple-possible-recipients" ? " · possible targets" : ""}
                  </p>
                </article>
              );
            })}
            {result.synergies.length === 0 && <p className={styles.noSynergy}>No Leader or Passive stat links activate in this formation.</p>}
          </div>
        </section>

        <section className={styles.searchSummary}>
          <span>{resultClaimLabel}</span>
          <strong>{result.search.searchLeaderTeamFormationsReranked.toLocaleString("en-US")}</strong>
          <small>Leader and five-Member formations compared</small>
          {result.search.resultClaim === "bounded-search" && result.search.unsearchedTeamSets > 0 && (
            <p>{result.search.teamSetsConsidered.toLocaleString("en-US")} of {result.search.teamSetsInScope.toLocaleString("en-US")} legal Member sets reached the full benchmark.</p>
          )}
          <div><span>Utility range</span><b>{formatUtility(result.score.relativeUtility.lower)}–{formatUtility(result.score.relativeUtility.upper)}</b></div>
          <em>Relative team value, not a projected Live Score.</em>
        </section>
      </div>

      {alternatives.length > 0 && (
        <section className={styles.alternativesPanel}>
          <header><div><span>Backups</span><h3>Top evaluated replacements</h3></div><small>With the recommended Leader</small></header>
          <div className={styles.alternativeGroups}>
            {alternatives.map((group) => {
              const replaced = result.members.find((member) => member.cardId === group.replacesCardId);
              if (!replaced) return null;
              return (
                <article key={group.replacesCardId}>
                  <header>
                    <Image alt="" height={38} src={replaced.artPath} width={38} />
                    <span><small>Instead of</small><strong>{replaced.talentName}</strong></span>
                  </header>
                  <div>
                    {group.cards.slice(0, 3).map((alternative) => {
                      const percentChange = result.score.relativeUtility.central === 0
                        ? 0
                        : (-alternative.modeledUtilityLoss.central / result.score.relativeUtility.central) * 100;
                      const changeLabel = percentChange >= 0.05
                        ? `+${percentChange.toFixed(1)}%`
                        : percentChange <= -0.05
                          ? `−${Math.abs(percentChange).toFixed(1)}%`
                          : "Near tie";
                      return (
                        <Link href={`/cards/${alternative.slug}`} key={alternative.cardId}>
                          <Image alt="" height={42} src={alternative.artPath} width={42} />
                          <span><strong>{alternative.talentName}</strong><small>{alternative.title} · B{alternative.bloomStage}</small></span>
                          <b data-improvement={percentChange >= 0.05}>{changeLabel}</b>
                        </Link>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}

export function TeamCalculator({ cards, rosterCommit }: TeamCalculatorProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialSearch = new URLSearchParams(searchParams.toString());
  initialSearch.delete("chart");
  const [ownedCards, setOwnedCards] = useState<Record<string, BloomStage>>({});
  const [oshiPreference, setOshiPreference] = useState<StoredOshiPreference>(
    () => emptyTeamRoster(rosterCommit).oshi,
  );
  const [storageStatus, setStorageStatus] = useState<"loading" | "persistent" | "session">("loading");
  const [filters, setFilters] = useState(() => ({
    query: searchParams.get("q") ?? "",
    rarity: searchParams.get("rarity") ?? "all",
    attribute: searchParams.get("attribute") ?? "all",
  }));
  const [calculationState, setCalculationState] = useState<
    | { status: "idle" }
    | { status: "calculating" }
    | { status: "done"; result: TeamCalculatorResult }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const activeTask = useRef<TeamCalculatorTask | null>(null);
  const resultAnchor = useRef<HTMLDivElement>(null);
  const pendingSearch = useRef(initialSearch.toString());

  const { query, rarity, attribute } = filters;
  const storageReady = storageStatus !== "loading";

  const validCardIds = useMemo(() => new Set(cards.map((card) => card.id)), [cards]);
  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      let hydratedCards: Record<string, BloomStage> = {};
      try {
        const loaded = loadTeamRoster(window.localStorage, rosterCommit, validCardIds);
        hydratedCards = loaded.roster.cards;
        const savedOshiStillOwned =
          loaded.roster.oshi.talentId === null ||
          Object.keys(hydratedCards).some(
            (cardId) => cardById.get(cardId)?.talentId === loaded.roster.oshi.talentId,
          );
        const hydratedOshi = savedOshiStillOwned
          ? loaded.roster.oshi
          : { ...loaded.roster.oshi, talentId: null };
        setOwnedCards(hydratedCards);
        setOshiPreference(hydratedOshi);
        if (loaded.needsWrite || !savedOshiStillOwned) {
          saveTeamRoster(window.localStorage, { ...loaded.roster, oshi: hydratedOshi });
        }
        setStorageStatus("persistent");
      } catch {
        setOwnedCards(hydratedCards);
        setStorageStatus("session");
      }
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [cardById, rosterCommit, validCardIds]);

  useEffect(() => {
    if (storageStatus !== "persistent") return;
    let fallbackTimer: number | null = null;
    try {
      saveTeamRoster(window.localStorage, {
        ...emptyTeamRoster(rosterCommit),
        cards: ownedCards,
        oshi: oshiPreference,
      });
    } catch {
      fallbackTimer = window.setTimeout(() => setStorageStatus("session"), 0);
    }
    return () => {
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
    };
  }, [ownedCards, oshiPreference, rosterCommit, storageStatus]);

  useEffect(() => () => {
    activeTask.current?.cancel();
    activeTask.current = null;
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("chart")) {
      window.history.replaceState(
        window.history.state,
        "",
        pendingSearch.current ? `${pathname}?${pendingSearch.current}` : pathname,
      );
    }

    const syncFiltersFromHistory = () => {
      const next = new URLSearchParams(window.location.search);
      next.delete("chart");
      pendingSearch.current = next.toString();
      setFilters({
        query: next.get("q") ?? "",
        rarity: next.get("rarity") ?? "all",
        attribute: next.get("attribute") ?? "all",
      });
    };
    window.addEventListener("popstate", syncFiltersFromHistory);
    return () => window.removeEventListener("popstate", syncFiltersFromHistory);
  }, [pathname]);

  const setFilter = (key: string, value: string, defaultValue = "all") => {
    // Keep an eagerly updated copy because several controls can change before
    // the preceding Next navigation has committed to window.location.
    const next = new URLSearchParams(pendingSearch.current);
    if (value === defaultValue || value === "") next.delete(key);
    else next.set(key, value);
    const nextQuery = next.toString();
    pendingSearch.current = nextQuery;
    setFilters({
      query: next.get("q") ?? "",
      rarity: next.get("rarity") ?? "all",
      attribute: next.get("attribute") ?? "all",
    });
    window.history.replaceState(
      window.history.state,
      "",
      nextQuery ? `${pathname}?${nextQuery}` : pathname,
    );
  };

  const selectedCards = Object.entries(ownedCards)
    .map(([cardId, bloomStage]) => {
      const card = cardById.get(cardId);
      return card ? { card, bloomStage } : null;
    })
    .filter((entry): entry is { card: TeamBuilderCard; bloomStage: BloomStage } => entry !== null)
    .sort((left, right) => left.card.talentName.localeCompare(right.card.talentName));
  const uniqueTalentCount = new Set(selectedCards.map(({ card }) => card.talentId)).size;
  const selectedTalents = [...selectedCards
    .reduce((talents, entry) => {
      const current = talents.get(entry.card.talentId);
      if (
        !current ||
        entry.card.rarity > current.card.rarity ||
        (entry.card.rarity === current.card.rarity && entry.card.title.localeCompare(current.card.title) < 0)
      ) {
        talents.set(entry.card.talentId, entry);
      }
      return talents;
    }, new Map<string, (typeof selectedCards)[number]>())
    .values()]
    .sort((left, right) => left.card.talentName.localeCompare(right.card.talentName));
  const selectedOshiTalent = selectedTalents.find(
    ({ card }) => card.talentId === oshiPreference.talentId,
  );
  const talentsNeeded = Math.max(0, 5 - uniqueTalentCount);
  const oshiReady =
    !oshiPreference.enabled ||
    (oshiPreference.talentId !== null &&
      selectedTalents.some(({ card }) => card.talentId === oshiPreference.talentId));
  const canCalculate = talentsNeeded === 0 && oshiReady;

  const normalizedQuery = query.trim().toLowerCase();
  const visibleCards = cards
    .filter((card) => rarity === "all" || String(card.rarity) === rarity)
    .filter((card) => attribute === "all" || card.attribute === attribute)
    .filter((card) =>
      normalizedQuery.length === 0
        ? true
        : `${card.talentName} ${card.title} ${card.outfitName}`.toLowerCase().includes(normalizedQuery),
    );
  const visibleFiveStarCards = visibleCards.filter((card) => card.rarity === 5);
  const visibleFourStarCards = visibleCards.filter((card) => card.rarity === 4);

  const invalidateCalculation = () => {
    activeTask.current?.cancel();
    activeTask.current = null;
    setCalculationState({ status: "idle" });
  };

  const toggleOwned = (cardId: string) => {
    invalidateCalculation();
    if (cardId in ownedCards) {
      const next = { ...ownedCards };
      delete next[cardId];
      setOwnedCards(next);
      const removedTalentId = cardById.get(cardId)?.talentId;
      if (
        oshiPreference.talentId === removedTalentId &&
        !Object.keys(next).some((ownedCardId) => cardById.get(ownedCardId)?.talentId === removedTalentId)
      ) {
        setOshiPreference((current) => ({ ...current, talentId: null }));
      }
      return;
    }
    setOwnedCards({ ...ownedCards, [cardId]: 0 });
  };

  const setBloom = (cardId: string, bloomStage: BloomStage) => {
    invalidateCalculation();
    setOwnedCards((current) => ({ ...current, [cardId]: bloomStage }));
  };

  const updateOshi = (next: Partial<StoredOshiPreference>) => {
    invalidateCalculation();
    setOshiPreference((current) => ({ ...current, ...next }));
  };

  const runCalculation = () => {
    if (calculationState.status === "calculating") {
      activeTask.current?.cancel();
      activeTask.current = null;
      setCalculationState({ status: "idle" });
      return;
    }
    if (!canCalculate) return;

    setCalculationState({ status: "calculating" });
    const task = startTeamCalculation({
      schemaVersion: 3,
      rosterCommit,
      ownedCards: selectedCards.map(({ card, bloomStage }) => ({ cardId: card.id, bloomStage })),
      ...(oshiPreference.enabled && oshiPreference.talentId
        ? { oshi: { talentId: oshiPreference.talentId, role: oshiPreference.role } }
        : {}),
    });
    activeTask.current = task;
    void task.result.then((result) => {
      if (activeTask.current !== task) return;
      activeTask.current = null;
      setCalculationState({ status: "done", result });
      window.requestAnimationFrame(() => {
        resultAnchor.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "start",
        });
      });
    }).catch((error: unknown) => {
      if (activeTask.current !== task) return;
      activeTask.current = null;
      if (error instanceof TeamCalculatorWorkerError && error.code === "cancelled") return;
      setCalculationState({
        status: "error",
        message: error instanceof Error ? error.message : "The team calculation could not finish.",
      });
      window.requestAnimationFrame(() => {
        resultAnchor.current?.scrollIntoView({ behavior: "auto", block: "start" });
      });
    });
  };

  const calculateLabel = talentsNeeded > 0
    ? `Add ${talentsNeeded} more ${talentsNeeded === 1 ? "talent" : "talents"}`
    : !oshiReady
      ? "Choose your Oshi"
    : calculationState.status === "calculating"
      ? "Cancel calculation"
      : "Calculate team";

  return (
    <div className={styles.workspace}>
      <div className={styles.mainColumn}>
        <section className={styles.rosterPanel} aria-busy={!storageReady} aria-labelledby="owned-cards-heading">
          <header className={styles.rosterHeading}>
            <div className={styles.stepHeading}>
              <span>01</span>
              <div>
                <h2 id="owned-cards-heading">Add the cards you own</h2>
                <p>Cards use max-level stats. Bloom 1–4 applies Live skill and stat upgrades; Bloom 5 Connect bonuses depend on your Board and are not included. New selections start at Bloom 0.</p>
              </div>
            </div>
            <div className={styles.rosterCount}><strong>{selectedCards.length}</strong><span>selected</span></div>
          </header>

          <div className={styles.filterBar}>
            <label className={styles.cardSearch}>
              <Search aria-hidden="true" />
              <span className="sr-only">Search cards</span>
              <input
                onChange={(event) => setFilter("q", event.target.value, "")}
                placeholder="Search talent, card, or Outfit…"
                type="search"
                value={query}
              />
              {query && <button aria-label="Clear card search" onClick={() => setFilter("q", "", "")} type="button"><X aria-hidden="true" /></button>}
            </label>
            <div className={styles.segmentedFilter} aria-label="Rarity filter" role="group">
              {["all", "5", "4"].map((value) => (
                <button aria-pressed={rarity === value} key={value} onClick={() => setFilter("rarity", value)} type="button">
                  {value === "all" ? "All" : `${value}★`}
                </button>
              ))}
            </div>
            <label className={styles.typeFilter}>
              <span>Type</span>
              <select aria-label="Card type" onChange={(event) => setFilter("attribute", event.target.value)} value={attribute}>
                <option value="all">All</option>
                <option value="cute">Cute</option>
                <option value="pure">Pure</option>
                <option value="happy">Happy</option>
              </select>
            </label>
            <span aria-atomic="true" aria-live="polite" className={styles.visibleCount}>{visibleCards.length} / {cards.length}</span>
          </div>

          <div className={styles.rarityGroups}>
            {[
              { rarity: 5 as const, label: "5★ Member cards", cards: visibleFiveStarCards },
              { rarity: 4 as const, label: "4★ Member cards", cards: visibleFourStarCards },
            ].filter((group) => group.cards.length > 0).map((group) => (
              <section className={styles.rarityGroup} data-rarity={group.rarity} key={group.rarity}>
                <header>
                  <h3>{group.label}</h3>
                  <strong>{group.cards.length}</strong>
                </header>
                <div className={styles.cardGrid}>
                  {group.cards.map((card, index) => {
                    const selected = card.id in ownedCards;
                    const bloomStage = ownedCards[card.id] ?? 0;
                    const eagerIndex = index + (group.rarity === 4 ? visibleFiveStarCards.length : 0);
                    return (
                      <article
                        className={`${styles.cardTile} ${selected ? styles.cardTileSelected : ""}`}
                        key={card.id}
                        style={{ "--card-accent": card.color } as CSSProperties}
                      >
                        <button
                          aria-label={`${selected ? "Remove" : "Add"} ${card.talentName}, ${card.title}, ${card.rarity} star card`}
                          aria-pressed={selected}
                          className={styles.cardSelect}
                          disabled={!storageReady}
                          onClick={() => toggleOwned(card.id)}
                          type="button"
                        >
                          <Image
                            alt=""
                            fill
                            loading={eagerIndex < 18 ? "eager" : "lazy"}
                            sizes="(max-width: 560px) 30vw, (max-width: 900px) 20vw, 130px"
                            src={card.artPath}
                          />
                          <span className={styles.rarityBadge}>{card.rarity}★</span>
                          <span className={styles.selectedBadge}><Check aria-hidden="true" /></span>
                        </button>
                        <div className={styles.cardIdentity}>
                          <small><i className={styles[card.attribute]} /> {card.attribute}</small>
                          <strong>{card.talentName}</strong>
                          <span>{card.title}</span>
                        </div>
                        {selected ? (
                          <label className={styles.bloomControl}>
                            <span>Bloom</span>
                            <select
                              aria-label={`${card.talentName}, ${card.title} Bloom level`}
                              onChange={(event) => setBloom(card.id, Number(event.target.value) as BloomStage)}
                              value={bloomStage}
                            >
                              {BLOOM_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                            </select>
                          </label>
                        ) : <span className={styles.addHint}>Select card</span>}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {visibleCards.length === 0 && (
            <div className={styles.emptyCards}>
              <Search aria-hidden="true" />
              <h3>No matching cards</h3>
              <button onClick={() => {
                const next = new URLSearchParams(pendingSearch.current);
                next.delete("q");
                next.delete("rarity");
                next.delete("attribute");
                const nextQuery = next.toString();
                pendingSearch.current = nextQuery;
                setFilters({ query: "", rarity: "all", attribute: "all" });
                window.history.replaceState(
                  window.history.state,
                  "",
                  nextQuery ? `${pathname}?${nextQuery}` : pathname,
                );
              }} type="button">Reset card filters</button>
            </div>
          )}
        </section>

        <section className={styles.oshiPanel} data-enabled={oshiPreference.enabled}>
          <header>
            <div className={styles.oshiHeadingIcon}><Heart aria-hidden="true" /></div>
            <div>
              <span>Optional constraint</span>
              <h2>Oshi mode</h2>
              <p>Keep one favorite in the recommendation.</p>
            </div>
            <button
              aria-checked={oshiPreference.enabled}
              aria-label="Oshi mode"
              className={styles.oshiToggle}
              onClick={() => updateOshi({ enabled: !oshiPreference.enabled })}
              role="switch"
              type="button"
            >
              <span />
              {oshiPreference.enabled ? "On" : "Off"}
            </button>
          </header>

          {oshiPreference.enabled && (
            <div className={styles.oshiControls}>
              <div className={styles.oshiTalentPicker}>
                <span className={styles.oshiTalentArt}>
                  {selectedOshiTalent ? (
                    <Image alt="" fill sizes="44px" src={selectedOshiTalent.card.artPath} />
                  ) : <Heart aria-hidden="true" />}
                </span>
                <label>
                  <span>Favorite talent</span>
                  <select
                    aria-label="Oshi talent"
                    onChange={(event) => updateOshi({ talentId: event.target.value || null })}
                    value={oshiPreference.talentId ?? ""}
                  >
                    <option value="">{selectedTalents.length > 0 ? "Choose from your roster" : "Add an owned card first"}</option>
                    {selectedTalents.map(({ card }) => (
                      <option key={card.talentId} value={card.talentId}>{card.talentName}</option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset>
                <legend>Required role</legend>
                <div className={styles.oshiRoles}>
                  {([
                    ["member", "Member", "One of the five"],
                    ["leader", "Leader", "Use their Outfit"],
                    ["member-and-leader", "Both", "Member and Leader"],
                  ] as const satisfies ReadonlyArray<readonly [StoredOshiRole, string, string]>).map(([role, label, hint]) => (
                    <button
                      aria-pressed={oshiPreference.role === role}
                      key={role}
                      onClick={() => updateOshi({ role })}
                      type="button"
                    >
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <p className={styles.oshiHelp}>
                The calculator evaluates your owned versions for the required role and builds the remaining slots around the selected one.
              </p>
            </div>
          )}
        </section>

        <div className={styles.resultAnchor} ref={resultAnchor}>
          {calculationState.status === "calculating" && (
            <section className={styles.calculatingPanel} aria-live="polite">
              <span className={styles.calculatingPulse} />
              <div><strong>Evaluating your roster</strong><small>Comparing legal Leaders, Members, Bloom levels, Oshi constraints, and team links…</small></div>
            </section>
          )}
          {calculationState.status === "error" && (
            <section className={styles.calculationError} role="alert">
              <strong>Calculation stopped</strong><p>{calculationState.message}</p><button onClick={runCalculation} type="button">Try again</button>
            </section>
          )}
          {calculationState.status === "done" && <TeamResult result={calculationState.result} />}
        </div>
      </div>

      <aside className={styles.selectionRail} aria-label="Selected roster">
        <header>
          <div><span>Your roster</span><strong>{selectedCards.length} {selectedCards.length === 1 ? "card" : "cards"}</strong></div>
              {selectedCards.length > 0 && <button aria-label="Clear selected roster" onClick={() => {
                invalidateCalculation();
                setOwnedCards({});
                setOshiPreference(emptyTeamRoster(rosterCommit).oshi);
              }} type="button"><Trash2 aria-hidden="true" /> Clear</button>}
        </header>

        <div className={styles.talentGate} data-ready={talentsNeeded === 0}>
          {talentsNeeded === 0 ? <BadgeCheck aria-hidden="true" /> : <span>{uniqueTalentCount}</span>}
          <div><strong>{talentsNeeded === 0 ? "Roster ready" : `${uniqueTalentCount} / 5 talents`}</strong><small>{talentsNeeded === 0 ? "Five unique Members available" : "A team cannot repeat a talent"}</small></div>
        </div>

        <div className={styles.selectedList}>
          {selectedCards.length === 0 ? (
            <p>Select a card to add it here.</p>
          ) : selectedCards.map(({ card, bloomStage }) => (
            <div className={styles.selectedCard} key={card.id}>
              <Image alt="" height={42} src={card.artPath} width={42} />
              <span><strong>{card.talentName}</strong><small>{card.title}</small></span>
              <b>B{bloomStage}</b>
              <button aria-label={`Remove ${card.talentName}, ${card.title}`} onClick={() => toggleOwned(card.id)} type="button"><X aria-hidden="true" /></button>
            </div>
          ))}
        </div>

        <button className={styles.calculateButton} disabled={!storageReady || (!canCalculate && calculationState.status !== "calculating")} onClick={runCalculation} type="button">
          <Calculator aria-hidden="true" /> {calculateLabel}
        </button>
        <p className={styles.savedState}><Check aria-hidden="true" /> {storageStatus === "persistent" ? "Roster saved on this device" : storageStatus === "session" ? "Roster changes stay on this page" : "Loading saved roster…"}</p>
      </aside>

      <div className={styles.mobileAction}>
        <div>
          <strong>{selectedCards.length} {selectedCards.length === 1 ? "card" : "cards"} · {uniqueTalentCount}/5 talents</strong>
          <span>{canCalculate ? "Ready to calculate" : talentsNeeded > 0 ? "Select five unique talents" : "Choose your Oshi"}</span>
        </div>
        <button aria-label={calculateLabel} disabled={!storageReady || (!canCalculate && calculationState.status !== "calculating")} onClick={runCalculation} type="button">
          <Calculator aria-hidden="true" /> {calculationState.status === "calculating" ? "Cancel" : !oshiReady && talentsNeeded === 0 ? "Set Oshi" : "Calculate"}
        </button>
      </div>

    </div>
  );
}
