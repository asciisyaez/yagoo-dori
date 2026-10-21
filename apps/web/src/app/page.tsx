"use client";

import { currentBanner, publicCardById, publicCards, publicData } from "@yagoo-dori/core";
import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import { useTranslation } from "@/lib/i18n";
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
const chapterDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
});
export default function HomePage() {
  const { t } = useTranslation();

  const quickLinks = [
    {
      href: "/tier-list",
      icon: BarChart3,
      eyebrow: t("home.qlRankingsEyebrow"),
      title: t("home.qlRankingsTitle"),
      text: t("home.qlRankingsText"),
      stat: t("home.qlRankingsStat"),
    },
    {
      href: "/cards",
      icon: LibraryBig,
      eyebrow: t("home.qlFindCardEyebrow"),
      title: t("home.qlFindCardTitle"),
      text: t("home.qlFindCardText"),
      stat: `${publicData.counts.total} ${t("common.card_other", { count: publicData.counts.total })}`,
    },
    {
      href: "/cards?view=outfits",
      icon: Shirt,
      eyebrow: t("home.qlCompareLeaderEyebrow"),
      title: t("home.qlCompareLeaderTitle"),
      text: t("home.qlCompareLeaderText"),
      stat: `${publicData.counts.total} outfits`,
    },
  ] as const;

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-kicker"><span /> {t("home.kicker")}</p>
          <h1>{t("home.headline")}</h1>
          <p className="home-lead">
            {t("home.lead")}
          </p>
          <div className="home-actions">
            <Link className="primary-action cursor-pointer" href="/tier-list">{t("home.ctaPrimary")} <ArrowRight aria-hidden="true" /></Link>
            <Link className="secondary-action cursor-pointer" href="/cards"><Search aria-hidden="true" /> {t("home.ctaSecondary")}</Link>
          </div>
          <dl className="home-roster-stats">
            <div><dt>{t("home.statMemberCards")}</dt><dd>{publicData.counts.total}</dd></div>
            <div><dt>{t("home.statTalents")}</dt><dd>{publicData.counts.talents}</dd></div>
            <div><dt>{t("home.statFiveStar")}</dt><dd>{publicData.counts.fiveStar}</dd></div>
          </dl>
        </div>

        <Link className={`hero-feature cursor-pointer attribute-${spotlight.attribute}`} href={`/cards/${spotlight.slug}`}>
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
          <span className="hero-feature-label"><small>{t("home.memberSpotlight")}</small><strong>{spotlight.talentName}</strong><span>{spotlight.title}</span></span>
          <span className="hero-feature-rarity">5★</span>
        </Link>
      </section>

      <section className="home-section current-banner-section" aria-labelledby="current-banner-heading">
        <div className="current-banner-panel">
          <div className="current-banner-copy">
            <p className="current-banner-kicker">{t("home.bannerKicker", { date: bannerStartLabel })}</p>
            <h2 id="current-banner-heading">{currentBanner.eventName}</h2>
            <p>
              {t("home.newFiveStar", { count: bannerCards.length + currentBanner.announcedMembers.length })} in <span lang="ja">{currentBanner.gachaNameJa}</span>.
            </p>
            <dl className="current-banner-stats">
              <div><dt>{t("home.featured")}</dt><dd>{bannerCards.length + currentBanner.announcedMembers.length} × ★5</dd></div>
              <div><dt>{t("home.newEventTracks")}</dt><dd>{currentBanner.eventTracks.length}</dd></div>
              <div><dt>{t("home.endsJst")}</dt><dd>{bannerEndLabel}</dd></div>
            </dl>
            <Link className="secondary-action current-banner-action cursor-pointer" href="/cards?rarity=5">
              {t("home.browseFiveStar")} <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className={`current-banner-cards${currentBanner.announcedMembers.length ? " announcement-cards" : ""}`}>
            {currentBanner.announcedMembers.map((member) => (
              <article className="current-banner-card announcement-card" key={member.talentId}>
                <span className="current-banner-card-art">
                  <Image alt={`${member.talentName} — ${member.titleJa}`} fill sizes="(max-width: 640px) 45vw, 25vw" src={member.artPath} />
                </span>
                <span className="current-banner-card-copy"><strong>{member.talentName}</strong><span lang="ja">{member.titleJa}</span></span>
              </article>
            ))}
            {bannerCards.map((card) => (
              <Link className={`current-banner-card cursor-pointer attribute-${card.attribute}`} href={`/cards/${card.slug}`} key={card.id}>
                <span className="current-banner-card-art">
                  <Image alt="" fill preview sizes="(max-width: 640px) 45vw, (max-width: 900px) 24vw, 14vw" src={card.illustrationPath} />
                </span>
                <span className="current-banner-card-copy"><strong>{card.talentName}</strong><span>{card.title}</span></span>
              </Link>
            ))}
          </div>
        </div>
        <div className="announced-banner-schedule">
          <h3>{t("home.newEventTracksHeading")}</h3>
          <p>{currentBanner.eventType === "spotlight" ? "Spotlight event" : "Score-challenge event"} · {eventStartLabel}–{eventEndLabel} JST.</p>
          <ul>
            {currentBanner.eventTracks.map((track) => (
              <li key={track.talent}>
                <strong>{track.talent}</strong>
                <span>{track.title}</span>
                <time dateTime={track.startsAt}>{chapterDateFormatter.format(new Date(track.startsAt))}–{chapterDateFormatter.format(new Date(track.endsAt))} JST</time>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-section">
        <header className="home-section-heading">
          <div><p>{t("home.startHere")}</p><h2>{t("home.getToAnswer")}</h2></div>
          <span>{t("home.cardsSkillsRoles")}</span>
        </header>
        <div className="quick-link-grid">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link href={item.href} className="quick-link-card cursor-pointer" key={item.href}>
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
          <div><p>{t("home.latestAdditions")}</p><h2>{t("home.newestFiveStar")}</h2></div>
          <Link className="cursor-pointer" href="/cards?rarity=5">{t("home.viewEveryFiveStar")} <ArrowRight aria-hidden="true" /></Link>
        </header>
        <div className="latest-card-grid">
          {latestCards.map((card) => (
            <Link className={`latest-card cursor-pointer attribute-${card.attribute}`} href={`/cards/${card.slug}`} key={card.id}>
              <span className="latest-card-art"><Image alt="" fill preview sizes="(max-width: 700px) 80vw, 20vw" src={card.illustrationPath} /><i>5★</i></span>
              <span className="latest-card-copy"><small>{card.attribute} · {card.generation}</small><strong>{card.talentName}</strong><span>{card.title}</span></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section browse-section">
        <header className="home-section-heading"><div><p>{t("home.browseGame")}</p><h2>{t("home.planTeam")}</h2></div></header>
        <div className="browse-links">
          <Link className="cursor-pointer" href="/talents"><UsersRound aria-hidden="true" /><span><strong>{publicData.counts.talents} talents</strong><small>{t("home.allLinkedCards")}</small></span><ArrowRight aria-hidden="true" /></Link>
          <Link className="cursor-pointer" href="/cards"><LibraryBig aria-hidden="true" /><span><strong>{publicData.counts.total} {t("common.card_other", { count: publicData.counts.total })}</strong><small>{t("home.statsSkillsArtwork")}</small></span><ArrowRight aria-hidden="true" /></Link>
          <Link className="cursor-pointer" href="/cards?view=outfits"><Shirt aria-hidden="true" /><span><strong>Leader Outfits</strong><small>{t("home.teamWideEffects")}</small></span><ArrowRight aria-hidden="true" /></Link>
          <Link className="cursor-pointer" href="/guides"><Sparkles aria-hidden="true" /><span><strong>Team guides</strong><small>{t("home.exactFormations")}</small></span><ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  );
}
