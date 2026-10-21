import { comparePublicMemberCards, publicCards, publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import { Suspense } from "react";

import {
  TeamCalculator,
  type TeamBuilderCard,
} from "@/components/team-calculator";

import { TeamBuilderHeader } from "./team-builder-header";
import styles from "./team-builder.module.css";

export const metadata: Metadata = {
  title: "Team calculator",
  description:
    "Choose the hololive Dreams cards you own, set each Bloom level, and build a legal team.",
};

const cards: TeamBuilderCard[] = [...publicCards]
  .sort(comparePublicMemberCards)
  .map((card) => ({
    id: card.id,
    slug: card.slug,
    talentId: card.talentId,
    generationOrder: card.generationOrder,
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
      <TeamBuilderHeader
        totalCards={publicData.counts.total}
        totalTalents={publicData.counts.talents}
      />

      <Suspense fallback={<div className={styles.loading}>Loading the team calculator…</div>}>
        <TeamCalculator
          cards={cards}
          rosterCommit={publicData.sourceSnapshots.english.commit}
        />
      </Suspense>
    </div>
  );
}
