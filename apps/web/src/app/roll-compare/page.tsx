import {
  currentBanner,
  nativeRankingEntryByLensAndCard,
  publicCardsInGenerationOrder,
  publicData,
} from "@yagoo-dori/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowRightLeft } from "lucide-react";

import {
  RollCompare,
  type RollCompareCard,
} from "@/components/roll-compare";

import styles from "./roll-compare.module.css";

export const metadata: Metadata = {
  title: "Roll compare",
  description:
    "Rank unowned hololive Dreams cards by how much they improve your saved team.",
};

const oneCopyRankingEntryByCard = nativeRankingEntryByLensAndCard.get("one-copy-maximum");

const cards: RollCompareCard[] = publicCardsInGenerationOrder.map((card) => ({
  id: card.id,
  slug: card.slug,
  talentId: card.talentId,
  talentName: card.talentName,
  title: card.title,
  rarity: card.rarity,
  artPath: card.artPath,
  isNew: currentBanner.featuredCardIds.includes(card.id),
  modelTier: oneCopyRankingEntryByCard?.get(card.id)?.tier ?? null,
}));

export default function RollComparePage() {
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div className={styles.headingIcon}><ArrowRightLeft aria-hidden="true" /></div>
        <div>
          <p>Tools / Roll compare</p>
          <h1>Should you roll?</h1>
          <span>
            Find which unowned cards improve your saved team, ranked by team gain, or compare a single card in detail.
          </span>
        </div>
      </header>

      <Suspense fallback={<div className={styles.loading}>Loading your saved roster…</div>}>
        <RollCompare
          cards={cards}
          rosterCommit={publicData.sourceSnapshots.english.commit}
        />
      </Suspense>
    </div>
  );
}
