import {
  nativeRankingChangelogData,
  nativeRankingData,
  publicCardById,
  publicData,
} from "@yagoo-dori/core";
import type { Metadata } from "next";
import { SiteLink as Link } from "@/components/site-link";
import { notFound } from "next/navigation";
import { ArrowRight, BarChart3, DatabaseZap, Layers3, Tags } from "lucide-react";

const snapshotId = nativeRankingData.snapshotId;

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ snapshot: snapshotId }];
}

export async function generateMetadata({ params }: { params: Promise<{ snapshot: string }> }): Promise<Metadata> {
  return { title: (await params).snapshot === snapshotId ? `${nativeRankingData.dataRetrievedAt} tier snapshot` : "Snapshot not found" };
}

export default async function ChangelogPage({ params }: { params: Promise<{ snapshot: string }> }) {
  if ((await params).snapshot !== snapshotId) notFound();

  return (
    <div className="database-page">
      <header className="database-heading">
        <div className="database-heading-icon"><DatabaseZap aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Changelog / {nativeRankingData.dataRetrievedAt}</p>
          <h1>Tier calibration update</h1>
          <p>
            SS and D placements now apply their confidence requirements after each ranking
            view&apos;s tier calibration. Numerical scores and ranks are unchanged.
          </p>
        </div>
        <dl className="database-summary">
          <div><dt>Tier changes</dt><dd>{nativeRankingChangelogData.summary.tierChanged}</dd></div>
          <div><dt>Rank changes</dt><dd>{nativeRankingChangelogData.summary.rankChanged}</dd></div>
          <div><dt>Score changes</dt><dd>{nativeRankingChangelogData.summary.scoreChanged}</dd></div>
        </dl>
      </header>

      <section className="snapshot-header" aria-label="Snapshot overview">
        <div><Layers3 aria-hidden="true" /><span>Roster</span><strong>{publicData.counts.total} cards</strong></div>
        <div><BarChart3 aria-hidden="true" /><span>Index movement</span><strong>None</strong></div>
        <div><Tags aria-hidden="true" /><span>Reason</span><strong>Tier confidence correction</strong></div>
      </section>

      <section className="change-table">
        <header><span>Card</span><span>Ranking view</span><span>Change</span></header>
        {nativeRankingChangelogData.entries.map((change) => {
          const card = publicCardById.get(change.cardId);
          if (!card) return null;
          const context = change.entityKind === "member" ? "Member" : "Leader Outfit";
          const lens = change.investment === "one-copy-maximum"
            ? "Standard Manual"
            : change.investment === "low-investment"
              ? "Low Investment"
              : "Max Ceiling";
          return (
            <div key={`${change.entityKind}-${change.investment}-${change.cardId}`}>
              <strong><Link href={`/cards/${card.slug}`}>{card.talentName} · {card.title}</Link></strong>
              <span>{context} · {lens}</span>
              <p>
                Tier {change.tierDelta.from} → {change.tierDelta.to}; score and rank unchanged.
              </p>
            </div>
          );
        })}
      </section>

      <div className="guide-next-actions">
        <Link className="button-primary" href="/tier-list">Open tier list <ArrowRight aria-hidden="true" /></Link>
        <Link className="button-secondary" href="/cards">Browse cards and Outfits</Link>
      </div>
    </div>
  );
}
