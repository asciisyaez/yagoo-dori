"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export type CatalogCard = {
  id: string;
  slug: string;
  talentName: string;
  title: string;
  rarity: 4 | 5;
  attribute: "cute" | "pure" | "happy";
  groups: string[];
  illustrationPath: string;
  costumeName: string;
  leaderDescription: string;
};

export function CardCatalog({ cards, groups }: { cards: CatalogCard[]; groups: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const rarity = searchParams.get("rarity") ?? "all";
  const attribute = searchParams.get("attribute") ?? "all";
  const group = searchParams.get("group") ?? "all";
  const view = searchParams.get("view") === "outfits" ? "outfits" : "members";

  const setFilter = (key: string, value: string, defaultValue = "all") => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === defaultValue || value === "") next.delete(key);
    else next.set(key, value);
    const text = next.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };

  const viewHref = (nextView: "members" | "outfits") => {
    const next = new URLSearchParams(searchParams.toString());
    if (nextView === "members") next.delete("view");
    else next.set("view", "outfits");
    const text = next.toString();
    return text ? `${pathname}?${text}` : pathname;
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visible = cards
    .filter((card) => rarity === "all" || String(card.rarity) === rarity)
    .filter((card) => attribute === "all" || card.attribute === attribute)
    .filter((card) => group === "all" || card.groups.includes(group))
    .filter((card) =>
      !normalizedQuery
        ? true
        : `${card.talentName} ${card.title} ${
            view === "outfits" ? `${card.costumeName} ${card.leaderDescription}` : ""
          }`.toLowerCase().includes(normalizedQuery),
    );

  return (
    <>
      <nav className="catalog-context-tabs" aria-label="Card database view">
        <Link aria-current={view === "members" ? "page" : undefined} href={viewHref("members")}>
          <span>Member cards</span><strong>{cards.length}</strong>
        </Link>
        <Link aria-current={view === "outfits" ? "page" : undefined} href={viewHref("outfits")}>
          <span>Leader Outfits</span><strong>{cards.length}</strong>
        </Link>
      </nav>

      <div className="catalog-filter-bar">
        <label className="card-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search {view === "outfits" ? "Leader Outfits" : "Member cards"}</span>
          <input
            onChange={(event) => setFilter("q", event.target.value, "")}
            placeholder={view === "outfits" ? "Search Outfits or effects…" : "Search cards or talents…"}
            type="search"
            value={query}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setFilter("q", "", "")} type="button">
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
        <label className="simple-select">
          <span className="sr-only">Attribute</span>
          <select value={attribute} onChange={(event) => setFilter("attribute", event.target.value)}>
            <option value="all">All types</option>
            <option value="cute">Cute</option>
            <option value="pure">Pure</option>
            <option value="happy">Happy</option>
          </select>
        </label>
        <label className="simple-select">
          <span className="sr-only">Generation</span>
          <select value={group} onChange={(event) => setFilter("group", event.target.value)}>
            <option value="all">All generations</option>
            {groups.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <span className="catalog-result-count">{visible.length} / {cards.length}</span>
      </div>

      <div className={`real-card-catalog${view === "outfits" ? " leader-directory-grid" : ""}`}>
        {visible.map((card, index) => (
          <Link
            className={`real-catalog-card${view === "outfits" ? " leader-directory-card" : ""} attribute-${card.attribute}`}
            href={`/cards/${card.slug}${view === "outfits" ? "#leader-outfit" : ""}`}
            key={card.id}
          >
            <span className="real-card-art">
              <Image
                alt=""
                fill
                loading={index < 4 ? "eager" : "lazy"}
                sizes="(max-width: 700px) 50vw, (max-width: 1200px) 33vw, 25vw"
                src={card.illustrationPath}
              />
              <i>{card.rarity}★{view === "outfits" ? " unlock" : ""}</i>
            </span>
            <span className="real-card-copy">
              <small><i aria-hidden="true" /> {card.attribute} · {card.groups.join(" + ")}</small>
              <strong>{view === "outfits" ? card.costumeName : card.talentName}</strong>
              <span>{view === "outfits" ? `${card.talentName} · From ${card.title}` : card.title}</span>
              {view === "outfits" && <em className="leader-skill-snippet">{card.leaderDescription}</em>}
            </span>
          </Link>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="empty-catalog">
          <Search aria-hidden="true" />
          <h2>No matching {view === "outfits" ? "Outfits" : "cards"}</h2>
          <p>Try a broader talent, effect, rarity, type, or generation.</p>
        </div>
      )}
    </>
  );
}
