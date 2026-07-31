import { publicCardBySlug, publicCards, publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Sparkles, Timer, Users } from "lucide-react";

export function generateStaticParams() {
  return publicCards.map((card) => ({ slug: card.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const card = publicCardBySlug.get((await params).slug);
  return {
    title: card ? `${card.talentName} — ${card.title}` : "Card not found",
    description: card
      ? `${card.rarity}★ ${card.attribute} Member card stats and skills for ${card.talentName}.`
      : undefined,
  };
}

function total(parameters: { performance: number; technique: number; sense: number }) {
  return parameters.performance + parameters.technique + parameters.sense;
}

function cleanDescription(description: string | null | undefined) {
  return description?.replace(/\[\/?[^\]]+\]/g, "") ?? "Description unavailable in the pinned English table.";
}

function SkillBlock({
  label,
  levels,
}: {
  label: string;
  levels: Array<{
    level: number;
    description: string | null;
    cooldownSeconds: number | null;
    durationSeconds: number | null;
    activationProbability: number | null;
  }>;
}) {
  const base = levels[0];
  const upgraded = levels.at(-1);
  return (
    <article className="mechanic-card">
      <div className="mechanic-card-heading">
        <span>{label.slice(0, 1)}</span>
        <div><small>Member skill</small><h2>{label}</h2></div>
      </div>
      <p>{cleanDescription(base?.description)}</p>
      <dl>
        {base?.activationProbability !== null && base?.activationProbability !== undefined && (
          <div><dt>Chance</dt><dd>{Math.round(base.activationProbability * 100)}%</dd></div>
        )}
        {base?.cooldownSeconds !== null && base?.cooldownSeconds !== undefined && (
          <div><dt>Interval</dt><dd>{base.cooldownSeconds}s</dd></div>
        )}
        {base?.durationSeconds !== null && base?.durationSeconds !== undefined && (
          <div><dt>Duration</dt><dd>{base.durationSeconds}s</dd></div>
        )}
      </dl>
      {upgraded && upgraded.level !== base?.level && (
        <details>
          <summary>Potential skill upgrade</summary>
          <p>{cleanDescription(upgraded.description)}</p>
        </details>
      )}
    </article>
  );
}

export default async function CardPage({ params }: { params: Promise<{ slug: string }> }) {
  const card = publicCardBySlug.get((await params).slug);
  if (!card) notFound();
  const related = publicCards.filter((candidate) => candidate.talentId === card.talentId && candidate.id !== card.id);

  return (
    <div className="database-page card-profile-page">
      <Link className="back-link" href="/cards"><ArrowLeft aria-hidden="true" /> Member-card database</Link>

      <section className={`card-profile-hero attribute-${card.attribute}`}>
        <div className="card-illustration">
          <Image
            alt={`${card.title} ${card.talentName} card illustration`}
            fill
            priority
            sizes="(max-width: 800px) 100vw, 62vw"
            src={card.illustrationPath}
          />
          <span className="profile-rarity">{card.rarity}★</span>
        </div>
        <div className="card-profile-copy">
          <p className="db-eyebrow">{card.attribute} · {card.groups.join(" + ")}</p>
          <h1>{card.talentName}</h1>
          <h2>{card.title}</h2>
          <p className="outfit-name">Leader Outfit: <strong>{card.leaderOutfit.costumeName}</strong></p>
          <div className="card-profile-badges">
            <span>Lv. {card.maxLevel}</span>
            <span>Member card</span>
            {card.editorialTier && <span>AppMedia {card.editorialTier} tier</span>}
          </div>
        </div>
      </section>

      <section className="parameter-section">
        <div className="section-title-row">
          <div><p className="db-eyebrow">Parameters</p><h2>Max-level stat profile</h2></div>
          <p>One-copy values exclude duplicate Potential. Max Potential is shown separately.</p>
        </div>
        <div className="parameter-comparison">
          {[
            ["One copy", card.parameters.oneCopyMaxLevel],
            ["Max Potential", card.parameters.maxPotential],
          ].map(([label, values]) => {
            const parameters = values as typeof card.parameters.oneCopyMaxLevel;
            return (
              <article key={label as string}>
                <header><span>{label as string}</span><strong>{total(parameters).toLocaleString()}</strong></header>
                {[
                  ["Performance", parameters.performance, "performance"],
                  ["Technique", parameters.technique, "technique"],
                  ["Sense", parameters.sense, "sense"],
                ].map(([name, value, key]) => (
                  <div className={`parameter-row parameter-${key}`} key={name as string}>
                    <span>{name as string}</span>
                    <i><b style={{ width: `${(Number(value) / Math.max(parameters.performance, parameters.technique, parameters.sense)) * 100}%` }} /></i>
                    <strong>{Number(value).toLocaleString()}</strong>
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      </section>

      <section className="skills-section">
        <div className="section-title-row">
          <div><p className="db-eyebrow">Member mechanics</p><h2>Active, Passive, and Special</h2></div>
          <Timer aria-hidden="true" />
        </div>
        <div className="mechanics-grid">
          <SkillBlock label="Active" levels={card.skills.active} />
          <SkillBlock label="Passive" levels={card.skills.passive} />
          <SkillBlock label="Special" levels={card.skills.special} />
        </div>
      </section>

      <section className="leader-outfit-panel">
        <div className="leader-icon"><Users aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Leader / Outfit skill</p>
          <h2>{card.leaderOutfit.costumeName}</h2>
          <p>{cleanDescription(card.leaderOutfit.description)}</p>
        </div>
        <span>Leader effect</span>
      </section>

      {related.length > 0 && (
        <section className="related-card-section">
          <div className="section-title-row">
            <div><p className="db-eyebrow">Same talent</p><h2>Other {card.talentName} cards</h2></div>
            <Sparkles aria-hidden="true" />
          </div>
          <div className="related-card-grid">
            {related.map((item) => (
              <Link href={`/cards/${item.slug}`} key={item.id}>
                <Image alt="" height={120} src={item.artPath} width={126} />
                <span><strong>{item.rarity}★ {item.title}</strong><small>{item.attribute}</small></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="compact-source-line">
        Data snapshot {publicData.retrievedAt} · HolodoriDB {publicData.sourceSnapshots.english.commit.slice(0, 8)} ·
        artwork indexed from Game8 · <a href={publicData.sourceSnapshots.art.page} target="_blank" rel="noreferrer">
          source <ExternalLink aria-hidden="true" />
        </a>
      </p>
    </div>
  );
}
