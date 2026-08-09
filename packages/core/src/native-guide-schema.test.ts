import { describe, expect, it } from "vitest";

import { utilityIntervalStrictlyDominates } from "./native-guide-generator";
import {
  NativeGuideDataSchema,
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
    orderStatus: "modeled-general",
    formationOrderModel: {
      methodologyVersion: "yd-formation-order-modeled-general-1.0.0",
      corpusChartCount: 30,
      markerLayoutCount: 14,
      timingScenarioCount: 420,
      permutationsChecked: 120,
      maxRegretPermil: 4,
      meanRegretPermil: 1,
      runnerUpGapPermil: 0.2,
      winSharePermil: 250,
      exactTimelineAvailable: false,
      noteTimelineAvailable: false,
      changesModeledTimingUtility: false,
      statement: "Fixture modeled-order result.",
    },
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
        source: "leader",
        sourceCardId: "leader",
        effectGroupId: "leader-effect",
        effectKind: "sense-up",
        valuePermil: 1_200,
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
      firstCheck: "one-cooldown-after-live-start",
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
  noteTimeline: "exact",
  formationOrderTimelineFidelity: "exact-timed",
  timelineEvidence: {
    susSha256: "0".repeat(64),
    metadataSha256: "1".repeat(64),
    specialMarkerMicroseconds: [1, 2, 3, 4, 5],
    feverMarkerMicroseconds: {
      chargeStart: 1,
      chargeEnd: 2,
      feverStart: 3,
      feverEnd: 4,
    },
  },
  leaderOutfitCardId: "leader",
  formationOrder: ["card-1", "card-2", "card-3", "card-4", "card-5"],
  orderStatus: "timed-corpus",
  formationOrderModel: {
    methodologyVersion: "yd-formation-order-timed-corpus-1.0.0",
    corpusChartCount: 1,
    markerLayoutCount: 1,
    timingScenarioCount: 1,
    permutationsChecked: 120,
    maxRegretPermil: 4,
    meanRegretPermil: 1,
    runnerUpGapPermil: 0.2,
    winSharePermil: 250,
    exactTimelineAvailable: true,
    noteTimelineAvailable: true,
    changesModeledTimingUtility: true,
    statement: "Fixture exact-song order result.",
  },
  members: ["card-1", "card-2", "card-3", "card-4", "card-5"],
  relativeUtility: { lower: 100, central: 110, upper: 120 },
} as const;

const unavailableComparisonFixture = {
  songId: "m0325",
  songTitle: "Unavailable fixture",
  chartKey: "m0325:expert",
  difficulty: "expert",
  durationMilliseconds: 100_000,
  noteCount: 500,
  scoreRatingEligible: true,
  leaderSingerMatched: true,
  platform: "mobile",
  chartFidelity: "aggregate",
  noteTimeline: "unavailable",
  comparisonMode: "aggregate-formation-only",
  timelineUnavailableReason: "source-api-unreachable-cloudflare-challenge-at-intake",
  leaderOutfitCardId: "leader",
  formationOrder: ["card-1", "card-2", "card-3", "card-4", "card-5"],
  orderStatus: "indeterminate",
  members: ["card-1", "card-2", "card-3", "card-4", "card-5"],
  relativeUtility: { lower: 100, central: 110, upper: 120 },
  advantageOverReferencePercent: null,
  changesReferenceFormation: false,
} as const;

function guideFixture(overrides: Partial<{
  id: string;
  slug: string;
  anchorCardId: string;
}> = {}) {
  return {
    id: overrides.id ?? "guide-fixture",
    slug: overrides.slug ?? "guide-fixture",
    title: "Fixture guide",
    anchorCardId: overrides.anchorCardId ?? "card-1",
    anchorTalentId: "talent-1",
    snapshotId: "snapshot-1",
    methodologyVersion: "yd-native-guide-1.2.0",
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
  } as const;
}

function guideDataFixture(guides: readonly unknown[]) {
  return {
    schemaVersion: 5,
    generatedAt: "2026-08-01T00:00:00.000Z",
    rosterCommit: "a".repeat(40),
    guides,
  };
}

describe("native guide publication schema", () => {
  it("accepts only a modeled order containing the same five Member cards", () => {
    expect(NativeGuideFormationSchema.safeParse(formationFixture()).success).toBe(true);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...formationFixture(),
        formationOrder: ["card-1", "card-2", "card-3", "card-4", "wrong"],
      }).success,
    ).toBe(false);
  });

  it("requires Member slots and modeled order to describe the same slot mapping", () => {
    const fixture = formationFixture();
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        members: fixture.members.map((member, index) =>
          index === 1 ? { ...member, slot: 1 } : member,
        ),
      }).success,
    ).toBe(false);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        members: fixture.members.map((member, index) =>
          index === 0 ? { ...member, slot: 2 } : index === 1 ? { ...member, slot: 1 } : member,
        ),
      }).success,
    ).toBe(false);
  });

  it("requires internally consistent modeled timing evidence", () => {
    const fixture = formationFixture();
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        formationOrderModel: {
          ...fixture.formationOrderModel,
          timingScenarioCount: 419,
        },
      }).success,
    ).toBe(false);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        ordersAudited: 121,
      }).success,
    ).toBe(false);
  });

  it("requires replacement tradeoffs to describe one legal swap", () => {
    const fixture = formationFixture();
    const replacement = {
      replacedCardId: "card-5",
      cardId: "card-6",
      rarity: 4 as const,
      lossPercent: { lower: 1, central: 2, upper: 3 },
      suggestedOrder: ["card-1", "card-2", "card-3", "card-4", "card-6"],
      orderStatus: "modeled-general" as const,
      tradeoff: {
        benefit: "Incoming Passive",
        cost: "Outgoing Passive",
        activeCooldownDeltaMilliseconds: -1_000,
        specialDurationDeltaMilliseconds: 2_000,
        formationOrderChanged: true,
        recipientApplicationsAdded: 1,
        recipientApplicationsRemoved: 2,
        possibleRecipientCardIdsAdded: ["card-6"],
        possibleRecipientCardIdsRemoved: ["card-5"],
      },
    };
    expect(
      NativeGuideFormationSchema.safeParse({ ...fixture, replacements: [replacement] }).success,
    ).toBe(true);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        replacements: [{ ...replacement, suggestedOrder: fixture.formationOrder }],
      }).success,
    ).toBe(false);
  });

  it("requires Active, Special, and investment summaries to cover the formation exactly", () => {
    const fixture = formationFixture();
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        activeSkills: fixture.activeSkills.map((skill, index) =>
          index === 4 ? { ...skill, cardId: "card-1" } : skill,
        ),
      }).success,
    ).toBe(false);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        specialSkills: fixture.specialSkills.map((skill, index) =>
          index === 0 ? { ...skill, slot: 2 } : skill,
        ),
      }).success,
    ).toBe(false);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        specialSkills: fixture.specialSkills.map((skill, index) =>
          index === 0 ? { ...skill, cardId: "card-2" } : skill,
        ),
      }).success,
    ).toBe(false);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        investmentOrder: ["card-1", "card-2", "card-3", "card-4", "card-4"],
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
            source: "leader",
            sourceCardId: "leader",
            effectGroupId: "leader-effect",
            effectKind: "sense-up",
            valuePermil: 1_200,
            guaranteedCardIds: ["card-1"],
            possibleCardIds: ["card-1", "card-2"],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires explicit Leader or Passive source attribution", () => {
    const fixture = formationFixture();
    const recipientWithoutSource = structuredClone(fixture.recipients[0]!);
    Reflect.deleteProperty(recipientWithoutSource, "source");
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        recipients: [recipientWithoutSource],
      }).success,
    ).toBe(false);
  });

  it("keeps Leader and Passive roles distinct when one card supplies both", () => {
    const fixture = formationFixture();
    const sharedSource = "card-1";
    const leaderRecipient = {
      ...fixture.recipients[0]!,
      source: "leader" as const,
      sourceCardId: sharedSource,
    };
    const passiveRecipient = {
      ...fixture.recipients[0]!,
      source: "passive" as const,
      sourceCardId: sharedSource,
      effectGroupId: "passive-effect",
    };
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        leaderOutfitCardId: sharedSource,
        recipients: [leaderRecipient, passiveRecipient],
      }).success,
    ).toBe(true);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        recipients: [{ ...leaderRecipient, sourceCardId: "wrong-leader" }],
      }).success,
    ).toBe(false);
    expect(
      NativeGuideFormationSchema.safeParse({
        ...fixture,
        recipients: [{ ...passiveRecipient, sourceCardId: "not-a-member" }],
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
    const guide = guideFixture();

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

  it("requires exactly one formation of each published kind", () => {
    const guide = guideFixture();
    expect(NativeGuideSchema.safeParse(guide).success).toBe(true);
    expect(
      NativeGuideSchema.safeParse({
        ...guide,
        formations: [
          formationFixture("premium"),
          formationFixture("standard"),
          formationFixture("standard"),
        ],
      }).success,
    ).toBe(false);
  });

  it.each(["id", "slug", "anchorCardId"] as const)(
    "requires unique guide %s values within a dataset",
    (field) => {
      const first = guideFixture();
      const second = guideFixture({
        id: field === "id" ? first.id : "guide-second",
        slug: field === "slug" ? first.slug : "guide-second",
        anchorCardId: field === "anchorCardId" ? first.anchorCardId : "card-second",
      });
      expect(NativeGuideDataSchema.safeParse(guideDataFixture([first, second])).success).toBe(false);
    },
  );

  it("accepts multiple guides when every dataset identity is unique", () => {
    expect(
      NativeGuideDataSchema.safeParse(
        guideDataFixture([
          guideFixture(),
          guideFixture({ id: "guide-second", slug: "guide-second", anchorCardId: "card-second" }),
        ]),
      ).success,
    ).toBe(true);
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

  it("models recorded-unavailable rows as aggregate-only and rejects placement claims", () => {
    expect(RatingSongComparisonSchema.safeParse(unavailableComparisonFixture).success).toBe(true);
    expect(
      RatingSongComparisonSchema.safeParse({
        ...unavailableComparisonFixture,
        advantageOverReferencePercent: 1.5,
        changesReferenceFormation: true,
      }).success,
    ).toBe(true);
    expect(
      RatingSongComparisonSchema.safeParse({
        ...unavailableComparisonFixture,
        orderStatus: "timed-corpus",
      }).success,
    ).toBe(false);
    expect(
      RatingSongComparisonSchema.safeParse({
        ...unavailableComparisonFixture,
        formationOrder: ["card-2", "card-1", "card-3", "card-4", "card-5"],
      }).success,
    ).toBe(false);
    expect(
      RatingSongComparisonSchema.safeParse({
        ...unavailableComparisonFixture,
        changesReferenceFormation: true,
        advantageOverReferencePercent: null,
      }).success,
    ).toBe(false);
  });

  it("keeps exact rows strict and does not accept unavailable-only fields", () => {
    expect(
      RatingSongComparisonSchema.safeParse({
        ...comparisonFixture,
        timelineUnavailableReason: "source-api-unreachable-cloudflare-challenge-at-intake",
        advantageOverReferencePercent: null,
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
