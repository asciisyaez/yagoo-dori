import { publicCards, publicData } from "@yagoo-dori/core";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  LibraryBig,
  Search,
  Shirt,
  Sparkles,
  UsersRound,
} from "lucide-react";

function releaseSequence(cardId: string) {
  return Number(cardId.match(/-uniq-(\d+)-/)?.[1] ?? -1);
}

const latestCards = publicCards
  .filter((card) => card.rarity === 5)
  .sort((left, right) => releaseSequence(right.id) - releaseSequence(left.id))
  .slice(0, 5);

const spotlight = latestCards[0]!;

const quickLinks = [
  {
    href: "/tier-list",
    icon: BarChart3,
    eyebrow: "Rankings",
    title: "Tier list",
    text: "Compare every Member card and Leader Outfit across the same three investment lenses.",
    stat: "2 ranking contexts",
  },
  {
    href: "/cards",
    icon: LibraryBig,
    eyebrow: "Database",
    title: "Find a Member card",
    text: "Search every 4★ and 5★ by talent, type, generation, stats, and skill set.",
    stat: `${publicData.counts.total} cards`,
  },
  {
    href: "/cards?view=outfits",
    icon: Shirt,
    eyebrow: "Team setup",
    title: "Compare Leaders",
    text: "Compare each Leader effect with the exact Member card that unlocks the Outfit.",
    stat: `${publicData.counts.total} outfits`,
  },
] as const;

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-kicker"><span /> Cards · tiers · team building</p>
          <h1>Know every card. Build the right five.</h1>
          <p className="home-lead">
            Compare skills, stats, and Leader Outfits, then shape a five-Member formation around
            the cards you own and the song you want to score.
          </p>
          <div className="home-actions">
            <Link className="primary-action" href="/tier-list">Open tier list <ArrowRight aria-hidden="true" /></Link>
            <Link className="secondary-action" href="/cards"><Search aria-hidden="true" /> Search cards</Link>
          </div>
          <dl className="home-roster-stats">
            <div><dt>Member cards</dt><dd>{publicData.counts.total}</dd></div>
            <div><dt>Talents</dt><dd>{publicData.counts.talents}</dd></div>
            <div><dt>5★ cards</dt><dd>{publicData.counts.fiveStar}</dd></div>
          </dl>
        </div>

        <Link className={`hero-feature attribute-${spotlight.attribute}`} href={`/cards/${spotlight.slug}`}>
          <Image
            alt={`${spotlight.title} ${spotlight.talentName}`}
            fill
            loading="eager"
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
          <span>Cards, skills, and team roles at a glance.</span>
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
          <div><p>Latest additions</p><h2>Newest 5★ cards</h2></div>
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

      <section className="home-section browse-section">
        <header className="home-section-heading"><div><p>Browse the game</p><h2>Everything you need to plan a team</h2></div></header>
        <div className="browse-links">
          <Link href="/talents"><UsersRound aria-hidden="true" /><span><strong>{publicData.counts.talents} talents</strong><small>All linked Member cards</small></span><ArrowRight aria-hidden="true" /></Link>
          <Link href="/cards"><LibraryBig aria-hidden="true" /><span><strong>{publicData.counts.total} cards</strong><small>Stats, skills, and artwork</small></span><ArrowRight aria-hidden="true" /></Link>
          <Link href="/cards?view=outfits"><Shirt aria-hidden="true" /><span><strong>Leader Outfits</strong><small>Team-wide effects and unlock cards</small></span><ArrowRight aria-hidden="true" /></Link>
          <Link href="/guides"><Sparkles aria-hidden="true" /><span><strong>Team guides</strong><small>Exact five-card formations</small></span><ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  );
}
