"use client";

import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import { useTranslation } from "@/lib/i18n";
import { ArrowLeft, Crown, Layers3 } from "lucide-react";
import type { TalentRecord } from "../talent-records";

interface TalentProfileViewProps {
  readonly talent: TalentRecord;
  readonly cards: readonly TalentRecord["cards"][number][];
}

function total(parameters: { performance: number; technique: number; sense: number }) {
  return parameters.performance + parameters.technique + parameters.sense;
}

export function TalentProfileView({ talent, cards }: TalentProfileViewProps) {
  const { t } = useTranslation();

  return (
    <div className="database-page talent-profile-page">
      <Link className="back-link cursor-pointer" href="/talents">
        <ArrowLeft aria-hidden="true" /> {t("talentsPage.backToDirectory")}
      </Link>

      <section className={`card-profile-hero talent-profile-hero attribute-${talent.heroCard.attribute}`}>
        <div className="card-illustration">
          <Image
            alt={`${talent.name} card illustration`}
            fill
            priority
            sizes="(max-width: 800px) 100vw, 62vw"
            src={talent.heroCard.illustrationPath}
          />
        </div>
        <div className="card-profile-copy">
          <p className="db-eyebrow">{talent.branch} · {talent.groups.join(" + ")}</p>
          <h1>{talent.name}</h1>
          <p className="talent-profile-intro">{t("talentsPage.talentIntro")}</p>
          <div className="card-profile-badges">
            <span>{t("talentsPage.memberCards", { count: cards.length })}</span>
            <span>{t("talentsPage.leaderOutfits", { count: cards.length })}</span>
          </div>
        </div>
      </section>

      <section className="related-card-section talent-card-section">
        <div className="section-title-row">
          <div>
            <p className="db-eyebrow">{t("nav.cardsAndOutfits")}</p>
            <h2>{t("talentsPage.recordsHeading")}</h2>
          </div>
          <Layers3 aria-hidden="true" />
        </div>
        <div className="real-card-catalog talent-card-grid">
          {cards.map((card) => (
            <Link
              className={`real-catalog-card cursor-pointer attribute-${card.attribute}`}
              href={`/cards/${card.slug}`}
              key={card.id}
            >
              <span className="real-card-art">
                <Image alt="" fill sizes="(max-width: 700px) 100vw, 28vw" src={card.illustrationPath} />
                <i>{card.rarity}★</i>
              </span>
              <span className="real-card-copy">
                <small><i aria-hidden="true" /> {card.attribute} · Lv. {card.maxLevel}</small>
                <strong>{card.title}</strong>
                <span>{t("talentsPage.maxPotential", { total: total(card.parameters.maxPotential).toLocaleString() })}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="talent-outfit-section">
        <div className="section-title-row">
          <div>
            <p className="db-eyebrow">{t("talentsPage.leaderOutfitsEyebrow")}</p>
            <h2>{t("talentsPage.rewardOutfitsHeading")}</h2>
          </div>
          <Crown aria-hidden="true" />
        </div>
        <div className="talent-outfit-list">
          {cards.map((card) => (
            <Link className="cursor-pointer" href={`/cards/${card.slug}#leader-outfit`} key={card.leaderOutfit.costumeId}>
              <Image alt="" height={88} src={card.artPath} width={92} />
              <span>
                <small>{t("talentsPage.unlockedBy", { rarity: card.rarity, title: card.title })}</small>
                <strong>{card.leaderOutfit.costumeName}</strong>
                <span>
                  {card.leaderOutfit.description?.replace(/\[\/?[^\]]+\]/g, "") ?? t("talentsPage.noLeaderEffect")}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
