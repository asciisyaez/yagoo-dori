import { publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, DatabaseZap, GitCommitHorizontal, ImageIcon, Tags } from "lucide-react";

const snapshotId = publicData.retrievedAt;

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ snapshot: snapshotId }];
}

export async function generateMetadata({ params }: { params: Promise<{ snapshot: string }> }): Promise<Metadata> {
  return { title: (await params).snapshot === snapshotId ? `${snapshotId} data snapshot` : "Snapshot not found" };
}

export default async function ChangelogPage({ params }: { params: Promise<{ snapshot: string }> }) {
  if ((await params).snapshot !== snapshotId) notFound();

  return (
    <div className="database-page">
      <header className="database-heading">
        <div className="database-heading-icon"><DatabaseZap aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Changelog / Data snapshot</p>
          <h1>{snapshotId} roster import</h1>
          <p>
            The current public-data snapshot adds the complete 4★ and 5★ roster, local card art,
            skill levels, max-level parameters, and linked Leader Outfits.
          </p>
        </div>
        <dl className="database-summary">
          <div><dt>Total</dt><dd>{publicData.counts.total}</dd></div>
          <div><dt>5★</dt><dd>{publicData.counts.fiveStar}</dd></div>
          <div><dt>4★</dt><dd>{publicData.counts.fourStar}</dd></div>
        </dl>
      </header>

      <section className="snapshot-header" aria-label="Snapshot versions">
        <div><GitCommitHorizontal aria-hidden="true" /><span>English data</span><strong>{publicData.sourceSnapshots.english.commit.slice(0, 12)}</strong></div>
        <div><GitCommitHorizontal aria-hidden="true" /><span>Japanese data</span><strong>{publicData.sourceSnapshots.japanese.commit.slice(0, 12)}</strong></div>
        <div><Tags aria-hidden="true" /><span>Schema</span><strong>v{publicData.schemaVersion}</strong></div>
      </section>

      <section className="change-table">
        <header><span>Area</span><span>Included</span><span>What changed</span></header>
        <div><strong>Member cards</strong><span>{publicData.counts.total} records</span><p>All current 54 four-star and 59 five-star cards normalized into one searchable catalog.</p></div>
        <div><strong>Skills and stats</strong><span>All cards</span><p>One-copy max-level and max-potential parameters plus every Active, Passive, and Special level.</p></div>
        <div><strong>Leader Outfits</strong><span>Linked</span><p>Each card record includes its Outfit and normalized Leader Skill description.</p></div>
        <div><strong>Artwork</strong><span><ImageIcon aria-hidden="true" /> {publicData.counts.art * 2} files</span><p>Local icon and full-illustration files are mapped through the verified asset manifest.</p></div>
        <div><strong>Tier reference</strong><span>5★ only</span><p>AppMedia’s current SS, S, and A score categories are displayed with attribution; no Yagoo-dori score is claimed.</p></div>
      </section>

      <div className="guide-next-actions">
        <Link className="button-primary" href="/cards">Browse imported cards <ArrowRight aria-hidden="true" /></Link>
        <Link className="button-secondary" href="/sources">View source snapshots</Link>
      </div>
    </div>
  );
}
