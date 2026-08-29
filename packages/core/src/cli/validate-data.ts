import { publicData, publicCards } from "../public-data";
import { mechanicsData, type MechanicsData } from "../mechanics";
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

function assertBoardCatalogs(catalogs: MechanicsData["catalogs"], publicTalentIds: Set<string>) {
  const nodeGroupIds = [...new Set(catalogs.boardNodes.map((node) => node.groupId))].sort();
  const positionModels = [...new Set(catalogs.boardNodePositions.map((position) => position.treeModelId))].sort();
  if (nodeGroupIds.length !== 153 || positionModels.length !== 4) {
    throw new Error("Board catalog must contain 153 node groups and four tree models.");
  }

  const positionsByModel = new Map<string, Map<string, { x: number; y: number }>>();
  for (const position of catalogs.boardNodePositions) {
    const model = positionsByModel.get(position.treeModelId) ?? new Map();
    if (model.has(position.nodeGroupId)) {
      throw new Error(`Duplicate Board position for ${position.treeModelId}/${position.nodeGroupId}.`);
    }
    model.set(position.nodeGroupId, { x: position.x, y: position.y });
    positionsByModel.set(position.treeModelId, model);
  }

  const edgeSets = positionModels.map((modelId) => {
    const positions = positionsByModel.get(modelId);
    if (!positions || positions.size !== 153) {
      throw new Error(`${modelId} must contain exactly 153 Board positions.`);
    }
    const cells = new Set([...positions.values()].map((cell) => `${cell.x},${cell.y}`));
    if (cells.size !== positions.size) {
      throw new Error(`${modelId} contains duplicate Board grid cells.`);
    }
    for (const groupId of nodeGroupIds) {
      if (!positions.has(groupId)) {
        throw new Error(`${modelId} is missing the ${groupId} Board position.`);
      }
    }
    const edges = new Set<string>();
    for (let leftIndex = 0; leftIndex < nodeGroupIds.length; leftIndex += 1) {
      const leftId = nodeGroupIds[leftIndex]!;
      const left = positions.get(leftId)!;
      for (let rightIndex = leftIndex + 1; rightIndex < nodeGroupIds.length; rightIndex += 1) {
        const rightId = nodeGroupIds[rightIndex]!;
        const right = positions.get(rightId)!;
        if (Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1) {
          edges.add(`${leftId}~${rightId}`);
        }
      }
    }
    return edges;
  });

  const canonicalEdges = edgeSets[0]!;
  if (canonicalEdges.size !== 172 || edgeSets.some((edges) => edges.size !== canonicalEdges.size)) {
    throw new Error("Board adjacency must contain 172 edges in every tree model.");
  }
  for (const edges of edgeSets.slice(1)) {
    if ([...canonicalEdges].some((edge) => !edges.has(edge))) {
      throw new Error("Board adjacency edge sets differ between tree models.");
    }
  }
  const neighbors = new Map<string, Set<string>>(nodeGroupIds.map((groupId) => [groupId, new Set()]));
  for (const edge of canonicalEdges) {
    const [leftId, rightId] = edge.split("~");
    neighbors.get(leftId!)!.add(rightId!);
    neighbors.get(rightId!)!.add(leftId!);
  }
  const reached = new Set<string>(["S-001"]);
  const queue = ["S-001"];
  for (let index = 0; index < queue.length; index += 1) {
    for (const neighbor of neighbors.get(queue[index]!) ?? []) {
      if (!reached.has(neighbor)) {
        reached.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  if (reached.size !== 153) {
    throw new Error(`Board adjacency is not connected from S-001 (${reached.size}/153).`);
  }

  const poolTalentIds = catalogs.boardPointPools.map((pool) => pool.talentId);
  if (
    new Set(poolTalentIds).size !== poolTalentIds.length ||
    poolTalentIds.length !== publicTalentIds.size ||
    poolTalentIds.some((talentId) => !publicTalentIds.has(talentId))
  ) {
    throw new Error("Board point pools do not match the current public talent set.");
  }

  const profileTalentIds = catalogs.talentBoardProfiles.map((profile) => profile.talentId);
  if (
    new Set(profileTalentIds).size !== profileTalentIds.length ||
    profileTalentIds.length !== publicTalentIds.size ||
    profileTalentIds.some((talentId) => !publicTalentIds.has(talentId))
  ) {
    throw new Error("Talent Board tree-model profiles do not match the current public talent set.");
  }
  for (const profile of catalogs.talentBoardProfiles) {
    if (!positionsByModel.has(profile.treeModelId)) {
      throw new Error(`Talent ${profile.talentId} references unknown tree model ${profile.treeModelId}.`);
    }
  }

  const nodesByGroup = new Map<string, typeof catalogs.boardNodes>();
  for (const node of catalogs.boardNodes) {
    const group = nodesByGroup.get(node.groupId) ?? [];
    group.push(node);
    nodesByGroup.set(node.groupId, group);
  }
  const resolveNode = (groupId: string, talentId: string) => {
    const group = nodesByGroup.get(groupId)!;
    if (group.length === 1) return group[0]!;
    const talentVariant = group.filter((node) => node.characterIds.includes(talentId));
    if (talentVariant.length === 1) return talentVariant[0]!;
    const defaultVariant = group.filter((node) => node.characterIds.length === 0);
    if (talentVariant.length === 0 && defaultVariant.length === 1) return defaultVariant[0]!;
    throw new Error(`Board node variant is ambiguous for ${groupId}/${talentId}.`);
  };
  for (const talentId of poolTalentIds) {
    let wholeBoardCost = 0;
    let inScopeCost = 0;
    for (const groupId of nodeGroupIds) {
      const node = resolveNode(groupId, talentId);
      wholeBoardCost += node.pointCost;
      if (["leader", "card", "connection"].includes(node.kind)) inScopeCost += node.pointCost;
    }
    if (wholeBoardCost !== 450 || inScopeCost !== 301) {
      throw new Error(
        `Board cost drift for ${talentId}: expected 450/301, got ${wholeBoardCost}/${inScopeCost}.`,
      );
    }
  }

  console.log(
    `Board validation: ${poolTalentIds.length} pools, ${positionModels.length}x153 positions, ` +
      `${canonicalEdges.size} invariant connected edges, uniform costs 450 whole/301 leader+card+connection.`,
  );
}

assertBoardCatalogs(
  mechanicsData.catalogs,
  new Set(publicCards.map((card) => card.talentId)),
);

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
    `${publicIds.size} cards, ${nativeGuideData.guides.length} generated guides.`,
);
console.log(
  `Exact optimizer scope valid: ${exactOptimizerScope.scopeHash}, ` +
    `${exactOptimizerScope.eligibility.eligibleMemberCardIds.length} Member and ` +
    `${exactOptimizerScope.chartCorpus.entries.length} chart inputs pinned.`,
);
