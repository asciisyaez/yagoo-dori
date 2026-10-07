import { currentBanner, publicCardById, publicCards, publicData } from "@yagoo-dori/core";
import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
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
const bannerCards = currentBanner.featuredCardIds
  .map((cardId) => publicCardById.get(cardId))
  .filter((card): card is (typeof publicCards)[number] => card !== undefined);
const bannerStartLabel = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
  year: "numeric",
}).format(new Date(currentBanner.startsAt));
const bannerEndLabel = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
}).format(new Date(currentBanner.endsAt));
const eventStartLabel = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
}).format(new Date(currentBanner.eventStartsAt));
const eventEndLabel = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
}).format(new Date(currentBanner.eventEndsAt));
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
            Compare skills, stats, and Leader Outfits, then shape a five-Member formation from
            the cards you own, benchmarked for general play across 30 Expert charts.
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
            fetchPriority="high"
            fill
            loading="eager"
            preview
            priority
            sizes="(max-width: 900px) 100vw, 48vw"
            src={spotlight.illustrationPath}
          />
          <span className="hero-feature-scrim" />
          <span className="hero-feature-label"><small>Latest 5★ addition</small><strong>{spotlight.talentName}</strong><span>{spotlight.title}</span></span>
          <span className="hero-feature-rarity">5★</span>
        </Link>
      </section>

      <section className="home-section current-banner-section" aria-labelledby="current-banner-heading">
        <div className="current-banner-panel">
          <div className="current-banner-copy">
            <p className="current-banner-kicker">Live banner · {bannerStartLabel} JST</p>
            <h2 id="current-banner-heading">{currentBanner.eventName}</h2>
            <p>
              {bannerCards.length} new ★5 cards in <span lang="ja">{currentBanner.gachaNameJa}</span>.
            </p>
            <dl className="current-banner-stats">
              <div><dt>Featured</dt><dd>{bannerCards.length} × ★5</dd></div>
              <div><dt>New event tracks</dt><dd>{currentBanner.eventTracks.length}</dd></div>
              <div><dt>Ends (JST)</dt><dd>{bannerEndLabel}</dd></div>
            </dl>
            <Link className="secondary-action current-banner-action" href="/cards?rarity=5">
              Browse ★5 cards <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className="current-banner-cards">
            {bannerCards.map((card) => (
              <Link className={`current-banner-card attribute-${card.attribute}`} href={`/cards/${card.slug}`} key={card.id}>
                <span className="current-banner-card-art">
                  <Image alt="" fill preview sizes="(max-width: 640px) 45vw, (max-width: 900px) 24vw, 14vw" src={card.illustrationPath} />
                </span>
                <span className="current-banner-card-copy"><strong>{card.talentName}</strong><span>{card.title}</span></span>
              </Link>
            ))}
          </div>
        </div>
        <div className="announced-banner-schedule">
          <h3>New event tracks</h3>
          <p>Score-challenge event · {eventStartLabel}–{eventEndLabel} JST.</p>
          <ul>
            {currentBanner.eventTracks.map((track) => (
              <li key={track.songId}>
                <strong>{track.talent}</strong>
                <span>{track.title}</span>
              </li>
            ))}
          </ul>
        </div>
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
              <span className="latest-card-art"><Image alt="" fill preview sizes="(max-width: 700px) 80vw, 20vw" src={card.illustrationPath} /><i>5★</i></span>
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
