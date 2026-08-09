import { nativeGuideData, publicCardById } from "@yagoo-dori/core";
import type { Metadata } from "next";
import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import { ArrowRight, BookOpenCheck, Clock3, Music2 } from "lucide-react";

import styles from "./guides.module.css";

export const metadata: Metadata = {
  title: "Team guides",
  description:
    "hololive Dreams teams with exact cards, singer-matched Leader Outfits, legal lineups, rating-song comparisons, and practical replacements.",
};

function formatDuration(milliseconds: number) {
  const seconds = Math.round(milliseconds / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function requireCard(cardId: string) {
  const card = publicCardById.get(cardId);
  if (!card) throw new Error(`Guide references missing card ${cardId}`);
  return card;
}

export default function GuidesPage() {
  const formations = nativeGuideData.guides.reduce(
    (total, guide) => total + guide.formations.length,
    0,
  );
  const songs = new Set(
    nativeGuideData.guides.flatMap((guide) =>
      guide.ratingSongComparisons.map((song) => song.songId),
    ),
  ).size;

  return (
    <div className="database-page">
      <header className="database-heading">
        <div className="database-heading-icon"><BookOpenCheck aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Team guides</p>
          <h1>Build teams for each holomem&rsquo;s own songs.</h1>
          <p>
            Choose a 5★ Member to see the recommended Leader Outfit, five-card lineups,
            practical replacements, and alternatives across the Expert charts that holomem
            sings. The in-game Holomem Score Rating itself totals the top 3 song scores
            played as Leader from all rating-eligible songs, at the highest difficulty
            score — a wider pool than any single guide covers.
          </p>
        </div>
        <dl className="database-summary">
          <div><dt>Guides</dt><dd>{nativeGuideData.guides.length}</dd></div>
          <div><dt>Formations</dt><dd>{formations}</dd></div>
          <div><dt>Unique songs</dt><dd>{songs}</dd></div>
        </dl>
      </header>

      <section className={styles.guideLibrary} aria-labelledby="guide-library-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className="db-eyebrow">Build library</p>
            <h2 id="guide-library-heading">Build around a 5★ Member</h2>
          </div>
          <p>Every lineup uses five different Holomems.</p>
        </div>

        <div className={styles.guideGrid}>
          {nativeGuideData.guides.map((guide, guideIndex) => {
            const anchor = requireCard(guide.anchorCardId);
            const standard = guide.formations.find((formation) => formation.kind === "standard");
            if (!standard) throw new Error(`Guide ${guide.id} has no standard formation`);
            const leader = requireCard(standard.leaderOutfitCardId);
            const members = standard.formationOrder.map(requireCard);

            return (
              <article className={styles.guideCard} key={guide.id}>
                <Link className={styles.guideArtwork} href={`/guides/${guide.slug}`}>
                  <Image
                    alt={`${anchor.title} ${anchor.talentName} card illustration`}
                    fill
                    preview
                    priority={guideIndex === 0}
                    sizes="(max-width: 800px) 100vw, 42vw"
                    src={anchor.illustrationPath}
                  />
                  <span>{anchor.rarity}★ Member</span>
                </Link>

                <div className={styles.guideCardBody}>
                  <p className="db-eyebrow">{anchor.attribute} · {anchor.generation}</p>
                  <h2>{anchor.talentName}</h2>
                  <p className={styles.anchorTitle}>{anchor.title}</p>

                  <dl className={styles.buildFacts}>
                    <div>
                      <dt>Recommended Leader</dt>
                      <dd>
                        {leader.talentName} · {leader.leaderOutfit.costumeName}
                        <small className={styles.leaderCardSource}>{leader.rarity}★ card · {leader.title}</small>
                      </dd>
                    </div>
                    <div>
                      <dt><Music2 aria-hidden="true" /> Reference song</dt>
                      <dd>{standard.context.songTitle}</dd>
                    </div>
                    <div>
                      <dt><Clock3 aria-hidden="true" /> Chart</dt>
                      <dd>{formatDuration(standard.context.durationMilliseconds)} · {standard.context.noteCount.toLocaleString()} notes</dd>
                    </div>
                  </dl>

                  <p className={styles.investmentLabel}>
                    <strong>Standard investment</strong>
                    <span>{standard.progressionLens.label}</span>
                  </p>

                  <ol
                    className={styles.lineupPreview}
                    aria-label={`${anchor.talentName} standard Member lineup`}
                  >
                    {members.map((member, index) => (
                      <li key={member.id}>
                        <Image alt="" height={52} src={member.artPath} width={52} />
                        <b aria-hidden="true">{index + 1}</b>
                        <span className="sr-only">
                          {index + 1}. {member.talentName}, {member.title}, {member.rarity} star {member.attribute}
                        </span>
                      </li>
                    ))}
                  </ol>

                  <Link
                    aria-label={`Open ${anchor.talentName} ${anchor.title} team guide`}
                    className={styles.openGuide}
                    href={`/guides/${guide.slug}`}
                  >
                    View team guide <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
