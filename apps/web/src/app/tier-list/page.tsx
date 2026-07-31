import { publicCards, publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart3, ExternalLink } from "lucide-react";

import { TierListExplorer, type TierCard } from "@/components/tier-list-explorer";

export const metadata: Metadata = {
  title: "hololive Dreams Member-card tier list",
  description: "Browse the complete hololive Dreams 4-star and 5-star card roster and a current source-attributed 5-star score tier snapshot.",
};

const tierCards: TierCard[] = publicCards.map((card) => ({
  id: card.id,
  slug: card.slug,
  talentName: card.talentName,
  title: card.title,
  rarity: card.rarity,
  attribute: card.attribute,
  generation: card.generation,
  groups: card.groups,
  artPath: card.artPath,
  editorialTier: card.editorialTier,
}));

export default function TierListPage() {
  const generations = [...new Set(publicCards.flatMap((card) => card.groups))].sort();

  return (
    <div className="database-page tier-list-page">
      <header className="database-heading">
        <div className="database-heading-icon"><BarChart3 aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Tier Lists / Member cards</p>
          <h1>hololive Dreams tier list</h1>
          <p>
            Scan every current 5★ score placement, or switch to the complete 113-card 4★ + 5★ roster.
            Filters stay in the URL so the exact view is shareable.
          </p>
        </div>
        <dl className="database-summary">
          <div><dt>5★ cards</dt><dd>{publicData.counts.fiveStar}</dd></div>
          <div><dt>4★ cards</dt><dd>{publicData.counts.fourStar}</dd></div>
          <div><dt>Talents</dt><dd>{publicData.counts.talents}</dd></div>
        </dl>
      </header>

      <Suspense fallback={<div className="db-loading">Loading card matrix…</div>}>
        <TierListExplorer cards={tierCards} generations={generations} />
      </Suspense>

      <details className="tier-source-note">
        <summary>About this tier snapshot</summary>
        <div>
          <p>
            The score-tier tab reproduces AppMedia’s current 5★ score-performance categories,
            including the five summer cards. It is an attributed editorial reference, not a
            Yagoo-dori calculation. The roster tab contains every 4★ and 5★ record from the pinned
            public database snapshot without inventing 4★ placements.
          </p>
          <a href={publicData.sourceSnapshots.editorialTier.page} target="_blank" rel="noreferrer">
            Open AppMedia source <ExternalLink aria-hidden="true" />
          </a>
        </div>
      </details>
    </div>
  );
}
