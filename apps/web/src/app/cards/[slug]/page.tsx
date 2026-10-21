import {
  nativeLeaderOutfitRankingEntryByLensAndCard,
  nativeGuideByAnchorCardId,
  nativeRankingEntryByLensAndCard,
  publicCardBySlug,
  publicCards,
} from "@yagoo-dori/core";
import { comparePublicMemberCards } from "@yagoo-dori/core/member-card-order";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardProfileView } from "./card-profile-view";

export function generateStaticParams() {
  return publicCards.map((card) => ({ slug: card.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const card = publicCardBySlug.get((await params).slug);
  return {
    title: card ? `${card.talentName} — ${card.title}` : "Card not found",
    description: card
      ? `${card.rarity}★ ${card.attribute} Member card, skills, stats, and Leader Outfit for ${card.talentName}.`
      : undefined,
  };
}

export default async function CardPage({ params }: { params: Promise<{ slug: string }> }) {
  const card = publicCardBySlug.get((await params).slug);
  if (!card) notFound();
  const standardRanking = nativeRankingEntryByLensAndCard
    .get("one-copy-maximum")
    ?.get(card.id);
  const standardLeaderRanking = nativeLeaderOutfitRankingEntryByLensAndCard
    .get("one-copy-maximum")
    ?.get(card.id);
  const related = publicCards
    .filter((candidate) => candidate.talentId === card.talentId && candidate.id !== card.id)
    .sort(comparePublicMemberCards);
  const teamGuide = nativeGuideByAnchorCardId.get(card.id);

  return (
    <CardProfileView
      card={card}
      related={related}
      standardLeaderRanking={standardLeaderRanking}
      standardRanking={standardRanking}
      teamGuide={teamGuide}
    />
  );
}
