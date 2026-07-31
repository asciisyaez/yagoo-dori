import { publicCards, publicData } from "@yagoo-dori/core";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Database,
  LibraryBig,
  Search,
  Shirt,
  Sparkles,
  UsersRound,
} from "lucide-react";

const latestIds = ["0062", "0063", "0064", "0065", "0066"];
const latestCards = publicCards
  .filter((card) => latestIds.some((id) => card.id.includes(`uniq-${id}`)))
  .sort((left, right) => left.talentName.localeCompare(right.talentName));

const spotlight = latestCards.find((card) => card.id.includes("0063")) ?? latestCards[0]!;

const quickLinks = [
  {
    href: "/tier-list",
    icon: BarChart3,
    eyebrow: "Rankings",
    title: "Member tier list",
    text: "Scan the current 5★ score-tier reference or switch to the complete 4★ + 5★ roster.",
    stat: `${publicData.counts.fiveStar} ranked 5★`,
  },
  {
    href: "/cards",
    icon: LibraryBig,
    eyebrow: "Database",
    title: "Find a Member card",
    text: "Search real art, maximum stats, Active, Passive, Special, and linked Outfit skills.",
    stat: `${publicData.counts.total} cards`,
  },
  {
    href: "/leaders",
    icon: Shirt,
    eyebrow: "Team setup",
    title: "Compare Leaders",
    text: "Browse the Outfit effects that occupy the separate Leader slot in a Live team.",
    stat: `${publicData.counts.total} outfits`,
  },
] as const;

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-kicker"><span /> English game database</p>
          <h1>Build your next Live team with the real roster.</h1>
          <p className="home-lead">
            Search every current 4★ and 5★ Member card, inspect actual skills and stats, then compare
            the separate Leader Outfit that shapes the team.
          </p>
          <div className="home-actions">
            <Link className="primary-action" href="/tier-list">Open tier list <ArrowRight aria-hidden="true" /></Link>
            <Link className="secondary-action" href="/cards"><Search aria-hidden="true" /> Search cards</Link>
          </div>
          <dl className="home-roster-stats">
            <div><dt>Member cards</dt><dd>{publicData.counts.total}</dd></div>
            <div><dt>Talents</dt><dd>{publicData.counts.talents}</dd></div>
            <div><dt>Local game images</dt><dd>{publicData.counts.art * 2}</dd></div>
          </dl>
        </div>

        <Link className={`hero-feature attribute-${spotlight.attribute}`} href={`/cards/${spotlight.slug}`}>
          <Image
            alt={`${spotlight.title} ${spotlight.talentName}`}
            fill
            priority
            sizes="(max-width: 900px) 100vw, 48vw"
            src={spotlight.illustrationPath}
          />
          <span className="hero-feature-scrim" />
          <span className="hero-feature-label"><small>Latest 5★ addition</small><strong>{spotlight.talentName}</strong><span>{spotlight.title}</span></span>
          <span className="hero-feature-rarity">5★</span>
        </Link>
      </section>

      <section className="home-section">
        <header className="home-section-heading">
          <div><p>Start here</p><h2>Get to the answer quickly</h2></div>
          <span>Card art leads. Mechanics follow.</span>
        </header>
        <div className="quick-link-grid">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link href={item.href} className="quick-link-card" key={item.href}>
                <span className="quick-link-icon"><Icon aria-hidden="true" /></span>
                <span className="quick-link-copy"><small>{item.eyebrow}</small><strong>{item.title}</strong><span>{item.text}</span></span>
                <span className="quick-link-stat">{item.stat}</span>
                <ArrowRight className="quick-link-arrow" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-section latest-section">
        <header className="home-section-heading">
          <div><p>Latest additions</p><h2>Summer 5★ cards</h2></div>
          <Link href="/cards?rarity=5">View every 5★ <ArrowRight aria-hidden="true" /></Link>
        </header>
        <div className="latest-card-grid">
          {latestCards.map((card) => (
            <Link className={`latest-card attribute-${card.attribute}`} href={`/cards/${card.slug}`} key={card.id}>
              <span className="latest-card-art"><Image alt="" fill sizes="(max-width: 700px) 80vw, 20vw" src={card.illustrationPath} /><i>5★</i></span>
              <span className="latest-card-copy"><small>{card.attribute} · {card.generation}</small><strong>{card.talentName}</strong><span>{card.title}</span></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-data-strip">
        <Database aria-hidden="true" />
        <div><small>Current public snapshot</small><strong>Complete 4★ + 5★ roster</strong></div>
        <p>59 five-stars · 54 four-stars · synced 30 July 2026</p>
        <Link href="/sources">Inspect sources <ArrowRight aria-hidden="true" /></Link>
      </section>

      <section className="home-section browse-section">
        <header className="home-section-heading"><div><p>Browse the game</p><h2>Separate records for separate decisions</h2></div></header>
        <div className="browse-links">
          <Link href="/talents"><UsersRound aria-hidden="true" /><span><strong>54 talents</strong><small>All linked Member cards</small></span><ArrowRight aria-hidden="true" /></Link>
          <Link href="/cards"><LibraryBig aria-hidden="true" /><span><strong>113 cards</strong><small>Stats, skills, and artwork</small></span><ArrowRight aria-hidden="true" /></Link>
          <Link href="/leaders"><Shirt aria-hidden="true" /><span><strong>Leader Outfits</strong><small>Separate team-wide effects</small></span><ArrowRight aria-hidden="true" /></Link>
          <Link href="/guides"><Sparkles aria-hidden="true" /><span><strong>Team guides</strong><small>Exact five-card formations</small></span><ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  );
}
