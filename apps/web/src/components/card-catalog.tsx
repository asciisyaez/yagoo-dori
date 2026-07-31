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
};

export function CardCatalog({ cards, groups }: { cards: CatalogCard[]; groups: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const rarity = searchParams.get("rarity") ?? "all";
  const attribute = searchParams.get("attribute") ?? "all";
  const group = searchParams.get("group") ?? "all";

  const setFilter = (key: string, value: string, defaultValue = "all") => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === defaultValue || value === "") next.delete(key);
    else next.set(key, value);
    const text = next.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visible = cards
    .filter((card) => rarity === "all" || String(card.rarity) === rarity)
    .filter((card) => attribute === "all" || card.attribute === attribute)
    .filter((card) => group === "all" || card.groups.includes(group))
    .filter((card) =>
      !normalizedQuery
        ? true
        : `${card.talentName} ${card.title}`.toLowerCase().includes(normalizedQuery),
    );

  return (
    <>
      <div className="catalog-filter-bar">
        <label className="card-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search cards</span>
          <input
            onChange={(event) => setFilter("q", event.target.value, "")}
            placeholder="Search 113 cards…"
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

      <div className="real-card-catalog">
        {visible.map((card) => (
          <Link className={`real-catalog-card attribute-${card.attribute}`} href={`/cards/${card.slug}`} key={card.id}>
            <span className="real-card-art">
              <Image
                alt=""
                fill
                sizes="(max-width: 700px) 100vw, (max-width: 1200px) 33vw, 25vw"
                src={card.illustrationPath}
              />
              <i>{card.rarity}★</i>
            </span>
            <span className="real-card-copy">
              <small><i aria-hidden="true" /> {card.attribute} · {card.groups.join(" + ")}</small>
              <strong>{card.talentName}</strong>
              <span>{card.title}</span>
            </span>
          </Link>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="empty-catalog">
          <Search aria-hidden="true" />
          <h2>No matching cards</h2>
          <p>Try a broader name, rarity, type, or generation.</p>
        </div>
      )}
    </>
  );
}
