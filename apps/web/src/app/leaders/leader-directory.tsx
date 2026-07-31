"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export type LeaderDirectoryRecord = {
  id: string;
  slug: string;
  talentName: string;
  cardTitle: string;
  costumeName: string;
  description: string;
  rarity: 4 | 5;
  attribute: "cute" | "pure" | "happy";
  groups: string[];
  illustrationPath: string;
};

export function LeaderDirectory({ leaders, groups }: { leaders: LeaderDirectoryRecord[]; groups: string[] }) {
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
    const nextQuery = next.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visible = leaders
    .filter((leader) => rarity === "all" || String(leader.rarity) === rarity)
    .filter((leader) => attribute === "all" || leader.attribute === attribute)
    .filter((leader) => group === "all" || leader.groups.includes(group))
    .filter((leader) =>
      !normalizedQuery
        ? true
        : `${leader.talentName} ${leader.cardTitle} ${leader.costumeName} ${leader.description}`
            .toLowerCase()
            .includes(normalizedQuery),
    );

  return (
    <>
      <div className="catalog-filter-bar">
        <label className="card-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search Leader Outfits</span>
          <input
            onChange={(event) => setFilter("q", event.target.value, "")}
            placeholder="Search Outfits, talents, or effects…"
            type="search"
            value={query}
          />
          {query && <button aria-label="Clear search" onClick={() => setFilter("q", "", "")} type="button"><X aria-hidden="true" /></button>}
        </label>
        <div className="compact-filter" aria-label="Unlock rarity filter">
          {["all", "5", "4"].map((value) => (
            <button aria-pressed={rarity === value} key={value} onClick={() => setFilter("rarity", value)} type="button">
              {value === "all" ? "All" : `${value}★`}
            </button>
          ))}
        </div>
        <label className="simple-select">
          <span className="sr-only">Member-card attribute</span>
          <select onChange={(event) => setFilter("attribute", event.target.value)} value={attribute}>
            <option value="all">All types</option>
            <option value="cute">Cute</option>
            <option value="pure">Pure</option>
            <option value="happy">Happy</option>
          </select>
        </label>
        <label className="simple-select">
          <span className="sr-only">Generation</span>
          <select onChange={(event) => setFilter("group", event.target.value)} value={group}>
            <option value="all">All generations</option>
            {groups.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <span className="catalog-result-count">{visible.length} / {leaders.length}</span>
      </div>

      <div className="real-card-catalog leader-directory-grid">
        {visible.map((leader) => (
          <Link className={`real-catalog-card leader-directory-card attribute-${leader.attribute}`} href={`/leaders/${leader.slug}`} key={leader.id}>
            <span className="real-card-art">
              <Image alt="" fill sizes="(max-width: 700px) 100vw, (max-width: 1200px) 33vw, 25vw" src={leader.illustrationPath} />
              <i>{leader.rarity}★ unlock</i>
            </span>
            <span className="real-card-copy">
              <small><i aria-hidden="true" /> {leader.talentName} · {leader.attribute}</small>
              <strong>{leader.costumeName}</strong>
              <span>From {leader.cardTitle}</span>
              <em className="leader-skill-snippet">{leader.description}</em>
            </span>
          </Link>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="empty-catalog"><Search aria-hidden="true" /><h2>No matching Leader Outfits</h2><p>Try a broader talent, Outfit, effect, rarity, type, or generation.</p></div>
      )}
    </>
  );
}
