import { publicCardBySlug, publicCards } from "@yagoo-dori/core";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Crown, Layers3 } from "lucide-react";

import { talentSlug } from "../../talents/talent-records";

export function generateStaticParams() {
  return publicCards.map((card) => ({ slug: card.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const card = publicCardBySlug.get((await params).slug);
  if (!card) return { title: "Leader Outfit not found" };
  return {
    title: `${card.leaderOutfit.costumeName} — ${card.talentName} Leader Outfit`,
    description: `${card.talentName}'s ${card.leaderOutfit.costumeName} Leader Outfit effect and unlock card.`,
  };
}

function plainText(value: string | null) {
  return value?.replace(/\[\/?[^\]]+\]/g, "") ?? "Leader effect description unavailable.";
}

function total(parameters: { performance: number; technique: number; sense: number }) {
  return parameters.performance + parameters.technique + parameters.sense;
}

export default async function LeaderProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const card = publicCardBySlug.get((await params).slug);
  if (!card) notFound();

  return (
    <div className="database-page leader-profile-page">
      <Link className="back-link" href="/leaders"><ArrowLeft aria-hidden="true" /> Leader Outfit database</Link>

      <section className={`card-profile-hero leader-profile-hero attribute-${card.attribute}`}>
        <div className="card-illustration">
          <Image
            alt={`${card.talentName} ${card.title} card illustration`}
            fill
            priority
            sizes="(max-width: 800px) 100vw, 62vw"
            src={card.illustrationPath}
          />
          <span className="profile-rarity">{card.rarity}★ unlock</span>
        </div>
        <div className="card-profile-copy">
          <p className="db-eyebrow">Leader / Outfit · {card.attribute}</p>
          <h1>{card.leaderOutfit.costumeName}</h1>
          <h2>{card.talentName}</h2>
          <p className="outfit-name">Reward from <strong>{card.title}</strong></p>
          <div className="card-profile-badges">
            <span>{card.groups.join(" + ")}</span>
            <span>Leader Outfit</span>
          </div>
        </div>
      </section>

      <section className="leader-effect-detail">
        <div className="leader-icon"><Crown aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Leader effect</p>
          <h2>{card.leaderOutfit.costumeName}</h2>
          <p>{plainText(card.leaderOutfit.description)}</p>
        </div>
      </section>

      <section className="leader-unlock-card">
        <div className="section-title-row">
          <div><p className="db-eyebrow">Unlock source</p><h2>Attached Member card</h2></div>
          <Layers3 aria-hidden="true" />
        </div>
        <Link className="leader-unlock-link" href={`/cards/${card.slug}`}>
          <Image alt="" height={144} src={card.artPath} width={150} />
          <span>
            <small>{card.rarity}★ · {card.attribute} · Lv. {card.maxLevel}</small>
            <strong>{card.talentName} — {card.title}</strong>
            <span>Max Potential total {total(card.parameters.maxPotential).toLocaleString()}</span>
          </span>
          <ArrowRight aria-hidden="true" />
        </Link>
        <Link className="text-link" href={`/talents/${talentSlug(card.talentName)}`}>View every {card.talentName} record <ArrowRight aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
