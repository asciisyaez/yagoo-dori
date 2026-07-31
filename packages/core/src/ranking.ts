import { researchBundle } from "./data";
import { combinations, optimizeTeam } from "./optimizer";
import {
  exactShapleyContributions,
  representativeCharts,
  type ChartContext,
  type PlayMode,
} from "./simulator";
import { RankingSnapshotSchema, type MemberCard, type RankingEntry, type RankingSnapshot } from "./schemas";

type Scale = { median: number; mad: number };
export type FrozenBaseline = {
  G: Scale;
  P: Scale;
  B: Scale;
  E: Scale;
  C: Scale;
};

export const FROZEN_BASELINE: FrozenBaseline = {
  G: { median: 130, mad: 15 },
  P: { median: 158, mad: 20 },
  B: { median: 0.62, mad: 0.15 },
  E: { median: 128, mad: 15 },
  C: { median: 0, mad: 0.68 },
};

export const METHODOLOGY_VERSION = "yd-m1.0.0-beta";
export const RESEARCH_SEED = 260729;

type CardMetrics = { G: number; P: number; B: number; E: number };

function robustZ(value: number, scale: Scale) {
  return (value - scale.median) / (1.4826 * scale.mad);
}

export function scoreMetricsToIndex(metrics: CardMetrics, baseline: FrozenBaseline) {
  const C =
    0.55 * robustZ(metrics.G, baseline.G) +
    0.25 * robustZ(metrics.P, baseline.P) +
    0.1 * robustZ(metrics.B, baseline.B) +
    0.1 * robustZ(metrics.E, baseline.E);
  const performanceIndex = 100 + 10 * robustZ(C, baseline.C);
  return { C, performanceIndex };
}

type TierInput = {
  performanceIndex: number;
  interval: [number, number];
  samplingError: number;
  sourceComplete: boolean;
  probabilityAbove120: number;
  probabilityTopDecile: number;
  probabilityBelow80: number;
  negativeMarginalFraction: number;
  boundaryConfidence: number;
  previousTier?: RankingEntry["tier"];
};

export function classifyTier(input: TierInput): RankingEntry["tier"] {
  if (!input.sourceComplete || input.interval[1] - input.interval[0] > 10 || input.samplingError > 0.5) {
    return "Provisional";
  }

  let candidate: RankingEntry["tier"];
  if (input.performanceIndex >= 120) {
    candidate =
      input.probabilityAbove120 >= 0.9 && input.probabilityTopDecile >= 0.8 ? "SS" : "S";
  } else if (input.performanceIndex >= 110) candidate = "S";
  else if (input.performanceIndex >= 100) candidate = "A";
  else if (input.performanceIndex >= 90) candidate = "B";
  else if (input.performanceIndex >= 80) candidate = "C";
  else {
    candidate =
      input.probabilityBelow80 >= 0.8 && input.negativeMarginalFraction >= 0.8 ? "D" : "C";
  }

  if (input.previousTier && input.previousTier !== "Provisional" && candidate !== input.previousTier && input.boundaryConfidence < 0.8) {
    return input.previousTier;
  }
  return candidate;
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function standardError(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance) / Math.sqrt(values.length);
}

function contributionsFor(
  card: MemberCard,
  investment: number,
  chart: ChartContext,
  mode: PlayMode,
) {
  const others = researchBundle.cards.filter((candidate) => candidate.id !== card.id);
  const containingTeams = combinations(others, 4).map((team) => [...team, card]);
  return researchBundle.leaders.flatMap((leader) =>
    containingTeams.map(
      (team) => exactShapleyContributions(team, leader, chart, investment, mode).get(card.id) ?? 0,
    ),
  );
}

const lensSettings: Record<RankingSnapshot["lens"], { investment: number; mode: PlayMode }> = {
  "standard-manual": { investment: 1, mode: "manual" },
  "low-investment": { investment: 0, mode: "manual" },
  "max-ceiling": { investment: 1, mode: "manual" },
  "expected-manual": { investment: 0.5, mode: "manual" },
  "auto-live": { investment: 1, mode: "auto" },
};

function computeMetrics(
  card: MemberCard,
  lens: RankingSnapshot["lens"],
): { metrics: CardMetrics; samples: number[] } {
  const settings = lensSettings[lens];
  const weightedSamples = representativeCharts.flatMap((chart) =>
    contributionsFor(card, settings.investment, chart, settings.mode).map(
      (value) => value * chart.weight * representativeCharts.length,
    ),
  );
  const sorted = [...weightedSamples].sort((a, b) => b - a);
  const topCount = Math.max(1, Math.ceil(sorted.length * 0.1));
  const proximity = representativeCharts.flatMap((chart) =>
    researchBundle.leaders.map((leader) => {
      const best = optimizeTeam({
        cards: researchBundle.cards,
        leader,
        chart,
        investment: 1,
        mode: "manual",
      }).score;
      const withCard = optimizeTeam({
        cards: researchBundle.cards,
        leader,
        chart,
        investment: 1,
        mode: "manual",
        anchorCardId: card.id,
      }).score;
      return withCard >= best * 0.95 ? 1 : 0;
    }),
  );
  const investmentMeans = [0, 0.5, 1].map((investment) =>
    mean(
      representativeCharts.flatMap((chart) =>
        contributionsFor(card, investment, chart, "manual").map(
          (value) => value * chart.weight * representativeCharts.length,
        ),
      ),
    ),
  );
  const E = (investmentMeans[0]! + 2 * investmentMeans[1]! + investmentMeans[2]!) / 4;
  return {
    metrics: {
      G: mean(weightedSamples),
      P: mean(sorted.slice(0, topCount)),
      B: mean(proximity),
      E,
    },
    samples: weightedSamples,
  };
}

export function generateResearchRanking(
  lens: RankingSnapshot["lens"] = "standard-manual",
): RankingSnapshot {
  const calculated = researchBundle.cards.map((card) => {
    const { metrics, samples } = computeMetrics(card, lens);
    const index = scoreMetricsToIndex(metrics, FROZEN_BASELINE);
    const samplingError = standardError(samples) / (1.4826 * FROZEN_BASELINE.G.mad);
    const uncertainty = Math.max(5.5, 10 * (1 - card.confidence));
    return { card, metrics, samples, ...index, samplingError, interval: [index.performanceIndex - uncertainty, index.performanceIndex + uncertainty] as [number, number] };
  });

  const ordered = [...calculated].sort((a, b) => b.performanceIndex - a.performanceIndex);
  const entries: RankingEntry[] = ordered.map((item, index) => ({
    cardId: item.card.id,
    rank: index + 1,
    tier: classifyTier({
      performanceIndex: item.performanceIndex,
      interval: item.interval,
      samplingError: item.samplingError,
      sourceComplete: item.card.verificationState === "verified" || item.card.verificationState === "corroborated",
      probabilityAbove120: item.interval[0] >= 120 ? 0.95 : 0.5,
      probabilityTopDecile: index < Math.max(1, Math.ceil(ordered.length * 0.1)) ? 0.85 : 0.2,
      probabilityBelow80: item.interval[1] < 80 ? 0.9 : 0.5,
      negativeMarginalFraction: item.samples.filter((value) => value < 0).length / item.samples.length,
      boundaryConfidence: 0.9,
    }),
    performanceIndex: item.performanceIndex,
    interval: item.interval,
    metrics: { ...item.metrics, C: item.C },
    samplingError: item.samplingError,
    reasons: ["Research-only source coverage", "Illustrative score model", "Artwork pending rights"],
  }));

  return RankingSnapshotSchema.parse({
    id: `rank-launch-preview-${lens}-m1`,
    patchId: "patch-research-preview",
    methodologyVersion: METHODOLOGY_VERSION,
    generatedAt: "2026-07-29T00:00:00.000Z",
    lens,
    seed: RESEARCH_SEED,
    chartCorpus: {
      frozenSeasonalWeight: 0.7,
      currentContentWeight: 0.3,
      contexts: representativeCharts.map((chart) => chart.id),
    },
    assumptions: [
      "One copy and duplicate-free maximum progression",
      "Neutral collection and board assumptions",
      "Perfect manual execution",
      "No event-specific bonus",
      "Illustrative inputs; not game-fact recommendations",
    ],
    baseline: FROZEN_BASELINE,
    entries,
    theorycraftBeta: true,
  });
}

export type DeltaReason =
  | "direct-change"
  | "new-synergy"
  | "chart-meta"
  | "new-evidence"
  | "methodology-correction";

export function attributeScoreDelta(total: number, parts: { reason: DeltaReason; delta: number }[]) {
  const attributed = parts.reduce((sum, part) => sum + part.delta, 0);
  if (Math.abs(attributed - total) > 1e-9) {
    throw new Error(`Attributed deltas must sum to displayed total (${attributed} != ${total})`);
  }
  return { total, parts };
}

export const researchRanking = generateResearchRanking();

export function rankResearchLeaders() {
  return researchBundle.leaders
    .map((leader) => {
      const scores = representativeCharts.map((chart) =>
        optimizeTeam({
          cards: researchBundle.cards,
          leader,
          chart,
          investment: 1,
          mode: "manual",
        }).score,
      );
      const rawUtility = mean(scores);
      return {
        leaderId: leader.id,
        rawUtility,
        fitIndex: 100 + (rawUtility - 700) / 7.5,
        verificationState: leader.verificationState,
      };
    })
    .sort((left, right) => right.fitIndex - left.fitIndex)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export const researchLeaderRanking = rankResearchLeaders();
