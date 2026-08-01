import { publicCards, publicData } from "@yagoo-dori/core";
import { Calculator } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import {
  TeamCalculator,
  type TeamBuilderCard,
} from "@/components/team-calculator";

import styles from "./team-builder.module.css";

export const metadata: Metadata = {
  title: "Team calculator",
  description:
    "Choose the hololive Dreams cards you own, set each Bloom level, and build a legal team.",
};

const cards: TeamBuilderCard[] = [...publicCards]
  .sort(
    (left, right) =>
      left.talentName.localeCompare(right.talentName) ||
      right.rarity - left.rarity ||
      left.title.localeCompare(right.title),
  )
  .map((card) => ({
    id: card.id,
    slug: card.slug,
    talentId: card.talentId,
    talentName: card.talentName,
    title: card.title,
    rarity: card.rarity,
    attribute: card.attribute,
    generation: card.generation,
    artPath: card.artPath,
    color: card.color,
    outfitName: card.leaderOutfit.costumeName,
  }));

export default function TeamBuilderPage() {
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div className={styles.headingIcon}><Calculator aria-hidden="true" /></div>
        <div>
          <p>Tools / Team calculator</p>
          <h1>Build from the cards you own</h1>
          <span>
            Choose your exact cards and Bloom levels, then calculate a legal Leader and
            five-Member formation for general play.
          </span>
        </div>
        <dl className={styles.headingStats}>
          <div><dt>Cards</dt><dd>{publicData.counts.total}</dd></div>
          <div><dt>Talents</dt><dd>{publicData.counts.talents}</dd></div>
        </dl>
      </header>

      <Suspense fallback={<div className={styles.loading}>Loading the team calculator…</div>}>
        <TeamCalculator
          cards={cards}
          rosterCommit={publicData.sourceSnapshots.english.commit}
        />
      </Suspense>
    </div>
  );
}
