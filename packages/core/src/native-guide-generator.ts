import { mechanicsData } from "./mechanics";
import { recommendFormationOrder } from "./formation-order-recommender";
import {
  guideRatingTimelineByKey,
  resolveGuideRatingTimeline,
} from "./guide-rating-timelines";
import {
  NativeGuideDataSchema,
  NativeGuideFormationSchema,
  type NativeGuideData,
  type NativeGuideFormation,
} from "./native-guide-schema";
import { nativeRankingData } from "./native-ranking-data";
import { nativeRankingBenchmark } from "./native-ranking-benchmark";
import type { NativeRankingChangelog } from "./native-ranking-changelog";
import { type SerializableInterval } from "./native-ranking-schema";
import { searchNativeLegalTeams, type NativeSearchResult } from "./native-search";
import {
  divideUtilityIntervals,
  evaluateNativeRelativeUtility,
  type NativeUtilityResult,
  type UtilityInterval,
} from "./native-utility";
import { publicCardById, publicCards } from "./public-data";
import {
  ratingSongsForTalent,
  songContextData,
  type SongContext,
} from "./song-contexts";

export const DEFAULT_GUIDE_ANCHOR_CARD_ID = "card-00013-5-uniq-0002-00";
const SEED = 0x5eed;
const BOARD = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "methodology:neutral-board-v1",
  },
} as const;

type FormationKind = "premium" | "standard" | "accessible-4-star";
type Investment = "one-copy-maximum" | "duplicate-enabled-ceiling";

const PROGRESSION_LENSES = {
  "one-copy-maximum": {
    id: "level-cap-bloom-0-skill-1-connect-1",
    label: "Level cap · Bloom 0 · skills Lv.1 · Connect Lv.1",
    level: "card-level-cap",
    bloomStage: 0,
    allParametersUpPermil: 0,
    activeSkillLevel: 1,
    passiveSkillLevel: 1,
    specialSkillLevel: 1,
    connectEffectLevel: 1,
  },
  "duplicate-enabled-ceiling": {
    id: "level-cap-bloom-5-skill-2-connect-2",
    label: "Level cap · Bloom 5 · skills Lv.2 · Connect Lv.2",
    level: "card-level-cap",
    bloomStage: 5,
    allParametersUpPermil: 100,
    activeSkillLevel: 2,
    passiveSkillLevel: 2,
    specialSkillLevel: 2,
    connectEffectLevel: 2,
  },
} as const;

const BENCHMARK = {
  accountState: "frozen-neutral-public-benchmark",
  platform: "mobile",
  playMode: "manual",
  judgement: "perfect",
  fullCombo: true,
  life: 1_000,
  board: { mode: "neutral", relativeContribution: 0 },
  collection: { memberUpgradeBonusPermyriad: 0 },
  eventBonusPermil: 0,
  targetResolution: "unresolved-enumerated-alternatives",
  scoreClaim: "relative-utility-only",
} as const;

export function utilityIntervalStrictlyDominates(
  candidate: UtilityInterval,
  reference: UtilityInterval,
): boolean {
  return candidate.lower > reference.upper;
}

function serializable(interval: UtilityInterval): SerializableInterval {
  return { lower: interval.lower, central: interval.central, upper: interval.upper };
}

function addIntervals(left: UtilityInterval, right: UtilityInterval): SerializableInterval {
  return {
    lower: left.lower + right.lower,
    central: left.central + right.central,
    upper: left.upper + right.upper,
  };
}

type MemberCardIdTuple = readonly [string, string, string, string, string];

const modeledOrderCache = new Map<string, ReturnType<typeof recommendFormationOrder>>();
const exactSongOrderCache = new Map<string, ReturnType<typeof recommendFormationOrder>>();

function modeledOrderEvaluation(
  leaderOutfitCardId: string,
  memberCardIds: MemberCardIdTuple,
  investment: Investment,
  chartKey: string,
): {
  order: readonly [string, string, string, string, string];
  utility: NativeUtilityResult;
  model: ReturnType<typeof recommendFormationOrder>;
} {
  const bloomStage = PROGRESSION_LENSES[investment].bloomStage;
  const cacheKey = `${leaderOutfitCardId}|${[...memberCardIds].sort().join("|")}|${bloomStage}`;
  let model = modeledOrderCache.get(cacheKey);
  if (!model) {
    model = recommendFormationOrder({
      leaderOutfitCardId,
      members: memberCardIds.map((cardId) => ({ cardId, bloomStage })) as [
        { cardId: string; bloomStage: typeof bloomStage },
        { cardId: string; bloomStage: typeof bloomStage },
        { cardId: string; bloomStage: typeof bloomStage },
        { cardId: string; bloomStage: typeof bloomStage },
        { cardId: string; bloomStage: typeof bloomStage },
      ],
      corpus: [
        ...nativeRankingBenchmark.corpus.reference,
        ...nativeRankingBenchmark.corpus.current,
      ],
    });
    modeledOrderCache.set(cacheKey, model);
  }
  const order = model.order;
  return {
    order,
    model,
    utility: evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId,
        members: order.map((cardId) => ({ cardId, investment })),
      },
      chartKey,
      seed: SEED,
      accountState: BOARD,
    }),
  };
}

function exactSongOrderEvaluation(
  leaderOutfitCardId: string,
  memberCardIds: MemberCardIdTuple,
  investment: Investment,
  chartKey: string,
): ReturnType<typeof recommendFormationOrder> {
  const bloomStage = PROGRESSION_LENSES[investment].bloomStage;
  const projection = resolveGuideRatingTimeline(chartKey);
  if (projection.availability !== "exact") {
    throw new Error(`Exact guide rating timeline is unavailable: ${chartKey}`);
  }
  const timeline = projection.chart;
  const cacheKey = [
    chartKey,
    leaderOutfitCardId,
    [...memberCardIds].sort().join("|"),
    bloomStage,
  ].join("|");
  let model = exactSongOrderCache.get(cacheKey);
  if (!model) {
    model = recommendFormationOrder({
      leaderOutfitCardId,
      members: memberCardIds.map((cardId) => ({ cardId, bloomStage })) as [
        { cardId: string; bloomStage: typeof bloomStage },
        { cardId: string; bloomStage: typeof bloomStage },
        { cardId: string; bloomStage: typeof bloomStage },
        { cardId: string; bloomStage: typeof bloomStage },
        { cardId: string; bloomStage: typeof bloomStage },
      ],
      corpus: [{ chartKey, expectedChartHash: timeline.expectedChartHash }],
      corpusMode: "exact-song",
      exactTimelineByKey: guideRatingTimelineByKey,
    });
    exactSongOrderCache.set(cacheKey, model);
  }
  return model;
}

export function guideRatingTimelineState(chartKey: string) {
  return resolveGuideRatingTimeline(chartKey);
}

function canonicalMemberIds(memberCardIds: readonly string[]): MemberCardIdTuple {
  return [...memberCardIds].sort() as unknown as MemberCardIdTuple;
}

function subtractIntervals(selected: UtilityInterval, alternative: UtilityInterval): UtilityInterval {
  return {
    lower: selected.lower - alternative.upper,
    central: selected.central - alternative.central,
    upper: selected.upper - alternative.lower,
  };
}

function serializeOrderModel(model: ReturnType<typeof recommendFormationOrder>) {
  return {
    methodologyVersion: model.methodologyVersion,
    corpusChartCount: model.scenarios.chartCount,
    markerLayoutCount: model.scenarios.layoutCount,
    timingScenarioCount: model.scenarios.count,
    permutationsChecked: model.method.permutationsChecked,
    maxRegretPermil: model.objective.selected.maxRegretPermil,
    meanRegretPermil: model.objective.selected.meanRegretPermil,
    runnerUpGapPermil: model.objective.runnerUpGapPermil,
    winSharePermil: model.objective.selected.winSharePermil,
    exactTimelineAvailable: model.method.exactTimelineAvailable,
    noteTimelineAvailable: model.method.noteTimelineAvailable,
    changesModeledTimingUtility: model.method.changesModeledTimingUtility,
    statement: model.confidence.statement,
  };
}

function recipientSignature(summary: ReturnType<typeof recipientSummary>[number]): string {
  return [
    summary.source,
    summary.sourceCardId,
    summary.effectGroupId,
    summary.effectKind,
    summary.valuePermil,
    summary.commonToEveryAlternativeCardIds.join(","),
    summary.possibleCardIds.join(","),
  ].join("|");
}

function skillDescription(
  cardId: string,
  kind: "passive" | "active" | "special",
  level: number,
): string {
  const card = publicCardById.get(cardId);
  const row = card?.skills[kind].find((skill) => skill.level === level);
  return row?.description ?? "No additional effect.";
}

function lossPercent(loss: UtilityInterval, selected: UtilityInterval): SerializableInterval {
  const ratio = divideUtilityIntervals(loss, selected);
  return {
    lower: ratio.lower * 100,
    central: ratio.central * 100,
    upper: ratio.upper * 100,
  };
}

function recipientSummary(utility: NativeUtilityResult, order: readonly string[]) {
  return utility.components.parameterEffects.contributions.map((contribution) => {
    const alternatives = contribution.recipientAlternatives.map((indexes) =>
      indexes.map((index) => order[index]!).filter(Boolean),
    );
    const possible = new Set(alternatives.flat());
    const guaranteed = [...possible].filter((cardId) =>
      alternatives.every((alternative) => alternative.includes(cardId)),
    );
    const distinctAlternatives = new Set(
      alternatives.map((alternative) => [...alternative].sort().join("\0")),
    );
    return {
      source: contribution.source,
      sourceCardId: contribution.sourceCardId,
      effectGroupId: contribution.effectGroupId,
      effectKind: contribution.effectKind,
      valuePermil: contribution.valuePermil,
      resolution: distinctAlternatives.size === 1
        ? "resolved" as const
        : "unresolved-enumerated-alternatives" as const,
      commonToEveryAlternativeCardIds: guaranteed.sort(),
      possibleCardIds: [...possible].sort(),
    };
  });
}

function buildFormation(
  kind: FormationKind,
  label: string,
  investment: Investment,
  search: NativeSearchResult,
  ratingSingerTalentId: string,
  includeReplacements = true,
): NativeGuideFormation {
  const selectedMemberIds = search.best.members.map(({ cardId }) => cardId) as unknown as MemberCardIdTuple;
  const selected = modeledOrderEvaluation(
    search.best.leaderOutfitCardId,
    selectedMemberIds,
    investment,
    search.context.chartKey,
  );
  const order = selected.order;
  const song = songContextData.songs.find((candidate) => candidate.id === selected.utility.context.songId);
  const leader = publicCardById.get(search.best.leaderOutfitCardId);
  if (
    !song ||
    !song.scoreRatingEligible ||
    !song.singerTalentIds.includes(ratingSingerTalentId) ||
    !leader ||
    leader.talentId !== ratingSingerTalentId
  ) {
    throw new Error("Guide formations require a rating-eligible song and a singer-matched Leader Outfit");
  }
  const selectedRecipientRows = recipientSummary(selected.utility, order);
  const selectedRecipients = new Set(selectedRecipientRows.map(recipientSignature));
  const replacementRows = includeReplacements ? search.replacementsBySlot.flatMap((slot) => {
    const replacedIndex = selectedMemberIds.indexOf(slot.replacedCardId);
    if (replacedIndex < 0) throw new Error(`Replacement source is not in the selected formation: ${slot.replacedCardId}`);
    return slot.alternatives.slice(0, 2).map((replacement) => {
      const replacementMemberIds = [...selectedMemberIds] as [string, string, string, string, string];
      replacementMemberIds[replacedIndex] = replacement.cardId;
      const alternative = modeledOrderEvaluation(
        search.best.leaderOutfitCardId,
        replacementMemberIds,
        investment,
        search.context.chartKey,
      );
      const alternativeRecipientRows = recipientSummary(alternative.utility, alternative.order);
      const alternativeRecipients = new Set(alternativeRecipientRows.map(recipientSignature));
      const addedRecipientRows = alternativeRecipientRows.filter(
        (row) => !selectedRecipients.has(recipientSignature(row)),
      );
      const removedRecipientRows = selectedRecipientRows.filter(
        (row) => !alternativeRecipients.has(recipientSignature(row)),
      );
      const outgoingActive = selected.utility.components.active.byMember.find(
        (active) => active.cardId === slot.replacedCardId,
      )!;
      const incomingActive = alternative.utility.components.active.byMember.find(
        (active) => active.cardId === replacement.cardId,
      )!;
      const outgoingSpecial = selected.utility.components.special.byFormationOrder.find(
        (special) => special.cardId === slot.replacedCardId,
      )!;
      const incomingSpecial = alternative.utility.components.special.byFormationOrder.find(
        (special) => special.cardId === replacement.cardId,
      )!;
      return {
        replacedCardId: slot.replacedCardId,
        cardId: replacement.cardId,
        rarity: replacement.rarity,
        lossPercent: lossPercent(
          subtractIntervals(selected.utility.relativeUtility, alternative.utility.relativeUtility),
          selected.utility.relativeUtility,
        ),
        suggestedOrder: alternative.order,
        orderStatus: alternative.model.status,
        tradeoff: {
          benefit: skillDescription(
            replacement.cardId,
            "passive",
            PROGRESSION_LENSES[investment].passiveSkillLevel,
          ),
          cost: skillDescription(
            slot.replacedCardId,
            "passive",
            PROGRESSION_LENSES[investment].passiveSkillLevel,
          ),
          activeCooldownDeltaMilliseconds:
            incomingActive.cooldownMilliseconds - outgoingActive.cooldownMilliseconds,
          specialDurationDeltaMilliseconds:
            incomingSpecial.durationMilliseconds - outgoingSpecial.durationMilliseconds,
          formationOrderChanged: alternative.order.join("|") !== order.join("|"),
          recipientApplicationsAdded: [...alternativeRecipients].filter(
            (signature) => !selectedRecipients.has(signature),
          ).length,
          recipientApplicationsRemoved: [...selectedRecipients].filter(
            (signature) => !alternativeRecipients.has(signature),
          ).length,
          possibleRecipientCardIdsAdded: [
            ...new Set(addedRecipientRows.flatMap((row) => row.possibleCardIds)),
          ].sort(),
          possibleRecipientCardIdsRemoved: [
            ...new Set(removedRecipientRows.flatMap((row) => row.possibleCardIds)),
          ].sort(),
        },
      };
    });
  }) : [];
  const lossByCard = new Map(
    search.replacementsBySlot.map((slot) => [
      slot.replacedCardId,
      slot.anchored ? Number.POSITIVE_INFINITY : (slot.alternatives[0]?.intervalLoss.central ?? 0),
    ]),
  );
  const investmentOrder = [...order].sort(
    (left, right) =>
      (lossByCard.get(right) ?? 0) - (lossByCard.get(left) ?? 0) || left.localeCompare(right),
  );
  const searchCertificate = {
    mode: search.certificate.kind === "certified"
      ? "exhaustive-declared-scope" as const
      : "heuristic" as const,
    resultClaim: "recommended-under-provisional-relative-model" as const,
    teamSetsInScope: search.certificate.teamSetsInScope,
    teamSetsConsidered: search.certificate.teamSetsConsidered,
    unsearchedTeamSets: search.certificate.unsearchedTeamSets,
    caveat: search.certificate.kind === "certified"
      ? "Every declared team set was evaluated under the provisional aggregate model; unresolved mechanics still limit the recommendation."
      : "Only the reported team-set subset was evaluated; unresolved mechanics and unsearched teams limit the recommendation.",
    localRefinement: {
      status: search.certificate.localRefinement.status === "globally-certified"
        ? "declared-scope-exhausted" as const
        : search.certificate.localRefinement.status,
      scope: search.certificate.localRefinement.scope,
      selection: search.certificate.localRefinement.selection,
      iterations: search.certificate.localRefinement.iterations,
      candidatesScreened: search.certificate.localRefinement.candidatesScreened,
      improvingCandidatesAudited:
        search.certificate.localRefinement.improvingCandidatesAudited,
      formationOrdersAudited: search.certificate.localRefinement.formationOrdersAudited,
      visitedFormations: search.certificate.localRefinement.visitedFormations,
    },
  };
  return NativeGuideFormationSchema.parse({
    kind,
    label,
    progressionLens: PROGRESSION_LENSES[investment],
    context: {
      chartKey: selected.utility.context.chartKey,
      songId: selected.utility.context.songId,
      songTitle: selected.utility.context.songTitle,
      difficulty: "expert",
      durationMilliseconds: selected.utility.context.durationMilliseconds,
      noteCount: selected.utility.context.noteCount,
      scoreRatingEligible: true,
      leaderSingerMatched: true,
      platform: "mobile",
      chartFidelity: "aggregate",
      noteTimeline: "unavailable",
      specialMarkers: "unavailable",
    },
    leaderOutfitCardId: search.best.leaderOutfitCardId,
    members: order.map((cardId, index) => ({ slot: index + 1, cardId })),
    formationOrder: order,
    orderStatus: selected.model.status,
    formationOrderModel: serializeOrderModel(selected.model),
    relativeUtility: serializable(selected.utility.relativeUtility),
    staticParameters: {
      base: serializable(selected.utility.components.baseParameters.relativeUnits),
      leaderAndPassiveGain: serializable(selected.utility.components.parameterEffects.relativeUnits),
      effective: addIntervals(
        selected.utility.components.baseParameters.relativeUnits,
        selected.utility.components.parameterEffects.relativeUnits,
      ),
    },
    searchCertificate,
    finalistsEvaluated: search.counts.auditedFinalists,
    ordersAudited: search.counts.formationOrdersAudited,
    recipients: recipientSummary(selected.utility, order),
    activeSkills: selected.utility.components.active.byMember.map((active) => ({
      cardId: active.cardId,
      activationProbabilityPermil: active.activationProbabilityPermil,
      cooldownMilliseconds: active.cooldownMilliseconds,
      durationMilliseconds: active.durationMilliseconds,
      firstCheck: "one-cooldown-after-live-start",
      chartNoteCoverage: null,
    })),
    specialSkills: selected.utility.components.special.byFormationOrder.map((special) => ({
      slot: special.slot,
      cardId: special.cardId,
      durationMilliseconds: special.durationMilliseconds,
      markerTime: "unavailable",
      startsAtMilliseconds: null,
      endsAtMilliseconds: null,
      chartNoteCoverage: null,
      scoreSupportPermil: special.scoreSupportPermil,
      activationRateUpPermil: special.activationRateUpPermil,
    })),
    replacements: replacementRows,
    investmentOrder,
  });
}

function runSearch(
  chartKey: string,
  investment: Investment,
  kind: FormationKind,
  anchorCardId: string,
  ratingSingerTalentId: string,
  fixedLeaderOutfitCardId?: string,
): NativeSearchResult {
  const anchor = publicCardById.get(anchorCardId)!;
  const song = songContextData.songs.find((candidate) => candidate.id === chartKey.split(":")[0]);
  if (!song || !song.scoreRatingEligible || !song.singerTalentIds.includes(ratingSingerTalentId)) {
    throw new Error(`Guide search requires a singer-matched rating song: ${chartKey}`);
  }
  const leaderOutfitCardIds = guideLeaderOutfitCardIdsForSong(song.id, ratingSingerTalentId);
  const constraints =
    kind === "accessible-4-star"
      ? {
          anchorCardId: anchor.id,
          memberCardIds: [anchor.id, ...publicCards.filter((card) => card.rarity === 4).map((card) => card.id)],
          leaderOutfitCardIds,
          ...(fixedLeaderOutfitCardId ? { fixedLeaderOutfitCardId } : {}),
          leaderRarities: [4] as const,
          memberRarities: [4, 5] as const,
          maxFiveStarMembers: 1,
        }
      : {
          anchorCardId: anchor.id,
          leaderOutfitCardIds,
          ...(fixedLeaderOutfitCardId ? { fixedLeaderOutfitCardId } : {}),
        };
  return searchNativeLegalTeams({
    chartKey,
    seed: SEED,
    investmentLayer: investment,
    accountState: BOARD,
    constraints,
    strategy: {
      mode: "beam",
      beamWidth: 256,
      finalistTeamCount: 16,
      auditedFinalists: 16,
      alternativesPerSlot: 3,
    },
  });
}

export function expertChartKey(songId: string): string {
  const chart = songContextData.charts.find(
    (candidate) => candidate.songId === songId && candidate.difficulty === "expert",
  );
  if (!chart) throw new Error(`No pinned Expert chart for ${songId}`);
  return chart.key;
}

export type NativeGuideGenerationOptions = Readonly<{
  anchorCardId?: string;
  fixedLeaderOutfitCardId?: string;
}>;

export function mergeNativeGuideData(
  generatedAt: string,
  generatedData: readonly NativeGuideData[],
  existingData?: NativeGuideData,
): NativeGuideData {
  const parsedGeneratedAt = new Date(generatedAt);
  if (Number.isNaN(parsedGeneratedAt.valueOf())) {
    throw new Error("generatedAt must be an ISO timestamp");
  }
  if (generatedData.length === 0) {
    throw new Error("At least one generated guide dataset is required");
  }

  const normalizedGeneratedAt = parsedGeneratedAt.toISOString();
  const generated = generatedData.map((data) => NativeGuideDataSchema.parse(data));
  for (const data of generated) {
    if (data.generatedAt !== normalizedGeneratedAt) {
      throw new Error("Generated guide datasets must share the requested timestamp");
    }
    if (data.rosterCommit !== nativeRankingData.rosterCommit) {
      throw new Error("Generated guide roster does not match the current ranking snapshot");
    }
    if (data.guides.some((guide) => guide.snapshotId !== nativeRankingData.snapshotId)) {
      throw new Error("Generated guide snapshot does not match the current ranking snapshot");
    }
  }

  const existing = existingData
    ? NativeGuideDataSchema.parse(existingData)
    : undefined;
  if (existing) {
    if (existing.rosterCommit !== nativeRankingData.rosterCommit) {
      throw new Error("Cannot retain guides from a stale roster snapshot");
    }
    if (existing.guides.some((guide) => guide.snapshotId !== nativeRankingData.snapshotId)) {
      throw new Error("Cannot retain guides from a stale ranking snapshot");
    }
  }

  const guidesByAnchorCardId = new Map(
    (existing?.guides ?? []).map((guide) => [guide.anchorCardId, guide]),
  );
  for (const data of generated) {
    for (const guide of data.guides) {
      guidesByAnchorCardId.set(guide.anchorCardId, guide);
    }
  }

  return NativeGuideDataSchema.parse({
    schemaVersion: 5,
    generatedAt: normalizedGeneratedAt,
    rosterCommit: nativeRankingData.rosterCommit,
    guides: [...guidesByAnchorCardId.values()].sort(
      (left, right) =>
        left.anchorCardId.localeCompare(right.anchorCardId) || left.slug.localeCompare(right.slug),
    ),
  });
}

/**
 * Carry deterministic guide output to a ranking-only metadata transition.
 * Guide search does not consume ranking tiers or indices, so a rebase is safe
 * only when the roster, scores, and ranks are unchanged across the transition.
 */
export function rebaseNativeGuideDataSnapshot(
  generatedAt: string,
  existingInput: NativeGuideData,
  transition: NativeRankingChangelog,
): NativeGuideData {
  const existing = NativeGuideDataSchema.parse(existingInput);
  const parsedGeneratedAt = new Date(generatedAt);
  if (Number.isNaN(parsedGeneratedAt.valueOf())) {
    throw new Error("generatedAt must be an ISO timestamp");
  }
  const normalizedGeneratedAt = parsedGeneratedAt.toISOString();
  if (!transition.from) throw new Error("Guide rebasing requires a previous ranking snapshot");
  if (
    transition.to.snapshotId !== nativeRankingData.snapshotId ||
    transition.to.generatedAt !== nativeRankingData.generatedAt ||
    transition.to.methodologyVersion !== nativeRankingData.methodologyVersion
  ) {
    throw new Error("Guide rebase transition does not end at the current ranking snapshot");
  }
  if (
    transition.summary.added !== 0 ||
    transition.summary.removed !== 0 ||
    transition.summary.scoreChanged !== 0 ||
    transition.summary.rankChanged !== 0
  ) {
    throw new Error("Guide rebasing requires an unchanged roster, score index, and rank order");
  }
  if (
    existing.rosterCommit !== nativeRankingData.rosterCommit ||
    existing.guides.some((guide) => guide.snapshotId !== transition.from!.snapshotId)
  ) {
    throw new Error("Guide data does not match the starting ranking snapshot");
  }
  return NativeGuideDataSchema.parse({
    ...existing,
    generatedAt: normalizedGeneratedAt,
    guides: existing.guides.map((guide) => ({
      ...guide,
      snapshotId: nativeRankingData.snapshotId,
    })),
  });
}

export function guideLeaderOutfitCardIdsForSong(
  songId: string,
  singerTalentId: string,
): readonly string[] {
  const song = songContextData.songs.find((candidate) => candidate.id === songId);
  if (!song || !song.scoreRatingEligible || !song.singerTalentIds.includes(singerTalentId)) {
    throw new Error(`Guide Leader pool requires a singer-matched rating song: ${songId}`);
  }
  const cardIds = publicCards
    .filter((card) => card.talentId === singerTalentId)
    .map((card) => card.id)
    .sort();
  if (cardIds.length === 0) {
    throw new Error(`No Leader Outfits found for rating singer ${singerTalentId}`);
  }
  return cardIds;
}

export function selectGuideRatingSongs(
  anchorCardId: string,
  fixedLeaderOutfitCardId?: string,
): Readonly<{ singerTalentId: string; songs: readonly SongContext[] }> {
  const anchor = publicCardById.get(anchorCardId);
  if (!anchor || anchor.rarity !== 5) {
    throw new Error("A native guide anchor must resolve to one exact 5-star Member card");
  }
  const fixedLeader = fixedLeaderOutfitCardId
    ? publicCardById.get(fixedLeaderOutfitCardId)
    : undefined;
  if (fixedLeaderOutfitCardId && !fixedLeader) {
    throw new Error(`Unknown fixed Leader/Outfit card ${fixedLeaderOutfitCardId}`);
  }
  const singerTalentId = fixedLeader?.talentId ?? anchor.talentId;
  const songs = ratingSongsForTalent(singerTalentId).sort(
    (left, right) => left.playingMilliseconds - right.playingMilliseconds || left.id.localeCompare(right.id),
  );
  if (
    songs.length === 0 ||
    songs.some(
      (song) => !song.scoreRatingEligible || !song.singerTalentIds.includes(singerTalentId),
    )
  ) {
    throw new Error(`No singer-matched rating songs found for ${singerTalentId}`);
  }
  return { singerTalentId, songs };
}

export function generateNativeGuideData(
  generatedAt: string,
  options: NativeGuideGenerationOptions = {},
  onProgress?: (message: string) => void,
): NativeGuideData {
  const parsedGeneratedAt = new Date(generatedAt);
  if (Number.isNaN(parsedGeneratedAt.valueOf())) throw new Error("generatedAt must be an ISO timestamp");
  if (nativeRankingData.rosterCommit !== mechanicsData.sourceSnapshot.commit) {
    throw new Error("Cannot generate a guide against a ranking snapshot from a different roster commit");
  }
  const anchorCardId = options.anchorCardId ?? DEFAULT_GUIDE_ANCHOR_CARD_ID;
  const anchor = publicCardById.get(anchorCardId)!;
  const ratingSelection = selectGuideRatingSongs(
    anchorCardId,
    options.fixedLeaderOutfitCardId,
  );
  const songs = ratingSelection.songs;
  const defaultSong = songs[Math.floor(songs.length / 2)]!;
  const standardSearches = new Map(
    songs.map((song) => {
      const chartKey = expertChartKey(song.id);
      onProgress?.(`Standard search: ${song.title} (${chartKey})`);
      return [
        chartKey,
        runSearch(
          chartKey,
          "one-copy-maximum",
          "standard",
          anchor.id,
          ratingSelection.singerTalentId,
          options.fixedLeaderOutfitCardId,
        ),
      ] as const;
    }),
  );
  const defaultChartKey = expertChartKey(defaultSong.id);
  const standard = buildFormation(
    "standard",
    "Bloom 0 · skills Lv.1",
    "one-copy-maximum",
    standardSearches.get(defaultChartKey)!,
    ratingSelection.singerTalentId,
  );
  onProgress?.(`Premium search: ${defaultSong.title} (${defaultChartKey})`);
  const premium = buildFormation(
    "premium",
    "Bloom 5 · skills Lv.2",
    "duplicate-enabled-ceiling",
    runSearch(
      defaultChartKey,
      "duplicate-enabled-ceiling",
      "premium",
      anchor.id,
      ratingSelection.singerTalentId,
      options.fixedLeaderOutfitCardId,
    ),
    ratingSelection.singerTalentId,
  );
  onProgress?.(`Accessible search: ${defaultSong.title} (${defaultChartKey})`);
  const accessible = buildFormation(
    "accessible-4-star",
    "4★ core · Bloom 0 · skills Lv.1",
    "one-copy-maximum",
    runSearch(
      defaultChartKey,
      "one-copy-maximum",
      "accessible-4-star",
      anchor.id,
      ratingSelection.singerTalentId,
      options.fixedLeaderOutfitCardId,
    ),
    ratingSelection.singerTalentId,
  );
  const ratingSongComparisons = songs.map((song) => {
    const chartKey = expertChartKey(song.id);
    const formation = buildFormation(
      "standard",
      "Bloom 0 · skills Lv.1",
      "one-copy-maximum",
      standardSearches.get(chartKey)!,
      ratingSelection.singerTalentId,
      false,
    );
    const candidateMembers = formation.members.map((member) => member.cardId) as unknown as MemberCardIdTuple;
    const defaultMembers = standard.members.map((member) => member.cardId) as unknown as MemberCardIdTuple;
    const timelineState = guideRatingTimelineState(chartKey);
    if (timelineState.availability === "recorded-unavailable") {
      const candidateAggregate = modeledOrderEvaluation(
        formation.leaderOutfitCardId,
        candidateMembers,
        "one-copy-maximum",
        chartKey,
      );
      const defaultAggregate = modeledOrderEvaluation(
        standard.leaderOutfitCardId,
        defaultMembers,
        "one-copy-maximum",
        chartKey,
      );
      const candidateFormationChanged =
        formation.leaderOutfitCardId !== standard.leaderOutfitCardId ||
        [...candidateMembers].sort().join("\0") !== [...defaultMembers].sort().join("\0");
      const robustlyBetter =
        candidateFormationChanged &&
        utilityIntervalStrictlyDominates(
          candidateAggregate.utility.relativeUtility,
          defaultAggregate.utility.relativeUtility,
        );
      const candidateCanonicalMembers = canonicalMemberIds(candidateMembers);
      const defaultCanonicalMembers = canonicalMemberIds(defaultMembers);
      const selectedMembers = robustlyBetter ? candidateCanonicalMembers : defaultCanonicalMembers;
      const selectedUtility = robustlyBetter
        ? candidateAggregate.utility
        : defaultAggregate.utility;
      const advantage =
        ((candidateAggregate.utility.relativeUtility.central - defaultAggregate.utility.relativeUtility.central) /
          Math.max(1, defaultAggregate.utility.relativeUtility.central)) *
        100;
      return {
        songId: song.id,
        songTitle: song.title,
        chartKey,
        difficulty: "expert" as const,
        durationMilliseconds: song.playingMilliseconds,
        noteCount: formation.context.noteCount,
        scoreRatingEligible: true as const,
        leaderSingerMatched: true as const,
        platform: "mobile" as const,
        chartFidelity: "aggregate" as const,
        noteTimeline: "unavailable" as const,
        comparisonMode: "aggregate-formation-only" as const,
        timelineUnavailableReason: timelineState.chart.reason,
        leaderOutfitCardId: robustlyBetter
          ? formation.leaderOutfitCardId
          : standard.leaderOutfitCardId,
        formationOrder: selectedMembers,
        orderStatus: "indeterminate" as const,
        members: selectedMembers,
        relativeUtility: serializable(selectedUtility.relativeUtility),
        advantageOverReferencePercent: robustlyBetter
          ? Math.round(advantage * 100) / 100
          : null,
        changesReferenceFormation: robustlyBetter,
      };
    }
    const candidateOrderModel = exactSongOrderEvaluation(
      formation.leaderOutfitCardId,
      candidateMembers,
      "one-copy-maximum",
      chartKey,
    );
    const defaultOrderModel = exactSongOrderEvaluation(
      standard.leaderOutfitCardId,
      defaultMembers,
      "one-copy-maximum",
      chartKey,
    );
    const candidateOnSong = evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId: formation.leaderOutfitCardId,
        members: candidateOrderModel.order.map((cardId) => ({
          cardId,
          investment: "one-copy-maximum" as const,
        })),
      },
      chartKey,
      seed: SEED,
      accountState: BOARD,
    });
    const defaultOnSong = evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId: standard.leaderOutfitCardId,
        members: defaultOrderModel.order.map((cardId) => ({
          cardId,
          investment: "one-copy-maximum" as const,
        })),
      },
      chartKey,
      seed: SEED,
      accountState: BOARD,
    });
    const advantage =
      ((candidateOnSong.relativeUtility.central - defaultOnSong.relativeUtility.central) /
        Math.max(1, defaultOnSong.relativeUtility.central)) *
      100;
    const robustlyBetter = utilityIntervalStrictlyDominates(
      candidateOnSong.relativeUtility,
      defaultOnSong.relativeUtility,
    );
    const selectedOrderModel = robustlyBetter ? candidateOrderModel : defaultOrderModel;
    const timeline = timelineState.chart;
    return {
      songId: song.id,
      songTitle: song.title,
      chartKey,
      difficulty: "expert",
      durationMilliseconds: song.playingMilliseconds,
      noteCount: formation.context.noteCount,
      scoreRatingEligible: true,
      leaderSingerMatched: true,
      platform: "mobile",
      chartFidelity: "aggregate",
      noteTimeline: "exact",
      formationOrderTimelineFidelity: "exact-timed",
      timelineEvidence: {
        susSha256: timeline.source.susSha256,
        metadataSha256: timeline.source.metadataSha256,
        specialMarkerMicroseconds: timeline.specialMarkerMicroseconds,
        feverMarkerMicroseconds: timeline.feverMarkerMicroseconds,
      },
      leaderOutfitCardId: robustlyBetter
        ? formation.leaderOutfitCardId
        : standard.leaderOutfitCardId,
      formationOrder: selectedOrderModel.order,
      members: robustlyBetter ? candidateMembers : defaultMembers,
      relativeUtility: robustlyBetter
        ? serializable(candidateOnSong.relativeUtility)
        : serializable(defaultOnSong.relativeUtility),
      advantageOverReferencePercent: robustlyBetter
        ? Math.round(advantage * 100) / 100
        : null,
      changesReferenceFormation: robustlyBetter,
      orderStatus: selectedOrderModel.status,
      formationOrderModel: serializeOrderModel(selectedOrderModel),
    };
  });

  return NativeGuideDataSchema.parse({
    schemaVersion: 5,
    generatedAt: parsedGeneratedAt.toISOString(),
    rosterCommit: mechanicsData.sourceSnapshot.commit,
    guides: [
      {
        id: `guide-${anchor.id}-standard-manual-v1`,
        slug:
          anchor.id === DEFAULT_GUIDE_ANCHOR_CARD_ID
            ? "azki-a-flower-in-full-bloom-team-guide"
            : `${anchor.slug}-team-guide`,
        title: `${anchor.talentName} — ${anchor.title} team guide`,
        anchorCardId: anchor.id,
        anchorTalentId: anchor.talentId,
        snapshotId: nativeRankingData.snapshotId,
        methodologyVersion: "yd-native-guide-1.2.0",
        publicationState: "theorycraft-beta",
        benchmark: BENCHMARK,
        ratingSongScope: {
          singerTalentId: ratingSelection.singerTalentId,
          scoreRatingEligibleOnly: true,
          leaderSingerMatchRequired: true,
          difficulty: "expert",
        },
        formations: [premium, standard, accessible],
        ratingSongComparisons,
      },
    ],
  });
}
