import {
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
    "Compare your saved team with one unowned hololive Dreams Member card using the standard search effort.",
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
            Compare your saved roster with one unowned card using the same model as the team calculator, at standard search effort.
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
