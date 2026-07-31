import { describe, expect, it } from "vitest";
import storedSnapshotJson from "../../../data/rankings/launch-preview-standard-manual-m1.json";

import {
  FROZEN_BASELINE,
  attributeScoreDelta,
  classifyTier,
  exactShapleyContributions,
  generateResearchRanking,
  optimizeTeam,
  researchBundle,
  RankingSnapshotSchema,
  scoreMetricsToIndex,
  simulateTeam,
  type ChartContext,
  type MemberCard,
} from "./index";

const chart: ChartContext = {
  id: "balanced-test",
  archetype: "balanced",
  primaryType: "smile",
  weight: 1,
  noteDensity: 1,
};

describe("team optimizer", () => {
  it("matches independently enumerated brute force on the reduced fixture", () => {
    const cards = researchBundle.cards.slice(0, 7);
    const leader = researchBundle.leaders[1]!;
    const optimized = optimizeTeam({
      cards,
      leader,
      chart,
      investment: 1,
      mode: "manual",
    });

    let bruteScore = Number.NEGATIVE_INFINITY;
    let bruteIds: string[] = [];
    for (let a = 0; a < cards.length; a += 1)
      for (let b = a + 1; b < cards.length; b += 1)
        for (let c = b + 1; c < cards.length; c += 1)
          for (let d = c + 1; d < cards.length; d += 1)
            for (let e = d + 1; e < cards.length; e += 1) {
              const team = [cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!];
              const score = simulateTeam(team, leader, chart, 1, "manual").total;
              const ids = team.map((card) => card.id).sort();
              if (score > bruteScore || (score === bruteScore && ids.join() < bruteIds.join())) {
                bruteScore = score;
                bruteIds = ids;
              }
            }

    expect(optimized.score).toBeCloseTo(bruteScore, 8);
    expect(optimized.cards.map((card) => card.id).sort()).toEqual(bruteIds);
  });

  it("is deterministic under the fixed research seed", () => {
    expect(generateResearchRanking()).toEqual(generateResearchRanking());
  });

  it("matches the versioned snapshot stored in Git", () => {
    expect(RankingSnapshotSchema.parse(storedSnapshotJson)).toEqual(generateResearchRanking());
  });
});

describe("stability invariants", () => {
  it("does not rescale an existing card when an unrelated card appears", () => {
    const metrics = { G: 142, P: 168, B: 0.72, E: 138 };
    const before = scoreMetricsToIndex(metrics, FROZEN_BASELINE);
    const unrelatedOutlier = { G: 9000, P: 12000, B: 1, E: 8000 };
    scoreMetricsToIndex(unrelatedOutlier, FROZEN_BASELINE);
    const after = scoreMetricsToIndex(metrics, FROZEN_BASELINE);

    expect(after).toEqual(before);
  });

  it("gives an older card more Shapley credit when a relevant synergy partner is present", () => {
    const [anchor, partner, ...rest] = researchBundle.cards;
    const leader = researchBundle.leaders[0]!;
    const unrelated: MemberCard = {
      ...partner!,
      id: "card-unrelated",
      slug: "card-unrelated",
      synergyTags: ["unrelated"],
    };
    const baseTeam = [anchor!, unrelated, ...rest.slice(0, 3)];
    const synergyTeam = [
      anchor!,
      { ...partner!, synergyTags: [...anchor!.synergyTags] },
      ...rest.slice(0, 3),
    ];

    const baseCredit = exactShapleyContributions(baseTeam, leader, chart, 1, "manual").get(anchor!.id)!;
    const synergyCredit = exactShapleyContributions(synergyTeam, leader, chart, 1, "manual").get(anchor!.id)!;

    expect(synergyCredit).toBeGreaterThan(baseCredit);
  });

  it("does not let an extreme outlier compress frozen index spacing", () => {
    const low = scoreMetricsToIndex({ G: 130, P: 155, B: 0.6, E: 128 }, FROZEN_BASELINE).performanceIndex;
    const high = scoreMetricsToIndex({ G: 150, P: 180, B: 0.8, E: 148 }, FROZEN_BASELINE).performanceIndex;
    scoreMetricsToIndex({ G: 100000, P: 100000, B: 1, E: 100000 }, FROZEN_BASELINE);
    const lowAgain = scoreMetricsToIndex({ G: 130, P: 155, B: 0.6, E: 128 }, FROZEN_BASELINE).performanceIndex;
    const highAgain = scoreMetricsToIndex({ G: 150, P: 180, B: 0.8, E: 148 }, FROZEN_BASELINE).performanceIndex;

    expect(highAgain - lowAgain).toBeCloseTo(high - low, 10);
  });
});

describe("tier confidence and changelog rules", () => {
  it("keeps incomplete records provisional and applies SS/D controls", () => {
    expect(
      classifyTier({
        performanceIndex: 125,
        interval: [119, 129],
        samplingError: 0.4,
        sourceComplete: false,
        probabilityAbove120: 0.95,
        probabilityTopDecile: 0.9,
        probabilityBelow80: 0,
        negativeMarginalFraction: 0,
        boundaryConfidence: 0.9,
      }),
    ).toBe("Provisional");

    expect(
      classifyTier({
        performanceIndex: 125,
        interval: [121, 129],
        samplingError: 0.4,
        sourceComplete: true,
        probabilityAbove120: 0.95,
        probabilityTopDecile: 0.85,
        probabilityBelow80: 0,
        negativeMarginalFraction: 0,
        boundaryConfidence: 0.9,
      }),
    ).toBe("SS");

    expect(
      classifyTier({
        performanceIndex: 75,
        interval: [72, 78],
        samplingError: 0.4,
        sourceComplete: true,
        probabilityAbove120: 0,
        probabilityTopDecile: 0,
        probabilityBelow80: 0.7,
        negativeMarginalFraction: 0.9,
        boundaryConfidence: 0.9,
      }),
    ).toBe("C");
  });

  it("retains the previous tier when boundary confidence is below 80%", () => {
    expect(
      classifyTier({
        performanceIndex: 110.2,
        interval: [108, 112],
        samplingError: 0.4,
        sourceComplete: true,
        probabilityAbove120: 0,
        probabilityTopDecile: 0.5,
        probabilityBelow80: 0,
        negativeMarginalFraction: 0,
        boundaryConfidence: 0.76,
        previousTier: "A",
      }),
    ).toBe("A");
  });

  it("requires attributed reasons to sum to the displayed score delta", () => {
    const delta = attributeScoreDelta(4.2, [
      { reason: "new-synergy", delta: 2.7 },
      { reason: "chart-meta", delta: 1.5 },
    ]);
    expect(delta.total).toBe(4.2);
    expect(() =>
      attributeScoreDelta(4.2, [
        { reason: "new-synergy", delta: 2.6 },
        { reason: "chart-meta", delta: 1.5 },
      ]),
    ).toThrow(/sum/);
  });
});
