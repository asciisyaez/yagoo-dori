import { publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Mic2 } from "lucide-react";

import { talentRecords } from "./talent-records";

export const metadata: Metadata = {
  title: "Holomem talent database",
  description: `Browse all ${publicData.counts.talents} playable holomem and their current 4-star and 5-star Member cards.`,
};

export default function TalentsPage() {
  const branchCount = new Set(talentRecords.map((talent) => talent.branch)).size;

  return (
    <div className="database-page">
      <header className="database-heading">
        <div className="database-heading-icon"><Mic2 aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Database / Talents</p>
          <h1>Holomem directory</h1>
          <p>Choose a talent to compare every current 4★ and 5★ card and its linked Leader Outfit.</p>
        </div>
        <dl className="database-summary">
          <div><dt>Talents</dt><dd>{publicData.counts.talents}</dd></div>
          <div><dt>Cards</dt><dd>{publicData.counts.total}</dd></div>
          <div><dt>Branches</dt><dd>{branchCount}</dd></div>
        </dl>
      </header>

      <div className="talent-directory-grid">
        {talentRecords.map((talent) => (
          <Link
            className={`talent-directory-card attribute-${talent.heroCard.attribute}`}
            href={`/talents/${talent.slug}`}
            key={talent.id}
          >
            <span className="talent-directory-art">
              <Image
                alt=""
                fill
                sizes="(max-width: 640px) 48vw, (max-width: 1200px) 25vw, 190px"
                src={talent.heroCard.illustrationPath}
              />
            </span>
            <span className="talent-directory-copy">
              <small>{talent.branch} · {talent.groups.join(" + ")}</small>
              <strong>{talent.name}</strong>
              <span>{talent.cards.length} Member cards · {talent.cards.length} Leader Outfits</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
