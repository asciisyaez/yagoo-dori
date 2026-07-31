"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Grid3X3, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";

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
  editorialTier: "SS" | "S" | "A" | null;
};

type TierListExplorerProps = {
  cards: TierCard[];
  generations: string[];
};

const attributes = [
  { value: "all", label: "All types" },
  { value: "cute", label: "Cute" },
  { value: "pure", label: "Pure" },
  { value: "happy", label: "Happy" },
] as const;

function CardTile({ card }: { card: TierCard }) {
  return (
    <motion.div className={`game-card-tile attribute-${card.attribute}`} layout>
      <Link
        href={`/cards/${card.slug}`}
        aria-label={`${card.talentName}, ${card.title}, ${card.rarity} star ${card.attribute}`}
      >
        <Image
          alt=""
          fill
          sizes="(max-width: 700px) 76px, 92px"
          src={card.artPath}
        />
        <span className="card-rarity">{card.rarity}★</span>
        <i className="attribute-dot" aria-hidden="true" />
        <span className="card-tile-tooltip">
          <strong>{card.talentName}</strong>
          <small>{card.title}</small>
        </span>
      </Link>
    </motion.div>
  );
}

export function TierListExplorer({ cards, generations }: TierListExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "roster" ? "roster" : "score";
  const query = searchParams.get("q") ?? "";
  const rarity = searchParams.get("rarity") ?? "all";
  const attribute = searchParams.get("attribute") ?? "all";
  const generation = searchParams.get("generation") ?? "all";

  const setFilter = (key: string, value: string, defaultValue = "all") => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === defaultValue || value === "") next.delete(key);
    else next.set(key, value);
    if (key === "view" && value === "score") next.delete("rarity");
    const nextQuery = next.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visible = cards
    .filter((card) => view === "roster" || card.rarity === 5)
    .filter((card) => rarity === "all" || String(card.rarity) === rarity)
    .filter((card) => attribute === "all" || card.attribute === attribute)
    .filter((card) => generation === "all" || card.groups.includes(generation))
    .filter((card) =>
      normalizedQuery.length === 0
        ? true
        : `${card.talentName} ${card.title}`.toLowerCase().includes(normalizedQuery),
    );

  const groups =
    view === "score"
      ? [
          { id: "SS", label: "SS", caption: "Top score picks", cards: visible.filter((card) => card.editorialTier === "SS") },
          { id: "S", label: "S", caption: "Strong score picks", cards: visible.filter((card) => card.editorialTier === "S") },
          { id: "A", label: "A", caption: "Viable score picks", cards: visible.filter((card) => card.editorialTier === "A") },
        ]
      : [
          { id: "five", label: "5★", caption: "59 cards", cards: visible.filter((card) => card.rarity === 5) },
          { id: "four", label: "4★", caption: "54 cards", cards: visible.filter((card) => card.rarity === 4) },
        ];

  const activeFilterCount = [
    normalizedQuery,
    rarity !== "all",
    attribute !== "all",
    generation !== "all",
  ].filter(Boolean).length;

  return (
    <div className="tier-workspace">
      <div className="context-tabs" role="tablist" aria-label="Tier-list context">
        <button
          aria-selected={view === "score"}
          onClick={() => setFilter("view", "score")}
          role="tab"
          type="button"
        >
          5★ score tier
          <span>AppMedia snapshot</span>
        </button>
        <button
          aria-selected={view === "roster"}
          onClick={() => setFilter("view", "roster")}
          role="tab"
          type="button"
        >
          All 4★ + 5★
          <span>Complete card roster</span>
        </button>
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

        {view === "roster" && (
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
        )}

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
          onClick={() => router.replace(view === "roster" ? `${pathname}?view=roster` : pathname, { scroll: false })}
          type="button"
        >
          <RotateCcw aria-hidden="true" />
          Reset
          {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
        </button>
      </div>

      <div className="tier-results-line">
        <span><Grid3X3 aria-hidden="true" /> {visible.length} {visible.length === 1 ? "card" : "cards"} shown</span>
        {view === "score" ? (
          <p>Editorial score-performance tiers · Updated 30 July 2026</p>
        ) : (
          <p>Roster view only · no invented placement for unranked 4★ cards</p>
        )}
      </div>

      <div className={`tier-matrix view-${view}`}>
        <AnimatePresence initial={false}>
          {groups.map((group) => (
            <motion.section
              animate={{ opacity: 1, y: 0 }}
              className={`tier-band tier-${group.id.toLowerCase()}`}
              initial={{ opacity: 0, y: 8 }}
              key={`${view}-${group.id}`}
              layout
              transition={{ duration: 0.22 }}
            >
              <div className="tier-band-label">
                <strong>{group.label}</strong>
                <span>{group.caption}</span>
              </div>
              <div className="tier-card-grid">
                {group.cards.map((card) => <CardTile card={card} key={card.id} />)}
                {group.cards.length === 0 && <p className="empty-tier-band">No cards match these filters.</p>}
              </div>
            </motion.section>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
