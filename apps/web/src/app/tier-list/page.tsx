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
import { isCardRecentlyAdded, trackingBaseline } from "@/lib/card-freshness";

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
  const placement = (entry: typeof lowInvestment) => ({
    tier: entry.tier,
    rank: entry.rank,
    index: {
      lower: entry.index.lower,
      central: entry.index.central,
      upper: entry.index.upper,
    },
    provisional: entry.stableTier === "Provisional",
    matchedContexts: entry.evaluation.matchedContexts,
  });
  return {
    "low-investment": placement(lowInvestment),
    "one-copy-maximum": placement(standard),
    "duplicate-enabled-ceiling": placement(ceiling),
  };
}

function plainText(value: string | null): string {
  return value?.replace(/\[\/?[^\]]+\]/g, "") ?? "No effect.";
}

function mechanicsFor(card: (typeof publicCards)[number]): TierCard["mechanics"] {
  const latest = <T,>(rows: readonly T[]): T => {
    const row = rows.at(-1);
    if (!row) throw new Error(`Card ${card.id} is missing a skill progression row`);
    return row;
  };
  return {
    performance: card.parameters.oneCopyMaxLevel.performance,
    technique: card.parameters.oneCopyMaxLevel.technique,
    sense: card.parameters.oneCopyMaxLevel.sense,
    active: plainText(latest(card.skills.active).description),
    passive: plainText(latest(card.skills.passive).description),
    special: plainText(latest(card.skills.special).description),
    leader: plainText(card.leaderOutfit.description),
  };
}

const firstSeenBaseline = trackingBaseline(publicCards.map((card) => card.firstSeenAt));

const memberCards: TierCard[] = publicCards.map((card) => ({
  id: card.id,
  slug: card.slug,
  talentName: card.talentName,
  title: card.title,
  isNew: isCardRecentlyAdded(card.firstSeenAt, publicData.retrievedAt, firstSeenBaseline),
  rarity: card.rarity,
  attribute: card.attribute,
  generation: card.generation,
  groups: card.groups,
  artPath: card.artPath,
  mechanics: mechanicsFor(card),
  rankings: rankingsFor(card.id, nativeRankingEntryByLensAndCard),
}));

const leaderOutfits: TierCard[] = publicCards.map((card) => ({
  id: card.id,
  slug: card.slug,
  talentName: card.talentName,
  title: card.leaderOutfit.costumeName,
  isNew: isCardRecentlyAdded(card.firstSeenAt, publicData.retrievedAt, firstSeenBaseline),
  rarity: card.rarity,
  attribute: card.attribute,
  generation: card.generation,
  groups: card.groups,
  artPath: card.artPath,
  mechanics: mechanicsFor(card),
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
          <p className="db-heading-note">
            Model tiers, published as provisional theorycraft against a frozen launch benchmark —
            a relative comparison index, not an in-game Live Score rating.
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
