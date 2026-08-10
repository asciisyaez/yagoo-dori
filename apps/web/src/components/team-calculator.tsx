"use client";

import { SiteImage as Image } from "@/components/site-image";
import { SiteLink as Link } from "@/components/site-link";
import { useSearchParams } from "next/navigation";
import type { TeamCalculatorResult } from "@yagoo-dori/core/team-calculator-contract";
import { comparePublicMemberCards } from "@yagoo-dori/core/member-card-order";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  Check,
  Heart,
  Search,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BLOOM_STAGES,
  type BloomStage,
  emptyTeamRoster,
  loadTeamRoster,
  saveTeamRoster,
  saveTeamRosterCalculatorFields,
  type StoredOshiPreference,
  type StoredOshiRole,
} from "@/lib/team-roster-storage";
import {
  startTeamCalculation,
  type TeamCalculatorTask,
  TeamCalculatorWorkerError,
} from "@/lib/team-calculator-worker-client";

import styles from "@/app/team-builder/team-builder.module.css";

export type TeamBuilderCard = {
  id: string;
  slug: string;
  talentId: string;
  generationOrder: number;
  talentName: string;
  title: string;
  rarity: 4 | 5;
  attribute: "cute" | "pure" | "happy";
  generation: string;
  artPath: string;
  color: string;
  outfitName: string;
};

type TeamCalculatorProps = {
  cards: TeamBuilderCard[];
  rosterCommit: string;
};

function normalizeRequiredMemberCardIds(
  cardIds: readonly string[],
  cardById: ReadonlyMap<string, TeamBuilderCard>,
  ownedCardIds: ReadonlySet<string>,
): string[] {
  const selectedTalentIds = new Set<string>();
  return [...new Set(cardIds)]
    .filter((cardId) => ownedCardIds.has(cardId) && cardById.has(cardId))
    .sort()
    .filter((cardId) => {
      const talentId = cardById.get(cardId)!.talentId;
      if (selectedTalentIds.has(talentId)) return false;
      selectedTalentIds.add(talentId);
      return true;
    })
    .slice(0, 5);
}

function formatUtility(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function formatSeconds(milliseconds: number) {
  const seconds = milliseconds / 1_000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

function formatSignedUtility(value: number) {
  if (Math.abs(value) < 0.5) return "0";
  return `${value > 0 ? "+" : "−"}${formatUtility(Math.abs(value))}`;
}

function formatSignedPercent(value: number) {
  if (Math.abs(value) < 0.05) return "Near tie (<0.05%)";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function formatPermilPercent(value: number) {
  return `${(value / 10).toFixed(1)}%`;
}

function formatBasisPoints(permil: number) {
  return `${(permil * 10).toFixed(1)} bp`;
}

function formatSignedDuration(milliseconds: number) {
  if (milliseconds === 0) return "0s";
  return `${milliseconds > 0 ? "+" : "−"}${formatSeconds(Math.abs(milliseconds))}`;
}

function cleanDescription(description: string | null | undefined) {
  return (description ?? "Effect description unavailable.")
    .replace(/\[\/?[^\]]+\]/g, "")
    .replace(/\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function boundAgreementLabel(
  agreement: TeamCalculatorResult["alternatives"][number]["cards"][number]["replacementImpact"]["boundAgreement"],
) {
  if (agreement === "improves-at-every-bound") return "Improves at every matched bound";
  if (agreement === "worsens-at-every-bound") return "Worsens at every matched bound";
  return "Bound-dependent";
}

function localRefinementLabel(result: TeamCalculatorResult) {
  if (result.search.resultClaim !== "bounded-search") {
    return "Not needed for the declared-corpus search.";
  }
  switch (result.search.localRefinementStatus) {
    case "fixed-point":
      return `Reached a fixed point after ${result.search.localRefinementIterations} iteration${result.search.localRefinementIterations === 1 ? "" : "s"}.`;
    case "cycle-guard":
      return `Stopped after ${result.search.localRefinementIterations} iteration${result.search.localRefinementIterations === 1 ? "" : "s"} when a repeated team was detected.`;
    case "iteration-cap":
      return `Stopped at the ${result.search.localRefinementIterations}-iteration cap; nearby swaps remain comparisons, not a claim about every roster combination.`;
    case "bounded-pass-complete":
      return "Completed the bounded local pass.";
    default:
      return "Local refinement status was not reported.";
  }
}

function effectLabel(effectKind: TeamCalculatorResult["synergies"][number]["effectKind"]) {
  switch (effectKind) {
    case "performance-up": return "Performance";
    case "technique-up": return "Technique";
    case "sense-up": return "Sense";
    case "all-parameters-up": return "All Stats";
  }
}

function oshiResultLabel(role: NonNullable<TeamCalculatorResult["oshi"]>["role"]) {
  if (role === "member") return "Locked into the five-Member lineup";
  if (role === "leader") return "Locked as the Leader Outfit";
  return "Locked as both Member and Leader Outfit";
}

function TeamResult({ result }: { result: TeamCalculatorResult }) {
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const requiredMemberIds = new Set(result.requiredMembers?.cardIds ?? []);
  const teamCardById = new Map([
    [result.leader.cardId, result.leader.talentName],
    ...result.members.map((member) => [member.cardId, member.talentName] as const),
  ]);
  const alternativeCardById = new Map(
    result.alternatives.flatMap((group) =>
      group.cards.map((card) => [card.cardId, card.talentName] as const),
    ),
  );
  const alternatives = result.alternatives.filter((group) => group.cards.length > 0);
  const boundedSearch = result.search.resultClaim === "bounded-search";
  const resultClaimLabel = boundedSearch
    ? "Best result in searched scope"
    : "All legal teams from your owned roster checked across the 30-chart benchmark";
  const resultHeading = boundedSearch
    ? "Strongest team found in the searched scope"
    : "Strongest team across the declared roster and 30-chart benchmark";

  const cardName = (cardId: string) =>
    teamCardById.get(cardId) ?? alternativeCardById.get(cardId) ?? "Matching Member";

  return (
    <section className={styles.resultPanel} aria-labelledby="team-result-heading" aria-live="polite">
      <header className={styles.resultHeading}>
        <div className={styles.resultHeadingIcon}><Trophy aria-hidden="true" /></div>
        <div>
          <p>Recommended formation</p>
          <h2 id="team-result-heading">{resultHeading}</h2>
          <span>Average performance across {result.corpus.chartCount} Expert charts · Board and Connect effects are not part of this objective</span>
        </div>
        <div className={styles.resultScore}>
          <span>Model utility</span>
          <strong>{formatUtility(result.score.relativeUtility.central)}</strong>
          <small>{formatUtility(result.score.relativeUtility.lower)}–{formatUtility(result.score.relativeUtility.upper)} range</small>
          <small>Relative team value, not a projected Live Score.</small>
        </div>
      </header>

      {result.oshi && (
        <div className={styles.oshiResult} role="status">
          <Heart aria-hidden="true" />
          <div>
            <span>Oshi lock fulfilled</span>
            <strong>{result.oshi.talentName}</strong>
          </div>
          <p>{oshiResultLabel(result.oshi.role)}</p>
        </div>
      )}

      {result.requiredMembers && (
        <div className={styles.requiredResult} role="status">
          <BadgeCheck aria-hidden="true" />
          <span>Lineup locks fulfilled</span>
          <strong>{result.requiredMembers.cardIds.length} required Member{result.requiredMembers.cardIds.length === 1 ? "" : "s"} retained</strong>
        </div>
      )}

      <div className={styles.teamFormation}>
        <article className={`${styles.leaderResult} ${styles[`result-${result.leader.attribute}`]} ${result.oshi?.resolution.leader.selectedCardId === result.leader.cardId ? styles.oshiSelectedResult : ""}`}>
          <Link
            aria-label={`${result.leader.outfitName} Leader Outfit from ${result.leader.talentName}`}
            className={styles.leaderArt}
            href={`/cards/${result.leader.slug}#leader-outfit`}
          >
            <Image alt="" fill sizes="(max-width: 700px) 100vw, 360px" src={result.leader.illustrationPath} />
            <span>Leader Outfit</span>
            {result.oshi?.resolution.leader.selectedCardId === result.leader.cardId && (
              <b className={styles.oshiResultBadge}><Heart aria-hidden="true" /> Oshi</b>
            )}
          </Link>
          <div>
            <small>{result.leader.rarity}★ source card · Bloom {result.leader.sourceCardBloomStage}</small>
            <h3>{result.leader.outfitName}</h3>
            <p>{result.leader.talentName}</p>
            <span>{result.leader.title}</span>
          </div>
        </article>

        <div className={styles.memberResultGroup}>
          <header>
            <div><span>Special activation order</span><strong>Left to right</strong></div>
            <small>{result.formationOrder.status === "indeterminate" ? "Timing tie" : result.formationOrder.kind === "timed-corpus" ? "Chart timed" : "Timing modeled"}</small>
          </header>
          <div className={styles.memberResults}>
            {result.members.map((member, index) => {
              const timing = result.formationOrder.members[index]!;
              return (
              <Link className={`${styles.memberResult} ${styles[`result-${member.attribute}`]} ${result.oshi?.resolution.member.selectedCardId === member.cardId ? styles.oshiSelectedResult : ""}`} href={`/cards/${member.slug}`} key={member.cardId}>
                <span className={styles.memberResultArt}>
                  <Image alt="" fill sizes="(max-width: 560px) 30vw, 150px" src={member.artPath} />
                  <i>{member.rarity}★</i>
                  <b>B{member.bloomStage}</b>
                  <span className={styles.orderSlot}>Slot {timing.slot}</span>
                  {requiredMemberIds.has(member.cardId) && (
                    <em className={styles.requiredResultBadge}>Required</em>
                  )}
                  {result.oshi?.resolution.member.selectedCardId === member.cardId && (
                    <em className={styles.oshiResultBadge}><Heart aria-hidden="true" /> Oshi</em>
                  )}
                </span>
                <span>
                  <strong>{member.talentName}</strong>
                  <small>{member.title}</small>
                  <span
                    className={styles.memberTiming}
                    title={`Active checks every ${formatSeconds(timing.active.cooldownMilliseconds)}; Special lasts ${formatSeconds(timing.special.durationMilliseconds)}`}
                  >
                    <b>A</b> {formatSeconds(timing.active.cooldownMilliseconds)}
                    <i aria-hidden="true" />
                    <b>SP</b> {formatSeconds(timing.special.durationMilliseconds)}
                  </span>
                </span>
              </Link>
              );
            })}
          </div>
          <p className={styles.orderSummary} data-status={result.formationOrder.status}>
            {result.formationOrder.confidence.statement} Win share {formatPermilPercent(result.formationOrder.confidence.winSharePermil)} · max regret {formatBasisPoints(result.formationOrder.confidence.maxRegretPermil)} · mean regret {formatBasisPoints(result.formationOrder.confidence.meanRegretPermil)}.
          </p>
        </div>
      </div>

      <section className={styles.memberEvidencePanel} aria-labelledby="member-evidence-heading">
        <header>
          <div>
            <span>Member field report</span>
            <h3 id="member-evidence-heading">Why each Member is here</h3>
          </div>
          <div className={styles.memberEvidenceHeaderActions}>
            <p>One-for-one comparisons keep the Leader and the other four Members fixed.</p>
            <button
              aria-controls="member-evidence-grid"
              aria-expanded={evidenceExpanded}
              className={styles.evidenceToggle}
              onClick={() => setEvidenceExpanded((expanded) => !expanded)}
              type="button"
            >
              {evidenceExpanded ? "Hide evidence" : "Show evidence for all 5"}
            </button>
          </div>
        </header>
        <div
          aria-label="Evidence for all five Members"
          className={styles.memberEvidenceGrid}
          id="member-evidence-grid"
          role="region"
        >
          {result.members.map((member, index) => {
            const timing = result.formationOrder.members[index]!;
            const replacementGroup = result.alternatives.find(
              (group) => group.replacesCardId === member.cardId,
            );
            const primaryAlternative = replacementGroup?.cards[0];
            const relevantSynergies = result.synergies.filter((synergy) =>
              synergy.sourceCardId === member.cardId ||
              synergy.recipientAlternatives.some((recipients) => recipients.includes(member.cardId)),
            );
            const persistent = timing.active.persistentSupportPermilAcrossCorpus;
            const oshiSelected = result.oshi?.resolution.member.selectedCardId === member.cardId;
            const required = requiredMemberIds.has(member.cardId);
            const specialGateLabel = timing.special.comboGateThresholds.length > 0
              ? `; combo thresholds ${timing.special.comboGateThresholds.join(", ")}`
              : "";
            return (
              <article className={styles.memberEvidenceCard} key={member.cardId}>
                <h4 className="sr-only">{member.talentName} Member evidence</h4>
                <header>
                  <Link href={`/cards/${member.slug}`}>
                    <Image alt="" height={42} src={member.artPath} width={42} />
                    <span><strong>{member.talentName}</strong><small>{member.title} · B{member.bloomStage}</small></span>
                  </Link>
                  <b>Slot {timing.slot}{required ? " · Required" : ""}</b>
                </header>
                <div className={styles.memberEvidenceBody} hidden={!evidenceExpanded}>
                    <p><strong>Active:</strong> fires on {formatPermilPercent(timing.active.activationProbabilityPermil)} of checks; checks every {formatSeconds(timing.active.cooldownMilliseconds)} and lasts {formatSeconds(timing.active.durationMilliseconds)}.</p>
                    {persistent.maximum > 0 && (
                      <p><strong>Persistent support:</strong> {persistent.minimum === persistent.maximum ? `${persistent.minimum}‰` : `${persistent.minimum}–${persistent.maximum}‰`} across the benchmark.</p>
                    )}
                    <p><strong>Special:</strong> at full combo without a song match, +{formatPermilPercent(timing.special.scoreSupportPermilAtFullComboWithoutSongMatch)} support and +{formatPermilPercent(timing.special.activationRateUpPermilAtFullComboWithoutSongMatch)} activation rate for {formatSeconds(timing.special.durationMilliseconds)}{specialGateLabel}.</p>
                    {oshiSelected && result.oshi && (
                      <p><strong>Oshi:</strong> selected from {result.oshi.eligibleOwnedMemberCardIds.length} eligible owned Member{result.oshi.eligibleOwnedMemberCardIds.length === 1 ? "" : "s"}.</p>
                    )}
                    {required && (
                      <p><strong>Lineup lock:</strong> this required Member was retained in the calculated formation.</p>
                    )}
                    <div className={styles.memberEvidenceLinks}>
                      <strong>Leader/Passive links</strong>
                      {relevantSynergies.length > 0 ? (
                        <ul>
                          {relevantSynergies.map((synergy) => {
                            const isSource = synergy.sourceCardId === member.cardId;
                            const isRecipient = synergy.recipientAlternatives.some((recipients) => recipients.includes(member.cardId));
                            const memberRelation = isSource && isRecipient
                              ? "source + possible recipient"
                              : isSource
                                ? "source"
                                : "possible recipient";
                            const recipients = synergy.recipientAlternatives
                              .map((recipientSet) => recipientSet.map(cardName).join(" + "))
                              .join(" / ");
                            return (
                              <li key={`${synergy.source}-${synergy.sourceCardId}-${synergy.effectGroupId}`}>
                                <span>{memberRelation}</span> {synergy.source} link from {cardName(synergy.sourceCardId)} · {effectLabel(synergy.effectKind)} +{synergy.valuePermil / 10}% · {recipients || "no listed recipients"} · {synergy.resolution === "resolved" ? "resolved" : "multiple possible targets"} ({synergy.activeChartCount}/30 charts)
                              </li>
                            );
                          })}
                        </ul>
                      ) : <p>No Leader or Passive link names this Member as a source or possible recipient.</p>}
                    </div>
                    <div className={styles.memberReplacementEvidence}>
                      <strong>One-for-one replacement check</strong>
                      {replacementGroup && primaryAlternative ? (
                        <>
                          <p>Primary rule: the strongest stand-in we evaluated was <Link href={`/cards/${primaryAlternative.slug}`}>{primaryAlternative.talentName}</Link>, with the Leader and other four Members held fixed.</p>
                          <p>Swapping {member.talentName} for {primaryAlternative.talentName} moves modeled team value by {formatSignedUtility(primaryAlternative.replacementImpact.centralDelta)} ({formatSignedPercent(primaryAlternative.replacementImpact.centralDeltaPercent)}); the stand-in central modeled value is {formatUtility(primaryAlternative.relativeUtility.central)}.</p>
                          {primaryAlternative.replacementImpact.centralDelta > 0 && (
                            <p className={styles.memberEvidenceWarning}>This stand-in models higher than the selected Member. {result.search.localRefinementStatus === "iteration-cap" ? "The local refinement stopped at its cap, so this remains a comparison rather than a promoted team." : "The displayed result keeps the selected team and shows this as a comparison."}</p>
                          )}
                          <p>Coverage: {replacementGroup.coverage.eligibleCardCount} eligible stand-in{replacementGroup.coverage.eligibleCardCount === 1 ? "" : "s"}; {replacementGroup.coverage.fullCorpusRerankedCardCount} reached the full 30-chart benchmark; {replacementGroup.coverage.returnedCardCount} shown.</p>
                        </>
                      ) : (
                        <p>{required ? "This slot is locked to a required card, so stand-ins were not evaluated for it." : "No evaluated stand-in was returned for this slot."} The selected Member remains explained by the timing, link, and roster evidence above.</p>
                      )}
                    </div>
                </div>
              </article>
            );
          })}
        </div>
        <p className={styles.memberEvidenceNote}>These are one-for-one comparisons, not shares of the team total; the Active lane models one skill applying per note, so member contributions do not add up to the whole.</p>
      </section>

      <div className={styles.resultDetailGrid}>
        <section className={styles.synergyPanel}>
          <header><div><span>Team links</span><h3>Active stat synergies</h3></div><strong>{result.synergies.length}</strong></header>
          <div>
            {result.synergies.map((synergy, index) => {
              const sourceName = cardName(synergy.sourceCardId);
              const recipients = synergy.recipientAlternatives
                .map((alternative) => alternative.map(cardName).join(" + "))
                .join(" / ");
              const recipientLabel = recipients || "No matching recipients";
              const coverageLabel = synergy.activeChartCount === synergy.corpusChartCount
                ? null
                : `${synergy.activeChartCount}/${synergy.corpusChartCount} charts`;
              return (
                <article key={`${synergy.source}-${synergy.sourceCardId}-${synergy.effectGroupId}-${index}`}>
                  <span className={synergy.source === "leader" ? styles.leaderSource : styles.passiveSource}>{synergy.source}</span>
                  <div>
                    <strong>{sourceName}</strong>
                    <small>{effectLabel(synergy.effectKind)} +{synergy.valuePermil / 10}%{coverageLabel ? ` · ${coverageLabel}` : ""}</small>
                  </div>
                  <ArrowRight aria-hidden="true" />
                  <p title={synergy.resolution === "multiple-possible-recipients" ? `${recipientLabel} (possible targets)` : recipientLabel}>
                    {recipientLabel}{synergy.resolution === "multiple-possible-recipients" ? " · possible targets" : ""}
                  </p>
                </article>
              );
            })}
            {result.synergies.length === 0 && <p className={styles.noSynergy}>No Leader or Passive stat links activate in this formation.</p>}
          </div>
        </section>

        <section className={styles.searchSummary}>
          <span>{resultClaimLabel}</span>
          <p className={styles.searchClaimDetail}><strong>Result claim:</strong> {boundedSearch ? "bounded search; searched scope only" : "declared roster scope"}.</p>
          <strong>{result.search.searchLeaderTeamFormationsReranked.toLocaleString("en-US")}</strong>
          <small>Leader and five-Member formations compared</small>
          {boundedSearch && result.search.teamSetsEvaluated < result.search.teamSetsInScope && (
            <p>{result.search.teamSetsEvaluated.toLocaleString("en-US")} of {result.search.teamSetsInScope.toLocaleString("en-US")} legal Member sets reached the full benchmark.</p>
          )}
          {boundedSearch && <p className={styles.searchClaimDetail}>Constrained runs can occasionally exceed this bounded result; re-running keeps the better answer.</p>}
          <div><span>Utility range</span><b>{formatUtility(result.score.relativeUtility.lower)}–{formatUtility(result.score.relativeUtility.upper)}</b></div>
          <p className={styles.searchRefinement}><strong>Local refinement:</strong> {localRefinementLabel(result)}</p>
          <em>Relative team value, not a projected Live Score.</em>
          <p className={styles.searchClaimDetail}>The range spans the unresolved targeting and overlap readings; the central value is the ranked answer rather than the middle of the range. Team value is order-invariant in this model — formation order changes Special timing, shown separately below. The <Link href="/methodology">methodology page</Link> documents the shared evaluation model and its limits.</p>
        </section>
      </div>

      {alternatives.length > 0 && (
        <section className={styles.alternativesPanel}>
          <header><div><span>Swap impact report</span><h3>One-for-one replacements</h3></div><small>With the recommended Leader</small></header>
          <p className={styles.alternativesDisclosure}>Both totals use the same central modeled value from the guaranteed-recipient targeting lane. The headline range reflects shared targeting ambiguity; it usually moves both teams together — the range note on each report flags the cases where the bounds disagree — so it is not attached to a swap delta. Formation order does not move the before/after value because the team-value model is order-invariant: it treats Special coverage as duration coverage rather than crediting one starting order. The separate order recommendation can still be chart-timed — order changes when Specials fire, not these totals.</p>
          <div className={styles.alternativeGroups}>
            {alternatives.map((group) => {
              const replaced = result.members.find((member) => member.cardId === group.replacesCardId);
              if (!replaced) return null;
              return (
                <article key={group.replacesCardId}>
                  <header>
                    <Image alt="" height={38} src={replaced.artPath} width={38} />
                    <span><small>Instead of</small><strong>{replaced.talentName}</strong></span>
                  </header>
                  <div className={styles.alternativeReports}>
                    {group.cards.map((alternative) => {
                      const impact = alternative.replacementImpact;
                      const chartChange = impact.centralDeltaPercent;
                      return (
                        <article className={styles.alternativeReport} key={alternative.cardId}>
                          <h4 className="sr-only">{replaced.talentName} to {alternative.talentName} replacement impact</h4>
                          <Link className={styles.alternativeIdentity} href={`/cards/${alternative.slug}`}>
                            <Image alt="" height={42} src={alternative.artPath} width={42} />
                            <span><strong>{alternative.talentName}</strong><small>{alternative.title} · B{alternative.bloomStage}</small></span>
                          </Link>
                          <div className={styles.alternativeValueLine}>
                            <span>Team value</span>
                            <strong>{formatUtility(result.score.relativeUtility.central)} → {formatUtility(alternative.relativeUtility.central)}</strong>
                            <b data-improvement={impact.centralDelta >= 0.5}>{formatSignedUtility(impact.centralDelta)}</b>
                            <small>{formatSignedPercent(chartChange)}</small>
                          </div>
                          <p className={styles.alternativeRobustness}>Improved {impact.chartsImproved}/30 charts · worsened {impact.chartsWorsened}/30 · tied {impact.chartsTied}/30.</p>
                          <p className={styles.alternativeRobustness}>Per-chart change {formatSignedPercent(impact.perChartDeltaPercent.minimum)} to {formatSignedPercent(impact.perChartDeltaPercent.maximum)}; median {formatSignedPercent(impact.perChartDeltaPercent.median)} · {boundAgreementLabel(impact.boundAgreement)}.</p>
                          <details className={styles.impactDetails}>
                            <summary>Inspect passive, cadence, and targeting changes</summary>
                            <div className={styles.impactBody}>
                              <div className={styles.passiveComparison}>
                                <div><span>Passive before · Lv.{impact.outgoingPassiveSkillLevel}</span><p>{cleanDescription(impact.outgoingPassiveDescription)}</p></div>
                                <ArrowRight aria-hidden="true" />
                                <div><span>Passive after · Lv.{impact.incomingPassiveSkillLevel}</span><p>{cleanDescription(impact.incomingPassiveDescription)}</p></div>
                              </div>
                              <p className={styles.impactScalars}><strong>Active cadence delta:</strong> {formatSignedDuration(impact.activeCooldownDeltaMilliseconds)} incoming minus outgoing · <strong>Special window delta:</strong> {formatSignedDuration(impact.specialDurationDeltaMilliseconds)} incoming minus outgoing.</p>
                              <div className={styles.effectChangeList}>
                                <strong>Leader/Passive effect changes</strong>
                                {impact.effectChanges.length > 0 ? (
                                  <ul>
                                    {impact.effectChanges.map((effect) => {
                                      const beforeTargets = effect.recipientCardIdsBefore.length > 0
                                        ? effect.recipientCardIdsBefore.map(cardName).join(", ")
                                        : "none";
                                      const afterTargets = effect.recipientCardIdsAfter.length > 0
                                        ? effect.recipientCardIdsAfter.map(cardName).join(", ")
                                        : "none";
                                      const sourceStatus = effect.sourceRemainsInTeam
                                        ? "source remains in team"
                                        : "source leaves with outgoing card";
                                      return (
                                        <li key={`${effect.source}-${effect.sourceCardId}-${effect.effectGroupId}-${effect.effectKind}-${effect.valuePermil}`}>
                                          <span data-change={effect.change}>{effect.change}</span> <strong>{effect.source} · {cardName(effect.sourceCardId)}</strong> · {sourceStatus} · {effectLabel(effect.effectKind)} +{effect.valuePermil / 10}% · before: {beforeTargets} · after: {afterTargets} · {effect.activeChartCountBefore}/30 → {effect.activeChartCountAfter}/30 charts
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : <p>No Leader or Passive effect recipient changed across the paired corpus.</p>}
                              </div>
                            </div>
                          </details>
                        </article>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}

export function TeamCalculator({ cards, rosterCommit }: TeamCalculatorProps) {
  const searchParams = useSearchParams();
  const initialSearch = new URLSearchParams(searchParams.toString());
  initialSearch.delete("chart");
  const [ownedCards, setOwnedCards] = useState<Record<string, BloomStage>>({});
  const [oshiPreference, setOshiPreference] = useState<StoredOshiPreference>(
    () => emptyTeamRoster(rosterCommit).oshi,
  );
  const [requiredMemberCardIds, setRequiredMemberCardIds] = useState<string[]>([]);
  const [storageStatus, setStorageStatus] = useState<"loading" | "persistent" | "session">("loading");
  const [filters, setFilters] = useState(() => ({
    query: searchParams.get("q") ?? "",
    rarity: searchParams.get("rarity") ?? "all",
    attribute: searchParams.get("attribute") ?? "all",
  }));
  const [calculationState, setCalculationState] = useState<
    | { status: "idle" }
    | { status: "calculating" }
    | { status: "done"; result: TeamCalculatorResult }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const activeTask = useRef<TeamCalculatorTask | null>(null);
  // Survives invalidateCalculation so edited-input re-runs still seed from the
  // last successful answer (memory-only; never persisted).
  const lastResult = useRef<TeamCalculatorResult | null>(null);
  const resultAnchor = useRef<HTMLDivElement>(null);
  const pendingSearch = useRef(initialSearch.toString());

  const { query, rarity, attribute } = filters;
  const storageReady = storageStatus !== "loading";

  const validCardIds = useMemo(() => new Set(cards.map((card) => card.id)), [cards]);
  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      let hydratedCards: Record<string, BloomStage> = {};
      try {
        const loaded = loadTeamRoster(window.localStorage, rosterCommit, validCardIds);
        hydratedCards = loaded.roster.cards;
        const hydratedRequiredMemberCardIds = normalizeRequiredMemberCardIds(
          loaded.roster.requiredMemberCardIds,
          cardById,
          new Set(Object.keys(hydratedCards)),
        );
        const savedOshiStillOwned =
          loaded.roster.oshi.talentId === null ||
          Object.keys(hydratedCards).some(
            (cardId) => cardById.get(cardId)?.talentId === loaded.roster.oshi.talentId,
          );
        const hydratedOshi = savedOshiStillOwned
          ? loaded.roster.oshi
          : { ...loaded.roster.oshi, talentId: null };
        setOwnedCards(hydratedCards);
        setRequiredMemberCardIds(hydratedRequiredMemberCardIds);
        setOshiPreference(hydratedOshi);
        if (
          loaded.needsWrite ||
          !savedOshiStillOwned ||
          JSON.stringify(loaded.roster.requiredMemberCardIds) !==
            JSON.stringify(hydratedRequiredMemberCardIds)
        ) {
          saveTeamRoster(window.localStorage, {
            ...loaded.roster,
            oshi: hydratedOshi,
            requiredMemberCardIds: hydratedRequiredMemberCardIds,
          });
        }
        setStorageStatus("persistent");
      } catch {
        setOwnedCards(hydratedCards);
        setRequiredMemberCardIds([]);
        setStorageStatus("session");
      }
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [cardById, rosterCommit, validCardIds]);

  useEffect(() => {
    if (storageStatus !== "persistent") return;
    let fallbackTimer: number | null = null;
    try {
      // Writes only the calculator-owned fields; persisted Board planner state
      // (playerLevel/boards) is preserved by the storage layer.
      saveTeamRosterCalculatorFields(window.localStorage, {
        rosterCommit,
        cards: ownedCards,
        oshi: oshiPreference,
        requiredMemberCardIds,
      });
    } catch {
      fallbackTimer = window.setTimeout(() => setStorageStatus("session"), 0);
    }
    return () => {
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
    };
  }, [ownedCards, oshiPreference, requiredMemberCardIds, rosterCommit, storageStatus]);

  useEffect(() => () => {
    activeTask.current?.cancel();
    activeTask.current = null;
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("chart")) {
      const nextQuery = pendingSearch.current;
      window.history.replaceState(
        window.history.state,
        "",
        nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname,
      );
    }

    const syncFiltersFromHistory = () => {
      const next = new URLSearchParams(window.location.search);
      next.delete("chart");
      pendingSearch.current = next.toString();
      setFilters({
        query: next.get("q") ?? "",
        rarity: next.get("rarity") ?? "all",
        attribute: next.get("attribute") ?? "all",
      });
    };
    window.addEventListener("popstate", syncFiltersFromHistory);
    return () => window.removeEventListener("popstate", syncFiltersFromHistory);
  }, []);

  const setFilter = (key: string, value: string, defaultValue = "all") => {
    // Keep an eagerly updated copy because several controls can change before
    // the preceding Next navigation has committed to window.location.
    const next = new URLSearchParams(pendingSearch.current);
    if (value === defaultValue || value === "") next.delete(key);
    else next.set(key, value);
    const nextQuery = next.toString();
    pendingSearch.current = nextQuery;
    setFilters({
      query: next.get("q") ?? "",
      rarity: next.get("rarity") ?? "all",
      attribute: next.get("attribute") ?? "all",
    });
    // location.pathname retains the repository prefix on GitHub Pages while
    // replaceState avoids a full App Router navigation for every keystroke.
    window.history.replaceState(
      window.history.state,
      "",
      nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname,
    );
  };

  const selectedCards = Object.entries(ownedCards)
    .map(([cardId, bloomStage]) => {
      const card = cardById.get(cardId);
      return card ? { card, bloomStage } : null;
    })
    .filter((entry): entry is { card: TeamBuilderCard; bloomStage: BloomStage } => entry !== null)
    .sort((left, right) => comparePublicMemberCards(left.card, right.card));
  const uniqueTalentCount = new Set(selectedCards.map(({ card }) => card.talentId)).size;
  const selectedTalents = [...selectedCards
    .reduce((talents, entry) => {
      const current = talents.get(entry.card.talentId);
      if (
        !current ||
        entry.card.rarity > current.card.rarity ||
        (entry.card.rarity === current.card.rarity && entry.card.title.localeCompare(current.card.title) < 0)
      ) {
        talents.set(entry.card.talentId, entry);
      }
      return talents;
    }, new Map<string, (typeof selectedCards)[number]>())
    .values()]
    .sort((left, right) => comparePublicMemberCards(left.card, right.card));
  const selectedOshiTalent = selectedTalents.find(
    ({ card }) => card.talentId === oshiPreference.talentId,
  );
  const requiredMemberIdSet = new Set(requiredMemberCardIds);
  const requiredMemberTalentIds = new Set(
    requiredMemberCardIds
      .map((cardId) => cardById.get(cardId)?.talentId)
      .filter((talentId): talentId is string => talentId !== undefined),
  );
  const talentsNeeded = Math.max(0, 5 - uniqueTalentCount);
  const oshiReady =
    !oshiPreference.enabled ||
    (oshiPreference.talentId !== null &&
      selectedTalents.some(({ card }) => card.talentId === oshiPreference.talentId));
  const oshiRequiresMember =
    oshiPreference.enabled &&
    (oshiPreference.role === "member" || oshiPreference.role === "member-and-leader");
  const oshiMemberAlreadyRequired =
    oshiPreference.talentId !== null && requiredMemberTalentIds.has(oshiPreference.talentId);
  const oshiCapacityConflict =
    oshiRequiresMember && !oshiMemberAlreadyRequired && requiredMemberCardIds.length >= 5;
  const canCalculate = talentsNeeded === 0 && oshiReady && !oshiCapacityConflict;

  const normalizedQuery = query.trim().toLowerCase();
  const visibleCards = cards
    .filter((card) => rarity === "all" || String(card.rarity) === rarity)
    .filter((card) => attribute === "all" || card.attribute === attribute)
    .filter((card) =>
      normalizedQuery.length === 0
        ? true
        : `${card.talentName} ${card.title} ${card.outfitName}`.toLowerCase().includes(normalizedQuery),
    );
  const visibleFiveStarCards = visibleCards.filter((card) => card.rarity === 5);
  const visibleFourStarCards = visibleCards.filter((card) => card.rarity === 4);

  const invalidateCalculation = () => {
    activeTask.current?.cancel();
    activeTask.current = null;
    setCalculationState({ status: "idle" });
  };

  const toggleOwned = (cardId: string) => {
    invalidateCalculation();
    if (cardId in ownedCards) {
      const next = { ...ownedCards };
      delete next[cardId];
      setOwnedCards(next);
      setRequiredMemberCardIds((current) => current.filter((requiredCardId) => requiredCardId !== cardId));
      const removedTalentId = cardById.get(cardId)?.talentId;
      if (
        oshiPreference.talentId === removedTalentId &&
        !Object.keys(next).some((ownedCardId) => cardById.get(ownedCardId)?.talentId === removedTalentId)
      ) {
        setOshiPreference((current) => ({ ...current, talentId: null }));
      }
      return;
    }
    setOwnedCards({ ...ownedCards, [cardId]: 0 });
  };

  const setBloom = (cardId: string, bloomStage: BloomStage) => {
    invalidateCalculation();
    setOwnedCards((current) => ({ ...current, [cardId]: bloomStage }));
  };

  const toggleRequiredMember = (cardId: string) => {
    const card = cardById.get(cardId);
    if (!card || !(cardId in ownedCards)) return;
    invalidateCalculation();
    setRequiredMemberCardIds((current) => {
      if (current.includes(cardId)) return current.filter((requiredCardId) => requiredCardId !== cardId);
      if (current.length >= 5 || current.some((requiredCardId) => cardById.get(requiredCardId)?.talentId === card.talentId)) {
        return current;
      }
      return [...current, cardId].sort();
    });
  };

  const updateOshi = (next: Partial<StoredOshiPreference>) => {
    invalidateCalculation();
    setOshiPreference((current) => ({ ...current, ...next }));
  };

  const runCalculation = () => {
    if (calculationState.status === "calculating") {
      activeTask.current?.cancel();
      activeTask.current = null;
      setCalculationState({ status: "idle" });
      return;
    }
    if (!canCalculate) return;

    // Seed from the last successful result even after roster/Oshi/lock edits
    // invalidate the visible state — that cross-input re-run is exactly the
    // case the seed guarantee exists for. Core validates the seed against the
    // new inputs and drops it (reported, not an error) when it is no longer
    // legal.
    const previousResult = lastResult.current;
    setCalculationState({ status: "calculating" });
    const task = startTeamCalculation({
      schemaVersion: 5,
      rosterCommit,
      ownedCards: selectedCards.map(({ card, bloomStage }) => ({ cardId: card.id, bloomStage })),
      requiredMemberCardIds: [...requiredMemberCardIds].sort(),
      searchEffort: "thorough",
      ...(previousResult
        ? {
            seedCandidates: [{
              leaderOutfitCardId: previousResult.leader.cardId,
              memberCardIds: previousResult.members.map((member) => member.cardId),
            }],
          }
        : {}),
      ...(oshiPreference.enabled && oshiPreference.talentId
        ? { oshi: { talentId: oshiPreference.talentId, role: oshiPreference.role } }
        : {}),
    });
    activeTask.current = task;
    void task.result.then((result) => {
      if (activeTask.current !== task) return;
      activeTask.current = null;
      lastResult.current = result;
      setCalculationState({ status: "done", result });
      window.requestAnimationFrame(() => {
        resultAnchor.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "start",
        });
      });
    }).catch((error: unknown) => {
      if (activeTask.current !== task) return;
      activeTask.current = null;
      if (error instanceof TeamCalculatorWorkerError && error.code === "cancelled") return;
      setCalculationState({
        status: "error",
        message: error instanceof Error ? error.message : "The team calculation could not finish.",
      });
      window.requestAnimationFrame(() => {
        resultAnchor.current?.scrollIntoView({ behavior: "auto", block: "start" });
      });
    });
  };

  const calculateLabel = talentsNeeded > 0
    ? `Add ${talentsNeeded} more ${talentsNeeded === 1 ? "talent" : "talents"}`
    : !oshiReady
      ? "Choose your Oshi"
      : oshiCapacityConflict
        ? "Unlock a required Member"
    : calculationState.status === "calculating"
      ? "Cancel calculation"
      : "Calculate team";

  return (
    <div className={styles.workspace}>
      <div className={styles.mainColumn}>
        <section className={styles.rosterPanel} aria-busy={!storageReady} aria-labelledby="owned-cards-heading">
          <header className={styles.rosterHeading}>
            <div className={styles.stepHeading}>
              <span>01</span>
              <div>
                <h2 id="owned-cards-heading">Add the cards you own</h2>
                <p>Cards use max-level stats. Bloom 1–4 applies Live skill and stat upgrades; Bloom 5 Connect bonuses depend on your Board and are not included. New selections start at Bloom 0.</p>
              </div>
            </div>
            <div className={styles.rosterCount}><strong>{selectedCards.length}</strong><span>selected</span></div>
          </header>

          <div className={styles.filterBar}>
            <label className={styles.cardSearch}>
              <Search aria-hidden="true" />
              <span className="sr-only">Search cards</span>
              <input
                onChange={(event) => setFilter("q", event.target.value, "")}
                placeholder="Search talent, card, or Outfit…"
                type="search"
                value={query}
              />
              {query && <button aria-label="Clear card search" onClick={() => setFilter("q", "", "")} type="button"><X aria-hidden="true" /></button>}
            </label>
            <div className={styles.segmentedFilter} aria-label="Rarity filter" role="group">
              {["all", "5", "4"].map((value) => (
                <button aria-pressed={rarity === value} key={value} onClick={() => setFilter("rarity", value)} type="button">
                  {value === "all" ? "All" : `${value}★`}
                </button>
              ))}
            </div>
            <label className={styles.typeFilter}>
              <span>Type</span>
              <select aria-label="Card type" onChange={(event) => setFilter("attribute", event.target.value)} value={attribute}>
                <option value="all">All</option>
                <option value="cute">Cute</option>
                <option value="pure">Pure</option>
                <option value="happy">Happy</option>
              </select>
            </label>
            <span aria-atomic="true" aria-live="polite" className={styles.visibleCount}>{visibleCards.length} / {cards.length}</span>
          </div>

          <div className={styles.rarityGroups}>
            {[
              { rarity: 5 as const, label: "5★ Member cards", cards: visibleFiveStarCards },
              { rarity: 4 as const, label: "4★ Member cards", cards: visibleFourStarCards },
            ].filter((group) => group.cards.length > 0).map((group) => (
              <section className={styles.rarityGroup} data-rarity={group.rarity} key={group.rarity}>
                <header>
                  <h3>{group.label}</h3>
                  <strong>{group.cards.length}</strong>
                </header>
                <div className={styles.cardGrid}>
                  {group.cards.map((card, index) => {
                    const selected = card.id in ownedCards;
                    const bloomStage = ownedCards[card.id] ?? 0;
                    const eagerIndex = index + (group.rarity === 4 ? visibleFiveStarCards.length : 0);
                    return (
                      <article
                        className={`${styles.cardTile} ${selected ? styles.cardTileSelected : ""}`}
                        key={card.id}
                        style={{ "--card-accent": card.color } as CSSProperties}
                      >
                        <button
                          aria-label={`${selected ? "Remove" : "Add"} ${card.talentName}, ${card.title}, ${card.rarity} star card`}
                          aria-pressed={selected}
                          className={styles.cardSelect}
                          disabled={!storageReady}
                          onClick={() => toggleOwned(card.id)}
                          type="button"
                        >
                          <Image
                            alt=""
                            fill
                            loading={eagerIndex < 18 ? "eager" : "lazy"}
                            sizes="(max-width: 560px) 30vw, (max-width: 900px) 20vw, 130px"
                            src={card.artPath}
                          />
                          <span className={styles.rarityBadge}>{card.rarity}★</span>
                          <span className={styles.selectedBadge}><Check aria-hidden="true" /></span>
                        </button>
                        <div className={styles.cardIdentity}>
                          <small><i className={styles[card.attribute]} /> {card.attribute}</small>
                          <strong>{card.talentName}</strong>
                          <span>{card.title}</span>
                        </div>
                        {selected ? (
                          <label className={styles.bloomControl}>
                            <span>Bloom</span>
                            <select
                              aria-label={`${card.talentName}, ${card.title} Bloom level`}
                              onChange={(event) => setBloom(card.id, Number(event.target.value) as BloomStage)}
                              value={bloomStage}
                            >
                              {BLOOM_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                            </select>
                          </label>
                        ) : <span className={styles.addHint}>Select card</span>}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {visibleCards.length === 0 && (
            <div className={styles.emptyCards}>
              <Search aria-hidden="true" />
              <h3>No matching cards</h3>
              <button onClick={() => {
                const next = new URLSearchParams(pendingSearch.current);
                next.delete("q");
                next.delete("rarity");
                next.delete("attribute");
                const nextQuery = next.toString();
                pendingSearch.current = nextQuery;
                setFilters({ query: "", rarity: "all", attribute: "all" });
                window.history.replaceState(
                  window.history.state,
                  "",
                  nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname,
                );
              }} type="button">Reset card filters</button>
            </div>
          )}
        </section>

        <section className={styles.oshiPanel} data-enabled={oshiPreference.enabled}>
          <header>
            <div className={styles.oshiHeadingIcon}><Heart aria-hidden="true" /></div>
            <div>
              <span>Optional constraint</span>
              <h2>Oshi mode</h2>
              <p>Keep one favorite in the recommendation.</p>
            </div>
            <button
              aria-checked={oshiPreference.enabled}
              aria-label="Oshi mode"
              className={styles.oshiToggle}
              onClick={() => updateOshi({ enabled: !oshiPreference.enabled })}
              role="switch"
              type="button"
            >
              <span />
              {oshiPreference.enabled ? "On" : "Off"}
            </button>
          </header>

          {oshiPreference.enabled && (
            <div className={styles.oshiControls}>
              <div className={styles.oshiTalentPicker}>
                <span className={styles.oshiTalentArt}>
                  {selectedOshiTalent ? (
                    <Image alt="" fill sizes="44px" src={selectedOshiTalent.card.artPath} />
                  ) : <Heart aria-hidden="true" />}
                </span>
                <label>
                  <span>Favorite talent</span>
                  <select
                    aria-label="Oshi talent"
                    onChange={(event) => updateOshi({ talentId: event.target.value || null })}
                    value={oshiPreference.talentId ?? ""}
                  >
                    <option value="">{selectedTalents.length > 0 ? "Choose from your roster" : "Add an owned card first"}</option>
                    {selectedTalents.map(({ card }) => (
                      <option key={card.talentId} value={card.talentId}>{card.talentName}</option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset>
                <legend>Required role</legend>
                <div className={styles.oshiRoles}>
                  {([
                    ["member", "Member", "One of the five"],
                    ["leader", "Leader", "Use their Outfit"],
                    ["member-and-leader", "Both", "Member and Leader"],
                  ] as const satisfies ReadonlyArray<readonly [StoredOshiRole, string, string]>).map(([role, label, hint]) => (
                    <button
                      aria-pressed={oshiPreference.role === role}
                      key={role}
                      onClick={() => updateOshi({ role })}
                      type="button"
                    >
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <p className={styles.oshiHelp}>
                The calculator evaluates your owned versions for the required role and builds the remaining slots around the selected one.
              </p>
            </div>
          )}
        </section>

        <section className={styles.requiredPanel} aria-labelledby="required-members-heading">
          <header>
            <div>
              <span>Lineup locks</span>
              <h2 id="required-members-heading">Required Members</h2>
              <p>Keep specific owned cards in the five-Member formation.</p>
            </div>
            <strong>{requiredMemberCardIds.length}/5</strong>
          </header>
          <div className={styles.requiredMemberGrid}>
            {selectedCards.length === 0 ? (
              <p>Select owned cards first, then mark the cards to keep.</p>
            ) : selectedCards.map(({ card }) => {
              const required = requiredMemberIdSet.has(card.id);
              const duplicateTalentLock = !required && requiredMemberTalentIds.has(card.talentId);
              const lockCapacityReached = !required && requiredMemberCardIds.length >= 5;
              const disabledReason = duplicateTalentLock
                ? "Only one card version per talent can be required."
                : lockCapacityReached
                  ? "All five Member slots are already locked."
                  : undefined;
              return (
                <button
                  aria-describedby="required-members-help"
                  aria-label={`${required ? "Unrequire" : "Require"} ${card.talentName}, ${card.title}`}
                  aria-pressed={required}
                  className={styles.requiredMemberToggle}
                  disabled={!storageReady || duplicateTalentLock || lockCapacityReached}
                  key={card.id}
                  onClick={() => toggleRequiredMember(card.id)}
                  title={disabledReason}
                  type="button"
                >
                  <Image alt="" height={42} src={card.artPath} width={42} />
                  <span><strong>{card.talentName}</strong><small>{card.title}</small></span>
                  <b>{required ? "Required" : duplicateTalentLock ? "Same talent" : lockCapacityReached ? "Full" : "Require"}</b>
                </button>
              );
            })}
          </div>
          <p className={styles.requiredHelp} id="required-members-help">
            {oshiCapacityConflict
              ? "Your Oshi needs one remaining Member slot. Unlock one required card or require the Oshi card."
              : requiredMemberCardIds.length >= 5
                ? "All five Member slots are locked. Unlock one to require a different card."
              : "Only one version of each talent can be required; locked cards stay selected in every calculation."}
          </p>
        </section>

        <div className={styles.resultAnchor} ref={resultAnchor}>
          {calculationState.status === "calculating" && (
            <section className={styles.calculatingPanel} aria-live="polite">
              <span className={styles.calculatingPulse} />
              <div><strong>Evaluating your roster</strong><small>Comparing legal Leaders, Members, Bloom levels, Oshi constraints, and team links…</small></div>
            </section>
          )}
          {calculationState.status === "error" && (
            <section className={styles.calculationError} role="alert">
              <strong>Calculation stopped</strong><p>{calculationState.message}</p><button onClick={runCalculation} type="button">Try again</button>
            </section>
          )}
          {calculationState.status === "done" && (
            <TeamResult key={calculationState.result.search.runRecordId} result={calculationState.result} />
          )}
        </div>
      </div>

      <aside className={styles.selectionRail} aria-label="Selected roster">
        <header>
          <div><span>Your roster</span><strong>{selectedCards.length} {selectedCards.length === 1 ? "card" : "cards"}</strong></div>
              {selectedCards.length > 0 && <button aria-label="Clear selected roster" onClick={() => {
                invalidateCalculation();
                setOwnedCards({});
                setRequiredMemberCardIds([]);
                setOshiPreference(emptyTeamRoster(rosterCommit).oshi);
              }} type="button"><Trash2 aria-hidden="true" /> Clear</button>}
        </header>

        <div className={styles.talentGate} data-ready={talentsNeeded === 0}>
          {talentsNeeded === 0 ? <BadgeCheck aria-hidden="true" /> : <span>{uniqueTalentCount}</span>}
          <div><strong>{talentsNeeded === 0 ? "Roster ready" : `${uniqueTalentCount} / 5 talents`}</strong><small>{talentsNeeded === 0 ? "Five unique Members available" : "A team cannot repeat a talent"}</small></div>
        </div>

        <div className={styles.selectedList}>
          {selectedCards.length === 0 ? (
            <p>Select a card to add it here.</p>
          ) : selectedCards.map(({ card, bloomStage }) => (
            <div className={styles.selectedCard} key={card.id}>
              <Image alt="" height={42} src={card.artPath} width={42} />
              <span><strong>{card.talentName}</strong><small>{card.title}</small></span>
              <b>B{bloomStage}</b>
              <button aria-label={`Remove ${card.talentName}, ${card.title}`} onClick={() => toggleOwned(card.id)} type="button"><X aria-hidden="true" /></button>
            </div>
          ))}
        </div>

        <button className={styles.calculateButton} disabled={!storageReady || (!canCalculate && calculationState.status !== "calculating")} onClick={runCalculation} type="button">
          <Calculator aria-hidden="true" /> {calculateLabel}
        </button>
        <p className={styles.savedState}><Check aria-hidden="true" /> {storageStatus === "persistent" ? "Roster saved on this device" : storageStatus === "session" ? "Roster changes stay on this page" : "Loading saved roster…"}</p>
      </aside>

      <div className={styles.mobileAction}>
        <div>
          <strong>{selectedCards.length} {selectedCards.length === 1 ? "card" : "cards"} · {uniqueTalentCount}/5 talents</strong>
          <span>{canCalculate ? "Ready to calculate" : talentsNeeded > 0 ? "Select five unique talents" : oshiCapacityConflict ? "Unlock a required Member" : "Choose your Oshi"}</span>
        </div>
        <button aria-label={calculateLabel} disabled={!storageReady || (!canCalculate && calculationState.status !== "calculating")} onClick={runCalculation} type="button">
          <Calculator aria-hidden="true" /> {calculationState.status === "calculating" ? "Cancel" : oshiCapacityConflict ? "Unlock Member" : !oshiReady && talentsNeeded === 0 ? "Set Oshi" : "Calculate"}
        </button>
      </div>

    </div>
  );
}
