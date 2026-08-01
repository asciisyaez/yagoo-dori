import {
  nativeGuideBySlug,
  nativeGuideData,
  publicCardById,
  type NativeGuideFormation,
  type PublicCard,
} from "@yagoo-dori/core";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Clock3,
  Crown,
  Gauge,
  Music2,
  Repeat2,
  Sparkles,
} from "lucide-react";

import styles from "../guides.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return nativeGuideData.guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const guide = nativeGuideBySlug.get((await params).slug);
  if (!guide) return { title: "Guide not found" };
  const anchor = publicCardById.get(guide.anchorCardId);
  return {
    title: guide.title,
    description: anchor
      ? `${anchor.talentName} ${anchor.title} teams, singer-matched Leader Outfits, legal lineups, replacements, and rating-song comparisons.`
      : undefined,
  };
}

function requireCard(cardId: string): PublicCard {
  const card = publicCardById.get(cardId);
  if (!card) throw new Error(`Guide references missing card ${cardId}`);
  return card;
}

function cleanDescription(description: string | null | undefined) {
  return (description ?? "Effect description unavailable.")
    .replace(/\[\/?[^\]]+\]/g, "")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDuration(milliseconds: number) {
  const seconds = Math.round(milliseconds / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatSeconds(milliseconds: number) {
  const seconds = milliseconds / 1_000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

function formatPermil(value: number, prefix = "") {
  const percent = value / 10;
  return `${prefix}${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function formatParameter(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function formationCopy(formation: NativeGuideFormation) {
  if (formation.kind === "premium") {
    return `Every Member uses ${formation.progressionLens.label}.`;
  }
  if (formation.kind === "accessible-4-star") {
    return `Exact 5★ anchor, four 4★ Members, and a 4★ singer-matched Leader Outfit. Member progression: ${formation.progressionLens.label}.`;
  }
  return `Every Member uses ${formation.progressionLens.label}.`;
}

function lossLabel(loss: number) {
  if (Math.abs(loss) < 0.5) return "Near-even";
  const rounded = Math.max(1, Math.round(Math.abs(loss)));
  return loss > 0 ? `≈${rounded}% lower` : `≈${rounded}% higher`;
}

function FormationSection({ formation }: { formation: NativeGuideFormation }) {
  const leader = requireCard(formation.leaderOutfitCardId);
  const members = formation.formationOrder.map(requireCard);
  const activeByCard = new Map(formation.activeSkills.map((skill) => [skill.cardId, skill]));
  const specialByCard = new Map(formation.specialSkills.map((skill) => [skill.cardId, skill]));
  const replacementsByCard = new Map(
    formation.replacements.map((replacement) => [
      `${replacement.replacedCardId}:${replacement.cardId}`,
      replacement,
    ]),
  );

  return (
    <section className={styles.formationSection} id={`formation-${formation.kind}`}>
      <header className={styles.formationHeading}>
        <div>
          <p className="db-eyebrow">{formation.kind === "accessible-4-star" ? "Accessible build" : `${formation.label} build`}</p>
          <h2>{formation.label}</h2>
          <p>{formationCopy(formation)}</p>
        </div>
        <dl>
          <div><dt>Chart</dt><dd>{formation.context.songTitle}</dd></div>
          <div><dt>Length</dt><dd>{formatDuration(formation.context.durationMilliseconds)}</dd></div>
          <div><dt>Notes</dt><dd>{formation.context.noteCount.toLocaleString()}</dd></div>
        </dl>
      </header>

      <div className={styles.leaderPanel}>
        <div className={styles.leaderPortrait}>
          <Image alt="" height={112} src={leader.artPath} width={112} />
          <Crown aria-hidden="true" />
        </div>
        <div>
          <p className="db-eyebrow">Leader Outfit</p>
          <h3>{leader.talentName} · {leader.leaderOutfit.costumeName}</h3>
          <p>{cleanDescription(leader.leaderOutfit.description)}</p>
        </div>
        <Link href={`/cards/${leader.slug}#leader-outfit`}>Open Outfit <ArrowRight aria-hidden="true" /></Link>
      </div>

      <div className={styles.parameterCalculation} aria-label={`${formation.label} static parameter calculation`}>
        <div><small>Base team parameters</small><strong>{formatParameter(formation.staticParameters.base.central)}</strong></div>
        <span aria-hidden="true">+</span>
        <div>
          <small>Leader &amp; Passive gain</small>
          <strong>{formatParameter(formation.staticParameters.leaderAndPassiveGain.central)}</strong>
          {formation.staticParameters.leaderAndPassiveGain.lower !== formation.staticParameters.leaderAndPassiveGain.upper && (
            <em>{formatParameter(formation.staticParameters.leaderAndPassiveGain.lower)}–{formatParameter(formation.staticParameters.leaderAndPassiveGain.upper)}</em>
          )}
        </div>
        <span aria-hidden="true">=</span>
        <div><small>Effective static pool</small><strong>{formatParameter(formation.staticParameters.effective.central)}</strong><em>Before Active &amp; Special skills</em></div>
      </div>

      <div className={styles.orderBlock}>
        <div className={styles.orderHeading}>
          <div><p className="db-eyebrow">Member lineup</p><h3>Recommended five</h3></div>
          <p>One card per Holomem, built around the exact 5★ anchor.</p>
        </div>
        <ul className={styles.formationTrack} aria-label={`${formation.label} Member lineup`}>
          {members.map((member) => (
            <li key={member.id}>
              <Link href={`/cards/${member.slug}`}>
                <Image
                  alt={`${member.talentName}, ${member.title}, ${member.rarity} star ${member.attribute}`}
                  height={180}
                  src={member.artPath}
                  width={180}
                />
                <span className={styles.memberCopy}>
                  <small>{member.rarity}★ · {member.attribute}</small>
                  <strong>{member.talentName}</strong>
                  <span>{member.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.mechanicsGrid}>
        <article>
          <div className={styles.panelTitle}><Sparkles aria-hidden="true" /><div><p className="db-eyebrow">Synergy</p><h3>Why this lineup works</h3></div></div>
          <ul className={styles.synergyList}>
            {formation.recipients.length === 0 && <li>No formation-targeted parameter effects in this build.</li>}
            {formation.recipients.map((recipient, index) => {
              const source = requireCard(recipient.sourceCardId);
              const isLeaderEffect = recipient.sourceCardId === formation.leaderOutfitCardId;
              const common = recipient.commonToEveryAlternativeCardIds.map((cardId) => requireCard(cardId).talentName);
              const possible = recipient.possibleCardIds.map((cardId) => requireCard(cardId).talentName);
              const description = isLeaderEffect
                ? source.leaderOutfit.description
                : source.skills.passive.at(-1)?.description;
              return (
                <li key={`${recipient.sourceCardId}-${recipient.effectKind}-${index}`}>
                  <strong>{source.talentName} · {isLeaderEffect ? "Leader" : "Passive"}</strong>
                  <p>{cleanDescription(description)}</p>
                  {common.length > 0 && common.length === possible.length ? (
                    <span>Affected: {common.join(", ")}</span>
                  ) : (
                    <>
                      {possible.length > 0 && <span>Eligible in this lineup: {possible.join(", ")}</span>}
                      {common.length > 0 && <span>Always affected: {common.join(", ")}</span>}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </article>

        <article>
          <div className={styles.panelTitle}><Repeat2 aria-hidden="true" /><div><p className="db-eyebrow">Replacements</p><h3>Practical swaps</h3></div></div>
          <div className={styles.replacementList}>
            {formation.replacements.length === 0 && <p>No legal replacement was returned for this formation.</p>}
            {formation.replacements.map((replacement) => {
              const outgoing = requireCard(replacement.replacedCardId);
              const incoming = requireCard(replacement.cardId);
              const key = `${replacement.replacedCardId}:${replacement.cardId}`;
              const row = replacementsByCard.get(key)!;
              return (
                <div key={key}>
                  <span className={styles.swapCards}>
                    <Image alt="" height={42} src={outgoing.artPath} width={42} />
                    <ArrowRight aria-hidden="true" />
                    <Image alt="" height={42} src={incoming.artPath} width={42} />
                  </span>
                  <span>
                    <small>Replace {outgoing.talentName} with</small>
                    <strong>{incoming.talentName} · {incoming.rarity}★</strong>
                    <small className={styles.swapReason}>
                      Brings: {cleanDescription(incoming.skills.passive.at(-1)?.description)}
                    </small>
                  </span>
                  <span className={styles.lossFigure}>
                    <strong>{lossLabel(row.lossPercent.central)}</strong>
                    <small>Relative model estimate</small>
                  </span>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <div className={styles.timingBlock}>
        <div className={styles.sectionHeading}>
          <div><p className="db-eyebrow">Skill cadence</p><h3>Active and Special timing</h3></div>
          <p>Activation rates, cooldowns, and durations at this build&apos;s progression.</p>
        </div>
        <div className={styles.tableScroller}>
          <table className={styles.timingTable}>
            <thead>
              <tr><th>Member</th><th>Active</th><th>Special duration</th><th>Special effect</th></tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const active = activeByCard.get(member.id)!;
                const special = specialByCard.get(member.id)!;
                return (
                  <tr key={member.id}>
                    <th><Image alt="" height={38} src={member.artPath} width={38} /><strong>{member.talentName}</strong></th>
                    <td>
                      {formatPermil(active.activationProbabilityPermil)} · every {formatSeconds(active.cooldownMilliseconds)} · {formatSeconds(active.durationMilliseconds)}
                      <small>{cleanDescription(member.skills.active.at(-1)?.description)}</small>
                    </td>
                    <td>{formatSeconds(special.durationMilliseconds)}</td>
                    <td>
                      {formatPermil(special.scoreSupportPermil)} support{special.activationRateUpPermil > 0 ? ` · ${formatPermil(special.activationRateUpPermil, "+")} activation` : ""}
                      <small>{cleanDescription(member.skills.special.at(-1)?.description)}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.investmentBlock}>
        <div><p className="db-eyebrow">Investment order</p><h3>Build in this sequence</h3></div>
        <ol>
          {formation.investmentOrder.map((cardId, index) => {
            const card = requireCard(cardId);
            return <li key={card.id}><span>{index + 1}</span><Image alt="" height={46} src={card.artPath} width={46} /><strong>{card.talentName}</strong><small>{card.title}</small></li>;
          })}
        </ol>
      </div>
    </section>
  );
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = nativeGuideBySlug.get((await params).slug);
  if (!guide) notFound();
  const anchor = requireCard(guide.anchorCardId);
  const standard = guide.formations.find((formation) => formation.kind === "standard")!;
  const standardLeader = requireCard(standard.leaderOutfitCardId);
  const songAlternatives = guide.ratingSongComparisons.filter(
    (comparison) => comparison.changesReferenceFormation,
  );
  const defaultSongCount = guide.ratingSongComparisons.length - songAlternatives.length;

  return (
    <div className={`database-page ${styles.guidePage}`}>
      <Link className={styles.backLink} href="/guides"><ArrowLeft aria-hidden="true" /> Team guides</Link>

      <header className={styles.guideHero}>
        <div className={styles.heroArtwork}>
          <Image
            alt={`${anchor.title} ${anchor.talentName} card illustration`}
            fill
            priority
            sizes="(max-width: 800px) 100vw, 54vw"
            src={anchor.illustrationPath}
          />
          <span>{anchor.rarity}★ anchor</span>
        </div>
        <div className={styles.heroCopy}>
          <p className="db-eyebrow">{anchor.attribute} · {anchor.generation} · Team guide</p>
          <h1>{anchor.talentName}</h1>
          <h2>{anchor.title}</h2>
          <p>
            Three legal formation recommendations for this exact card, with team synergies,
            replacement losses, skill cadence, and song-specific alternatives.
          </p>
          <dl className={styles.heroFacts}>
            <div><dt><Crown aria-hidden="true" /> Standard Leader</dt><dd>{standardLeader.talentName} · {standardLeader.leaderOutfit.costumeName}</dd></div>
            <div><dt><Music2 aria-hidden="true" /> Song coverage</dt><dd>{guide.ratingSongComparisons.length} singer-matched Expert charts</dd></div>
            <div><dt><Clock3 aria-hidden="true" /> Alternate builds</dt><dd>{songAlternatives.length === 0 ? "None needed" : songAlternatives.length}</dd></div>
            <div><dt><Gauge aria-hidden="true" /> Benchmark</dt><dd>Mobile · Manual · All Perfect</dd></div>
          </dl>
          <Link className={styles.anchorLink} href={`/cards/${anchor.slug}`}>Open anchor card <ArrowRight aria-hidden="true" /></Link>
        </div>
      </header>

      <nav className={styles.guideNav} aria-label="Guide sections">
        {guide.formations.map((formation) => (
          <a href={`#formation-${formation.kind}`} key={formation.kind}>{formation.label}</a>
        ))}
        <a href="#rating-song-comparisons">Song fit</a>
        <a href="#calculation-basis">Calculation basis</a>
      </nav>

      {guide.formations.map((formation) => <FormationSection formation={formation} key={formation.kind} />)}

      <section className={styles.songSection} id="rating-song-comparisons">
        <div className={styles.sectionHeading}>
          <div><p className="db-eyebrow">Song fit</p><h2>Use one build unless the chart changes the answer</h2></div>
          <p>Only a reliably stronger formation is shown as an alternative.</p>
        </div>
        <div className={styles.songGrid}>
          <article className={styles.songSummary}>
            <header>
              <Music2 aria-hidden="true" />
              <div><h3>Most rating songs</h3><p>{defaultSongCount} of {guide.ratingSongComparisons.length} current singer-matched Expert charts</p></div>
              <span className={styles.defaultSong}>Standard build</span>
            </header>
            <p><Crown aria-hidden="true" /> Keep {standardLeader.talentName} · {standardLeader.leaderOutfit.costumeName} with the Standard formation above.</p>
          </article>
          {songAlternatives.map((variant) => {
            const leader = requireCard(variant.leaderOutfitCardId);
            const variantMembers = variant.formationOrder.map(requireCard);
            return (
              <article key={variant.chartKey}>
                <header>
                  <Music2 aria-hidden="true" />
                  <div><h3>{variant.songTitle}</h3><p>{formatDuration(variant.durationMilliseconds)} · {variant.noteCount.toLocaleString()} notes</p></div>
                  <span className={styles.changedSong}>
                    {variant.advantageOverReferencePercent !== null
                      ? `+${variant.advantageOverReferencePercent.toFixed(1)}% model`
                      : "Alternative"}
                  </span>
                </header>
                <p><Crown aria-hidden="true" /> {leader.talentName} · {leader.leaderOutfit.costumeName}</p>
                <ul aria-label={`${variant.songTitle} Member lineup`}>
                  {variantMembers.map((member) => (
                    <li key={member.id}><Image alt="" height={40} src={member.artPath} width={40} /><strong>{member.talentName}</strong></li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.basisSection} id="calculation-basis">
        <div className={styles.panelTitle}><BarChart3 aria-hidden="true" /><div><p className="db-eyebrow">Calculation basis</p><h2>What this comparison measures</h2></div></div>
        <p>
          These are relative team comparisons under one fixed benchmark, not absolute Live Score forecasts.
          The model combines legal team rules, card parameters, progression, skill effects, and song context.
        </p>
        <ul>
          <li><Gauge aria-hidden="true" />Mobile · Manual · All Perfect/full combo · full 1,000 Life</li>
          <li><Gauge aria-hidden="true" />Neutral Board contribution, 0% collection Member Upgrade Bonus, and no event bonus</li>
          <li><Music2 aria-hidden="true" />Rating-eligible Expert songs with the Leader talent listed as a singer</li>
          <li><Sparkles aria-hidden="true" />Performance, Technique, Sense, Leader effects, Passives, Active cadence, Specials, and target limits</li>
        </ul>
      </section>
    </div>
  );
}
