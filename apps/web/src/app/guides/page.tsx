import { publicCards, publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, ListChecks, UsersRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Team guides",
  description: "Team-building guides based on the current hololive Dreams roster and legal five-Member formations.",
};

const referenceAnchors = publicCards
  .filter((card) => card.rarity === 5 && card.editorialTier === "SS")
  .sort((left, right) => left.talentName.localeCompare(right.talentName));

export default function GuidesPage() {
  return (
    <div className="database-page">
      <header className="database-heading">
        <div className="database-heading-icon"><BookOpenCheck aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Guides / Team building</p>
          <h1>Build around the card you own.</h1>
          <p>
            Team guides are being rebuilt against the real {publicData.counts.total}-card roster.
            Each published guide will name the exact 5★ anchor, Leader Outfit, five Member slots,
            formation order, and practical 4★ replacements.
          </p>
        </div>
        <dl className="database-summary">
          <div><dt>Members</dt><dd>5</dd></div>
          <div><dt>Talents</dt><dd>{publicData.counts.talents}</dd></div>
          <div><dt>Cards</dt><dd>{publicData.counts.total}</dd></div>
        </dl>
      </header>

      <section className="content-grid" aria-label="Guide requirements">
        <article className="content-panel">
          <ListChecks aria-hidden="true" />
          <p className="db-eyebrow">Exact inputs</p>
          <h2>Card and Outfit, not just a talent name</h2>
          <p>A guide starts from one specific Member card and one specific Leader Outfit so its conditions and targets are auditable.</p>
        </article>
        <article className="content-panel">
          <UsersRound aria-hidden="true" />
          <p className="db-eyebrow">Legal formation</p>
          <h2>Five unique Holomems</h2>
          <p>Premium and accessible variants keep one Member card per Holomem and preserve meaningful skill targets.</p>
        </article>
      </section>

      <section className="record-section">
        <p className="db-eyebrow">5★ score-tier reference</p>
        <h2>Current SS cards to inspect</h2>
        <p>
          These are the ten cards in AppMedia’s current SS score category. This is a source-attributed
          starting list, not a Yagoo-dori team recommendation.
        </p>
        <div className="guide-anchor-grid">
          {referenceAnchors.map((card) => (
            <Link className="simple-record" href={`/cards/${card.slug}`} key={card.id}>
              <Image src={card.artPath} alt="" width={96} height={96} sizes="72px" />
              <div>
                <span>5★ · {card.attribute} · AppMedia SS</span>
                <h3>{card.talentName}</h3>
                <p>{card.title}</p>
              </div>
              <ArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <div className="guide-next-actions">
        <Link className="button-primary" href="/cards">Browse all Member cards <ArrowRight aria-hidden="true" /></Link>
        <Link className="button-secondary" href="/tier-list">Open the tier list</Link>
      </div>
    </div>
  );
}
