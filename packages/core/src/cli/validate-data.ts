import { publicData, publicCards } from "../public-data";
import { mechanicsData } from "../mechanics";
import { nativeGuideData } from "../native-guide-data";
import { nativeRankingData } from "../native-ranking-data";
import { nativeRankingChangelogData } from "../native-ranking-changelog-data";
import { nativeRankingBenchmark } from "../native-ranking-benchmark";
import { chartTimelineData } from "../chart-timelines";
import { rankingCorpusTimelineData } from "../ranking-corpus-timelines";
import { assertRelativeUtilityModelValidationCurrent } from "../relative-utility-model-validation";
import {
  guideRatingTimelineByKey,
  guideRatingTimelineData,
  guideRatingTimelineUnavailableByKey,
} from "../guide-rating-timelines";
import { songContextData } from "../song-contexts";
import { exactOptimizerScope } from "../exact-optimizer-scope";

assertRelativeUtilityModelValidationCurrent();

const sampleIds = [
  "card-00013-5-uniq-0002-00",
  "card-00012-5-uniq-0062-00",
  "card-06003-4-cmmn-0000-00",
];

for (const id of sampleIds) {
  if (!publicCards.some((card) => card.id === id)) {
    throw new Error(`Pinned representative card is missing: ${id}`);
  }
}

const azki = publicCards.find((card) => card.id === "card-00013-5-uniq-0002-00");
if (
  !azki ||
  azki.attribute !== "pure" ||
  azki.parameters.maxPotential.performance !== 6803 ||
  azki.parameters.maxPotential.technique !== 7682 ||
  azki.parameters.maxPotential.sense !== 11380
) {
  throw new Error("AZKi golden record no longer matches the pinned data and AppMedia corroboration.");
}

if (publicCards.some((card) => /research slot|illustrative/i.test(`${card.title} ${card.talentName}`))) {
  throw new Error("Synthetic research fixtures are not allowed in the public dataset.");
}

const publicIds = new Set(publicCards.map((card) => card.id));
for (const [context, lenses] of [
  ["Member", nativeRankingData.lenses],
  ["Leader/Outfit", nativeRankingData.leaderOutfitLenses],
] as const) {
  for (const lens of lenses) {
    const rankedIds = new Set(lens.entries.map((entry) => entry.cardId));
    if (rankedIds.size !== publicIds.size || [...publicIds].some((id) => !rankedIds.has(id))) {
      throw new Error(`${context} ${lens.label} does not rank the exact pinned public roster.`);
    }
  }
}
if (nativeRankingData.rosterCommit !== mechanicsData.sourceSnapshot.commit) {
  throw new Error("Native ranking snapshot and mechanics catalog use different roster commits.");
}
if (nativeRankingData.absoluteScoreAvailable) {
  throw new Error("An absolute score cannot be published before the runtime equation is validated.");
}
if (
  nativeRankingChangelogData.to.snapshotId !== nativeRankingData.snapshotId ||
  nativeRankingChangelogData.to.generatedAt !== nativeRankingData.generatedAt ||
  nativeRankingChangelogData.to.methodologyVersion !== nativeRankingData.methodologyVersion
) {
  throw new Error("Native ranking changelog does not end at the published ranking snapshot.");
}

const aggregateCharts = songContextData.charts.filter((chart) => chart.fidelity === "aggregate");
const aggregateChartByKey = new Map(aggregateCharts.map((chart) => [chart.key, chart] as const));
const exactChartByKey = new Map(chartTimelineData.charts.map((chart) => [chart.key, chart] as const));
const unavailableChartByKey = new Map(
  chartTimelineData.unavailableCharts.map((chart) => [chart.key, chart] as const),
);
if (
  chartTimelineData.charts.length + chartTimelineData.unavailableCharts.length !==
  aggregateCharts.length
) {
  throw new Error("Exact and unavailable chart timelines do not cover the aggregate chart catalog.");
}
for (const aggregate of aggregateCharts) {
  const exact = exactChartByKey.get(aggregate.key);
  const unavailable = unavailableChartByKey.get(aggregate.key);
  if (Boolean(exact) === Boolean(unavailable)) {
    throw new Error(`${aggregate.key} must have exactly one chart timeline availability state.`);
  }
  const timeline = exact ?? unavailable!;
  if (
    timeline.upstreamChartHash !== aggregate.chartHash ||
    timeline.fullComboNoteCount !== aggregate.fullComboNoteCount
  ) {
    throw new Error(`${aggregate.key} timeline drifted from the pinned aggregate chart.`);
  }
  if (
    exact &&
    (exact.normalNoteCount !== aggregate.normalNoteCount ||
      exact.level !== aggregate.level ||
      exact.chartAssetId !== aggregate.chartAssetId)
  ) {
    throw new Error(`${aggregate.key} exact timeline metadata drifted from the aggregate chart.`);
  }
}

const frozenBenchmarkEntries = [
  ...nativeRankingBenchmark.corpus.reference,
  ...nativeRankingBenchmark.corpus.current,
];
if (rankingCorpusTimelineData.charts.length !== frozenBenchmarkEntries.length) {
  throw new Error("Compact ranking timelines do not cover the frozen benchmark corpus.");
}
for (const entry of frozenBenchmarkEntries) {
  const compact = rankingCorpusTimelineData.charts.find((chart) => chart.key === entry.chartKey);
  const exact = exactChartByKey.get(entry.chartKey);
  if (
    !compact ||
    !exact ||
    compact.expectedChartHash !== entry.expectedChartHash ||
    compact.expectedChartHash !== exact.upstreamChartHash ||
    compact.fullComboNoteCount !== exact.fullComboNoteCount ||
    compact.events.length !== exact.events.length ||
    compact.feverMarkerMicroseconds.chargeStart !== exact.feverMarkerMicroseconds?.chargeStart ||
    compact.feverMarkerMicroseconds.chargeEnd !== exact.feverMarkerMicroseconds?.chargeEnd ||
    compact.feverMarkerMicroseconds.feverStart !== exact.feverMarkerMicroseconds?.feverStart ||
    compact.feverMarkerMicroseconds.feverEnd !== exact.feverMarkerMicroseconds?.feverEnd ||
    compact.source.susSha256 !== exact.source.sus.sha256 ||
    compact.source.metadataSha256 !== exact.source.metadata.sha256
  ) {
    throw new Error(`${entry.chartKey} compact ranking timeline drifted from its exact source.`);
  }
}

const publishedGuideChartKeys = new Set(
  nativeGuideData.guides.flatMap((guide) =>
    guide.ratingSongComparisons.map((comparison) => comparison.chartKey),
  ),
);
const projectedGuideChartKeys = new Set([
  ...guideRatingTimelineData.charts.map((chart) => chart.key),
  ...guideRatingTimelineData.unavailableCharts.map((chart) => chart.key),
]);
if (
  publishedGuideChartKeys.size !== projectedGuideChartKeys.size ||
  [...publishedGuideChartKeys].some((chartKey) => !projectedGuideChartKeys.has(chartKey))
) {
  throw new Error("Compact guide timelines do not cover the published rating-song set.");
}
for (const guide of nativeGuideData.guides) {
  for (const comparison of guide.ratingSongComparisons) {
    if (comparison.noteTimeline === "unavailable") {
      const unavailable = guideRatingTimelineUnavailableByKey.get(comparison.chartKey);
      const sourceUnavailable = unavailableChartByKey.get(comparison.chartKey);
      if (
        !unavailable ||
        !sourceUnavailable ||
        unavailable.expectedChartHash !== sourceUnavailable.upstreamChartHash ||
        unavailable.fullComboNoteCount !== sourceUnavailable.fullComboNoteCount ||
        unavailable.reason !== sourceUnavailable.reason ||
        comparison.orderStatus !== "indeterminate" ||
        comparison.comparisonMode !== "aggregate-formation-only" ||
        (comparison.advantageOverReferencePercent !== null) !== comparison.changesReferenceFormation
      ) {
        throw new Error(`${guide.slug}/${comparison.chartKey} unavailable comparison evidence drifted.`);
      }
      continue;
    }
    const compact = guideRatingTimelineByKey.get(comparison.chartKey);
    const exact = exactChartByKey.get(comparison.chartKey);
    if (
      !compact ||
      !exact ||
      compact.expectedChartHash !== exact.upstreamChartHash ||
      comparison.formationOrderTimelineFidelity !== "exact-timed" ||
      comparison.noteTimeline !== "exact" ||
      comparison.formationOrderModel.corpusChartCount !== 1 ||
      comparison.timelineEvidence.susSha256 !== compact.source.susSha256 ||
      comparison.timelineEvidence.metadataSha256 !== compact.source.metadataSha256 ||
      comparison.timelineEvidence.specialMarkerMicroseconds.join(",") !==
        compact.specialMarkerMicroseconds.join(",") ||
      comparison.timelineEvidence.feverMarkerMicroseconds.chargeStart !==
        compact.feverMarkerMicroseconds.chargeStart ||
      comparison.timelineEvidence.feverMarkerMicroseconds.chargeEnd !==
        compact.feverMarkerMicroseconds.chargeEnd ||
      comparison.timelineEvidence.feverMarkerMicroseconds.feverStart !==
        compact.feverMarkerMicroseconds.feverStart ||
      comparison.timelineEvidence.feverMarkerMicroseconds.feverEnd !==
        compact.feverMarkerMicroseconds.feverEnd
    ) {
      throw new Error(`${guide.slug}/${comparison.chartKey} exact order evidence drifted.`);
    }
  }
}

for (const guide of nativeGuideData.guides) {
  const anchor = publicCards.find((card) => card.id === guide.anchorCardId);
  if (!anchor || anchor.rarity !== 5 || anchor.talentId !== guide.anchorTalentId) {
    throw new Error(`${guide.slug} does not resolve to its exact 5-star anchor.`);
  }
  if (guide.snapshotId !== nativeRankingData.snapshotId) {
    throw new Error(`${guide.slug} was not generated against the published ranking snapshot.`);
  }
  for (const formation of guide.formations) {
    const leader = publicCards.find((card) => card.id === formation.leaderOutfitCardId);
    const members = formation.members.map((member) => publicCards.find((card) => card.id === member.cardId));
    if (!leader || members.some((card) => !card)) {
      throw new Error(`${guide.slug}/${formation.kind} references a missing card.`);
    }
    const talents = new Set(members.map((card) => card!.talentId));
    if (talents.size !== 5 || !members.some((card) => card!.id === guide.anchorCardId)) {
      throw new Error(`${guide.slug}/${formation.kind} is not a legal anchored five-Member team.`);
    }
    if (
      formation.kind === "accessible-4-star" &&
      (leader.rarity !== 4 || members.filter((card) => card!.rarity === 5).length > 1)
    ) {
      throw new Error(`${guide.slug} does not satisfy its 4-star-accessible constraint.`);
    }
    const expectedStatic = {
      lower: formation.staticParameters.base.lower + formation.staticParameters.leaderAndPassiveGain.lower,
      central: formation.staticParameters.base.central + formation.staticParameters.leaderAndPassiveGain.central,
      upper: formation.staticParameters.base.upper + formation.staticParameters.leaderAndPassiveGain.upper,
    };
    if (
      (Object.keys(expectedStatic) as Array<keyof typeof expectedStatic>).some(
        (key) => Math.abs(expectedStatic[key] - formation.staticParameters.effective[key]) > 0.000_001,
      )
    ) {
      throw new Error(`${guide.slug}/${formation.kind} static parameter arithmetic does not reconcile.`);
    }
    if (formation.replacements.some((replacement) => replacement.lossPercent.central < -0.000_001)) {
      throw new Error(`${guide.slug}/${formation.kind} is locally dominated by a listed replacement.`);
    }
  }
}

console.log(
  `Public dataset valid: ${publicData.counts.talents} talents, ` +
    `${publicData.counts.fiveStar} five-star cards, ${publicData.counts.fourStar} four-star cards, ` +
    `${publicData.counts.art} local art mappings.`,
);
console.log(`Pinned ENG ${publicData.sourceSnapshots.english.commit}; JPN ${publicData.sourceSnapshots.japanese.commit}.`);
console.log(
  `Mechanics catalog valid: ${mechanicsData.coverage.mappedCards}/${mechanicsData.coverage.cards} cards mapped, ` +
    `${mechanicsData.coverage.unresolvedReferences.length} unresolved references.`,
);
console.log(
  `Song contexts valid: ${songContextData.counts.songs} songs, ` +
    `${songContextData.counts.aggregateCharts} aggregate charts, ` +
    `${songContextData.counts.timedCharts} timed charts.`,
);
console.log(
  `Exact chart timelines valid: ${chartTimelineData.counts.charts} available, ` +
    `${chartTimelineData.counts.unavailableCharts} unavailable, ` +
    `${chartTimelineData.counts.events} timed events; ` +
    `${rankingCorpusTimelineData.counts.charts} frozen ranking charts and ` +
    `${guideRatingTimelineData.counts.charts} published guide charts projected.`,
);
console.log(
  `Native output valid: 2 ranking contexts x ${nativeRankingData.lenses.length} lenses x ` +
    `${publicIds.size} cards, ${nativeGuideData.guides.length} generated guide.`,
);
console.log(
  `Exact optimizer scope valid: ${exactOptimizerScope.scopeHash}, ` +
    `${exactOptimizerScope.eligibility.eligibleMemberCardIds.length} Member and ` +
    `${exactOptimizerScope.chartCorpus.entries.length} chart inputs pinned.`,
);
