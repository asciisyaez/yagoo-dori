import { publicData } from "@yagoo-dori/core";
import type { Metadata } from "next";
import { Database, ExternalLink, FileCheck2, Landmark, Newspaper } from "lucide-react";

export const metadata: Metadata = {
  title: "Data sources",
  description: "Pinned structured data, mechanics references, editorial tiers, and artwork sources used by Yagoo-dori.",
};

const shortCommit = (commit: string) => commit.slice(0, 12);

export default function SourcesPage() {
  const { sourceSnapshots } = publicData;
  const sources = [
    {
      kind: "data",
      title: "HolodoriDB English diff",
      publisher: "HolodoriDB",
      note: "English names and normalized game records.",
      snapshot: shortCommit(sourceSnapshots.english.commit),
      url: `${sourceSnapshots.english.repository}/commit/${sourceSnapshots.english.commit}`,
    },
    {
      kind: "data",
      title: "HolodoriDB Japanese diff",
      publisher: "HolodoriDB",
      note: "Japanese records used for joins and cross-checking.",
      snapshot: shortCommit(sourceSnapshots.japanese.commit),
      url: `${sourceSnapshots.japanese.repository}/commit/${sourceSnapshots.japanese.commit}`,
    },
    {
      kind: "official",
      title: "hololive Dreams — Game System",
      publisher: "QualiArts",
      note: "Official overview of Lives, Leader Outfits, and Member-card skills.",
      snapshot: "Current page",
      url: "https://www.hololive-dreams.com/en/system",
    },
    {
      kind: "editorial",
      title: sourceSnapshots.editorialTier.label,
      publisher: "AppMedia",
      note: "Displayed 5★ score-tier categories and independent mechanics reference.",
      snapshot: sourceSnapshots.editorialTier.updatedAt.slice(0, 10),
      url: sourceSnapshots.editorialTier.page,
    },
    {
      kind: "art",
      title: sourceSnapshots.art.label,
      publisher: "Game8",
      note: "Public card-icon and illustration source for the local art library.",
      snapshot: publicData.retrievedAt,
      url: sourceSnapshots.art.page,
    },
    {
      kind: "mechanics",
      title: "Formation order reference",
      publisher: "Game8",
      note: "Independent reference for team formation and Special Skill order.",
      snapshot: "Current page",
      url: "https://game8.jp/hololive-dreams/801512",
    },
  ] as const;

  return (
    <div className="database-page">
      <header className="database-heading">
        <div className="database-heading-icon"><FileCheck2 aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">Reference / Sources</p>
          <h1>Data you can trace.</h1>
          <p>
            Structured inputs are pinned to exact commits. Official pages anchor game structure;
            AppMedia and Game8 provide independent mechanics and editorial context.
          </p>
        </div>
        <dl className="database-summary">
          <div><dt>Retrieved</dt><dd>{publicData.retrievedAt}</dd></div>
          <div><dt>Cards</dt><dd>{publicData.counts.total}</dd></div>
          <div><dt>Images</dt><dd>{publicData.counts.art * 2}</dd></div>
        </dl>
      </header>

      <section className="source-principles" aria-label="Source roles">
        <article><Database aria-hidden="true" /><h2>Pinned records</h2><p>Every generated card points back to an upstream snapshot.</p></article>
        <article><Landmark aria-hidden="true" /><h2>Official structure</h2><p>First-party materials define the game’s core entities and terminology.</p></article>
        <article><Newspaper aria-hidden="true" /><h2>Named editorial views</h2><p>Third-party tiers stay attributed instead of being relabeled as our calculation.</p></article>
      </section>

      <section className="source-ledger">
        <header><span>Role</span><span>Source</span><span>Snapshot</span><span>Open</span></header>
        {sources.map((source) => (
          <a href={source.url} target="_blank" rel="noreferrer" key={source.title}>
            <span className={`source-kind source-${source.kind}`}>{source.kind}</span>
            <div><strong>{source.title}</strong><small>{source.publisher}</small><p>{source.note}</p></div>
            <span>{source.snapshot}</span>
            <span>Source <ExternalLink aria-hidden="true" /></span>
          </a>
        ))}
      </section>

      <aside className="asset-manifest-note">
        <FileCheck2 aria-hidden="true" />
        <div>
          <strong>Local artwork, reproducible manifest</strong>
          <p>
            Production UI loads local images. Source URL, local path, retrieval date, file size,
            and SHA-256 are tracked in <code>data/generated/card-art-manifest.json</code> and checked during the build.
          </p>
        </div>
      </aside>
    </div>
  );
}
