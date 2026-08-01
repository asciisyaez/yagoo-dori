import { mechanicsData } from "./mechanics";
import {
  NativeGuideDataSchema,
  NativeGuideFormationSchema,
  type NativeGuideData,
  type NativeGuideFormation,
} from "./native-guide-schema";
import { nativeRankingData } from "./native-ranking-data";
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

function canonicalOrderEvaluation(
  search: NativeSearchResult,
  investment: Investment,
): { order: readonly string[]; utility: NativeUtilityResult } {
  const order = search.best.orderAudit.canonicalOrder;
  return {
    order,
    utility: evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId: search.best.leaderOutfitCardId,
        members: order.map((cardId) => ({ cardId, investment })),
      },
      chartKey: search.context.chartKey,
      seed: SEED,
      accountState: BOARD,
    }),
  };
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
    return {
      sourceCardId: contribution.sourceCardId,
      effectKind: contribution.effectKind,
      resolution: "unresolved-enumerated-alternatives" as const,
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
): NativeGuideFormation {
  const selected = canonicalOrderEvaluation(search, investment);
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
  const replacementRows = search.replacementsBySlot.flatMap((slot) =>
    slot.alternatives.slice(0, 2).map((replacement) => ({
      replacedCardId: slot.replacedCardId,
      cardId: replacement.cardId,
      rarity: replacement.rarity,
      lossPercent: lossPercent(replacement.intervalLoss, selected.utility.relativeUtility),
    })),
  );
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
    orderStatus: "canonical-display-only-timing-unresolved",
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
    ordersAudited: 120,
    recipients: recipientSummary(selected.utility, order),
    activeSkills: selected.utility.components.active.byMember.map((active) => ({
      cardId: active.cardId,
      activationProbabilityPermil: active.activationProbabilityPermil,
      cooldownMilliseconds: active.cooldownMilliseconds,
      durationMilliseconds: active.durationMilliseconds,
      firstCheck: "unresolved",
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

function expertChartKey(songId: string): string {
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
    );
    const defaultOnSong = evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId: standard.leaderOutfitCardId,
        members: standard.formationOrder.map((cardId) => ({
          cardId,
          investment: "one-copy-maximum" as const,
        })),
      },
      chartKey,
      seed: SEED,
      accountState: BOARD,
    });
    const advantage =
      ((formation.relativeUtility.central - defaultOnSong.relativeUtility.central) /
        Math.max(1, defaultOnSong.relativeUtility.central)) *
      100;
    const candidateMembers = formation.members.map((member) => member.cardId);
    const defaultMembers = standard.members.map((member) => member.cardId);
    const robustlyBetter = utilityIntervalStrictlyDominates(
      formation.relativeUtility,
      defaultOnSong.relativeUtility,
    );
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
      noteTimeline: "unavailable",
      leaderOutfitCardId: robustlyBetter
        ? formation.leaderOutfitCardId
        : standard.leaderOutfitCardId,
      formationOrder: robustlyBetter
        ? formation.formationOrder
        : standard.formationOrder,
      members: robustlyBetter ? candidateMembers : defaultMembers,
      relativeUtility: robustlyBetter
        ? formation.relativeUtility
        : serializable(defaultOnSong.relativeUtility),
      advantageOverReferencePercent: robustlyBetter
        ? Math.round(advantage * 100) / 100
        : null,
      changesReferenceFormation: robustlyBetter,
      orderStatus: "canonical-display-only-timing-unresolved",
    };
  });

  return NativeGuideDataSchema.parse({
    schemaVersion: 2,
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
        methodologyVersion: "yd-native-guide-1.1.0",
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
