import { nativeRankingData, publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Layers3, Sigma } from "lucide-react";

export const metadata: Metadata = {
  title: "Tier-list methodology",
  description: "How Yagoo-dori evaluates hololive Dreams cards in legal teams across three investment lenses.",
};

const metrics = [
  { symbol: "G", name: "General value", weight: "55%", detail: "Mean substitution value against every legal alternative in the same frozen context." },
  { symbol: "P", name: "Synergy ceiling", weight: "25%", detail: "Mean of the strongest 10% of matched results—not a single best-case team." },
  { symbol: "B", name: "Team breadth", weight: "10%", detail: "Share of contexts where the result stays within 5% of the best legal alternative." },
  { symbol: "E", name: "Investment efficiency", weight: "10%", detail: "Area under the value curve from entry level through duplicate-enabled ceiling." },
] as const;

export default function MethodologyPage() {
  return (
    <div className="database-page">
      <header className="database-heading">
        <div className="database-heading-icon"><Sigma aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Tier list / Methodology</p>
          <h1>Cards are measured inside teams.</h1>
          <p>
            Each band comes from deterministic matched substitutions across legal teams, current
            card mechanics, song contexts, and investment. Members and Leader Outfits are measured
            separately. This is relative team utility—not an absolute Live Score forecast.
          </p>
        </div>
        <dl className="database-summary">
          <div><dt>Roster</dt><dd>{publicData.counts.total}</dd></div>
          <div><dt>Contexts</dt><dd>600</dd></div>
          <div><dt>Lenses</dt><dd>{nativeRankingData.lenses.length}</dd></div>
        </dl>
      </header>

      <section className="content-grid methodology-summary">
        <article className="content-panel">
          <BarChart3 aria-hidden="true" />
          <p className="db-eyebrow">Three progression lenses</p>
          <h2>Compare investment on the same field</h2>
          <p>
            Standard Manual uses one copy at the highest non-duplicate progression. Low Investment
            starts from the entry state. Max Ceiling enables duplicate-only boosts. The public
            benchmark holds Board and collection effects neutral so every card faces the same test.
          </p>
          <Link className="text-link" href="/tier-list">Open the tier matrix <ArrowRight aria-hidden="true" /></Link>
        </article>
        <article className="content-panel">
          <Layers3 aria-hidden="true" />
          <p className="db-eyebrow">Formation value</p>
          <h2>Members and Outfits stay connected</h2>
          <p>
            Every comparison uses one Leader Outfit plus five unique Member talents. Type,
            generation, parameters, skill conditions, target limits, cooldown, duration, song,
            and progression remain attached to the legal formation.
          </p>
          <Link className="text-link" href="/cards">Compare cards and Outfits <ArrowRight aria-hidden="true" /></Link>
        </article>
      </section>

      <section className="record-section methodology-roadmap">
        <p className="db-eyebrow">Fixed comparison setup</p>
        <h2>Every card faces the same test</h2>
        <ol className="methodology-checklist">
          <li><span>01</span><div><strong>Legal teams</strong><p>One Leader Outfit, five Member cards, and no duplicate Holomem.</p></div></li>
          <li><span>02</span><div><strong>Complete card kit</strong><p>Performance, Technique, Sense, attribute, Active, Passive, Special, Leader effect, triggers, and recipients.</p></div></li>
          <li><span>03</span><div><strong>Thirty charts</strong><p>Twenty-one frozen reference charts plus the nine newest current charts, balanced across 600 matched contexts.</p></div></li>
          <li><span>04</span><div><strong>Fixed execution</strong><p>Manual All Perfect, full Life, no event bonus, and a declared-neutral Board and collection state.</p></div></li>
        </ol>
      </section>

      <section className="record-section">
        <p className="db-eyebrow">Yagoo-dori card rubric</p>
        <h2>Four measures produce one card index</h2>
        <p>
          Each candidate replaces the same slot or Leader in an otherwise identical legal context
          and is compared with every eligible frozen-roster alternative. Results are robustly scaled
          against a frozen launch baseline, so a new outlier cannot rescale the existing roster.
        </p>
        <div className="methodology-metrics">
          {metrics.map((metric) => (
            <article key={metric.symbol}>
              <span>{metric.symbol}</span>
              <div><strong>{metric.name}</strong><p>{metric.detail}</p></div>
              <em>{metric.weight}</em>
            </article>
          ))}
        </div>
        <p className="methodology-formula" aria-label="Composite weighting">
          <strong>Composite:</strong> 55% G + 25% P + 10% B + 10% E
        </p>
      </section>

      <aside className="methodology-beta-note">
        <span>Fixed tier scale</span>
        <p>
          Member cutoffs are frozen from the launch index distribution: 5★ cards span SS through B,
          while the launch gap between rarities separates B from C and 4★ cards span C through D.
          Future cards use these same cutoffs, so adding a card does not move the existing roster.
        </p>
      </aside>

      <div className="guide-next-actions">
        <Link className="button-primary" href="/tier-list">Open tier list <ArrowRight aria-hidden="true" /></Link>
        <Link className="button-secondary" href="/cards">Browse cards and Outfits</Link>
      </div>
    </div>
  );
}
