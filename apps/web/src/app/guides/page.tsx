import { nativeGuideData, publicCardById } from "@yagoo-dori/core";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
          <h1>Teams for rating songs.</h1>
          <p>
            Exact cards, a singer-matched Leader Outfit, five unique Members, Expert chart
            comparisons, and practical replacements in one build sheet.
          </p>
        </div>
        <dl className="database-summary">
          <div><dt>Guides</dt><dd>{nativeGuideData.guides.length}</dd></div>
          <div><dt>Builds</dt><dd>{formations}</dd></div>
          <div><dt>Songs</dt><dd>{songs}</dd></div>
        </dl>
      </header>

      <section className={styles.guideLibrary} aria-labelledby="guide-library-heading">
        <div className={styles.sectionHeading}>
          <div>
            <p className="db-eyebrow">Current builds</p>
            <h2 id="guide-library-heading">Choose an exact 5★ anchor</h2>
          </div>
          <p>Every recommendation keeps one Member card per Holomem.</p>
        </div>

        <div className={styles.guideGrid}>
          {nativeGuideData.guides.map((guide) => {
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
                    priority
                    sizes="(max-width: 800px) 100vw, 42vw"
                    src={anchor.illustrationPath}
                  />
                  <span>{anchor.rarity}★ anchor</span>
                </Link>

                <div className={styles.guideCardBody}>
                  <p className="db-eyebrow">{anchor.attribute} · {anchor.generation}</p>
                  <h2>{guide.title}</h2>
                  <p className={styles.anchorTitle}>{anchor.title}</p>

                  <dl className={styles.buildFacts}>
                    <div>
                      <dt>Leader Outfit</dt>
                      <dd>{leader.talentName} · {leader.leaderOutfit.costumeName}</dd>
                    </div>
                    <div>
                      <dt><Music2 aria-hidden="true" /> Rating song</dt>
                      <dd>{standard.context.songTitle}</dd>
                    </div>
                    <div>
                      <dt><Clock3 aria-hidden="true" /> Chart length</dt>
                      <dd>{formatDuration(standard.context.durationMilliseconds)} · {standard.context.noteCount.toLocaleString()} notes</dd>
                    </div>
                  </dl>

                  <p className={styles.anchorTitle}>{standard.progressionLens.label}</p>

                  <div className={styles.lineupPreview} aria-label="Standard Member lineup">
                    {members.map((member, index) => (
                      <span key={member.id} title={`${index + 1}. ${member.talentName}`}>
                        <Image alt="" height={52} src={member.artPath} width={52} />
                        <b>{index + 1}</b>
                      </span>
                    ))}
                  </div>

                  <Link className={styles.openGuide} href={`/guides/${guide.slug}`}>
                    Open team guide <ArrowRight aria-hidden="true" />
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
