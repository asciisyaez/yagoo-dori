import { publicCards, publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Crown } from "lucide-react";

import { LeaderDirectory, type LeaderDirectoryRecord } from "./leader-directory";

export const metadata: Metadata = {
  title: "Leader Outfit database",
  description: "Browse every current Leader Outfit and the Member card that unlocks it.",
};

const leaders: LeaderDirectoryRecord[] = [...publicCards]
  .sort((left, right) => right.rarity - left.rarity || left.talentName.localeCompare(right.talentName))
  .map((card) => ({
    id: card.leaderOutfit.costumeId,
    slug: card.slug,
    talentName: card.talentName,
    cardTitle: card.title,
    costumeName: card.leaderOutfit.costumeName,
    description: card.leaderOutfit.description?.replace(/\[\/?[^\]]+\]/g, "") ?? "Leader effect description unavailable.",
    rarity: card.rarity,
    attribute: card.attribute,
    groups: card.groups,
    illustrationPath: card.illustrationPath,
  }));

export default function LeadersPage() {
  const groups = [...new Set(publicCards.flatMap((card) => card.groups))].sort();

  return (
    <div className="database-page">
      <header className="database-heading">
        <div className="database-heading-icon"><Crown aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Database / Leader Outfits</p>
          <h1>Leader Outfit database</h1>
          <p>Every reward Outfit and its real Leader effect, linked to the Member card that unlocks it.</p>
        </div>
        <dl className="database-summary">
          <div><dt>Outfits</dt><dd>{leaders.length}</dd></div>
          <div><dt>5★ unlocks</dt><dd>{publicData.counts.fiveStar}</dd></div>
          <div><dt>4★ unlocks</dt><dd>{publicData.counts.fourStar}</dd></div>
        </dl>
      </header>

      <Suspense fallback={<div className="db-loading">Loading Leader Outfit database…</div>}>
        <LeaderDirectory groups={groups} leaders={leaders} />
      </Suspense>
    </div>
  );
}
