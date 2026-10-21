import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { talentRecordBySlug, talentRecords } from "../talent-records";
import { TalentProfileView } from "./talent-profile-view";

export function generateStaticParams() {
  return talentRecords.map((talent) => ({ slug: talent.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const talent = talentRecordBySlug.get((await params).slug);
  if (!talent) return { title: "Talent not found" };
  return {
    title: `${talent.name} cards and Outfits`,
    description: `Compare every current 4-star and 5-star ${talent.name} card and its linked Leader Outfit.`,
  };
}

export default async function TalentPage({ params }: { params: Promise<{ slug: string }> }) {
  const talent = talentRecordBySlug.get((await params).slug);
  if (!talent) notFound();

  const cards = [...talent.cards].sort((left, right) =>
    right.rarity - left.rarity || left.title.localeCompare(right.title),
  );

  return <TalentProfileView cards={cards} talent={talent} />;
}
