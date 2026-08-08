import rankingBenchmarkJson from "../../../data/native/ranking-benchmark-v1.json";
import { createHash } from "node:crypto";

import { recommendFormationOrder } from "./formation-order-recommender";
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
} from "./team-calculator-contract";

export const TEAM_CALCULATOR_ROSTER_COMMIT = publicData.sourceSnapshots.english.commit;
export const TEAM_CALCULATOR_DEFAULT_SEED = 0x5941_474f;
export const TEAM_CALCULATOR_MAX_EXACT_TEAM_SETS = 25;
export const TEAM_CALCULATOR_OBJECTIVE_ID = "yd-equal-chart-average-relative-utility-v1" as const;
export const TEAM_CALCULATOR_EVALUATOR_METHODOLOGY = "yd-native-utility-1.0.0" as const;
export const TEAM_CALCULATOR_ARITHMETIC_METHODOLOGY = "yd-native-six-decimal-rounding-1.0.0" as const;

// The coordinate ascent must run to a fixpoint, not take a single step. At 1 it
// adopted one improving swap and stopped, leaving the new incumbent's own
// neighbourhood unexamined — so the backups panel, which screens that same
// neighbourhood on the identical corpus, routinely displayed replacements that
// strictly beat the headline team. Measured over 440 sampled rosters: 98 runs
// (22%, and 38 of 40 full-roster runs) showed at least one strictly improving
// backup at 1, and none did at a fixpoint. The longest observed ascent was 7
// passes; 12 leaves headroom while still bounding the worst case.
const HEURISTIC_LOCAL_ITERATION_LIMIT = 12;
const LOCAL_COARSE_FINALIST_COUNT = 48;
const LOCAL_CORPUS_FINALIST_COUNT = 12;
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

export type TeamCalculatorDependencies = Readonly<{
  search?: SearchRunner;
  evaluate?: UtilityRunner;
}>;

export class TeamCalculatorError extends Error {
  readonly code:
    | "invalid-request"
    | "stale-roster"
    | "unknown-card"
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
): string {
  const scope = {
    schemaVersion: request.schemaVersion,
    rosterCommit: request.rosterCommit,
    ownedCards: [...ownedCards]
      .map(({ cardId, bloomStage }) => ({ cardId, bloomStage }))
      .sort((left, right) => left.cardId.localeCompare(right.cardId)),
    oshi: request.oshi ?? null,
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

function countLegalTeamSets(cards: readonly PublicCard[], requiredTalentId?: string): number {
  const variantsPerTalent = new Map<string, number>();
  for (const card of cards) {
    variantsPerTalent.set(card.talentId, (variantsPerTalent.get(card.talentId) ?? 0) + 1);
  }
  const requiredVariantCount = requiredTalentId
    ? variantsPerTalent.get(requiredTalentId) ?? 0
    : 1;
  if (requiredTalentId && requiredVariantCount === 0) return 0;
  const targetMemberCount = requiredTalentId ? 4 : 5;
  const ways = [1, 0, 0, 0, 0, 0];
  for (const [talentId, variantCount] of variantsPerTalent) {
    if (talentId === requiredTalentId) continue;
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

function enumerateLegalTeamSets(cards: readonly PublicCard[], requiredTalentId?: string): MemberTuple[] {
  const sorted = [...cards].sort((left, right) => left.id.localeCompare(right.id));
  const teams: MemberTuple[] = [];
  const visit = (start: number, selected: string[], talents: Set<string>): void => {
    if (selected.length === 5) {
      teams.push(asTeamTuple(selected));
      return;
    }
    for (let index = start; index <= sorted.length - (5 - selected.length); index += 1) {
      const card = sorted[index]!;
      if (talents.has(card.talentId)) continue;
      selected.push(card.id);
      talents.add(card.talentId);
      visit(index + 1, selected, talents);
      talents.delete(card.talentId);
      selected.pop();
    }
  };
  if (requiredTalentId) {
    const requiredCards = sorted.filter((card) => card.talentId === requiredTalentId);
    const remainingCards = sorted.filter((card) => card.talentId !== requiredTalentId);
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
      visitRequired(0, [requiredCard.id], new Set([requiredTalentId]));
    }
  } else {
    visit(0, [], new Set());
  }
  return teams;
}

function candidateKey(candidate: Candidate): string {
  return `${candidate.leaderOutfitCardId}|${candidate.memberCardIds.join("|")}`;
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

  const ownedCards = [...request.ownedCards]
    .sort((left, right) => left.cardId.localeCompare(right.cardId))
    .map((ownedCard) => ({ ...ownedCard, card: requirePublicCard(ownedCard.cardId) }));
  const scopeHash = calculateOwnedRosterScopeHash(request, ownedCards);
  const runRecordId = `yd-owned-roster-run-v3-${scopeHash}`;
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
  const requiredMemberTalentId = oshiConstraint?.memberRequired
    ? oshiConstraint.talentId
    : undefined;
  const eligibleLeaderCardIds = oshiConstraint?.leaderRequired
    ? oshiConstraint.eligibleCards.map((ownedCard) => ownedCard.cardId)
    : ownedCardIds;
  const legalTeamSets = countLegalTeamSets(
    ownedCards.map((ownedCard) => ownedCard.card),
    requiredMemberTalentId,
  );
  const search = dependencies.search ?? searchNativeCanonicalCandidates;
  const evaluate = dependencies.evaluate ?? evaluateNativeRelativeUtility;
  const rawCache = new Map<string, NativeUtilityResult>();
  const averageCache = new Map<string, AverageEvaluation>();
  const coarseCache = new Map<string, UtilityInterval>();
  const proxyCache = new Map<string, UtilityInterval>();
  const searchTeamKeys = new Set<string>();
  const searchFormationKeys = new Set<string>();
  const replacementFormationKeys = new Set<string>();
  let adapterUtilityEvaluations = 0;
  let nativeUtilityEvaluations = 0;

  const candidateSatisfiesOshi = (candidate: Candidate): boolean => {
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
    if (cached) return cached;
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
    return result;
  };

  const evaluateProxy = (rawCandidate: Candidate): UtilityInterval => {
    const candidate: Candidate = {
      leaderOutfitCardId: rawCandidate.leaderOutfitCardId,
      memberCardIds: asTeamTuple(rawCandidate.memberCardIds),
    };
    const key = candidateKey(candidate);
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

  const evaluateCoarse = (rawCandidate: Candidate): UtilityInterval => {
    const candidate: Candidate = {
      leaderOutfitCardId: rawCandidate.leaderOutfitCardId,
      memberCardIds: asTeamTuple(rawCandidate.memberCardIds),
    };
    const key = candidateKey(candidate);
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

  const candidateMap = new Map<string, Candidate>();
  let candidateGenerationChartCount = 0;
  let localRefinementStatus: TeamCalculatorResult["search"]["localRefinementStatus"] =
    "not-needed-exhaustive";
  let localRefinementIterations = 0;

  if (legalTeamSets <= TEAM_CALCULATOR_MAX_EXACT_TEAM_SETS) {
    const teams = enumerateLegalTeamSets(
      ownedCards.map((ownedCard) => ownedCard.card),
      requiredMemberTalentId,
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
      const memberAnchorCardIds = oshiConstraint?.memberRequired
        ? oshiConstraint.eligibleCards.map((ownedCard) => ownedCard.cardId)
        : [null];
      for (const anchorCardId of memberAnchorCardIds) {
        for (const entry of TEAM_CALCULATOR_CANDIDATE_GENERATION_CHARTS) {
          const nativeResult = search({
            chartKey: entry.chartKey,
            seed: TEAM_CALCULATOR_DEFAULT_SEED,
            investmentLayer: "one-copy-maximum",
            bloomStageByCardId,
            accountState: CALCULATOR_BOARD_STATE,
            constraints: {
              memberCardIds: ownedCardIds,
              leaderOutfitCardIds: eligibleLeaderCardIds,
              ...(anchorCardId ? { anchorCardId } : {}),
            },
            strategy: boundedSearchStrategy(
              Boolean(oshiConstraint?.memberRequired && !oshiConstraint.leaderRequired),
            ),
          });
          nativeUtilityEvaluations += nativeResult.counts.utilityEvaluations;
          const nativeCandidates: Candidate[] = nativeResult.candidates.map((candidate) => ({
            leaderOutfitCardId: candidate.leaderOutfitCardId,
            memberCardIds: asTeamTuple(candidate.memberCardIds),
          }));
          for (const candidate of nativeCandidates) {
            if (!candidateSatisfiesOshi(candidate)) continue;
            candidateMap.set(candidateKey(candidate), candidate);
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

  let rankedCandidates = [...candidateMap.values()]
    .map((candidate) => evaluateAverage(candidate, "search"))
    .sort(compareAverage);
  let selected = rankedCandidates[0];
  if (!selected) {
    throw new TeamCalculatorError("calculation-failed", "The calculator produced no legal finalist.");
  }
  const initialLeaderTeamFormationsReranked = rankedCandidates.length;

  if (legalTeamSets > TEAM_CALCULATOR_MAX_EXACT_TEAM_SETS) {
    const visited = new Set<string>([candidateKey(selected.candidate)]);
    localRefinementStatus = "fixed-point";
    for (let pass = 0; pass < HEURISTIC_LOCAL_ITERATION_LIMIT; pass += 1) {
      const neighbors = new Map<string, Candidate>();
      for (const leaderOutfitCardId of eligibleLeaderCardIds) {
        if (leaderOutfitCardId === selected.candidate.leaderOutfitCardId) continue;
        const candidate = { leaderOutfitCardId, memberCardIds: selected.candidate.memberCardIds };
        if (!candidateSatisfiesOshi(candidate)) continue;
        neighbors.set(candidateKey(candidate), candidate);
      }
      for (let slot = 0; slot < 5; slot += 1) {
        const otherIds = selected.candidate.memberCardIds.filter((_, index) => index !== slot);
        const otherTalents = new Set(otherIds.map((cardId) => cardById.get(cardId)!.talentId));
        for (const ownedCard of ownedCards) {
          if (otherIds.includes(ownedCard.cardId) || otherTalents.has(ownedCard.card.talentId)) continue;
          const memberCardIds = [...selected.candidate.memberCardIds];
          memberCardIds[slot] = ownedCard.cardId;
          const candidate = {
            leaderOutfitCardId: selected.candidate.leaderOutfitCardId,
            memberCardIds: asTeamTuple(memberCardIds),
          };
          if (!candidateSatisfiesOshi(candidate)) continue;
          neighbors.set(candidateKey(candidate), candidate);
        }
      }
      const coarseFinalists = [...neighbors.values()]
        .map((candidate) => ({ candidate, relativeUtility: evaluateCoarse(candidate) }))
        .sort(compareScreened)
        .slice(0, LOCAL_COARSE_FINALIST_COUNT)
        .map((entry) => entry.candidate);
      const proxyFinalists = coarseFinalists
        .map((candidate) => ({ candidate, relativeUtility: evaluateProxy(candidate) }))
        .sort(compareScreened)
        .slice(0, LOCAL_CORPUS_FINALIST_COUNT)
        .map((entry) => entry.candidate);
      rankedCandidates = [
        selected,
        ...proxyFinalists.map((candidate) => evaluateAverage(candidate, "search")),
      ].sort(compareAverage);
      const improvement = rankedCandidates.find(
        (candidate) =>
          candidate.relativeUtility.central >
          selected!.relativeUtility.central + IMPROVEMENT_EPSILON,
      );
      localRefinementIterations += 1;
      if (!improvement) break;
      const key = candidateKey(improvement.candidate);
      if (visited.has(key)) {
        localRefinementStatus = "cycle-guard";
        break;
      }
      selected = improvement;
      visited.add(key);
      if (pass === HEURISTIC_LOCAL_ITERATION_LIMIT - 1) {
        localRefinementStatus = "iteration-cap";
      }
    }
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

  type SynergyAccumulator = {
    source: "leader" | "passive";
    sourceCardId: string;
    effectGroupId: string;
    effectKind: "performance-up" | "technique-up" | "sense-up" | "all-parameters-up";
    valuePermil: number;
    activeCharts: Set<string>;
    alternatives: Map<string, string[]>;
  };
  const synergyByKey = new Map<string, SynergyAccumulator>();
  for (const entry of TEAM_CALCULATOR_CORPUS.entries) {
    const utility = evaluateRaw(selectedCandidate, entry.chartKey);
    for (const contribution of utility.components.parameterEffects.contributions) {
      const key = [
        contribution.source,
        contribution.sourceCardId,
        contribution.effectGroupId,
        contribution.effectKind,
        contribution.valuePermil,
      ].join("|");
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
          .map((index) => selectedCandidate.memberCardIds[index])
          .filter((cardId): cardId is string => cardId !== undefined);
        const normalized = [...alternative].sort();
        accumulator.alternatives.set(normalized.join("|"), normalized);
      }
      synergyByKey.set(key, accumulator);
    }
  }
  const synergies = [...synergyByKey.values()]
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

  const exhaustive = legalTeamSets <= TEAM_CALCULATOR_MAX_EXACT_TEAM_SETS;
  const alternatives = members.map((member) => {
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
            relativeUtility: evaluateCoarse(entry.candidate),
          }))
          .sort(compareScreened)
          .slice(0, REPLACEMENT_COARSE_FINALIST_COUNT);
    const screened = exhaustive
      ? coarseReplacements
      : coarseReplacements
          .map((entry) => ({
            ...entry,
            relativeUtility: evaluateProxy(entry.candidate),
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
        return {
          ...cardSummary(ownedCard.card),
          bloomStage: ownedCard.bloomStage,
          relativeUtility: alternative.relativeUtility,
          modeledUtilityLoss: subtractIntervals(selected.relativeUtility, alternative.relativeUtility),
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

  const result: TeamCalculatorResult = {
    kind: "owned-roster-team-calculation",
    schemaVersion: 3,
    methodologyVersion: "yd-owned-roster-calculator-3.0.0",
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
      teamSetsInScope: legalTeamSets,
      teamSetsConsidered: searchTeamKeys.size,
      teamSetsEvaluated: searchTeamKeys.size,
      teamSetsPruned: 0,
      unsearchedTeamSets: legalTeamSets - searchTeamKeys.size,
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
        : "two-stage-screened-one-member-swap-or-leader-change",
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
