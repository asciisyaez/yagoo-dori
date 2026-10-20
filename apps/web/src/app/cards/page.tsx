import { currentBanner, publicCards, publicCardsInGenerationOrder, publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryBig } from "lucide-react";

import { CardCatalog, type CatalogCard } from "@/components/card-catalog";

export const metadata: Metadata = {
  title: "Cards and Leader Outfits",
  description: "Browse hololive Dreams Member cards and their linked Leader Outfits.",
};

const cards: CatalogCard[] = publicCardsInGenerationOrder.map((card) => ({
  id: card.id,
  slug: card.slug,
  talentName: card.talentName,
  title: card.title,
  rarity: card.rarity,
  attribute: card.attribute,
  groups: card.groups,
  illustrationPath: card.illustrationPath,
  isNew: currentBanner.featuredCardIds.includes(card.id),
  costumeName: card.leaderOutfit.costumeName,
  leaderDescription:
    card.leaderOutfit.description?.replace(/\[\/?[^\]]+\]/g, "") ??
    "Leader effect description unavailable.",
  firstSeenAt: card.firstSeenAt,
  generationOrder: card.generationOrder,
}));

export default function CardsPage() {
  const groups = [...new Set(publicCards.flatMap((card) => card.groups))].sort();

  return (
    <div className="database-page">
      <header className="database-heading">
        <div className="database-heading-icon"><LibraryBig aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Database / Cards & Outfits</p>
          <h1>Cards and Leader Outfits</h1>
          <p>Compare 4★ and 5★ Members, then switch to the Outfit view for Leader effects.</p>
        </div>
        <dl className="database-summary">
          <div><dt>Total</dt><dd>{publicData.counts.total}</dd></div>
          <div><dt>5★</dt><dd>{publicData.counts.fiveStar}</dd></div>
          <div><dt>4★</dt><dd>{publicData.counts.fourStar}</dd></div>
        </dl>
      </header>
      <Suspense fallback={<div className="db-loading">Loading cards and Outfits…</div>}>
        <CardCatalog cards={cards} groups={groups} />
      </Suspense>
    </div>
  );
}
