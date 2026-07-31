import { publicCards } from "@yagoo-dori/core";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, ArrowRight, Clock3, Layers3, Target } from "lucide-react";

const skillCategories = ["active", "passive", "special"] as const;
const skillRecords = publicCards.flatMap((card) =>
  skillCategories.map((category) => ({
    slug: `${card.slug}--${category}`,
    card,
    category,
    levels: card.skills[category],
  })),
);

const cleanDescription = (description: string | null) =>
  description?.replace(/\[\/?attribute(?:=[^\]]+)?\]/g, "") ?? "Description unavailable in the pinned English table.";

export const dynamicParams = false;

export function generateStaticParams() {
  return skillRecords.map((record) => ({ slug: record.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const record = skillRecords.find((candidate) => candidate.slug === slug);
  return { title: record ? `${record.card.talentName} ${record.category} skill` : "Skill not found" };
}

export default async function SkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = skillRecords.find((candidate) => candidate.slug === slug);
  if (!record) notFound();

  const current = record.levels.at(-1)!;
  const related = current.effectGroupId
    ? skillRecords.filter((candidate) =>
        candidate.slug !== record.slug &&
        candidate.category === record.category &&
        candidate.levels.at(-1)?.effectGroupId === current.effectGroupId,
      )
    : [];

  return (
    <div className="database-page skill-profile-page">
      <Link className="back-link" href={`/cards/${record.card.slug}`}>
        <ArrowLeft aria-hidden="true" /> {record.card.talentName} card
      </Link>

      <section className={`skill-profile-hero attribute-${record.card.attribute}`}>
        <Image src={record.card.artPath} alt="" width={176} height={176} priority />
        <div>
          <p className="db-eyebrow">{record.card.rarity}★ Member skill / {record.category}</p>
          <h1>{record.card.talentName}</h1>
          <h2>{record.card.title}</h2>
          <p>{cleanDescription(current.description)}</p>
        </div>
      </section>

      <section className="skill-sheet" aria-label="Skill timing">
        <div>
          <Activity aria-hidden="true" /><span>Category</span><strong>{record.category}</strong>
          <p>{record.levels.length} recorded level{record.levels.length === 1 ? "" : "s"}</p>
        </div>
        <div>
          <Clock3 aria-hidden="true" /><span>Timing</span>
          <strong>{current.cooldownSeconds === null ? "—" : `${current.cooldownSeconds}s`}</strong>
          <p>{current.durationSeconds === null ? "Persistent or immediate" : `${current.durationSeconds}s duration`}</p>
        </div>
        <div>
          <Target aria-hidden="true" /><span>Activation</span>
          <strong>{current.activationProbability === null ? "Condition" : `${Math.round(current.activationProbability * 100)}%`}</strong>
          <p>{current.triggerGroupId === null ? "No separate base trigger" : "Conditional trigger recorded"}</p>
        </div>
      </section>

      <section className="record-section">
        <p className="db-eyebrow">Progression</p>
        <h2>Recorded skill levels</h2>
        <div className="skill-level-list">
          {record.levels.map((level) => (
            <article className="content-panel" key={level.level}>
              <Layers3 aria-hidden="true" />
              <span>Skill level {level.level}</span>
              <p>{cleanDescription(level.description)}</p>
              <dl>
                {level.activationProbability !== null && <div><dt>Chance</dt><dd>{Math.round(level.activationProbability * 100)}%</dd></div>}
                {level.cooldownSeconds !== null && <div><dt>Interval</dt><dd>{level.cooldownSeconds}s</dd></div>}
                {level.durationSeconds !== null && <div><dt>Duration</dt><dd>{level.durationSeconds}s</dd></div>}
              </dl>
            </article>
          ))}
        </div>
      </section>

      {related.length > 0 && (
        <section className="record-section">
          <p className="db-eyebrow">Same primary effect</p>
          <h2>Other cards with this {record.category} effect</h2>
          <div className="group-target-list">
            {related.slice(0, 12).map((item) => (
              <Link className="simple-record" href={`/skills/${item.slug}`} key={item.slug}>
                <Image src={item.card.artPath} alt="" width={72} height={72} />
                <div><span>{item.card.rarity}★ · {item.card.attribute}</span><h3>{item.card.talentName}</h3><p>{item.card.title}</p></div>
                <ArrowRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
