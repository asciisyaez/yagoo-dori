import { publicCards, publicCardsInGenerationOrder } from "@yagoo-dori/core";
import type { Metadata } from "next";
import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import { notFound } from "next/navigation";
import { ArrowRight, GitBranch, Target } from "lucide-react";

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const groups = [...new Set(publicCards.flatMap((card) => card.groups))]
  .sort()
  .map((name) => ({ name, slug: slugify(name) }));

export const dynamicParams = false;

export function generateStaticParams() {
  return groups.map((group) => ({ slug: group.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const group = groups.find((candidate) => candidate.slug === slug);
  return { title: group ? `${group.name} Member cards` : "Group not found" };
}

export default async function SynergyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = groups.find((candidate) => candidate.slug === slug);
  if (!group) notFound();

  const memberCards = publicCardsInGenerationOrder.filter((card) => card.groups.includes(group.name));
  const targetNeedle = group.name.toLowerCase();
  const targetingCards = publicCardsInGenerationOrder.flatMap((card) => {
    const memberSkill = Object.values(card.skills)
      .flat()
      .find((level) => level.description?.toLowerCase().includes(targetNeedle))?.description;
    const leaderSkill = card.leaderOutfit.description?.toLowerCase().includes(targetNeedle)
      ? card.leaderOutfit.description
      : null;
    const description = memberSkill ?? leaderSkill;
    return description ? [{ card, description }] : [];
  });
  const talents = new Set(memberCards.map((card) => card.talentId)).size;

  return (
    <div className="database-page">
      <header className="database-heading">
        <div className="database-heading-icon"><GitBranch aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Database / Group connection</p>
          <h1>{group.name}</h1>
          <p>
            Cards belonging to this in-game group. Group membership matters when a skill or Leader
            condition explicitly targets it; membership alone is not a score bonus.
          </p>
        </div>
        <dl className="database-summary">
          <div><dt>Talents</dt><dd>{talents}</dd></div>
          <div><dt>Cards</dt><dd>{memberCards.length}</dd></div>
          <div><dt>Skill mentions</dt><dd>{targetingCards.length}</dd></div>
        </dl>
      </header>

      <section className="record-section">
        <p className="db-eyebrow">Group roster</p>
        <h2>{group.name} Member cards</h2>
        <div className="guide-anchor-grid">
          {memberCards.map((card) => (
            <Link className="simple-record" href={`/cards/${card.slug}`} key={card.id}>
              <Image src={card.artPath} alt="" width={96} height={96} sizes="72px" />
              <div>
                <span>{card.rarity}★ · {card.attribute}</span>
                <h3>{card.talentName}</h3>
                <p>{card.title}</p>
              </div>
              <ArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      {targetingCards.length > 0 && (
        <section className="record-section">
          <p className="db-eyebrow">Explicit targets</p>
          <h2>Skill text mentioning {group.name}</h2>
          <div className="group-target-list">
            {targetingCards.map(({ card, description }) => (
              <Link className="simple-record" href={`/cards/${card.slug}`} key={card.id}>
                <Target aria-hidden="true" />
                <div>
                  <span>{card.rarity}★ · {card.attribute}</span>
                  <h3>{card.talentName}</h3>
                  <p>{description}</p>
                </div>
                <ArrowRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
