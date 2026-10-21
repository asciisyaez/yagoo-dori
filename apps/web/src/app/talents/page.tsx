import { publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";

import { talentRecords } from "./talent-records";
import { TalentsHeader } from "./talents-header";
import { TalentDirectoryGrid } from "./talent-directory-grid";

export const metadata: Metadata = {
  title: "Holomem talent database",
  description: `Browse all ${publicData.counts.talents} playable holomem and their current 4-star and 5-star Member cards.`,
};

export default function TalentsPage() {
  const branchCount = new Set(talentRecords.map((talent) => talent.branch)).size;

  return (
    <div className="database-page">
      <TalentsHeader
        branchCount={branchCount}
        cardCount={publicData.counts.total}
        talentCount={publicData.counts.talents}
      />
      <TalentDirectoryGrid talents={talentRecords} />
    </div>
  );
}
