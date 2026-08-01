import { describe, expect, it } from "vitest";

import { utilityIntervalStrictlyDominates } from "./native-guide-generator";
import {
  NativeGuideFormationSchema,
  NativeGuideSchema,
  RatingSongComparisonSchema,
} from "./native-guide-schema";

const bloomZeroLens = {
  id: "level-cap-bloom-0-skill-1-connect-1",
  label: "Level cap · Bloom 0 · skills Lv.1 · Connect Lv.1",
  level: "card-level-cap",
  bloomStage: 0,
  allParametersUpPermil: 0,
  activeSkillLevel: 1,
  passiveSkillLevel: 1,
  specialSkillLevel: 1,
  connectEffectLevel: 1,
} as const;

const bloomFiveLens = {
  id: "level-cap-bloom-5-skill-2-connect-2",
  label: "Level cap · Bloom 5 · skills Lv.2 · Connect Lv.2",
  level: "card-level-cap",
  bloomStage: 5,
  allParametersUpPermil: 100,
  activeSkillLevel: 2,
  passiveSkillLevel: 2,
  specialSkillLevel: 2,
  connectEffectLevel: 2,
} as const;

const heuristicCertificate = {
  mode: "heuristic",
  resultClaim: "recommended-under-provisional-relative-model",
  teamSetsInScope: 10,
  teamSetsConsidered: 5,
  unsearchedTeamSets: 5,
  caveat: "Fixture covers only its reported provisional model scope.",
  localRefinement: {
    status: "fixed-point",
    scope: "one-member-swap-or-leader-change",
    selection: "strict-central-coordinate-ascent",
    iterations: 2,
    candidatesScreened: 20,
    improvingCandidatesAudited: 3,
    formationOrdersAudited: 360,
    visitedFormations: 3,
  },
} as const;

function formationFixture(kind: "premium" | "standard" | "accessible-4-star" = "standard") {
  return {
    kind,
    label: kind === "premium" ? "Bloom 5 · skills Lv.2" : "Bloom 0 · skills Lv.1",
    progressionLens: kind === "premium" ? bloomFiveLens : bloomZeroLens,
    context: {
      chartKey: "m0001:expert",
      songId: "m0001",
      songTitle: "Fixture",
      difficulty: "expert",
      durationMilliseconds: 100_000,
      noteCount: 500,
      scoreRatingEligible: true,
      leaderSingerMatched: true,
      platform: "mobile",
      chartFidelity: "aggregate",
      noteTimeline: "unavailable",
      specialMarkers: "unavailable",
    },
    leaderOutfitCardId: "leader",
    members: [1, 2, 3, 4, 5].map((slot) => ({ slot, cardId: `card-${slot}` })),
    formationOrder: ["card-1", "card-2", "card-3", "card-4", "card-5"],
    orderStatus: "canonical-display-only-timing-unresolved",
    relativeUtility: { lower: 1, central: 2, upper: 3 },
    staticParameters: {
      base: { lower: 100, central: 100, upper: 100 },
      leaderAndPassiveGain: { lower: 20, central: 25, upper: 30 },
      effective: { lower: 120, central: 125, upper: 130 },
    },
    searchCertificate: heuristicCertificate,
    finalistsEvaluated: 5,
    ordersAudited: 120,
    recipients: [
      {
        sourceCardId: "leader",
        effectKind: "sense-up",
        resolution: "unresolved-enumerated-alternatives",
        commonToEveryAlternativeCardIds: ["card-1"],
        possibleCardIds: ["card-1", "card-2"],
      },
    ],
    activeSkills: [1, 2, 3, 4, 5].map((slot) => ({
      cardId: `card-${slot}`,
      activationProbabilityPermil: 500,
      cooldownMilliseconds: 20_000,
      durationMilliseconds: 10_000,
      firstCheck: "unresolved",
      chartNoteCoverage: null,
    })),
    specialSkills: [1, 2, 3, 4, 5].map((slot) => ({
      slot,
      cardId: `card-${slot}`,
      durationMilliseconds: 10_000,
      markerTime: "unavailable",
      startsAtMilliseconds: null,
      endsAtMilliseconds: null,
      chartNoteCoverage: null,
      scoreSupportPermil: 1_000,
      activationRateUpPermil: 0,
    })),
    replacements: [],
    investmentOrder: ["card-1", "card-2", "card-3", "card-4", "card-5"],
  } as const;
}

const comparisonFixture = {
  songId: "m0001",
  songTitle: "Fixture",
  chartKey: "m0001:expert",
  difficulty: "expert",
  durationMilliseconds: 100_000,
  noteCount: 500,
  scoreRatingEligible: true,
  leaderSingerMatched: true,
  platform: "mobile",
  chartFidelity: "aggregate",
  noteTimeline: "unavailable",
  leaderOutfitCardId: "leader",
  formationOrder: ["card-1", "card-2", "card-3", "card-4", "card-5"],
  orderStatus: "canonical-display-only-timing-unresolved",
  members: ["card-1", "card-2", "card-3", "card-4", "card-5"],
  relativeUtility: { lower: 100, central: 110, upper: 120 },
} as const;

describe("native guide publication schema", () => {
  it("accepts only a canonical display order containing the same five Member cards", () => {
    expect(NativeGuideFormationSchema.safeParse(formationFixture()).success).toBe(true);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...formationFixture(),
        formationOrder: ["card-1", "card-2", "card-3", "card-4", "wrong"],
      }).success,
    ).toBe(false);
  });

  it("requires literal progression states instead of ambiguous investment names", () => {
    expect(
      NativeGuideFormationSchema.safeParse({
        ...formationFixture("standard"),
        progressionLens: bloomFiveLens,
      }).success,
    ).toBe(false);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...formationFixture(),
        investment: "one-copy-maximum",
      }).success,
    ).toBe(false);
  });

  it("cannot publish invented Active or Special chart coverage", () => {
    const fixture = formationFixture();
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        activeSkills: fixture.activeSkills.map((skill, index) =>
          index === 0 ? { ...skill, chartNoteCoverage: 0.4 } : skill,
        ),
      }).success,
    ).toBe(false);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        specialSkills: fixture.specialSkills.map((skill, index) =>
          index === 0 ? { ...skill, startsAtMilliseconds: 10_000 } : skill,
        ),
      }).success,
    ).toBe(false);
  });

  it("keeps recipient resolution uncertain and rejects certainty-shaped legacy fields", () => {
    const fixture = formationFixture();
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        recipients: [
          {
            sourceCardId: "leader",
            effectKind: "sense-up",
            guaranteedCardIds: ["card-1"],
            possibleCardIds: ["card-1", "card-2"],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("reports search coverage without accepting an optimality claim", () => {
    const fixture = formationFixture();
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        searchCertificate: { ...heuristicCertificate, unsearchedTeamSets: 4 },
      }).success,
    ).toBe(false);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        searchCertificate: { ...heuristicCertificate, optimalityClaim: "globally-optimal" },
      }).success,
    ).toBe(false);
  });

  it("requires mobile, singer-matched, rating-eligible aggregate Expert contexts", () => {
    const fixture = formationFixture();
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        context: { ...fixture.context, leaderSingerMatched: false },
      }).success,
    ).toBe(false);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        context: { ...fixture.context, platform: "pc" },
      }).success,
    ).toBe(false);
  });

  it("makes neutral Board and collection state explicit at guide scope", () => {
    const guide = {
      id: "guide-fixture",
      slug: "guide-fixture",
      title: "Fixture guide",
      anchorCardId: "card-1",
      anchorTalentId: "talent-1",
      snapshotId: "snapshot-1",
      methodologyVersion: "yd-native-guide-1.1.0",
      publicationState: "theorycraft-beta",
      benchmark: {
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
      },
      ratingSongScope: {
        singerTalentId: "talent-1",
        scoreRatingEligibleOnly: true,
        leaderSingerMatchRequired: true,
        difficulty: "expert",
      },
      formations: [
        formationFixture("premium"),
        formationFixture("standard"),
        formationFixture("accessible-4-star"),
      ],
      ratingSongComparisons: [
        {
          ...comparisonFixture,
          advantageOverReferencePercent: null,
          changesReferenceFormation: false,
        },
      ],
    };

    expect(NativeGuideSchema.safeParse(guide).success).toBe(true);
    expect(
      NativeGuideSchema.safeParse({
        ...guide,
        benchmark: {
          ...guide.benchmark,
          collection: { memberUpgradeBonusPermyriad: 500 },
        },
      }).success,
    ).toBe(false);
  });

  it("publishes formation changes only when an interval-robust advantage exists", () => {
    expect(
      RatingSongComparisonSchema.safeParse({
        ...comparisonFixture,
        advantageOverReferencePercent: null,
        changesReferenceFormation: false,
      }).success,
    ).toBe(true);
    expect(
      RatingSongComparisonSchema.safeParse({
        ...comparisonFixture,
        advantageOverReferencePercent: 1.5,
        changesReferenceFormation: true,
      }).success,
    ).toBe(true);
    expect(
      RatingSongComparisonSchema.safeParse({
        ...comparisonFixture,
        advantageOverReferencePercent: 1.5,
        changesReferenceFormation: false,
      }).success,
    ).toBe(false);
  });

  it("suppresses central-only chart changes whose uncertainty envelopes overlap", () => {
    expect(
      utilityIntervalStrictlyDominates(
        { lower: 95, central: 120, upper: 150 },
        { lower: 90, central: 100, upper: 130 },
      ),
    ).toBe(false);
    expect(
      utilityIntervalStrictlyDominates(
        { lower: 131, central: 140, upper: 150 },
        { lower: 90, central: 100, upper: 130 },
      ),
    ).toBe(true);
  });
});
