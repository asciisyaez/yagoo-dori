import { nativeRankingData, publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BarChart3, DatabaseZap, ImageIcon, Layers3, Tags } from "lucide-react";

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
          <h1>First Yagoo-dori tier snapshot</h1>
          <p>
            Every current 4★ and 5★ card now has separate Member and Leader Outfit bands across
            Standard Manual, Low Investment, and Max Ceiling.
          </p>
        </div>
        <dl className="database-summary">
          <div><dt>Evaluations</dt><dd>{publicData.counts.total * 2}</dd></div>
          <div><dt>Lenses</dt><dd>{nativeRankingData.lenses.length}</dd></div>
          <div><dt>Cards</dt><dd>{publicData.counts.total}</dd></div>
        </dl>
      </header>

      <section className="snapshot-header" aria-label="Snapshot overview">
        <div><Layers3 aria-hidden="true" /><span>Roster</span><strong>{publicData.counts.total} cards</strong></div>
        <div><BarChart3 aria-hidden="true" /><span>Ranking contexts</span><strong>Members + Outfits</strong></div>
        <div><Tags aria-hidden="true" /><span>Tier scale</span><strong>SS through D</strong></div>
      </section>

      <section className="change-table">
        <header><span>Area</span><span>Included</span><span>What changed</span></header>
        <div><strong>Member tiers</strong><span>{publicData.counts.total} cards</span><p>All current 4★ and 5★ Members are grouped into six fixed decision tiers.</p></div>
        <div><strong>Leader Outfit tiers</strong><span>{publicData.counts.total} Outfits</span><p>Leader effects are compared in their own matched five-Member contexts instead of being mixed with Member kits.</p></div>
        <div><strong>Investment lenses</strong><span>3 views</span><p>Standard Manual, Low Investment, and Max Ceiling can be compared without leaving the tier matrix.</p></div>
        <div><strong>Team mechanics</strong><span>Full card kits</span><p>Performance, Technique, Sense, typing, Leader, Active, Passive, and Special skills, song context, and legal team rules contribute to placement.</p></div>
        <div><strong>Artwork</strong><span><ImageIcon aria-hidden="true" /> {publicData.counts.art * 2} files</span><p>Card icons and full illustrations are served locally throughout the database and tier list.</p></div>
      </section>

      <div className="guide-next-actions">
        <Link className="button-primary" href="/tier-list">Open tier list <ArrowRight aria-hidden="true" /></Link>
        <Link className="button-secondary" href="/cards">Browse cards and Outfits</Link>
      </div>
    </div>
  );
}
