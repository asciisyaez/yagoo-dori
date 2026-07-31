import { publicCards, publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryBig } from "lucide-react";

import { CardCatalog, type CatalogCard } from "@/components/card-catalog";

export const metadata: Metadata = {
  title: "Member-card database",
  description: "Browse all 113 current hololive Dreams 4-star and 5-star Member cards.",
};

const cards: CatalogCard[] = publicCards.map((card) => ({
  id: card.id,
  slug: card.slug,
  talentName: card.talentName,
  title: card.title,
  rarity: card.rarity,
  attribute: card.attribute,
  groups: card.groups,
  illustrationPath: card.illustrationPath,
}));

export default function CardsPage() {
  const groups = [...new Set(publicCards.flatMap((card) => card.groups))].sort();

  return (
    <div className="database-page">
      <header className="database-heading">
        <div className="database-heading-icon"><LibraryBig aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Database / Member cards</p>
          <h1>Member-card database</h1>
          <p>Every current 4★ and 5★ card, with the real art, stats, skill levels, and linked Leader Outfit.</p>
        </div>
        <dl className="database-summary">
          <div><dt>Total</dt><dd>{publicData.counts.total}</dd></div>
          <div><dt>5★</dt><dd>{publicData.counts.fiveStar}</dd></div>
          <div><dt>4★</dt><dd>{publicData.counts.fourStar}</dd></div>
        </dl>
      </header>
      <Suspense fallback={<div className="db-loading">Loading card database…</div>}>
        <CardCatalog cards={cards} groups={groups} />
      </Suspense>
    </div>
  );
}
