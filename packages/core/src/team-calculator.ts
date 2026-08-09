import rankingBenchmarkJson from "../../../data/native/ranking-benchmark-v1.json";
import { createHash } from "node:crypto";

import { recommendFormationOrder } from "./formation-order-recommender";
import { resolveCardInvestmentState } from "./formation-evaluator";
import { mechanicsCardById } from "./mechanics";
import {
  searchNativeCanonicalCandidates,
  type NativeCanonicalCandidateSearchInput,
  type NativeCanonicalCandidateSearchResult,
} from "./native-search";
import {
  evaluateNativeRelativeUtility,
  type NativeUtilityInput,
  type NativeUtilityResult,
  type UtilityInterval,
} from "./native-utility";
import { publicCardById, publicData, type PublicCard } from "./public-data";
import { songContextData } from "./song-contexts";
import {
  TeamCalculatorRequestSchema,
  TeamCalculatorResultSchema,
  type TeamCalculatorBloomStage,
  type TeamCalculatorOshiRole,
  type TeamCalculatorRequest,
  type TeamCalculatorResult,
  type TeamCalculatorSearchEffort,
} from "./team-calculator-contract";

export const TEAM_CALCULATOR_ROSTER_COMMIT = publicData.sourceSnapshots.english.commit;
export const TEAM_CALCULATOR_DEFAULT_SEED = 0x5941_474f;
export const TEAM_CALCULATOR_MAX_EXACT_TEAM_SETS = 25;
export const TEAM_CALCULATOR_OBJECTIVE_ID = "yd-equal-chart-average-relative-utility-v1" as const;
export const TEAM_CALCULATOR_EVALUATOR_METHODOLOGY = "yd-native-utility-1.0.0" as const;
export const TEAM_CALCULATOR_ARITHMETIC_METHODOLOGY = "yd-native-six-decimal-rounding-1.0.0" as const;

export type TeamCalculatorEffortProfile = Readonly<{
  exactEvaluationBudget: number;
  enumMaxTeamSets: number;
  enumProxyKeepTeams: number;
  enumLeadersPerTeam: number;
  enumCoarseKeep: number;
  enumFinalKeep: number;
  enumLeaderStartCap: number;
  enumLeaderStartSetKeep: number | null;
  coarseKeep: number;
  proxyKeep: number;
  jointCoarseKeep: number;
  jointLeaderComponentKeep: number;
  jointSwapComponentKeep: number;
  ascentSeedCount: number;
  fanoutEnabled: boolean;
  fanoutLeaderCap: number | null;
  seedCandidatesMax: number;
}>;

export const TEAM_CALCULATOR_EFFORT_PROFILES: Readonly<
  Record<TeamCalculatorSearchEffort, TeamCalculatorEffortProfile>
> = Object.freeze({
  standard: Object.freeze({
    exactEvaluationBudget: 8_640,
    enumMaxTeamSets: 200_000,
    enumProxyKeepTeams: 192,
    enumLeadersPerTeam: 2,
    enumCoarseKeep: 48,
    enumFinalKeep: 16,
    enumLeaderStartCap: 0,
    enumLeaderStartSetKeep: null,
    coarseKeep: 64,
    proxyKeep: 16,
    jointCoarseKeep: 48,
    jointLeaderComponentKeep: 8,
    jointSwapComponentKeep: 12,
    ascentSeedCount: 1,
    fanoutEnabled: false,
    fanoutLeaderCap: null,
    seedCandidatesMax: 8,
  }),
  thorough: Object.freeze({
    exactEvaluationBudget: 34_560,
    enumMaxTeamSets: 200_000,
    enumProxyKeepTeams: 512,
    enumLeadersPerTeam: 4,
    enumCoarseKeep: 128,
    enumFinalKeep: 48,
    enumLeaderStartCap: 4,
    enumLeaderStartSetKeep: 32,
    coarseKeep: 96,
    proxyKeep: 24,
    jointCoarseKeep: 96,
    jointLeaderComponentKeep: 24,
    jointSwapComponentKeep: 32,
    // Three thorough-profile starts; the protected standard lane is the
    // fourth trajectory of the start budget (Sol review, Ticket B round 3).
    ascentSeedCount: 3,
    fanoutEnabled: true,
    fanoutLeaderCap: 8,
    seedCandidatesMax: 8,
  }),
});

// The coordinate ascent must run to a fixpoint, not take a single step. At 1 it
// adopted one improving swap and stopped, leaving the new incumbent's own
// neighbourhood unexamined — so the backups panel, which screens that same
// neighbourhood on the identical corpus, routinely displayed replacements that
// strictly beat the headline team. Measured over 440 sampled rosters: 98 runs
// (22%, and 38 of 40 full-roster runs) showed at least one strictly improving
// backup at 1, and none did at a fixpoint. The longest observed ascent was 7
// passes; 12 leaves headroom while still bounding the worst case.
const HEURISTIC_LOCAL_ITERATION_LIMIT = 12;
const REPLACEMENT_COARSE_FINALIST_COUNT = 16;
const REPLACEMENT_CORPUS_FINALIST_COUNT = 4;
const IMPROVEMENT_EPSILON = 0.000_001;
const CORPUS_CHART_COUNT = 30;

const OSHI_ROLE_LABELS = {
  member: "Must include as Member",
  leader: "Must use as Leader Outfit",
  "member-and-leader": "Must include as Member and use as Leader Outfit",
} as const satisfies Record<TeamCalculatorOshiRole, string>;

const CALCULATOR_BOARD_STATE = {
  board: {
    mode: "declared-neutral" as const,
    evidenceGrade: "verified" as const,
    evidenceRef: "calculator:neutral-board-v1",
  },
};

function canonicalizeScopeValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalizeScopeValue).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeScopeValue(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

type SearchRunner = (
  input: NativeCanonicalCandidateSearchInput,
) => NativeCanonicalCandidateSearchResult;
type UtilityRunner = (input: NativeUtilityInput) => NativeUtilityResult;
type MemberTuple = readonly [string, string, string, string, string];
type OwnedCalculatorCard = Readonly<{
  cardId: string;
  bloomStage: TeamCalculatorBloomStage;
  card: PublicCard;
}>;
type Candidate = Readonly<{
  leaderOutfitCardId: string;
  memberCardIds: MemberTuple;
}>;
type ResolvedOshiConstraint = Readonly<{
  talentId: string;
  talentName: string;
  role: TeamCalculatorOshiRole;
  memberRequired: boolean;
  leaderRequired: boolean;
  eligibleCards: ReadonlyArray<{
    cardId: string;
    bloomStage: TeamCalculatorBloomStage;
    card: PublicCard;
  }>;
}>;
type CorpusEntry = Readonly<{
  chartKey: string;
  expectedChartHash: string;
  segment: "reference" | "current";
}>;
type AverageEvaluation = Readonly<{
  candidate: Candidate;
  relativeUtility: UtilityInterval;
  referenceAverage: UtilityInterval;
  currentAverage: UtilityInterval;
}>;

type SynergyRow = TeamCalculatorResult["synergies"][number];
type SynergyAccumulator = {
  source: "leader" | "passive";
  sourceCardId: string;
  effectGroupId: string;
  effectKind: "performance-up" | "technique-up" | "sense-up" | "all-parameters-up";
  valuePermil: number;
  activeCharts: Set<string>;
  alternatives: Map<string, string[]>;
};

export type TeamCalculatorDependencies = Readonly<{
  search?: SearchRunner;
  evaluate?: UtilityRunner;
}>;

export class TeamCalculatorError extends Error {
  readonly code:
    | "invalid-request"
    | "stale-roster"
    | "unknown-card"
    | "invalid-required-members"
    | "unowned-oshi"
    | "invalid-corpus"
    | "insufficient-talents"
    | "calculation-failed";

  constructor(code: TeamCalculatorError["code"], message: string) {
    super(message);
    this.name = "TeamCalculatorError";
    this.code = code;
  }
}

function loadRepresentativeCorpus(): {
  benchmarkId: string;
  entriesSha256: string;
  entries: readonly CorpusEntry[];
} {
  const corpus = rankingBenchmarkJson.corpus;
  if (
    corpus.difficulty !== "expert" ||
    corpus.referenceSharePermil !== 700 ||
    corpus.currentSharePermil !== 300 ||
    corpus.reference.length !== 21 ||
    corpus.current.length !== 9
  ) {
    throw new TeamCalculatorError("invalid-corpus", "The representative chart corpus is invalid.");
  }
  const entries: CorpusEntry[] = [
    ...corpus.reference.map((entry) => ({ ...entry, segment: "reference" as const })),
    ...corpus.current.map((entry) => ({ ...entry, segment: "current" as const })),
  ];
  const chartByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));
  if (new Set(entries.map((entry) => entry.chartKey)).size !== CORPUS_CHART_COUNT) {
    throw new TeamCalculatorError("invalid-corpus", "The representative chart corpus contains duplicates.");
  }
  for (const entry of entries) {
    const chart = chartByKey.get(entry.chartKey);
    if (
      !chart ||
      chart.difficulty !== "expert" ||
      chart.chartHash !== entry.expectedChartHash
    ) {
      throw new TeamCalculatorError("invalid-corpus", "The representative chart corpus has drifted.");
    }
  }
  return {
    benchmarkId: rankingBenchmarkJson.benchmarkId,
    entriesSha256: corpus.entriesSha256,
    entries,
  };
}

export const TEAM_CALCULATOR_CORPUS = Object.freeze(loadRepresentativeCorpus());

function calculateOwnedRosterScopeHash(
  request: TeamCalculatorRequest,
  ownedCards: ReadonlyArray<{ cardId: string; bloomStage: TeamCalculatorBloomStage }>,
  effortTier: TeamCalculatorSearchEffort,
): string {
  const scope = {
    schemaVersion: request.schemaVersion,
    rosterCommit: request.rosterCommit,
    ownedCards: [...ownedCards]
      .map(({ cardId, bloomStage }) => ({ cardId, bloomStage }))
      .sort((left, right) => left.cardId.localeCompare(right.cardId)),
    requiredMemberCardIds: [...request.requiredMemberCardIds].sort(),
    oshi: request.oshi ?? null,
    searchEffort: effortTier,
    seedCandidates: [...(request.seedCandidates ?? [])]
      .map((candidate) => ({
        leaderOutfitCardId: candidate.leaderOutfitCardId,
        memberCardIds: [...candidate.memberCardIds].sort(),
      }))
      .sort((left, right) =>
        `${left.leaderOutfitCardId}|${left.memberCardIds.join("|")}`.localeCompare(
          `${right.leaderOutfitCardId}|${right.memberCardIds.join("|")}`,
        ),
      ),
    leaderAndMemberEligibility: "all-owned-cards-with-one-card-per-talent",
    maximumFiveStarMembers: 5,
    investmentLayer: "one-copy-maximum",
    corpus: {
      benchmarkId: TEAM_CALCULATOR_CORPUS.benchmarkId,
      entriesSha256: TEAM_CALCULATOR_CORPUS.entriesSha256,
      entries: TEAM_CALCULATOR_CORPUS.entries,
    },
    seed: TEAM_CALCULATOR_DEFAULT_SEED,
    accountState: CALCULATOR_BOARD_STATE,
    objective: TEAM_CALCULATOR_OBJECTIVE_ID,
    evaluatorMethodologyVersion: TEAM_CALCULATOR_EVALUATOR_METHODOLOGY,
    arithmeticMethodologyVersion: TEAM_CALCULATOR_ARITHMETIC_METHODOLOGY,
    formationOrderClaim: "conditional-on-selected-team",
  };
  return createHash("sha256")
    .update(canonicalizeScopeValue(scope), "utf8")
    .digest("hex");
}

type ChartProfile = Readonly<{
  entry: CorpusEntry;
  durationMilliseconds: number;
  notesPerSecond: number;
}>;

function chartProfiles(entries: readonly CorpusEntry[]): ChartProfile[] {
  const chartByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));
  const songById = new Map(songContextData.songs.map((song) => [song.id, song]));
  return entries.map((entry) => {
    const chart = chartByKey.get(entry.chartKey)!;
    const song = songById.get(chart.songId)!;
    return {
      entry,
      durationMilliseconds: song.playingMilliseconds,
      notesPerSecond: chart.fullComboNoteCount / (song.playingMilliseconds / 1_000),
    };
  });
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function medoid(
  candidates: readonly ChartProfile[],
  universe: readonly ChartProfile[],
): CorpusEntry {
  const durationMedian = median(universe.map((profile) => profile.durationMilliseconds));
  const densityMedian = median(universe.map((profile) => profile.notesPerSecond));
  const durationRange = Math.max(
    1,
    Math.max(...universe.map((profile) => profile.durationMilliseconds)) -
      Math.min(...universe.map((profile) => profile.durationMilliseconds)),
  );
  const densityRange = Math.max(
    Number.EPSILON,
    Math.max(...universe.map((profile) => profile.notesPerSecond)) -
      Math.min(...universe.map((profile) => profile.notesPerSecond)),
  );
  const selected = [...candidates].sort((left, right) => {
    const leftDistance =
      Math.abs(left.durationMilliseconds - durationMedian) / durationRange +
      Math.abs(left.notesPerSecond - densityMedian) / densityRange;
    const rightDistance =
      Math.abs(right.durationMilliseconds - durationMedian) / durationRange +
      Math.abs(right.notesPerSecond - densityMedian) / densityRange;
    return leftDistance - rightDistance || left.entry.chartKey.localeCompare(right.entry.chartKey);
  })[0];
  if (!selected) throw new TeamCalculatorError("invalid-corpus", "No corpus medoid is available.");
  return selected.entry;
}

function selectCandidateGenerationCharts(entries: readonly CorpusEntry[]): readonly CorpusEntry[] {
  const profiles = chartProfiles(entries);
  const byDuration = [...profiles].sort(
    (left, right) =>
      left.durationMilliseconds - right.durationMilliseconds ||
      left.entry.chartKey.localeCompare(right.entry.chartKey),
  );
  const byDensity = [...profiles].sort(
    (left, right) =>
      left.notesPerSecond - right.notesPerSecond ||
      left.entry.chartKey.localeCompare(right.entry.chartKey),
  );
  const extremes = [
    byDuration[0]!.entry,
    byDuration.at(-1)!.entry,
    byDensity[0]!.entry,
    byDensity.at(-1)!.entry,
  ];
  const extremeKeys = new Set(extremes.map((entry) => entry.chartKey));
  const referenceMedoid = medoid(
    profiles.filter(
      (profile) =>
        profile.entry.segment === "reference" && !extremeKeys.has(profile.entry.chartKey),
    ),
    profiles,
  );
  const selected = [...extremes, referenceMedoid];
  if (
    new Set(selected.map((entry) => entry.chartKey)).size !== 5 ||
    selected.filter((entry) => entry.segment === "reference").length !== 3 ||
    selected.filter((entry) => entry.segment === "current").length !== 2
  ) {
    throw new TeamCalculatorError(
      "invalid-corpus",
      "The candidate-generation chart mix must contain three reference and two current charts.",
    );
  }
  return Object.freeze(selected);
}

export const TEAM_CALCULATOR_CANDIDATE_GENERATION_CHARTS =
  selectCandidateGenerationCharts(TEAM_CALCULATOR_CORPUS.entries);

const TEAM_CALCULATOR_COARSE_SCREENING_CHARTS = Object.freeze([
  medoid(
    chartProfiles(TEAM_CALCULATOR_CANDIDATE_GENERATION_CHARTS).filter(
      (profile) => profile.entry.segment === "reference",
    ),
    chartProfiles(TEAM_CALCULATOR_CORPUS.entries),
  ),
  medoid(
    chartProfiles(TEAM_CALCULATOR_CANDIDATE_GENERATION_CHARTS).filter(
      (profile) => profile.entry.segment === "current",
    ),
    chartProfiles(TEAM_CALCULATOR_CORPUS.entries),
  ),
]);

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function averageIntervals(intervals: readonly UtilityInterval[]): UtilityInterval {
  if (intervals.length === 0) throw new Error("Cannot average an empty utility interval list");
  return {
    lower: round(intervals.reduce((sum, interval) => sum + interval.lower, 0) / intervals.length),
    central: round(intervals.reduce((sum, interval) => sum + interval.central, 0) / intervals.length),
    upper: round(intervals.reduce((sum, interval) => sum + interval.upper, 0) / intervals.length),
  };
}

function subtractIntervals(selected: UtilityInterval, alternative: UtilityInterval): UtilityInterval {
  return {
    lower: round(selected.lower - alternative.upper),
    central: round(selected.central - alternative.central),
    upper: round(selected.upper - alternative.lower),
  };
}

function countLegalTeamSets(
  cards: readonly PublicCard[],
  requiredTalentId?: string,
  requiredMemberCardIds: readonly string[] = [],
): number {
  const variantsPerTalent = new Map<string, number>();
  for (const card of cards) {
    variantsPerTalent.set(card.talentId, (variantsPerTalent.get(card.talentId) ?? 0) + 1);
  }
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const lockedCards = requiredMemberCardIds.map((cardId) => cardById.get(cardId));
  if (lockedCards.some((card) => !card)) return 0;
  const lockedTalents = new Set(lockedCards.map((card) => card!.talentId));
  const oshiAlreadyLocked = requiredTalentId !== undefined && lockedTalents.has(requiredTalentId);
  const requiredVariantCount = requiredTalentId && !oshiAlreadyLocked
    ? variantsPerTalent.get(requiredTalentId) ?? 0
    : 1;
  if (requiredTalentId && !oshiAlreadyLocked && requiredVariantCount === 0) return 0;
  const targetMemberCount = 5 - requiredMemberCardIds.length - (requiredTalentId && !oshiAlreadyLocked ? 1 : 0);
  if (targetMemberCount < 0) return 0;
  const ways = [1, 0, 0, 0, 0, 0];
  for (const [talentId, variantCount] of variantsPerTalent) {
    if (lockedTalents.has(talentId) || (talentId === requiredTalentId && !oshiAlreadyLocked)) continue;
    for (let selected = 4; selected >= 0; selected -= 1) {
      ways[selected + 1] = Math.min(
        Number.MAX_SAFE_INTEGER,
        ways[selected + 1]! + ways[selected]! * variantCount,
      );
    }
  }
  return Math.min(Number.MAX_SAFE_INTEGER, ways[targetMemberCount]! * requiredVariantCount);
}

function asTeamTuple(ids: readonly string[]): MemberTuple {
  if (ids.length !== 5) throw new Error(`Expected five Members; received ${ids.length}`);
  return [...ids].sort() as unknown as MemberTuple;
}

export function enumerateLegalTeamSets(
  cards: readonly PublicCard[],
  requiredTalentId?: string,
  requiredMemberCardIds: readonly string[] = [],
): MemberTuple[] {
  const sorted = [...cards].sort((left, right) => left.id.localeCompare(right.id));
  const lockedIds = new Set(requiredMemberCardIds);
  const lockedCards = requiredMemberCardIds
    .map((cardId) => sorted.find((card) => card.id === cardId))
    .filter((card): card is PublicCard => card !== undefined);
  const lockedTalents = new Set(lockedCards.map((card) => card.talentId));
  const oshiAlreadyLocked = requiredTalentId !== undefined && lockedTalents.has(requiredTalentId);
  const anchorIds = new Set(lockedCards.map((card) => card.id));
  const remainingCards = sorted.filter(
    (card) => !lockedIds.has(card.id) && !lockedTalents.has(card.talentId),
  );
  const teams: MemberTuple[] = [];
  const visit = (start: number, selected: string[], talents: Set<string>): void => {
    if (selected.length === 5) {
      teams.push(asTeamTuple(selected));
      return;
    }
    for (let index = start; index <= remainingCards.length - (5 - selected.length); index += 1) {
      const card = remainingCards[index]!;
      if (talents.has(card.talentId)) continue;
      selected.push(card.id);
      talents.add(card.talentId);
      visit(index + 1, selected, talents);
      talents.delete(card.talentId);
      selected.pop();
    }
  };
  if (requiredTalentId && !oshiAlreadyLocked) {
    const requiredCards = sorted.filter(
      (card) => card.talentId === requiredTalentId && !anchorIds.has(card.id),
    );
    const visitRequired = (
      start: number,
      selected: string[],
      talents: Set<string>,
    ): void => {
      if (selected.length === 5) {
        teams.push(asTeamTuple(selected));
        return;
      }
      for (
        let index = start;
        index <= remainingCards.length - (5 - selected.length);
        index += 1
      ) {
        const card = remainingCards[index]!;
        if (talents.has(card.talentId)) continue;
        selected.push(card.id);
        talents.add(card.talentId);
        visitRequired(index + 1, selected, talents);
        talents.delete(card.talentId);
        selected.pop();
      }
    };
    for (const requiredCard of requiredCards) {
      visitRequired(
        0,
        [...requiredMemberCardIds, requiredCard.id],
        new Set([...lockedTalents, requiredTalentId]),
      );
    }
  } else {
    visit(0, [...requiredMemberCardIds], new Set(lockedTalents));
  }
  return teams;
}

function candidateKey(candidate: Candidate): string {
  return `${candidate.leaderOutfitCardId}|${candidate.memberCardIds.join("|")}`;
}

function seedKey(seed: Pick<Candidate, "leaderOutfitCardId" | "memberCardIds">): string {
  return `${seed.leaderOutfitCardId}|${[...seed.memberCardIds].sort().join("|")}`;
}

function teamKey(memberCardIds: readonly string[]): string {
  return [...memberCardIds].sort().join("|");
}

function compareAverage(left: AverageEvaluation, right: AverageEvaluation): number {
  if (left.relativeUtility.central !== right.relativeUtility.central) {
    return right.relativeUtility.central - left.relativeUtility.central;
  }
  if (left.relativeUtility.lower !== right.relativeUtility.lower) {
    return right.relativeUtility.lower - left.relativeUtility.lower;
  }
  if (left.relativeUtility.upper !== right.relativeUtility.upper) {
    return right.relativeUtility.upper - left.relativeUtility.upper;
  }
  return candidateKey(left.candidate).localeCompare(candidateKey(right.candidate));
}

function compareScreened(
  left: Readonly<{ candidate: Candidate; relativeUtility: UtilityInterval }>,
  right: Readonly<{ candidate: Candidate; relativeUtility: UtilityInterval }>,
): number {
  if (left.relativeUtility.central !== right.relativeUtility.central) {
    return right.relativeUtility.central - left.relativeUtility.central;
  }
  if (left.relativeUtility.lower !== right.relativeUtility.lower) {
    return right.relativeUtility.lower - left.relativeUtility.lower;
  }
  if (left.relativeUtility.upper !== right.relativeUtility.upper) {
    return right.relativeUtility.upper - left.relativeUtility.upper;
  }
  return candidateKey(left.candidate).localeCompare(candidateKey(right.candidate));
}

function cardSummary(card: PublicCard) {
  return {
    cardId: card.id,
    slug: card.slug,
    talentId: card.talentId,
    talentName: card.talentName,
    title: card.title,
    rarity: card.rarity,
    attribute: card.attribute,
    artPath: card.artPath,
    illustrationPath: card.illustrationPath,
  };
}

function requirePublicCard(cardId: string): PublicCard {
  const card = publicCardById.get(cardId);
  if (!card) {
    throw new TeamCalculatorError("unknown-card", `Unknown card in saved roster: ${cardId}`);
  }
  const mechanics = mechanicsCardById.get(cardId);
  if (!mechanics) {
    throw new TeamCalculatorError("unknown-card", `Card mechanics are unavailable: ${cardId}`);
  }
  if (!mechanics.coverage.allReferencesMapped || mechanics.coverage.unresolvedReferenceIds.length > 0) {
    throw new TeamCalculatorError("unknown-card", `Card mechanics are incomplete: ${cardId}`);
  }
  return card;
}

function normalizedRecipientAlternatives(alternatives: ReadonlyArray<readonly string[]>): string[][] {
  return [
    ...new Map(
      alternatives.map((alternative) => {
        const normalized = [...alternative].sort();
        return [normalized.join("|"), normalized] as const;
      }),
    ).values(),
  ].sort((left, right) => left.join("|").localeCompare(right.join("|")));
}

function synergyKey(row: Pick<SynergyRow, "source" | "sourceCardId" | "effectGroupId" | "effectKind" | "valuePermil">): string {
  return [row.source, row.sourceCardId, row.effectGroupId, row.effectKind, row.valuePermil].join("|");
}

function accumulateCorpusSynergies(
  candidate: Candidate,
  evaluateRaw: (candidate: Candidate, chartKey: string) => NativeUtilityResult,
): SynergyRow[] {
  const synergyByKey = new Map<string, SynergyAccumulator>();
  for (const entry of TEAM_CALCULATOR_CORPUS.entries) {
    const utility = evaluateRaw(candidate, entry.chartKey);
    for (const contribution of utility.components.parameterEffects.contributions) {
      const key = synergyKey(contribution);
      const accumulator = synergyByKey.get(key) ?? {
        source: contribution.source,
        sourceCardId: contribution.sourceCardId,
        effectGroupId: contribution.effectGroupId,
        effectKind: contribution.effectKind,
        valuePermil: contribution.valuePermil,
        activeCharts: new Set<string>(),
        alternatives: new Map<string, string[]>(),
      };
      accumulator.activeCharts.add(entry.chartKey);
      for (const indexes of contribution.recipientAlternatives) {
        const alternative = indexes
          .map((index) => candidate.memberCardIds[index])
          .filter((cardId): cardId is string => cardId !== undefined);
        const normalized = [...alternative].sort();
        accumulator.alternatives.set(normalized.join("|"), normalized);
      }
      synergyByKey.set(key, accumulator);
    }
  }
  return [...synergyByKey.values()]
    .map((synergy) => {
      const recipientAlternatives = normalizedRecipientAlternatives([
        ...synergy.alternatives.values(),
      ]);
      return {
        source: synergy.source,
        sourceCardId: synergy.sourceCardId,
        effectGroupId: synergy.effectGroupId,
        effectKind: synergy.effectKind,
        valuePermil: synergy.valuePermil,
        recipientAlternatives,
        resolution: recipientAlternatives.length === 1
          ? "resolved" as const
          : "multiple-possible-recipients" as const,
        activeChartCount: synergy.activeCharts.size,
        corpusChartCount: CORPUS_CHART_COUNT as 30,
        activationSharePermil: Math.round((synergy.activeCharts.size * 1_000) / CORPUS_CHART_COUNT),
      };
    })
    .sort(
      (left, right) =>
        left.source.localeCompare(right.source) ||
        left.sourceCardId.localeCompare(right.sourceCardId) ||
        left.effectGroupId.localeCompare(right.effectGroupId),
    );
}

function targetIds(row: SynergyRow | undefined): string[] {
  return row
    ? [...new Set(row.recipientAlternatives.flat())].sort((left, right) => left.localeCompare(right))
    : [];
}

function passiveDetails(cardId: string, bloomStage: TeamCalculatorBloomStage): {
  description: string;
  level: number;
} {
  const mechanics = mechanicsCardById.get(cardId);
  const card = publicCardById.get(cardId);
  if (!mechanics || !card) {
    throw new TeamCalculatorError("calculation-failed", `Passive details are unavailable: ${cardId}`);
  }
  const level = resolveCardInvestmentState(mechanics, "one-copy-maximum", bloomStage).passiveSkillLevel;
  return {
    description:
      card.skills.passive.find((skill) => skill.level === level)?.description ??
      "Effect description unavailable.",
    level,
  };
}

function scalarComponent(
  utility: NativeUtilityResult,
  cardId: string,
): { cooldownMilliseconds: number; specialDurationMilliseconds: number } {
  const active = utility.components.active.byMember.find((member) => member.cardId === cardId);
  const special = utility.components.special.byFormationOrder.find((member) => member.cardId === cardId);
  if (!active || !special) {
    throw new TeamCalculatorError("calculation-failed", `Cached timing details are unavailable: ${cardId}`);
  }
  return {
    cooldownMilliseconds: active.cooldownMilliseconds,
    specialDurationMilliseconds: special.durationMilliseconds,
  };
}

type ReplacementImpact = TeamCalculatorResult["alternatives"][number]["cards"][number]["replacementImpact"];

function buildReplacementImpact(input: {
  selectedCandidate: Candidate;
  alternativeCandidate: Candidate;
  outgoingCardId: string;
  incomingCardId: string;
  selectedSynergies: readonly SynergyRow[];
  alternativeSynergies: readonly SynergyRow[];
  selectedAverage: AverageEvaluation;
  alternativeAverage: AverageEvaluation;
  evaluateRaw: (candidate: Candidate, chartKey: string) => NativeUtilityResult;
  bloomStageByCardId: Readonly<Record<string, TeamCalculatorBloomStage>>;
}): ReplacementImpact {
  const beforeCentral = input.selectedAverage.relativeUtility.central;
  const afterCentral = input.alternativeAverage.relativeUtility.central;
  const centralDelta = round(afterCentral - beforeCentral);
  const centralDeltaPercent = beforeCentral === 0 ? 0 : round((centralDelta / beforeCentral) * 100);
  let chartsImproved = 0;
  let chartsWorsened = 0;
  let chartsTied = 0;
  const perChartDeltaPercent = TEAM_CALCULATOR_CORPUS.entries.map((entry) => {
    const before = input.evaluateRaw(input.selectedCandidate, entry.chartKey).relativeUtility.central;
    const after = input.evaluateRaw(input.alternativeCandidate, entry.chartKey).relativeUtility.central;
    const delta = after - before;
    if (delta > IMPROVEMENT_EPSILON) chartsImproved += 1;
    else if (delta < -IMPROVEMENT_EPSILON) chartsWorsened += 1;
    else chartsTied += 1;
    return before === 0 ? 0 : round((delta / before) * 100);
  });
  const boundDeltas = (["lower", "central", "upper"] as const).map(
    (bound) => input.alternativeAverage.relativeUtility[bound] - input.selectedAverage.relativeUtility[bound],
  );
  const boundAgreement = boundDeltas.every((delta) => delta > IMPROVEMENT_EPSILON)
    ? "improves-at-every-bound" as const
    : boundDeltas.every((delta) => delta < -IMPROVEMENT_EPSILON)
      ? "worsens-at-every-bound" as const
      : "bound-dependent" as const;

  const selectedByKey = new Map(input.selectedSynergies.map((row) => [synergyKey(row), row]));
  const alternativeByKey = new Map(input.alternativeSynergies.map((row) => [synergyKey(row), row]));
  const effectChanges: ReplacementImpact["effectChanges"] = [];
  const effectKeys = [...new Set([...selectedByKey.keys(), ...alternativeByKey.keys()])].sort();
  const sourceRemainsInTeam = (sourceCardId: string) =>
    sourceCardId === input.selectedCandidate.leaderOutfitCardId ||
    input.alternativeCandidate.memberCardIds.includes(sourceCardId);
  for (const effectKey of effectKeys) {
    const before = selectedByKey.get(effectKey);
    const after = alternativeByKey.get(effectKey);
    const beforeRecipients = targetIds(before);
    const afterRecipients = targetIds(after);
    const beforeCoverage = before?.activeChartCount ?? 0;
    const afterCoverage = after?.activeChartCount ?? 0;
    // Classify by recipient emptiness, not key presence: the contract re-derives
    // change from the recipient arrays, and an effect whose target resolves to
    // zero eligible recipients (possible for cross-attribute or cross-group
    // passives a future patch may add) is present-but-reaching-nobody. Deriving
    // both sides from the same arrays keeps producer and contract consistent by
    // construction; on current data the two rules coincide.
    const change = afterRecipients.length === 0
      ? beforeRecipients.length === 0
        ? null
        : "lost" as const
      : beforeRecipients.length === 0
        ? "gained" as const
        : beforeRecipients.join("|") !== afterRecipients.join("|") || beforeCoverage !== afterCoverage
          ? "retargeted" as const
          : null;
    if (!change) continue;
    const source = (after ?? before)!;
    effectChanges.push({
      change,
      source: source.source,
      sourceCardId: source.sourceCardId,
      sourceRemainsInTeam: sourceRemainsInTeam(source.sourceCardId),
      effectGroupId: source.effectGroupId,
      effectKind: source.effectKind,
      valuePermil: source.valuePermil,
      recipientCardIdsBefore: beforeRecipients,
      recipientCardIdsAfter: afterRecipients,
      activeChartCountBefore: beforeCoverage,
      activeChartCountAfter: afterCoverage,
    });
  }

  const outgoingBloomStage = input.bloomStageByCardId[input.outgoingCardId];
  const incomingBloomStage = input.bloomStageByCardId[input.incomingCardId];
  if (outgoingBloomStage === undefined || incomingBloomStage === undefined) {
    throw new TeamCalculatorError("calculation-failed", "Replacement Bloom state is unavailable.");
  }
  const outgoingPassive = passiveDetails(input.outgoingCardId, outgoingBloomStage);
  const incomingPassive = passiveDetails(input.incomingCardId, incomingBloomStage);
  const firstChartKey = TEAM_CALCULATOR_CORPUS.entries[0]?.chartKey;
  if (!firstChartKey) {
    throw new TeamCalculatorError("invalid-corpus", "The representative chart corpus is empty.");
  }
  const outgoingTiming = scalarComponent(
    input.evaluateRaw(input.selectedCandidate, firstChartKey),
    input.outgoingCardId,
  );
  const incomingTiming = scalarComponent(
    input.evaluateRaw(input.alternativeCandidate, firstChartKey),
    input.incomingCardId,
  );
  return {
    comparisonDesign: "paired-per-chart-same-leader-and-canonical-order",
    beforeCentral,
    afterCentral,
    centralDelta,
    centralDeltaPercent,
    chartsImproved,
    chartsWorsened,
    chartsTied,
    perChartDeltaPercent: {
      minimum: round(Math.min(...perChartDeltaPercent)),
      median: round(median(perChartDeltaPercent)),
      maximum: round(Math.max(...perChartDeltaPercent)),
    },
    boundAgreement,
    effectChanges,
    outgoingPassiveDescription: outgoingPassive.description,
    incomingPassiveDescription: incomingPassive.description,
    outgoingPassiveSkillLevel: outgoingPassive.level,
    incomingPassiveSkillLevel: incomingPassive.level,
    activeCooldownDeltaMilliseconds:
      incomingTiming.cooldownMilliseconds - outgoingTiming.cooldownMilliseconds,
    specialDurationDeltaMilliseconds:
      incomingTiming.specialDurationMilliseconds - outgoingTiming.specialDurationMilliseconds,
    formationOrderAffectsValue: false,
  };
}

function boundedSearchStrategy(
  compactMemberOshiSearch = false,
): NativeCanonicalCandidateSearchInput["strategy"] {
  return {
    mode: "beam",
    beamWidth: 32,
    finalistTeamCount: compactMemberOshiSearch ? 2 : 4,
    leadersPerTeam: compactMemberOshiSearch ? 1 : 2,
  };
}

function baseParameterProxy(
  cardId: string,
  bloomStage: TeamCalculatorBloomStage,
): number {
  const mechanics = mechanicsCardById.get(cardId);
  if (!mechanics) throw new Error(`Card mechanics are unavailable: ${cardId}`);
  const state = resolveCardInvestmentState(mechanics, "one-copy-maximum", bloomStage);
  const curve = mechanics.progression.levelCurve.find((row) => row.level === state.level);
  if (!curve) throw new Error(`${cardId} has no level ${state.level} progression row`);
  const multiplierPermil = 1_000 + state.allParameterPermilUp;
  return (["performance", "technique", "sense"] as const).reduce(
    (total, parameter) =>
      total +
      Math.ceil(
        (curve.parameterBaseValue *
          mechanics.parameterDistributionPermil[parameter] *
          multiplierPermil) /
          1_000_000,
      ),
    0,
  );
}

function shouldUseExhaustiveSearch(
  teamSetsInScope: number,
  eligibleLeaderCount: number,
  effortProfile: TeamCalculatorEffortProfile,
): boolean {
  return (
    teamSetsInScope <= TEAM_CALCULATOR_MAX_EXACT_TEAM_SETS ||
    teamSetsInScope * eligibleLeaderCount * CORPUS_CHART_COUNT <= effortProfile.exactEvaluationBudget
  );
}

function enumerateBoundedCandidatePool(input: Readonly<{
  ownedCards: readonly OwnedCalculatorCard[];
  eligibleLeaderCardIds: readonly string[];
  requiredTalentId: string | undefined;
  requiredMemberCardIds: readonly string[];
  teamSetsInScope: number;
  effortProfile: TeamCalculatorEffortProfile;
}>): Readonly<{
  memberSets: readonly MemberTuple[];
  candidates: readonly Candidate[];
}> {
  const memberSets = enumerateLegalTeamSets(
    input.ownedCards.map((ownedCard) => ownedCard.card),
    input.requiredTalentId,
    input.requiredMemberCardIds,
  );
  if (memberSets.length !== input.teamSetsInScope) {
    throw new TeamCalculatorError(
      "calculation-failed",
      "Bounded member-set enumeration did not reconcile.",
    );
  }

  const bloomStageByCardId = new Map(
    input.ownedCards.map((ownedCard) => [ownedCard.cardId, ownedCard.bloomStage] as const),
  );
  const memberSetProxy = memberSets
    .map((memberCardIds) => ({
      memberCardIds,
      proxy: memberCardIds.reduce(
        (total, cardId) => total + baseParameterProxy(cardId, bloomStageByCardId.get(cardId)!),
        0,
      ),
    }))
    .sort(
      (left, right) =>
        right.proxy - left.proxy ||
        teamKey(left.memberCardIds).localeCompare(teamKey(right.memberCardIds)),
    )
    .slice(0, input.effortProfile.enumProxyKeepTeams);
  const rankedLeaderCardIds = [...input.eligibleLeaderCardIds]
    .sort(
      (left, right) =>
        baseParameterProxy(right, bloomStageByCardId.get(right)!) -
          baseParameterProxy(left, bloomStageByCardId.get(left)!) ||
        left.localeCompare(right),
    )
    .slice(0, input.effortProfile.enumLeadersPerTeam);
  const candidates: Candidate[] = [];
  for (const memberSet of memberSetProxy) {
    for (const leaderOutfitCardId of rankedLeaderCardIds) {
      candidates.push({ leaderOutfitCardId, memberCardIds: memberSet.memberCardIds });
    }
  }
  return {
    memberSets: memberSetProxy.map((entry) => entry.memberCardIds),
    candidates,
  };
}

/**
 * Calculates one general-purpose team against the frozen 21:9 reference/current
 * Expert corpus. Web callers invoke this synchronous deterministic core only in
 * the dedicated calculator Worker.
 */
export function calculateOwnedRosterTeam(
  rawRequest: unknown,
  dependencies: TeamCalculatorDependencies = {},
): TeamCalculatorResult {
  const parsedRequest = TeamCalculatorRequestSchema.safeParse(rawRequest);
  if (!parsedRequest.success) {
    throw new TeamCalculatorError("invalid-request", "Check the selected cards and Bloom stages.");
  }
  const request = parsedRequest.data;
  if (request.rosterCommit !== TEAM_CALCULATOR_ROSTER_COMMIT) {
    throw new TeamCalculatorError(
      "stale-roster",
      "The saved roster is from an older card catalog. Review it before calculating again.",
    );
  }
  const effortTier: TeamCalculatorSearchEffort = request.searchEffort ?? "thorough";
  const effortProfile = TEAM_CALCULATOR_EFFORT_PROFILES[effortTier];

  const ownedCards = [...request.ownedCards]
    .sort((left, right) => left.cardId.localeCompare(right.cardId))
    .map((ownedCard) => ({ ...ownedCard, card: requirePublicCard(ownedCard.cardId) }));
  const ownedCardById = new Map(ownedCards.map((ownedCard) => [ownedCard.cardId, ownedCard]));
  const requiredMemberCardIds = [...request.requiredMemberCardIds].sort();
  const requiredMemberCards = requiredMemberCardIds.map((cardId) => ownedCardById.get(cardId));
  if (requiredMemberCards.some((ownedCard) => !ownedCard)) {
    throw new TeamCalculatorError(
      "invalid-required-members",
      "Every required Member card must be selected in your owned roster.",
    );
  }
  if (
    new Set(requiredMemberCards.map((ownedCard) => ownedCard!.card.talentId)).size !==
    requiredMemberCards.length
  ) {
    throw new TeamCalculatorError(
      "invalid-required-members",
      "Required Member cards must use different talents.",
    );
  }
  const scopeHash = calculateOwnedRosterScopeHash(request, ownedCards, effortTier);
  const runRecordId = `yd-owned-roster-run-v6-${scopeHash}`;
  const ownedTalentCount = new Set(ownedCards.map((ownedCard) => ownedCard.card.talentId)).size;
  if (ownedTalentCount < 5) {
    throw new TeamCalculatorError(
      "insufficient-talents",
      "Select cards from at least five different talents to build a legal team.",
    );
  }

  let oshiConstraint: ResolvedOshiConstraint | null = null;
  if (request.oshi) {
    const eligibleCards = ownedCards.filter(
      (ownedCard) => ownedCard.card.talentId === request.oshi!.talentId,
    );
    if (eligibleCards.length === 0) {
      throw new TeamCalculatorError(
        "unowned-oshi",
        "Select an Oshi talent with at least one owned card.",
      );
    }
    oshiConstraint = {
      talentId: request.oshi.talentId,
      talentName: eligibleCards[0]!.card.talentName,
      role: request.oshi.role,
      memberRequired:
        request.oshi.role === "member" || request.oshi.role === "member-and-leader",
      leaderRequired:
        request.oshi.role === "leader" || request.oshi.role === "member-and-leader",
      eligibleCards,
    };
  }

  const bloomStageByCardId = Object.fromEntries(
    ownedCards.map((ownedCard) => [ownedCard.cardId, ownedCard.bloomStage]),
  ) as Record<string, TeamCalculatorBloomStage>;
  const ownedCardIds = ownedCards.map((ownedCard) => ownedCard.cardId);
  const cardById = new Map(ownedCards.map((ownedCard) => [ownedCard.cardId, ownedCard.card]));
  const requiredMemberTalentId = oshiConstraint?.memberRequired &&
    !requiredMemberCards.some((ownedCard) => ownedCard!.card.talentId === oshiConstraint.talentId)
    ? oshiConstraint.talentId
    : undefined;
  if (
    oshiConstraint?.memberRequired &&
    requiredMemberTalentId !== undefined &&
    requiredMemberCardIds.length >= 5
  ) {
    throw new TeamCalculatorError(
      "invalid-required-members",
      "The Oshi Member constraint needs one remaining slot; unlock a required Member card or lock the Oshi card.",
    );
  }
  const eligibleLeaderCardIds = oshiConstraint?.leaderRequired
    ? oshiConstraint.eligibleCards.map((ownedCard) => ownedCard.cardId)
    : ownedCardIds;
  const legalTeamSets = countLegalTeamSets(
    ownedCards.map((ownedCard) => ownedCard.card),
    requiredMemberTalentId,
    requiredMemberCardIds,
  );
  const exhaustive = shouldUseExhaustiveSearch(
    legalTeamSets,
    eligibleLeaderCardIds.length,
    effortProfile,
  );
  const search = dependencies.search ?? searchNativeCanonicalCandidates;
  const evaluate = dependencies.evaluate ?? evaluateNativeRelativeUtility;
  const rawCache = new Map<string, NativeUtilityResult>();
  const averageCache = new Map<string, AverageEvaluation>();
  const searchEvaluations = new Map<string, AverageEvaluation>();
  let bestSeen: AverageEvaluation | undefined;
  const coarseCache = new Map<string, UtilityInterval>();
  const proxyCache = new Map<string, UtilityInterval>();
  const searchTeamKeys = new Set<string>();
  // Member sets touched at the cheaper screening tiers. Telemetry unions the
  // downstream tiers so screened ⊇ considered ⊇ evaluated holds by
  // construction even for seeds, which bypass the screens entirely.
  const coarseTeamKeys = new Set<string>();
  const proxyTeamKeys = new Set<string>();
  const searchFormationKeys = new Set<string>();
  const replacementFormationKeys = new Set<string>();
  const requiredMemberCardIdSet = new Set(requiredMemberCardIds);
  let adapterUtilityEvaluations = 0;
  let nativeUtilityEvaluations = 0;

  const rememberSearchEvaluation = (evaluation: AverageEvaluation): void => {
    searchEvaluations.set(candidateKey(evaluation.candidate), evaluation);
    if (!bestSeen || compareAverage(evaluation, bestSeen) < 0) bestSeen = evaluation;
  };

  const candidateSatisfiesOshi = (candidate: Candidate): boolean => {
    if (requiredMemberCardIds.some((cardId) => !candidate.memberCardIds.includes(cardId))) return false;
    if (!oshiConstraint) return true;
    const memberSatisfied =
      !oshiConstraint.memberRequired ||
      candidate.memberCardIds.some(
        (cardId) => cardById.get(cardId)?.talentId === oshiConstraint.talentId,
      );
    const leaderSatisfied =
      !oshiConstraint.leaderRequired ||
      cardById.get(candidate.leaderOutfitCardId)?.talentId === oshiConstraint.talentId;
    return memberSatisfied && leaderSatisfied;
  };

  const candidateSatisfiesSeedLegality = (candidate: Candidate): boolean => {
    if (!ownedCardById.has(candidate.leaderOutfitCardId)) return false;
    if (candidate.memberCardIds.length !== 5 || new Set(candidate.memberCardIds).size !== 5) {
      return false;
    }
    if (candidate.memberCardIds.some((cardId) => !ownedCardById.has(cardId))) return false;
    if (new Set(candidate.memberCardIds.map((cardId) => cardById.get(cardId)!.talentId)).size !== 5) {
      return false;
    }
    return candidateSatisfiesOshi(candidate);
  };

  const evaluateRaw = (candidate: Candidate, chartKey: string): NativeUtilityResult => {
    const key = `${candidateKey(candidate)}|${chartKey}`;
    const cached = rawCache.get(key);
    if (cached) return cached;
    adapterUtilityEvaluations += 1;
    const result = evaluate({
      formation: {
        leaderOutfitCardId: candidate.leaderOutfitCardId,
        members: candidate.memberCardIds.map((cardId) => ({
          cardId,
          investment: "one-copy-maximum" as const,
          bloomStage: bloomStageByCardId[cardId]!,
        })),
      },
      chartKey,
      seed: TEAM_CALCULATOR_DEFAULT_SEED,
      accountState: CALCULATOR_BOARD_STATE,
    });
    rawCache.set(key, result);
    return result;
  };

  const evaluateAverage = (
    rawCandidate: Candidate,
    purpose: "search" | "replacement" = "search",
  ): AverageEvaluation => {
    const candidate: Candidate = {
      leaderOutfitCardId: rawCandidate.leaderOutfitCardId,
      memberCardIds: asTeamTuple(rawCandidate.memberCardIds),
    };
    const key = candidateKey(candidate);
    if (purpose === "search") {
      searchTeamKeys.add(teamKey(candidate.memberCardIds));
      searchFormationKeys.add(key);
    } else {
      replacementFormationKeys.add(key);
    }
    const cached = averageCache.get(key);
    if (cached) {
      if (purpose === "search") rememberSearchEvaluation(cached);
      return cached;
    }
    const reference: UtilityInterval[] = [];
    const current: UtilityInterval[] = [];
    for (const entry of TEAM_CALCULATOR_CORPUS.entries) {
      const utility = evaluateRaw(candidate, entry.chartKey).relativeUtility;
      (entry.segment === "reference" ? reference : current).push(utility);
    }
    const result: AverageEvaluation = {
      candidate,
      relativeUtility: averageIntervals([...reference, ...current]),
      referenceAverage: averageIntervals(reference),
      currentAverage: averageIntervals(current),
    };
    averageCache.set(key, result);
    if (purpose === "search") rememberSearchEvaluation(result);
    return result;
  };

  const evaluateProxy = (
    rawCandidate: Candidate,
    purpose: "search" | "replacement" = "search",
  ): UtilityInterval => {
    const candidate: Candidate = {
      leaderOutfitCardId: rawCandidate.leaderOutfitCardId,
      memberCardIds: asTeamTuple(rawCandidate.memberCardIds),
    };
    const key = candidateKey(candidate);
    if (purpose === "search") proxyTeamKeys.add(teamKey(candidate.memberCardIds));
    const cached = proxyCache.get(key);
    if (cached) return cached;
    const result = averageIntervals(
      TEAM_CALCULATOR_CANDIDATE_GENERATION_CHARTS.map(
        (entry) => evaluateRaw(candidate, entry.chartKey).relativeUtility,
      ),
    );
    proxyCache.set(key, result);
    return result;
  };

  const evaluateCoarse = (
    rawCandidate: Candidate,
    purpose: "search" | "replacement" = "search",
  ): UtilityInterval => {
    const candidate: Candidate = {
      leaderOutfitCardId: rawCandidate.leaderOutfitCardId,
      memberCardIds: asTeamTuple(rawCandidate.memberCardIds),
    };
    const key = candidateKey(candidate);
    if (purpose === "search") coarseTeamKeys.add(teamKey(candidate.memberCardIds));
    const cached = coarseCache.get(key);
    if (cached) return cached;
    const result = averageIntervals(
      TEAM_CALCULATOR_COARSE_SCREENING_CHARTS.map(
        (entry) => evaluateRaw(candidate, entry.chartKey).relativeUtility,
      ),
    );
    coarseCache.set(key, result);
    return result;
  };

  const screenFactoryPool = (
    candidates: readonly Candidate[],
    profile: TeamCalculatorEffortProfile,
  ): Candidate[] => {
    const coarseFinalists = candidates
      .map((candidate) => ({ candidate, relativeUtility: evaluateCoarse(candidate) }))
      .sort(compareScreened)
      .slice(0, profile.enumCoarseKeep)
      .map((entry) => entry.candidate);
    return coarseFinalists
      .map((candidate) => ({ candidate, relativeUtility: evaluateProxy(candidate) }))
      .sort(compareScreened)
      .slice(0, profile.enumFinalKeep)
      .map((entry) => entry.candidate);
  };

  const candidateMap = new Map<string, Candidate>();
  const preFanoutCandidateKeys = new Set<string>();
  const standardEnumerationCandidateKeys = new Set<string>();
  const standardEnumerationCandidates = new Map<string, Candidate>();
  let factoryProxyMemberSets: readonly MemberTuple[] = [];
  const providedSeedCount = request.seedCandidates?.length ?? 0;
  const legalSeedCandidates: Candidate[] = [];
  const seenSeedKeys = new Set<string>();
  for (const seed of (request.seedCandidates ?? []).slice(0, effortProfile.seedCandidatesMax)) {
    const candidate: Candidate = {
      leaderOutfitCardId: seed.leaderOutfitCardId,
      memberCardIds: asTeamTuple([...seed.memberCardIds].sort()),
    };
    const key = seedKey(candidate);
    if (seenSeedKeys.has(key) || !candidateSatisfiesSeedLegality(candidate)) continue;
    seenSeedKeys.add(key);
    legalSeedCandidates.push(candidate);
  }
  legalSeedCandidates.sort((left, right) => candidateKey(left).localeCompare(candidateKey(right)));
  let candidateGenerationChartCount = 0;
  let localRefinementStatus: TeamCalculatorResult["search"]["localRefinementStatus"] =
    "not-needed-exhaustive";
  let localRefinementIterations = 0;
  let localRefinementSeedCount = 0;

  const addNativeSearchCandidates = (input: NativeCanonicalCandidateSearchInput): void => {
    const nativeResult = search(input);
    nativeUtilityEvaluations += nativeResult.counts.utilityEvaluations;
    for (const candidate of nativeResult.candidates) {
      const normalizedCandidate: Candidate = {
        leaderOutfitCardId: candidate.leaderOutfitCardId,
        memberCardIds: asTeamTuple(candidate.memberCardIds),
      };
      if (!candidateSatisfiesOshi(normalizedCandidate)) continue;
      candidateMap.set(candidateKey(normalizedCandidate), normalizedCandidate);
    }
  };

  if (exhaustive) {
    const teams = enumerateLegalTeamSets(
      ownedCards.map((ownedCard) => ownedCard.card),
      requiredMemberTalentId,
      requiredMemberCardIds,
    );
    if (teams.length !== legalTeamSets) {
      throw new TeamCalculatorError("calculation-failed", "Legal team enumeration did not reconcile.");
    }
    for (const memberCardIds of teams) {
      for (const leaderOutfitCardId of eligibleLeaderCardIds) {
        const candidate = { leaderOutfitCardId, memberCardIds };
        if (!candidateSatisfiesOshi(candidate)) continue;
        candidateMap.set(candidateKey(candidate), candidate);
      }
    }
  } else {
    candidateGenerationChartCount = TEAM_CALCULATOR_CANDIDATE_GENERATION_CHARTS.length;
    try {
      const memberAnchorCardIds = requiredMemberTalentId !== undefined
        ? oshiConstraint!.eligibleCards
            .filter((ownedCard) => ownedCard.card.talentId === requiredMemberTalentId)
            .map((ownedCard) => ownedCard.cardId)
        : [null];
      for (const anchorCardId of memberAnchorCardIds) {
        for (const entry of TEAM_CALCULATOR_CANDIDATE_GENERATION_CHARTS) {
          addNativeSearchCandidates({
            chartKey: entry.chartKey,
            seed: TEAM_CALCULATOR_DEFAULT_SEED,
            investmentLayer: "one-copy-maximum",
            bloomStageByCardId,
            accountState: CALCULATOR_BOARD_STATE,
            constraints: {
              memberCardIds: ownedCardIds,
              leaderOutfitCardIds: eligibleLeaderCardIds,
              anchorCardIds: anchorCardId
                ? [...requiredMemberCardIds, anchorCardId]
                : requiredMemberCardIds,
            },
            strategy: boundedSearchStrategy(
              // Compact only while the per-variant anchor fan-out is active. When a
              // required card already covers the Oshi Member role the fan-out
              // collapses to a single pass, so the full finalist/leader budget is
              // the correct bound again.
              Boolean(requiredMemberTalentId !== undefined && !oshiConstraint?.leaderRequired),
            ),
          });
        }
      }

      // Keep the native pool separate from the profile-sized enumeration pool:
      // thorough's protected standard lane must replay the same bounded pool
      // that a standalone standard request would construct.
      for (const key of candidateMap.keys()) preFanoutCandidateKeys.add(key);

      if (legalTeamSets <= effortProfile.enumMaxTeamSets) {
        const factoryPool = enumerateBoundedCandidatePool({
          ownedCards,
          eligibleLeaderCardIds,
          requiredTalentId: requiredMemberTalentId,
          requiredMemberCardIds,
          teamSetsInScope: legalTeamSets,
          effortProfile,
        });
        factoryProxyMemberSets = factoryPool.memberSets;
        for (const candidate of screenFactoryPool(factoryPool.candidates, effortProfile)) {
          candidateMap.set(candidateKey(candidate), candidate);
        }

        if (effortTier === "thorough") {
          const standardFactoryPool = enumerateBoundedCandidatePool({
            ownedCards,
            eligibleLeaderCardIds,
            requiredTalentId: requiredMemberTalentId,
            requiredMemberCardIds,
            teamSetsInScope: legalTeamSets,
            effortProfile: TEAM_CALCULATOR_EFFORT_PROFILES.standard,
          });
          for (const candidate of screenFactoryPool(
            standardFactoryPool.candidates,
            TEAM_CALCULATOR_EFFORT_PROFILES.standard,
          )) {
            const key = candidateKey(candidate);
            standardEnumerationCandidateKeys.add(key);
            standardEnumerationCandidates.set(key, candidate);
          }
        }
      }

      if (effortProfile.fanoutEnabled) {
        const proxyByCardId = new Map<string, number>();
        const cardProxy = (cardId: string, bloomStage: TeamCalculatorBloomStage): number => {
          const cached = proxyByCardId.get(cardId);
          if (cached !== undefined) return cached;
          const value = baseParameterProxy(cardId, bloomStage);
          proxyByCardId.set(cardId, value);
          return value;
        };
        const cardsByTalent = new Map<string, typeof ownedCards>();
        for (const ownedCard of ownedCards) {
          const variants = cardsByTalent.get(ownedCard.card.talentId) ?? [];
          variants.push(ownedCard);
          cardsByTalent.set(ownedCard.card.talentId, variants);
        }
        const requiredCardByTalent = new Map(
          requiredMemberCards.map((ownedCard) => [ownedCard!.card.talentId, ownedCard!] as const),
        );
        const fanoutAnchors = [...cardsByTalent.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([talentId, variants]) => {
            const requiredCard = requiredCardByTalent.get(talentId);
            if (requiredCard) return requiredCard.cardId;
            return [...variants].sort(
              (left, right) =>
                cardProxy(right.cardId, right.bloomStage) - cardProxy(left.cardId, left.bloomStage) ||
                left.cardId.localeCompare(right.cardId),
            )[0]!.cardId;
          });
        const fanoutLeaderCardIds = [...eligibleLeaderCardIds]
          .sort(
            (left, right) =>
              cardProxy(right, bloomStageByCardId[right]!) - cardProxy(left, bloomStageByCardId[left]!) ||
              left.localeCompare(right),
          )
          .slice(0, effortProfile.fanoutLeaderCap ?? eligibleLeaderCardIds.length);
        const fanoutRequiredCardIds = [...requiredMemberCardIds];
        if (
          oshiConstraint?.memberRequired &&
          !fanoutRequiredCardIds.some(
            (cardId) => cardById.get(cardId)!.talentId === oshiConstraint.talentId,
          )
        ) {
          const oshiAnchor = [...oshiConstraint.eligibleCards].sort(
            (left, right) =>
              cardProxy(right.cardId, right.bloomStage) - cardProxy(left.cardId, left.bloomStage) ||
              left.cardId.localeCompare(right.cardId),
          )[0];
          if (oshiAnchor) fanoutRequiredCardIds.push(oshiAnchor.cardId);
        }
        for (const anchorCardId of fanoutAnchors) {
          const anchorTalentId = cardById.get(anchorCardId)!.talentId;
          const anchorCardIds = fanoutRequiredCardIds.some(
            (requiredCardId) => cardById.get(requiredCardId)!.talentId === anchorTalentId,
          )
            ? fanoutRequiredCardIds
            : fanoutRequiredCardIds.length < 5
              ? [...fanoutRequiredCardIds, anchorCardId]
              : fanoutRequiredCardIds;
          for (const entry of TEAM_CALCULATOR_COARSE_SCREENING_CHARTS) {
            addNativeSearchCandidates({
              chartKey: entry.chartKey,
              seed: TEAM_CALCULATOR_DEFAULT_SEED,
              investmentLayer: "one-copy-maximum",
              bloomStageByCardId,
              accountState: CALCULATOR_BOARD_STATE,
              constraints: {
                memberCardIds: ownedCardIds,
                leaderOutfitCardIds: fanoutLeaderCardIds,
                anchorCardIds,
              },
              strategy: boundedSearchStrategy(true),
            });
          }
        }
      }
    } catch (error) {
      if (error instanceof TeamCalculatorError) throw error;
      throw new TeamCalculatorError(
        "calculation-failed",
        "No legal team could be calculated from this roster.",
      );
    }
  }

  // Request seeds are deliberately injected after native generation so they do
  // not pass through any candidate-generation screen. They are full-corpus
  // evaluated with the same cache and comparison rules as every other finalist.
  for (const seed of legalSeedCandidates) {
    candidateMap.set(candidateKey(seed), seed);
  }

  const rankedCandidates = [...candidateMap.values()]
    .map((candidate) => evaluateAverage(candidate, "search"))
    .sort(compareAverage);
  let selected = rankedCandidates[0];
  if (!selected) {
    throw new TeamCalculatorError("calculation-failed", "The calculator produced no legal finalist.");
  }
  const initialLeaderTeamFormationsReranked = rankedCandidates.length;

  if (!exhaustive) {
    const buildStarts = (
      ranked: readonly AverageEvaluation[],
      distinctMemberSetCount: number,
    ): AverageEvaluation[] => {
      const laneStarts: AverageEvaluation[] = [];
      const laneStartKeys = new Set<string>();
      const laneMemberKeys = new Set<string>();
      for (const candidate of ranked) {
        if (laneMemberKeys.size >= distinctMemberSetCount) break;
        const membersKey = teamKey(candidate.candidate.memberCardIds);
        if (laneMemberKeys.has(membersKey)) continue;
        laneStarts.push(candidate);
        laneStartKeys.add(candidateKey(candidate.candidate));
        laneMemberKeys.add(membersKey);
      }
      for (const seed of legalSeedCandidates) {
        const evaluation = averageCache.get(candidateKey(seed));
        if (!evaluation) throw new TeamCalculatorError("calculation-failed", "An adopted seed was not evaluated.");
        const key = candidateKey(seed);
        if (laneStartKeys.has(key)) continue;
        laneStarts.push(evaluation);
        laneStartKeys.add(key);
      }
      return laneStarts;
    };

    let sawCycleGuard = false;
    let sawIterationCap = false;
    const runAscentLane = (
      laneStarts: readonly AverageEvaluation[],
      laneProfile: TeamCalculatorEffortProfile,
    ): void => {
    const visited = new Set<string>();
    for (const start of laneStarts) {
      let current = start;
      visited.add(candidateKey(current.candidate));
      for (let pass = 0; pass < HEURISTIC_LOCAL_ITERATION_LIMIT; pass += 1) {
        const leaderChangeNeighbors = new Map<string, Candidate>();
        const memberSwapNeighbors = new Map<string, Candidate>();
        for (const leaderOutfitCardId of eligibleLeaderCardIds) {
          if (leaderOutfitCardId === current.candidate.leaderOutfitCardId) continue;
          const candidate = {
            leaderOutfitCardId,
            memberCardIds: current.candidate.memberCardIds,
          };
          if (!candidateSatisfiesOshi(candidate)) continue;
          leaderChangeNeighbors.set(candidateKey(candidate), candidate);
        }
        for (let slot = 0; slot < 5; slot += 1) {
          if (requiredMemberCardIdSet.has(current.candidate.memberCardIds[slot]!)) continue;
          const otherIds = current.candidate.memberCardIds.filter((_, index) => index !== slot);
          const otherTalents = new Set(otherIds.map((cardId) => cardById.get(cardId)!.talentId));
          for (const ownedCard of ownedCards) {
            if (
              ownedCard.cardId === current.candidate.memberCardIds[slot] ||
              otherIds.includes(ownedCard.cardId) ||
              otherTalents.has(ownedCard.card.talentId)
            ) {
              continue;
            }
            const memberCardIds = [...current.candidate.memberCardIds];
            memberCardIds[slot] = ownedCard.cardId;
            const candidate = {
              leaderOutfitCardId: current.candidate.leaderOutfitCardId,
              memberCardIds: asTeamTuple(memberCardIds),
            };
            if (!candidateSatisfiesOshi(candidate)) continue;
            memberSwapNeighbors.set(candidateKey(candidate), candidate);
          }
        }
        const coarseLeaderChanges = [...leaderChangeNeighbors.values()]
          .map((candidate) => ({ candidate, relativeUtility: evaluateCoarse(candidate) }))
          .sort(compareScreened);
        const coarseMemberSwaps = [...memberSwapNeighbors.values()]
          .map((candidate) => ({ candidate, relativeUtility: evaluateCoarse(candidate) }))
          .sort(compareScreened);
        const coarseOrdinaryFinalists = [...coarseLeaderChanges, ...coarseMemberSwaps]
          .sort(compareScreened)
          .slice(0, laneProfile.coarseKeep)
          .map((entry) => entry.candidate);
        // Joint moves are component-guided rather than the full leader x swap
        // Cartesian product: pairing only the coarse-strongest leader changes
        // with the coarse-strongest member swaps bounds the extra coarse work
        // to jointLeaderComponentKeep x jointSwapComponentKeep formations per
        // pass, where the unfiltered product measured tens of seconds on large
        // rosters. The never-below-best-seen incumbent keeps any narrowing
        // strictly non-harmful.
        const jointNeighbors = new Map<string, Candidate>();
        const ordinaryKeys = new Set([
          ...leaderChangeNeighbors.keys(),
          ...memberSwapNeighbors.keys(),
        ]);
        const topJointLeaderIds = coarseLeaderChanges
          .slice(0, laneProfile.jointLeaderComponentKeep)
          .map((entry) => entry.candidate.leaderOutfitCardId);
        const topJointSwapMembers = coarseMemberSwaps
          .slice(0, laneProfile.jointSwapComponentKeep)
          .map((entry) => entry.candidate.memberCardIds);
        for (const memberCardIds of topJointSwapMembers) {
          for (const leaderOutfitCardId of topJointLeaderIds) {
            const jointCandidate = { leaderOutfitCardId, memberCardIds };
            if (!candidateSatisfiesOshi(jointCandidate)) continue;
            const key = candidateKey(jointCandidate);
            if (ordinaryKeys.has(key)) continue;
            jointNeighbors.set(key, jointCandidate);
          }
        }
        const coarseJointFinalists = [...jointNeighbors.values()]
          .map((candidate) => ({ candidate, relativeUtility: evaluateCoarse(candidate) }))
          .sort(compareScreened)
          .slice(0, laneProfile.jointCoarseKeep)
          .map((entry) => entry.candidate);
        const proxyFinalists = [...coarseOrdinaryFinalists, ...coarseJointFinalists]
          .map((candidate) => ({ candidate, relativeUtility: evaluateProxy(candidate) }))
          .sort(compareScreened)
          .slice(0, laneProfile.proxyKeep)
          .map((entry) => entry.candidate);
        const neighborhood = proxyFinalists.map((candidate) => evaluateAverage(candidate, "search"));
        const improvement = [...neighborhood].sort(compareAverage)[0];
        localRefinementIterations += 1;
        if (
          !improvement ||
          improvement.relativeUtility.central <= current.relativeUtility.central
        ) {
          break;
        }
        const key = candidateKey(improvement.candidate);
        if (visited.has(key)) {
          sawCycleGuard = true;
          break;
        }
        current = improvement;
        visited.add(key);
        if (pass === HEURISTIC_LOCAL_ITERATION_LIMIT - 1) {
          sawIterationCap = true;
        }
      }
    }
    };

    const thoroughStarts = buildStarts(rankedCandidates, effortProfile.ascentSeedCount);
    const thoroughStartKeys = new Set(thoroughStarts.map((start) => candidateKey(start.candidate)));
    if (
      effortTier === "thorough" &&
      effortProfile.enumLeaderStartCap > 0 &&
      effortProfile.enumLeaderStartSetKeep !== null &&
      factoryProxyMemberSets.length > 0
    ) {
      const proxyTopMemberSet = factoryProxyMemberSets[0]!;
      const leadersRankedByCoarse = eligibleLeaderCardIds
        .map((leaderOutfitCardId) => {
          const candidate = { leaderOutfitCardId, memberCardIds: proxyTopMemberSet };
          return { candidate, relativeUtility: evaluateCoarse(candidate) };
        })
        .filter(({ candidate }) => candidateSatisfiesOshi(candidate))
        .sort(compareScreened)
        .slice(0, effortProfile.enumLeaderStartCap);
      for (const { candidate: leaderCandidate } of leadersRankedByCoarse) {
        const leaderAnchoredCandidate = factoryProxyMemberSets
          .slice(0, effortProfile.enumLeaderStartSetKeep)
          .map((memberCardIds) => ({
            candidate: { leaderOutfitCardId: leaderCandidate.leaderOutfitCardId, memberCardIds },
            relativeUtility: evaluateCoarse({
              leaderOutfitCardId: leaderCandidate.leaderOutfitCardId,
              memberCardIds,
            }),
          }))
          .filter(({ candidate }) => candidateSatisfiesOshi(candidate))
          .sort(compareScreened)[0];
        if (!leaderAnchoredCandidate) continue;
        const evaluation = evaluateAverage(leaderAnchoredCandidate.candidate, "search");
        const key = candidateKey(evaluation.candidate);
        if (thoroughStartKeys.has(key)) continue;
        thoroughStarts.push(evaluation);
        thoroughStartKeys.add(key);
      }
    }
    runAscentLane(thoroughStarts, effortProfile);
    let protectedLaneStartCount = 0;
    if (effortTier === "thorough") {
      // Protected standard lane: thorough must never return below what a
      // standalone standard run would find. The lane replays standard's exact
      // search - its pool is the pre-fan-out candidates plus the adopted seeds
      // (precisely what a standalone standard run ranks), its keeps are the
      // standard profile's, and it gets a fresh visited set so trajectory
      // interleaving cannot clip it. Caches and the best-seen incumbent are
      // shared, so the replay is cheap and its fixpoints join the selection.
      const standardProfile = TEAM_CALCULATOR_EFFORT_PROFILES.standard;
      const seedKeys = new Set(legalSeedCandidates.map((seed) => candidateKey(seed)));
      const standardOnlyEvaluations = [...standardEnumerationCandidates.values()]
        .map((candidate) => evaluateAverage(candidate, "search"));
      const standardRanked = [...rankedCandidates, ...standardOnlyEvaluations]
        .filter((evaluation) => {
          const key = candidateKey(evaluation.candidate);
          return (
            preFanoutCandidateKeys.has(key) ||
            standardEnumerationCandidateKeys.has(key) ||
            seedKeys.has(key)
          );
        })
        .sort(compareAverage);
      const standardStarts = buildStarts(standardRanked, standardProfile.ascentSeedCount);
      runAscentLane(standardStarts, standardProfile);
      protectedLaneStartCount = standardStarts.length;
    }
    localRefinementSeedCount = thoroughStarts.length + protectedLaneStartCount;
    localRefinementStatus = sawIterationCap
      ? "iteration-cap"
      : sawCycleGuard
        ? "cycle-guard"
        : "fixed-point";
    selected = bestSeen;
    if (!selected) {
      throw new TeamCalculatorError("calculation-failed", "The calculator produced no corpus-evaluated finalist.");
    }
  }

  const adoptedSeedCentralUtilities = legalSeedCandidates.map(
    (seed) => averageCache.get(candidateKey(seed))!.relativeUtility.central,
  );
  const maxAdoptedCentralUtility = adoptedSeedCentralUtilities.length > 0
    ? Math.max(...adoptedSeedCentralUtilities)
    : null;
  if (
    maxAdoptedCentralUtility !== null &&
    selected.relativeUtility.central < maxAdoptedCentralUtility
  ) {
    throw new TeamCalculatorError(
      "calculation-failed",
      "The selected team fell below an adopted seed.",
    );
  }

  const selectedCandidate = selected.candidate;
  const leaderCard = requirePublicCard(selectedCandidate.leaderOutfitCardId);
  const leaderBloomStage = bloomStageByCardId[leaderCard.id];
  if (leaderBloomStage === undefined) {
    throw new TeamCalculatorError("calculation-failed", "The calculated Leader is outside the owned roster.");
  }
  const formationOrderRecommendation = recommendFormationOrder({
    leaderOutfitCardId: selectedCandidate.leaderOutfitCardId,
    members: selectedCandidate.memberCardIds.map((cardId) => ({
      cardId,
      bloomStage: bloomStageByCardId[cardId]!,
    })) as unknown as readonly [
      { cardId: string; bloomStage: TeamCalculatorBloomStage },
      { cardId: string; bloomStage: TeamCalculatorBloomStage },
      { cardId: string; bloomStage: TeamCalculatorBloomStage },
      { cardId: string; bloomStage: TeamCalculatorBloomStage },
      { cardId: string; bloomStage: TeamCalculatorBloomStage },
    ],
    corpus: TEAM_CALCULATOR_CORPUS.entries,
  });
  const memberById = new Map(selectedCandidate.memberCardIds
    .map((cardId) => {
      const card = requirePublicCard(cardId);
      const bloomStage = bloomStageByCardId[cardId];
      if (bloomStage === undefined) {
        throw new TeamCalculatorError("calculation-failed", "A calculated Member is outside the owned roster.");
      }
      return [cardId, { ...cardSummary(card), bloomStage }] as const;
    }));
  const members = formationOrderRecommendation.order.map((cardId) => memberById.get(cardId)!);
  const selectedOshiMemberCardId = oshiConstraint?.memberRequired
    ? selectedCandidate.memberCardIds.find(
        (cardId) => cardById.get(cardId)?.talentId === oshiConstraint.talentId,
      ) ?? null
    : null;
  const selectedOshiLeaderCardId =
    oshiConstraint?.leaderRequired && leaderCard.talentId === oshiConstraint.talentId
      ? leaderCard.id
      : null;
  if (
    oshiConstraint &&
    ((oshiConstraint.memberRequired && !selectedOshiMemberCardId) ||
      (oshiConstraint.leaderRequired && !selectedOshiLeaderCardId))
  ) {
    throw new TeamCalculatorError(
      "calculation-failed",
      "The calculated team did not satisfy the Oshi constraint.",
    );
  }

  const synergies = accumulateCorpusSynergies(selectedCandidate, evaluateRaw);

  const alternatives = members.map((member) => {
    if (requiredMemberCardIdSet.has(member.cardId)) {
      return {
        replacesCardId: member.cardId,
        fixedLeaderCardId: selectedCandidate.leaderOutfitCardId,
        comparisonBasis:
          "fixed-selected-leader-and-canonical-order-across-representative-corpus" as const,
        lossSignConvention: "positive-means-selected-team-is-better" as const,
        coverage: {
          selectionMethod: exhaustive
            ? "exhaustive-full-corpus" as const
            : "bounded-two-stage-screen" as const,
          eligibleCardCount: 0,
          coarseScreenedCardCount: 0,
          corpusProxyScreenedCardCount: 0,
          fullCorpusRerankedCardCount: 0,
          returnedCardCount: 0,
        },
        cards: [],
      };
    }
    const otherIds = selectedCandidate.memberCardIds.filter((cardId) => cardId !== member.cardId);
    const otherTalents = new Set(otherIds.map((cardId) => cardById.get(cardId)!.talentId));
    const replacementCandidates = ownedCards
      .filter(
        (ownedCard) =>
          ownedCard.cardId !== member.cardId &&
          !otherIds.includes(ownedCard.cardId) &&
          !otherTalents.has(ownedCard.card.talentId),
      )
      .map((ownedCard) => {
        const memberCardIds = asTeamTuple([...otherIds, ownedCard.cardId]);
        const candidate = {
          leaderOutfitCardId: selectedCandidate.leaderOutfitCardId,
          memberCardIds,
        };
        return { ownedCard, candidate };
      })
      .filter(({ candidate }) => candidateSatisfiesOshi(candidate))
      .sort((left, right) => left.ownedCard.cardId.localeCompare(right.ownedCard.cardId));
    const coarseReplacements = exhaustive
      ? replacementCandidates
      : replacementCandidates
          .map((entry) => ({
            ...entry,
            relativeUtility: evaluateCoarse(entry.candidate, "replacement"),
          }))
          .sort(compareScreened)
          .slice(0, REPLACEMENT_COARSE_FINALIST_COUNT);
    const screened = exhaustive
      ? coarseReplacements
      : coarseReplacements
          .map((entry) => ({
            ...entry,
            relativeUtility: evaluateProxy(entry.candidate, "replacement"),
          }))
          .sort(compareScreened)
          .slice(0, REPLACEMENT_CORPUS_FINALIST_COUNT);
    const cards = screened
      .map(({ ownedCard, candidate }) => {
        const alternative = evaluateAverage(
          {
            leaderOutfitCardId: candidate.leaderOutfitCardId,
            memberCardIds: candidate.memberCardIds,
          },
          "replacement",
        );
        const replacementImpact = buildReplacementImpact({
          selectedCandidate,
          alternativeCandidate: candidate,
          outgoingCardId: member.cardId,
          incomingCardId: ownedCard.cardId,
          selectedSynergies: synergies,
          alternativeSynergies: accumulateCorpusSynergies(candidate, evaluateRaw),
          selectedAverage: selected,
          alternativeAverage: alternative,
          evaluateRaw,
          bloomStageByCardId,
        });
        return {
          ...cardSummary(ownedCard.card),
          bloomStage: ownedCard.bloomStage,
          relativeUtility: alternative.relativeUtility,
          modeledUtilityLoss: subtractIntervals(selected.relativeUtility, alternative.relativeUtility),
          replacementImpact,
        };
      })
      .sort(
        (left, right) =>
          left.modeledUtilityLoss.central - right.modeledUtilityLoss.central ||
          left.cardId.localeCompare(right.cardId),
      )
      .slice(0, 3);
    return {
      replacesCardId: member.cardId,
      fixedLeaderCardId: selectedCandidate.leaderOutfitCardId,
      comparisonBasis:
        "fixed-selected-leader-and-canonical-order-across-representative-corpus" as const,
      lossSignConvention: "positive-means-selected-team-is-better" as const,
      coverage: {
        selectionMethod: exhaustive
          ? "exhaustive-full-corpus" as const
          : "bounded-two-stage-screen" as const,
        eligibleCardCount: replacementCandidates.length,
        coarseScreenedCardCount: exhaustive ? 0 : replacementCandidates.length,
        corpusProxyScreenedCardCount: exhaustive ? 0 : coarseReplacements.length,
        fullCorpusRerankedCardCount: screened.length,
        returnedCardCount: cards.length,
      },
      cards,
    };
  });

  // Tiered member-set telemetry: screened = any tier touched the set,
  // considered = the set advanced past the coarse screen (proxy or corpus),
  // evaluated = the set received a full-corpus search evaluation. Downstream
  // tiers are unioned so the count chain holds even for screen-bypassing seeds
  // and for the exhaustive path, which never uses the cheaper tiers.
  const consideredTeamKeys = new Set([...proxyTeamKeys, ...searchTeamKeys]);
  const screenedTeamKeys = new Set([...coarseTeamKeys, ...consideredTeamKeys]);

  const result: TeamCalculatorResult = {
    kind: "owned-roster-team-calculation",
    schemaVersion: 6,
    methodologyVersion: "yd-owned-roster-calculator-6.0.0",
    roster: {
      commit: TEAM_CALCULATOR_ROSTER_COMMIT,
      ownedCardCount: ownedCards.length,
      ownedTalentCount,
    },
    oshi: oshiConstraint
      ? {
          talentId: oshiConstraint.talentId,
          talentName: oshiConstraint.talentName,
          role: oshiConstraint.role,
          roleLabel: OSHI_ROLE_LABELS[oshiConstraint.role],
          eligibleOwnedMemberCardIds: oshiConstraint.eligibleCards.map(
            (ownedCard) => ownedCard.cardId,
          ),
          eligibleOwnedLeaderCardIds: oshiConstraint.eligibleCards.map(
            (ownedCard) => ownedCard.cardId,
          ),
          resolution: {
            member: {
              status: oshiConstraint.memberRequired ? "fulfilled" : "not-required",
              selectedCardId: selectedOshiMemberCardId,
            },
            leader: {
              status: oshiConstraint.leaderRequired ? "fulfilled" : "not-required",
              selectedCardId: selectedOshiLeaderCardId,
            },
            overallStatus: "fulfilled",
          },
        }
      : null,
    requiredMembers: requiredMemberCardIds.length > 0
      ? { cardIds: requiredMemberCardIds, status: "fulfilled" as const }
      : null,
    corpus: {
      benchmarkId: TEAM_CALCULATOR_CORPUS.benchmarkId,
      entriesSha256: TEAM_CALCULATOR_CORPUS.entriesSha256,
      difficulty: "expert",
      weighting: "equal-per-chart",
      chartCount: 30,
      referenceChartCount: 21,
      currentChartCount: 9,
      referenceSharePermil: 700,
      currentSharePermil: 300,
      charts: TEAM_CALCULATOR_CORPUS.entries.map((entry) => ({
        chartKey: entry.chartKey,
        segment: entry.segment,
      })),
    },
    score: {
      kind: "representative-corpus-average-relative-utility",
      absoluteLiveScoreAvailable: false,
      relativeUtility: selected.relativeUtility,
      referenceAverage: selected.referenceAverage,
      currentAverage: selected.currentAverage,
    },
    leader: {
      ...cardSummary(leaderCard),
      outfitName: leaderCard.leaderOutfit.costumeName,
      sourceCardBloomStage: leaderBloomStage,
    },
    members,
    synergies,
    alternatives,
    formationOrder: {
      kind: formationOrderRecommendation.kind,
      status: formationOrderRecommendation.status,
      label: formationOrderRecommendation.label,
      methodologyVersion: formationOrderRecommendation.methodologyVersion,
      cardIds: [...formationOrderRecommendation.order],
      exactTimelineAvailable: formationOrderRecommendation.method.exactTimelineAvailable,
      changesModeledTimingUtility: formationOrderRecommendation.method.changesModeledTimingUtility,
      permutationsChecked: formationOrderRecommendation.method.permutationsChecked,
      corpusChartCount: CORPUS_CHART_COUNT as 30,
      markerLayoutCount: formationOrderRecommendation.scenarios.layoutCount,
      timingScenarioCount: formationOrderRecommendation.scenarios.count,
      activeFirstCheck: formationOrderRecommendation.method.activeFirstCheck,
      confidence: {
        kind: formationOrderRecommendation.confidence.kind,
        winSharePermil: formationOrderRecommendation.objective.selected.winSharePermil,
        runnerUpGapPermil: formationOrderRecommendation.objective.runnerUpGapPermil,
        maxRegretPermil: formationOrderRecommendation.objective.selected.maxRegretPermil,
        meanRegretPermil: formationOrderRecommendation.objective.selected.meanRegretPermil,
        statement: formationOrderRecommendation.confidence.statement,
      },
      members: formationOrderRecommendation.components.map((component) => ({
        cardId: component.cardId,
        slot: component.recommendedSlot,
        bloomStage: component.bloomStage,
        active: {
          ...component.active,
          persistentSupportPermilAcrossCorpus: {
            ...component.active.persistentSupportPermilAcrossCorpus,
          },
        },
        special: {
          ...component.special,
          comboGateThresholds: [...component.special.comboGateThresholds],
        },
      })),
    },
    search: {
      resultClaim: exhaustive
        ? "certified-within-canonical-corpus-scope"
        : "bounded-search",
      certificateKind: exhaustive ? "certified" : "heuristic-bounded",
      certificateId: exhaustive ? scopeHash : null,
      scopeHash,
      runRecordId,
      optimalityClaim: exhaustive
        ? "exhaustive-across-constraint-eligible-teams-leaders-and-frozen-corpus-under-canonical-order"
        : "not-certified",
      objective: "equal-chart-average-relative-utility",
      objectiveId: TEAM_CALCULATOR_OBJECTIVE_ID,
      evaluatorMethodologyVersion: TEAM_CALCULATOR_EVALUATOR_METHODOLOGY,
      arithmeticMethodologyVersion: TEAM_CALCULATOR_ARITHMETIC_METHODOLOGY,
      comparisonOrder: "canonical-card-id-order",
      effortTier,
      seedCandidates: request.seedCandidates === undefined
        ? null
        : {
            provided: providedSeedCount,
            legal: legalSeedCandidates.length,
            adopted: legalSeedCandidates.length,
            maxAdoptedCentralUtility,
            // Per-seed echo: identity plus evaluated central for every adopted
            // seed, so the contract reconciles the claimed maximum against the
            // list and a caller can verify the seeds it sent were the seeds
            // evaluated. The contract cannot re-evaluate; identity plus
            // arithmetic reconciliation is the enforceable ceiling.
            evaluations: legalSeedCandidates.map((seed) => ({
              leaderOutfitCardId: seed.leaderOutfitCardId,
              memberCardIds: [...seed.memberCardIds],
              centralUtility: averageCache.get(candidateKey(seed))!.relativeUtility.central,
            })),
          },
      localRefinementSeedCount: exhaustive ? 0 : localRefinementSeedCount,
      teamSetsInScope: legalTeamSets,
      teamSetsScreened: screenedTeamKeys.size,
      teamSetsConsidered: consideredTeamKeys.size,
      teamSetsEvaluated: searchTeamKeys.size,
      teamSetsPruned: 0,
      unsearchedTeamSets: legalTeamSets - screenedTeamKeys.size,
      optimalityGap: exhaustive ? 0 : null,
      candidateGenerationMode: exhaustive ? "exhaustive" : "bounded-native-search",
      candidateGenerationChartCount,
      candidateGenerationChartKeys: exhaustive
        ? []
        : TEAM_CALCULATOR_CANDIDATE_GENERATION_CHARTS.map((entry) => entry.chartKey),
      initialLeaderTeamFormationsReranked,
      searchLeaderTeamFormationsReranked: searchFormationKeys.size,
      replacementLeaderTeamFormationsReranked: replacementFormationKeys.size,
      localRefinementScope: exhaustive
        ? "not-needed-exhaustive"
        : "two-stage-screened-single-or-joint-leader-and-member-moves-multi-start",
      localRefinementStatus,
      localRefinementIterations,
      candidateGenerationUtilityEvaluations: nativeUtilityEvaluations,
      corpusUtilityEvaluations: adapterUtilityEvaluations,
      utilityEvaluations: adapterUtilityEvaluations + nativeUtilityEvaluations,
      formationOrderGloballyCertified: false,
      formationOrderClaim: "conditional-on-selected-team",
      canonicalCorpusOptimalityClaim: exhaustive,
    },
  };
  const parsedResult = TeamCalculatorResultSchema.safeParse(result);
  if (!parsedResult.success) {
    throw new TeamCalculatorError("calculation-failed", "The calculated team failed validation.");
  }
  return parsedResult.data;
}
