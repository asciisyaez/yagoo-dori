"use client";

import type { publicCards } from "@yagoo-dori/core";
import { RollCompareCta } from "@/components/roll-compare-cta";
import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import { useTranslation } from "@/lib/i18n";
import { ArrowLeft, ArrowRight, Sparkles, Timer, Users } from "lucide-react";

type PublicCardItem = (typeof publicCards)[number];

interface CardProfileViewProps {
  readonly card: PublicCardItem;
  readonly standardRanking?: {
    tier: string;
    index: { lower: number; upper: number };
    evaluation: { matchedContexts: number };
  } | undefined;
  readonly standardLeaderRanking?: {
    tier: string;
    index: { lower: number; upper: number };
    evaluation: { matchedContexts: number };
  } | undefined;
  readonly related: readonly PublicCardItem[];
  readonly teamGuide?: {
    slug: string;
    title: string;
  } | undefined;
}

function total(parameters: { performance: number; technique: number; sense: number }) {
  return parameters.performance + parameters.technique + parameters.sense;
}

function cleanDescription(description: string | null | undefined) {
  return description?.replace(/\[\/?[^\]]+\]/g, "") ?? "Description unavailable.";
}

function SkillBlock({
  label,
  levels,
}: {
  label: string;
  levels: Array<{
    level: number;
    description: string | null;
    cooldownSeconds: number | null;
    durationSeconds: number | null;
    activationProbability: number | null;
  }>;
}) {
  const { t } = useTranslation();
  const base = levels[0];
  const upgraded = levels.at(-1);

  return (
    <article className="mechanic-card">
      <div className="mechanic-card-heading">
        <span>{label.slice(0, 1)}</span>
        <div>
          <small>{t("cardProfile.memberSkill")}</small>
          <h2>{label}</h2>
        </div>
      </div>
      <p>{cleanDescription(base?.description)}</p>
      <dl>
        {base?.activationProbability !== null && base?.activationProbability !== undefined && (
          <div><dt>{t("cardProfile.chance")}</dt><dd>{Math.round(base.activationProbability * 100)}%</dd></div>
        )}
        {base?.cooldownSeconds !== null && base?.cooldownSeconds !== undefined && (
          <div><dt>{t("cardProfile.interval")}</dt><dd>{base.cooldownSeconds}s</dd></div>
        )}
        {base?.durationSeconds !== null && base?.durationSeconds !== undefined && (
          <div><dt>{t("cardProfile.duration")}</dt><dd>{base.durationSeconds}s</dd></div>
        )}
      </dl>
      {upgraded && upgraded.level !== base?.level && (
        <details>
          <summary>{t("cardProfile.potentialUpgrade")}</summary>
          <p>{cleanDescription(upgraded.description)}</p>
        </details>
      )}
    </article>
  );
}

export function CardProfileView({
  card,
  standardRanking,
  standardLeaderRanking,
  related,
  teamGuide,
}: CardProfileViewProps) {
  const { t } = useTranslation();

  return (
    <div className="database-page card-profile-page">
      <Link className="back-link cursor-pointer" href="/cards">
        <ArrowLeft aria-hidden="true" /> {t("cardProfile.backToCatalog")}
      </Link>

      <section className={`card-profile-hero attribute-${card.attribute}`}>
        <div className="card-illustration">
          <Image
            alt={`${card.title} ${card.talentName} card illustration`}
            fill
            priority
            sizes="(max-width: 800px) 100vw, 62vw"
            src={card.illustrationPath}
          />
          <span className="profile-rarity">{card.rarity}★</span>
        </div>
        <div className="card-profile-copy">
          <p className="db-eyebrow">{card.attribute} · {card.groups.join(" + ")}</p>
          <h1>{card.talentName}</h1>
          <h2>{card.title}</h2>
          <p className="outfit-name">{t("cardProfile.leaderOutfitLabel", { name: card.leaderOutfit.costumeName })}</p>
          <div className="card-profile-badges">
            <span>Lv. {card.maxLevel}</span>
            <span>{t("cardProfile.memberCardBadge")}</span>
            {standardRanking && (
              <span className="native-tier-badge">
                {t("cardProfile.memberTierBadge", { tier: standardRanking.tier })}
              </span>
            )}
            {standardLeaderRanking && (
              <span className="native-tier-badge">
                {t("cardProfile.leaderTierBadge", { tier: standardLeaderRanking.tier })}
              </span>
            )}
          </div>
          {(standardRanking || standardLeaderRanking) && (
            <p className="db-heading-note">
              {t("cardProfile.tierNote")}{" "}
              <Link className="cursor-pointer" href="/methodology">{t("tierList.howTiersWork")}</Link>
              {standardRanking && (
                <> · {t("cardProfile.memberRange", {
                  lower: standardRanking.index.lower.toFixed(1),
                  upper: standardRanking.index.upper.toFixed(1),
                  contexts: standardRanking.evaluation.matchedContexts.toLocaleString(),
                })}</>
              )}
              {standardLeaderRanking && (
                <> · {t("cardProfile.leaderRange", {
                  lower: standardLeaderRanking.index.lower.toFixed(1),
                  upper: standardLeaderRanking.index.upper.toFixed(1),
                  contexts: standardLeaderRanking.evaluation.matchedContexts.toLocaleString(),
                })}</>
              )}
            </p>
          )}
          <RollCompareCta cardId={card.id} />
        </div>
      </section>

      <section className="parameter-section">
        <div className="section-title-row">
          <div>
            <p className="db-eyebrow">{t("cardProfile.parametersEyebrow")}</p>
            <h2>{t("cardProfile.parametersHeading")}</h2>
          </div>
          <p>{t("cardProfile.parametersDesc")}</p>
        </div>
        <div className="parameter-comparison">
          {[
            [t("cardProfile.oneCopy"), card.parameters.oneCopyMaxLevel],
            [t("cardProfile.maxPotential"), card.parameters.maxPotential],
          ].map(([label, values]) => {
            const parameters = values as typeof card.parameters.oneCopyMaxLevel;
            return (
              <article key={label as string}>
                <header><span>{label as string}</span><strong>{total(parameters).toLocaleString()}</strong></header>
                {[
                  ["Performance", parameters.performance, "performance"],
                  ["Technique", parameters.technique, "technique"],
                  ["Sense", parameters.sense, "sense"],
                ].map(([name, value, key]) => (
                  <div className={`parameter-row parameter-${key}`} key={name as string}>
                    <span>{name as string}</span>
                    <i><b style={{ width: `${(Number(value) / Math.max(parameters.performance, parameters.technique, parameters.sense)) * 100}%` }} /></i>
                    <strong>{Number(value).toLocaleString()}</strong>
                  </div>
                ))}
              </article>
            );
          })}
        </div>
      </section>

      <section className="skills-section">
        <div className="section-title-row">
          <div>
            <p className="db-eyebrow">{t("cardProfile.mechanicsEyebrow")}</p>
            <h2>{t("cardProfile.mechanicsHeading")}</h2>
          </div>
          <Timer aria-hidden="true" />
        </div>
        <div className="mechanics-grid">
          <SkillBlock label="Active" levels={card.skills.active} />
          <SkillBlock label="Passive" levels={card.skills.passive} />
          <SkillBlock label="Special" levels={card.skills.special} />
        </div>
      </section>

      <section className="leader-outfit-panel" id="leader-outfit">
        <div className="leader-icon"><Users aria-hidden="true" /></div>
        <div>
          <p className="db-eyebrow">{t("cardProfile.leaderSkillEyebrow")}</p>
          <h2>{card.leaderOutfit.costumeName}</h2>
          <p>{cleanDescription(card.leaderOutfit.description)}</p>
        </div>
        <span>{t("cardProfile.leaderEffect")}</span>
      </section>

      {related.length > 0 && (
        <section className="related-card-section">
          <div className="section-title-row">
            <div>
              <p className="db-eyebrow">{t("cardProfile.sameTalentEyebrow")}</p>
              <h2>{t("cardProfile.sameTalentHeading", { talent: card.talentName })}</h2>
            </div>
            <Sparkles aria-hidden="true" />
          </div>
          <div className="related-card-grid">
            {related.map((item) => (
              <Link className="cursor-pointer" href={`/cards/${item.slug}`} key={item.id}>
                <Image alt="" height={120} src={item.artPath} width={120} />
                <span><strong>{item.rarity}★ {item.title}</strong><small>{item.attribute}</small></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {teamGuide && (
        <section className="related-card-section">
          <div className="section-title-row">
            <div>
              <p className="db-eyebrow">{t("cardProfile.teamGuideEyebrow")}</p>
              <h2>{t("cardProfile.teamGuideHeading")}</h2>
            </div>
            <Users aria-hidden="true" />
          </div>
          <div className="related-card-grid">
            <Link className="cursor-pointer" href={`/guides/${teamGuide.slug}`}>
              <Image alt="" height={120} src={card.artPath} width={120} />
              <span><strong>{teamGuide.title}</strong><small>{t("cardProfile.teamGuideDesc")}</small></span>
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
