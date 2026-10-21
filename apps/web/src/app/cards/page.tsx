import { currentBanner, publicCards, publicCardsInGenerationOrder, publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import { Suspense } from "react";

import { CardCatalog, type CatalogCard } from "@/components/card-catalog";
import { CardsHeader } from "./cards-header";

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
}));

export default function CardsPage() {
  const groups = [...new Set(publicCards.flatMap((card) => card.groups))].sort();

  return (
    <div className="database-page">
      <CardsHeader
        total={publicData.counts.total}
        fiveStar={publicData.counts.fiveStar}
        fourStar={publicData.counts.fourStar}
      />
      <Suspense fallback={<div className="db-loading">Loading cards and Outfits…</div>}>
        <CardCatalog cards={cards} groups={groups} />
      </Suspense>
    </div>
  );
}
