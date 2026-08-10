"use client";

import type { NativeLens, NativeModelBand } from "@yagoo-dori/core";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, CircleHelp, Eye, Grid3X3, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

type TierPlacement = {
  tier: NativeModelBand;
  rank: number;
  index: { lower: number; central: number; upper: number };
  provisional: boolean;
  matchedContexts: number;
};

export type TierCard = {
  id: string;
  slug: string;
  talentName: string;
  title: string;
  rarity: 4 | 5;
  attribute: "cute" | "pure" | "happy";
  generation: string;
  groups: string[];
  artPath: string;
  mechanics: {
    performance: number;
    technique: number;
    sense: number;
    active: string;
    passive: string;
    special: string;
    leader: string;
  };
  rankings: Record<NativeLens, TierPlacement>;
};

type TierListExplorerProps = {
  memberCards: TierCard[];
  leaderOutfits: TierCard[];
  generations: string[];
};

const DEFAULT_LENS: NativeLens = "one-copy-maximum";
type TierContext = "members" | "outfits";
const DEFAULT_CONTEXT: TierContext = "members";

const contexts: ReadonlyArray<{
  id: TierContext;
  label: string;
  caption: string;
}> = [
  { id: "members", label: "Member cards", caption: "Active, Passive & Special kits" },
  { id: "outfits", label: "Leader / Outfits", caption: "Leader effects and conditions" },
];

const lenses: ReadonlyArray<{
  id: NativeLens;
  label: string;
  caption: string;
}> = [
  { id: "one-copy-maximum", label: "Standard Manual", caption: "One copy · max non-dupe growth" },
  { id: "low-investment", label: "Low Investment", caption: "Entry level" },
  { id: "duplicate-enabled-ceiling", label: "Max Ceiling", caption: "Duplicate boosts enabled" },
];

const attributes = [
  { value: "all", label: "All types" },
  { value: "cute", label: "Cute" },
  { value: "pure", label: "Pure" },
  { value: "happy", label: "Happy" },
] as const;

const bands: ReadonlyArray<{
  id: NativeModelBand;
  caption: string;
}> = [
  { id: "SS", caption: "Exceptional" },
  { id: "S", caption: "Leading" },
  { id: "A", caption: "Strong" },
  { id: "B", caption: "Solid" },
  { id: "C", caption: "Situational" },
  { id: "D", caption: "Limited" },
];

function isNativeLens(value: string | null): value is NativeLens {
  return lenses.some((lens) => lens.id === value);
}

function isTierContext(value: string | null): value is TierContext {
  return contexts.some((context) => context.id === value);
}

function moveWithinTablist(event: ReactKeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[role='tab']") ?? [],
  );
  const currentIndex = tabs.indexOf(event.currentTarget);
  if (currentIndex < 0 || tabs.length === 0) return;
  event.preventDefault();
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? tabs.length - 1
      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[nextIndex]?.focus();
  tabs[nextIndex]?.click();
}

function CardTile({
  card,
  context,
  lens,
  reducedMotion,
  onQuickView,
}: {
  card: TierCard;
  context: TierContext;
  lens: NativeLens;
  reducedMotion: boolean;
  onQuickView: (card: TierCard) => void;
}) {
  const placement = card.rankings[lens];
  const entityLabel = context === "outfits" ? "Leader Outfit" : "Member card";
  return (
    <motion.div className={`game-card-tile attribute-${card.attribute}`} layout={!reducedMotion}>
      <Link
        href={`/cards/${card.slug}`}
        aria-label={`${card.talentName}, ${card.title}, ${card.rarity} star ${card.attribute} ${entityLabel}, ${placement.tier} tier`}
      >
        <Image
          alt=""
          fill
          sizes="(max-width: 700px) 76px, 92px"
          src={card.artPath}
        />
        <span className="card-rarity">{card.rarity}★</span>
        <i className="attribute-dot" aria-hidden="true" />
      </Link>
      <button
        aria-label={`Quick view ${card.talentName}, ${card.title}`}
        className="card-quick-view-button"
        onClick={() => onQuickView(card)}
        type="button"
      >
        <Eye aria-hidden="true" />
      </button>
      <span className="card-tile-tooltip" aria-hidden="true">
        <strong>{card.talentName}</strong>
        <small>{card.title} · {placement.tier} tier</small>
      </span>
    </motion.div>
  );
}

export function TierListExplorer({ memberCards, leaderOutfits, generations }: TierListExplorerProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const quickViewRef = useRef<HTMLDialogElement>(null);
  const [selectedCard, setSelectedCard] = useState<TierCard | null>(null);
  const requestedLens = searchParams.get("lens");
  const lens = isNativeLens(requestedLens) ? requestedLens : DEFAULT_LENS;
  const requestedContext = searchParams.get("context");
  const context = isTierContext(requestedContext) ? requestedContext : DEFAULT_CONTEXT;
  const cards = context === "outfits" ? leaderOutfits : memberCards;
  const query = searchParams.get("q") ?? "";
  const rarity = searchParams.get("rarity") ?? "all";
  const attribute = searchParams.get("attribute") ?? "all";
  const generation = searchParams.get("generation") ?? "all";

  const filterHref = (key: string, value: string, defaultValue = "all") => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === defaultValue || value === "") next.delete(key);
    else next.set(key, value);
    const nextQuery = next.toString();
    return nextQuery ? `${pathname}?${nextQuery}` : pathname;
  };

  const setFilter = (key: string, value: string, defaultValue = "all") => {
    // Read the live URL so rapid control changes cannot overwrite a navigation
    // that has reached history before React receives the new search params.
    const next = new URLSearchParams(window.location.search);
    if (value === defaultValue || value === "") next.delete(key);
    else next.set(key, value);
    const nextQuery = next.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visible = cards
    .filter((card) => rarity === "all" || String(card.rarity) === rarity)
    .filter((card) => attribute === "all" || card.attribute === attribute)
    .filter((card) => generation === "all" || card.groups.includes(generation))
    .filter((card) =>
      normalizedQuery.length === 0
        ? true
        : `${card.talentName} ${card.title}`.toLowerCase().includes(normalizedQuery),
    )
    .sort((left, right) => left.rankings[lens].rank - right.rankings[lens].rank);

  const groups = bands.map((band) => ({
    ...band,
    cards: visible.filter((card) => card.rankings[lens].tier === band.id),
  }));

  const activeFilterCount = [
    normalizedQuery,
    rarity !== "all",
    attribute !== "all",
    generation !== "all",
  ].filter(Boolean).length;
  const activeLens = lenses.find((item) => item.id === lens)!;

  useEffect(() => {
    const dialog = quickViewRef.current;
    if (selectedCard && dialog && !dialog.open) dialog.showModal();
  }, [selectedCard]);

  const resetFilters = () => {
    const next = new URLSearchParams();
    if (context !== DEFAULT_CONTEXT) next.set("context", context);
    if (lens !== DEFAULT_LENS) next.set("lens", lens);
    const text = next.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };

  return (
    <div className="tier-workspace">
      <div className="context-tabs entity-context-tabs" role="tablist" aria-label="Ranking context">
        {contexts.map((item) => (
          <Link
            aria-selected={context === item.id}
            href={filterHref("context", item.id, DEFAULT_CONTEXT)}
            key={item.id}
            onKeyDown={moveWithinTablist}
            role="tab"
            tabIndex={context === item.id ? 0 : -1}
          >
            {item.label}
            <span>{item.caption}</span>
          </Link>
        ))}
      </div>

      <div className="context-tabs context-tabs-three" role="tablist" aria-label="Ranking investment lens">
        {lenses.map((item) => (
          <Link
            aria-selected={lens === item.id}
            href={filterHref("lens", item.id, DEFAULT_LENS)}
            key={item.id}
            onKeyDown={moveWithinTablist}
            role="tab"
            tabIndex={lens === item.id ? 0 : -1}
          >
            {item.label}
            <span>{item.caption}</span>
          </Link>
        ))}
      </div>

      <div className="tier-filter-bar">
        <label className="card-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search cards</span>
          <input
            onChange={(event) => setFilter("q", event.target.value, "")}
            placeholder="Search cards or talents…"
            type="search"
            value={query}
          />
          {query && (
            <button onClick={() => setFilter("q", "", "")} type="button" aria-label="Clear search">
              <X aria-hidden="true" />
            </button>
          )}
        </label>

        <div className="compact-filter" aria-label="Rarity filter">
          {["all", "5", "4"].map((value) => (
            <button
              aria-pressed={rarity === value}
              key={value}
              onClick={() => setFilter("rarity", value)}
              type="button"
            >
              {value === "all" ? "All" : `${value}★`}
            </button>
          ))}
        </div>

        <div className="attribute-filter" aria-label="Attribute filter">
          {attributes.map((item) => (
            <button
              aria-pressed={attribute === item.value}
              className={`attribute-${item.value}`}
              key={item.value}
              onClick={() => setFilter("attribute", item.value)}
              type="button"
            >
              {item.value !== "all" && <i aria-hidden="true" />}
              {item.label}
            </button>
          ))}
        </div>

        <label className="generation-filter">
          <SlidersHorizontal aria-hidden="true" />
          <span className="sr-only">Generation</span>
          <select
            onChange={(event) => setFilter("generation", event.target.value)}
            value={generation}
          >
            <option value="all">All generations</option>
            {generations.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <button
          className="clear-compact-filters"
          disabled={activeFilterCount === 0}
          onClick={resetFilters}
          type="button"
        >
          <RotateCcw aria-hidden="true" />
          Reset
          {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>
      </div>

      <div className="tier-results-line" aria-live="polite">
        <span><Grid3X3 aria-hidden="true" /> {visible.length} {context === "outfits" ? "Outfits" : visible.length === 1 ? "card" : "cards"} shown</span>
        <p>{activeLens.label} · Manual · All Perfect · provisional model tiers</p>
        <div className="tier-results-actions">
          <Link href="/methodology"><CircleHelp aria-hidden="true" /> How tiers work</Link>
        </div>
      </div>

      <div className="tier-matrix">
        <AnimatePresence initial={false} mode="popLayout">
          {groups.map((group) => (
            <motion.section
              animate={{ opacity: 1, y: 0 }}
              className={`tier-band tier-${group.id.toLowerCase()}${group.cards.length === 0 ? " tier-band-empty" : ""}`}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              key={`${context}-${lens}-${group.id}`}
              layout={!reducedMotion}
              transition={{ duration: reducedMotion ? 0 : 0.22 }}
            >
              <div className="tier-band-label">
                <strong>{group.id}</strong>
                <span>{group.caption}</span>
              </div>
              <div className="tier-card-grid">
                {group.cards.map((card) => (
                  <CardTile
                    card={card}
                    context={context}
                    key={card.id}
                    lens={lens}
                    onQuickView={setSelectedCard}
                    reducedMotion={reducedMotion}
                  />
                ))}
                {group.cards.length === 0 && (
                  <p className="empty-tier-band">
                    {group.id === "SS" && "No current card clears the SS evidence gate — its absolute index requirement sits above every card's most optimistic reading, so S is the current effective top. See the methodology page."}
                    {group.id === "D" && "The D evidence gate requires mostly definitely-negative contexts, which no current card shows — cards near the bottom publish as C instead. See the methodology page."}
                    {group.id !== "SS" && group.id !== "D" && "No cards in this tier."}
                  </p>
                )}
              </div>
            </motion.section>
          ))}
        </AnimatePresence>
      </div>

      <dialog
        aria-labelledby="tier-quick-view-title"
        className="tier-quick-view"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        onClose={() => setSelectedCard(null)}
        ref={quickViewRef}
      >
        {selectedCard && (
          <div className={`tier-quick-view-shell attribute-${selectedCard.attribute}`}>
            <button
              aria-label="Close quick view"
              className="tier-quick-view-close"
              onClick={() => quickViewRef.current?.close()}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
            <div className="tier-quick-view-art">
              <Image
                alt={`${selectedCard.talentName} ${selectedCard.title}`}
                fill
                sizes="(max-width: 700px) 100vw, 330px"
                src={selectedCard.artPath}
              />
            </div>
            <div className="tier-quick-view-copy">
              <p className="db-eyebrow">{context === "outfits" ? "Leader Outfit" : "Member card"}</p>
              <h2 id="tier-quick-view-title">{selectedCard.talentName}</h2>
              <p className="tier-quick-view-title">{selectedCard.title}</p>
              <div className="tier-quick-view-tags">
                <span>{selectedCard.rarity}★</span>
                <span>{selectedCard.attribute}</span>
                <span>{selectedCard.rankings[lens].tier} tier</span>
                <span>#{selectedCard.rankings[lens].rank}</span>
                {selectedCard.rankings[lens].provisional && <span>Provisional</span>}
              </div>
              <p className="tier-quick-view-index">
                Model index {selectedCard.rankings[lens].index.central.toFixed(1)}
                {" "}({selectedCard.rankings[lens].index.lower.toFixed(1)}–{selectedCard.rankings[lens].index.upper.toFixed(1)} range)
                {" "}· {selectedCard.rankings[lens].matchedContexts.toLocaleString()} matched contexts vs the frozen launch cohort
              </p>

              {context === "members" ? (
                <>
                  <dl className="tier-quick-view-stats">
                    <div><dt>Performance</dt><dd>{selectedCard.mechanics.performance.toLocaleString()}</dd></div>
                    <div><dt>Technique</dt><dd>{selectedCard.mechanics.technique.toLocaleString()}</dd></div>
                    <div><dt>Sense</dt><dd>{selectedCard.mechanics.sense.toLocaleString()}</dd></div>
                  </dl>
                  <div className="tier-quick-view-skills">
                    <section><h3>Active</h3><p>{selectedCard.mechanics.active}</p></section>
                    <section><h3>Passive</h3><p>{selectedCard.mechanics.passive}</p></section>
                    <section><h3>Special</h3><p>{selectedCard.mechanics.special}</p></section>
                  </div>
                </>
              ) : (
                <div className="tier-quick-view-skills">
                  <section><h3>Leader effect</h3><p>{selectedCard.mechanics.leader}</p></section>
                </div>
              )}

              <Link className="tier-quick-view-link" href={`/cards/${selectedCard.slug}`}>
                Open full card <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
