import {
  nativeRankingData,
  nativeRankingEntryByLensAndCard,
  nativeLeaderOutfitRankingEntryByLensAndCard,
  publicCards,
  publicData,
} from "@yagoo-dori/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart3 } from "lucide-react";

import { TierListExplorer, type TierCard } from "@/components/tier-list-explorer";

export const metadata: Metadata = {
  title: "hololive Dreams tier list",
  description: "Compare every current hololive Dreams Member card and Leader Outfit across three model-evaluated investment lenses.",
};

function rankingsFor(
  cardId: string,
  source: typeof nativeRankingEntryByLensAndCard,
): TierCard["rankings"] {
  const lowInvestment = source.get("low-investment")?.get(cardId);
  const standard = source.get("one-copy-maximum")?.get(cardId);
  const ceiling = source.get("duplicate-enabled-ceiling")?.get(cardId);
  if (!lowInvestment || !standard || !ceiling) {
    throw new Error(`Native ranking snapshot is missing ${cardId}`);
  }
  return {
    "low-investment": { tier: lowInvestment.tier, rank: lowInvestment.rank },
    "one-copy-maximum": { tier: standard.tier, rank: standard.rank },
    "duplicate-enabled-ceiling": { tier: ceiling.tier, rank: ceiling.rank },
  };
}

const memberCards: TierCard[] = publicCards.map((card) => ({
  id: card.id,
  slug: card.slug,
  talentName: card.talentName,
  title: card.title,
  rarity: card.rarity,
  attribute: card.attribute,
  generation: card.generation,
  groups: card.groups,
  artPath: card.artPath,
  rankings: rankingsFor(card.id, nativeRankingEntryByLensAndCard),
}));

const leaderOutfits: TierCard[] = publicCards.map((card) => ({
  id: card.id,
  slug: card.slug,
  talentName: card.talentName,
  title: card.leaderOutfit.costumeName,
  rarity: card.rarity,
  attribute: card.attribute,
  generation: card.generation,
  groups: card.groups,
  artPath: card.artPath,
  rankings: rankingsFor(card.id, nativeLeaderOutfitRankingEntryByLensAndCard),
}));

export default function TierListPage() {
  const generations = [...new Set(publicCards.flatMap((card) => card.groups))].sort();

  return (
    <div className="database-page tier-list-page">
      <header className="database-heading">
        <div className="database-heading-icon"><BarChart3 aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Tier list</p>
          <h1>hololive Dreams tier list</h1>
          <p>
            Compare every current 4★ and 5★ card as a Member or as its Leader Outfit. Switch
            context and investment lens, then filter the full roster.
          </p>
        </div>
        <dl className="database-summary">
          <div><dt>Roster</dt><dd>{publicData.counts.total}</dd></div>
          <div><dt>Contexts</dt><dd>2</dd></div>
          <div><dt>Lenses</dt><dd>{nativeRankingData.lenses.length}</dd></div>
        </dl>
      </header>

      <Suspense fallback={<div className="db-loading">Loading tier matrix…</div>}>
        <TierListExplorer
          generations={generations}
          leaderOutfits={leaderOutfits}
          memberCards={memberCards}
        />
      </Suspense>
    </div>
  );
}
