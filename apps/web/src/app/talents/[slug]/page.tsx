import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Crown, Layers3 } from "lucide-react";

import { talentRecordBySlug, talentRecords } from "../talent-records";

export function generateStaticParams() {
  return talentRecords.map((talent) => ({ slug: talent.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const talent = talentRecordBySlug.get((await params).slug);
  if (!talent) return { title: "Talent not found" };
  return {
    title: `${talent.name} cards and Leader Outfits`,
    description: `Compare every current 4-star and 5-star ${talent.name} Member card and linked Leader Outfit.`,
  };
}

function total(parameters: { performance: number; technique: number; sense: number }) {
  return parameters.performance + parameters.technique + parameters.sense;
}

export default async function TalentPage({ params }: { params: Promise<{ slug: string }> }) {
  const talent = talentRecordBySlug.get((await params).slug);
  if (!talent) notFound();

  const cards = [...talent.cards].sort((left, right) =>
    right.rarity - left.rarity || left.title.localeCompare(right.title),
  );

  return (
    <div className="database-page talent-profile-page">
      <Link className="back-link" href="/talents"><ArrowLeft aria-hidden="true" /> Holomem directory</Link>

      <section className={`card-profile-hero talent-profile-hero attribute-${talent.heroCard.attribute}`}>
        <div className="card-illustration">
          <Image
            alt={`${talent.name} card illustration`}
            fill
            priority
            sizes="(max-width: 800px) 100vw, 62vw"
            src={talent.heroCard.illustrationPath}
          />
        </div>
        <div className="card-profile-copy">
          <p className="db-eyebrow">{talent.branch} · {talent.groups.join(" + ")}</p>
          <h1>{talent.name}</h1>
          <p className="talent-profile-intro">All current Member cards and the exact reward Outfit attached to each card.</p>
          <div className="card-profile-badges">
            <span>{cards.length} Member cards</span>
            <span>{cards.length} Leader Outfits</span>
          </div>
        </div>
      </section>

      <section className="related-card-section talent-card-section">
        <div className="section-title-row">
          <div><p className="db-eyebrow">Member cards</p><h2>4★ and 5★ records</h2></div>
          <Layers3 aria-hidden="true" />
        </div>
        <div className="real-card-catalog talent-card-grid">
          {cards.map((card) => (
            <Link className={`real-catalog-card attribute-${card.attribute}`} href={`/cards/${card.slug}`} key={card.id}>
              <span className="real-card-art">
                <Image alt="" fill sizes="(max-width: 700px) 100vw, 28vw" src={card.illustrationPath} />
                <i>{card.rarity}★</i>
              </span>
              <span className="real-card-copy">
                <small><i aria-hidden="true" /> {card.attribute} · Lv. {card.maxLevel}</small>
                <strong>{card.title}</strong>
                <span>Max Potential total {total(card.parameters.maxPotential).toLocaleString()}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="talent-outfit-section">
        <div className="section-title-row">
          <div><p className="db-eyebrow">Leader / Outfits</p><h2>Reward Outfits and Leader effects</h2></div>
          <Crown aria-hidden="true" />
        </div>
        <div className="talent-outfit-list">
          {cards.map((card) => (
            <Link href={`/leaders/${card.slug}`} key={card.leaderOutfit.costumeId}>
              <Image alt="" height={88} src={card.artPath} width={92} />
              <span>
                <small>Unlocked by {card.rarity}★ {card.title}</small>
                <strong>{card.leaderOutfit.costumeName}</strong>
                <span>{card.leaderOutfit.description?.replace(/\[\/?[^\]]+\]/g, "") ?? "Leader effect description unavailable."}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
