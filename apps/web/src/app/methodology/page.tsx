import { publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Database, ExternalLink, Sigma } from "lucide-react";

export const metadata: Metadata = {
  title: "Tier-list methodology",
  description: "How Yagoo-dori labels source-attributed editorial tiers and develops its own game model.",
};

export default function MethodologyPage() {
  return (
    <div className="database-page">
      <header className="database-heading">
        <div className="database-heading-icon"><Sigma aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Reference / Methodology</p>
          <h1>Know which ranking you are looking at.</h1>
          <p>
            The current score-tier view is AppMedia’s editorial 5★ placement, reproduced with
            attribution. Yagoo-dori does not currently publish a calculated score or tier.
          </p>
        </div>
        <dl className="database-summary">
          <div><dt>Editorial 5★</dt><dd>{publicData.counts.fiveStar}</dd></div>
          <div><dt>Unranked 4★</dt><dd>{publicData.counts.fourStar}</dd></div>
          <div><dt>YD score</dt><dd>—</dd></div>
        </dl>
      </header>

      <section className="content-grid methodology-summary">
        <article className="content-panel">
          <BarChart3 aria-hidden="true" />
          <p className="db-eyebrow">Displayed now</p>
          <h2>Source-attributed editorial tiers</h2>
          <p>
            SS, S, and A are preserved as the publisher-independent source presents them. Filters
            change what is visible; they do not recalculate placement.
          </p>
          <a className="text-link" href={publicData.sourceSnapshots.editorialTier.page} target="_blank" rel="noreferrer">
            Open the AppMedia tier page <ExternalLink aria-hidden="true" />
          </a>
        </article>
        <article className="content-panel">
          <Database aria-hidden="true" />
          <p className="db-eyebrow">Displayed alongside it</p>
          <h2>Complete roster, without invented ranks</h2>
          <p>
            The all-card tab includes every current 4★ and 5★ record from the pinned dataset.
            Because the cited tier source only covers 5★ score performance, 4★ cards are browsable
            but not assigned an unsupported tier.
          </p>
          <Link className="text-link" href="/cards">Browse the card database <ArrowRight aria-hidden="true" /></Link>
        </article>
      </section>

      <section className="record-section methodology-roadmap">
        <p className="db-eyebrow">Yagoo-dori calculation</p>
        <h2>What must be modeled before a native tier goes live</h2>
        <ol className="methodology-checklist">
          <li><span>01</span><div><strong>Legal team structure</strong><p>One Leader Outfit, five Member cards, and one card per Holomem.</p></div></li>
          <li><span>02</span><div><strong>Exact card mechanics</strong><p>Performance, Technique, Sense, Active, Passive, Special, targets, conditions, and progression.</p></div></li>
          <li><span>03</span><div><strong>Formation and timing</strong><p>Left-to-right order, trigger chances, cooldowns, durations, and overlapping effects.</p></div></li>
          <li><span>04</span><div><strong>Observed validation</strong><p>Calculated results must be tested against reproducible Live evidence before publication.</p></div></li>
        </ol>
      </section>

      <div className="guide-next-actions">
        <Link className="button-primary" href="/tier-list">Open tier list <ArrowRight aria-hidden="true" /></Link>
        <Link className="button-secondary" href="/sources">Review sources</Link>
      </div>
    </div>
  );
}
