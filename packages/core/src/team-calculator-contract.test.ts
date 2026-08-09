import { describe, expect, it } from "vitest";

import {
  TeamCalculatorRequestSchema,
  TeamCalculatorResultSchema,
  type TeamCalculatorResult,
} from "./team-calculator-contract";

const OWNED_CARDS = [
  "card-00004-5-uniq-0005-00",
  "card-00005-5-uniq-0006-00",
  "card-00013-5-uniq-0002-00",
  "card-00018-5-uniq-0004-00",
  "card-00039-5-uniq-0032-00",
].map((cardId, bloomStage) => ({ cardId, bloomStage })) as Array<{
  cardId: string;
  bloomStage: 0 | 1 | 2 | 3 | 4 | 5;
}>;

function card(cardId: string, talentId: string) {
  return {
    cardId,
    slug: cardId,
    talentId,
    talentName: talentId,
    title: cardId,
    rarity: 5 as const,
    attribute: "cute" as const,
    artPath: `/game/cards/${cardId}.webp`,
    illustrationPath: `/game/illustrations/${cardId}.webp`,
  };
}

type FixtureUtilityInterval = TeamCalculatorResult["score"]["relativeUtility"];
type FixtureReplacementImpact =
  TeamCalculatorResult["alternatives"][number]["cards"][number]["replacementImpact"];

function replacementImpact(after: FixtureUtilityInterval): FixtureReplacementImpact {
  const before = { lower: 99.6, central: 109.6, upper: 119.6 };
  const centralDelta = after.central - before.central;
  const centralDeltaPercent = (centralDelta / before.central) * 100;
  const boundDeltas = (Object.keys(before) as Array<keyof FixtureUtilityInterval>).map(
    (bound) => after[bound] - before[bound],
  );
  const improvesAtEveryBound = boundDeltas.every((delta) => delta > 0.000_001);
  const worsensAtEveryBound = boundDeltas.every((delta) => delta < -0.000_001);
  return {
    comparisonDesign: "paired-per-chart-same-leader-and-canonical-order",
    beforeCentral: before.central,
    afterCentral: after.central,
    centralDelta,
    centralDeltaPercent,
    chartsImproved: improvesAtEveryBound ? 30 : 0,
    chartsWorsened: worsensAtEveryBound ? 30 : 0,
    chartsTied: improvesAtEveryBound || worsensAtEveryBound ? 0 : 30,
    perChartDeltaPercent: {
      minimum: centralDeltaPercent,
      median: centralDeltaPercent,
      maximum: centralDeltaPercent,
    },
    boundAgreement: improvesAtEveryBound
      ? "improves-at-every-bound"
      : worsensAtEveryBound
        ? "worsens-at-every-bound"
        : "bound-dependent",
    effectChanges: [],
    outgoingPassiveDescription: "Fixture outgoing passive.",
    incomingPassiveDescription: "Fixture incoming passive.",
    outgoingPassiveSkillLevel: 1,
    incomingPassiveSkillLevel: 1,
    activeCooldownDeltaMilliseconds: 0,
    specialDurationDeltaMilliseconds: 0,
    formationOrderAffectsValue: false,
  };
}

function resultFixture(): TeamCalculatorResult {
  const members = OWNED_CARDS.map((ownedCard, index) => ({
    ...card(ownedCard.cardId, `talent-${index}`),
    bloomStage: ownedCard.bloomStage,
  }));
  return {
    kind: "owned-roster-team-calculation",
    schemaVersion: 5,
    methodologyVersion: "yd-owned-roster-calculator-5.0.0",
    roster: { commit: "a".repeat(40), ownedCardCount: 5, ownedTalentCount: 5 },
    oshi: null,
    requiredMembers: null,
    corpus: {
      benchmarkId: "fixture-benchmark",
      entriesSha256: "b".repeat(64),
      difficulty: "expert",
      weighting: "equal-per-chart",
      chartCount: 30,
      referenceChartCount: 21,
      currentChartCount: 9,
      referenceSharePermil: 700,
      currentSharePermil: 300,
      charts: Array.from({ length: 30 }, (_, index) => ({
        chartKey: `m${String(index + 1).padStart(4, "0")}:expert`,
        segment: index < 21 ? "reference" as const : "current" as const,
      })),
    },
    score: {
      kind: "representative-corpus-average-relative-utility",
      absoluteLiveScoreAvailable: false,
      relativeUtility: { lower: 99.6, central: 109.6, upper: 119.6 },
      referenceAverage: { lower: 99, central: 109, upper: 119 },
      currentAverage: { lower: 101, central: 111, upper: 121 },
    },
    leader: {
      ...card(OWNED_CARDS[0]!.cardId, "talent-0"),
      outfitName: "Fixture Outfit",
      sourceCardBloomStage: 0,
    },
    members,
    synergies: [],
    alternatives: members.map((member) => ({
      replacesCardId: member.cardId,
      fixedLeaderCardId: OWNED_CARDS[0]!.cardId,
      comparisonBasis:
        "fixed-selected-leader-and-canonical-order-across-representative-corpus" as const,
      lossSignConvention: "positive-means-selected-team-is-better" as const,
      coverage: {
        selectionMethod: "bounded-two-stage-screen" as const,
        eligibleCardCount: 0,
        coarseScreenedCardCount: 0,
        corpusProxyScreenedCardCount: 0,
        fullCorpusRerankedCardCount: 0,
        returnedCardCount: 0,
      },
      cards: [],
    })),
    formationOrder: {
      kind: "modeled-general",
      status: "modeled-general",
      label: "Suggested general order",
      methodologyVersion: "yd-formation-order-modeled-general-1.0.0",
      cardIds: members.map((member) => member.cardId),
      exactTimelineAvailable: false,
      changesModeledTimingUtility: false,
      permutationsChecked: 120,
      corpusChartCount: 30,
      markerLayoutCount: 14,
      timingScenarioCount: 420,
      activeFirstCheck: "one-cooldown-after-live-start",
      confidence: {
        kind: "modeled-general",
        winSharePermil: 225,
        runnerUpGapPermil: 1.2,
        maxRegretPermil: 4.2,
        meanRegretPermil: 0.8,
        statement: "Fixture modeled order clears the tiny-margin threshold.",
      },
      members: members.map((member, index) => ({
        cardId: member.cardId,
        slot: index + 1,
        bloomStage: member.bloomStage,
        active: {
          level: 1,
          cooldownMilliseconds: 20_000,
          durationMilliseconds: 8_000,
          activationProbabilityPermil: 750,
          persistentSupportPermilAcrossCorpus: { minimum: 0, maximum: 100 },
        },
        special: {
          level: 1,
          durationMilliseconds: 10_000,
          scoreSupportPermilAtFullComboWithoutSongMatch: 1_200,
          activationRateUpPermilAtFullComboWithoutSongMatch: 0,
          comboGateThresholds: [],
        },
      })),
    },
    search: {
      resultClaim: "bounded-search",
      certificateKind: "heuristic-bounded",
      certificateId: null,
      scopeHash: "b".repeat(64),
      runRecordId: "yd-owned-roster-run-v5-test",
      optimalityClaim: "not-certified",
      objective: "equal-chart-average-relative-utility",
      objectiveId: "yd-equal-chart-average-relative-utility-v1",
      evaluatorMethodologyVersion: "yd-native-utility-1.0.0",
      arithmeticMethodologyVersion: "yd-native-six-decimal-rounding-1.0.0",
      comparisonOrder: "canonical-card-id-order",
      teamSetsInScope: 12,
      teamSetsConsidered: 6,
      teamSetsEvaluated: 6,
      teamSetsPruned: 0,
      unsearchedTeamSets: 6,
      optimalityGap: null,
      candidateGenerationMode: "bounded-native-search",
      candidateGenerationChartCount: 5,
      candidateGenerationChartKeys: [
        "m0001:expert",
        "m0002:expert",
        "m0003:expert",
        "m0022:expert",
        "m0023:expert",
      ],
      initialLeaderTeamFormationsReranked: 6,
      searchLeaderTeamFormationsReranked: 6,
      replacementLeaderTeamFormationsReranked: 0,
      localRefinementScope: "two-stage-screened-one-member-swap-or-leader-change",
      localRefinementStatus: "fixed-point",
      localRefinementIterations: 1,
      candidateGenerationUtilityEvaluations: 20,
      corpusUtilityEvaluations: 80,
      utilityEvaluations: 100,
      formationOrderGloballyCertified: false,
      formationOrderClaim: "conditional-on-selected-team",
      canonicalCorpusOptimalityClaim: false,
    },
  };
}

describe("team calculator contract", () => {
  it("accepts exact cards and Bloom stages without any song or chart selection", () => {
    const request = TeamCalculatorRequestSchema.parse({
      schemaVersion: 4,
      rosterCommit: "a".repeat(40),
      ownedCards: OWNED_CARDS,
      requiredMemberCardIds: [],
    });

    expect(request).not.toHaveProperty("chartKey");
    expect(request).not.toHaveProperty("oshi");
    expect(request.ownedCards.map((ownedCard) => ownedCard.bloomStage)).toEqual([0, 1, 2, 3, 4]);
    expect(request.requiredMemberCardIds).toEqual([]);
    expect(
      TeamCalculatorRequestSchema.safeParse({ ...request, chartKey: "m0206:expert" }).success,
    ).toBe(false);
  });

  it("rejects duplicate card IDs and invalid Bloom", () => {
    const duplicate = TeamCalculatorRequestSchema.safeParse({
      schemaVersion: 4,
      rosterCommit: "a".repeat(40),
      ownedCards: [...OWNED_CARDS, OWNED_CARDS[0]],
      requiredMemberCardIds: [],
    });
    const invalidBloom = TeamCalculatorRequestSchema.safeParse({
      schemaVersion: 4,
      rosterCommit: "a".repeat(40),
      ownedCards: OWNED_CARDS.map((ownedCard, index) =>
        index === 0 ? { ...ownedCard, bloomStage: 6 } : ownedCard,
      ),
      requiredMemberCardIds: [],
    });

    expect(duplicate.success).toBe(false);
    expect(invalidBloom.success).toBe(false);
    expect(
      TeamCalculatorRequestSchema.safeParse({
        schemaVersion: 4,
        rosterCommit: "a".repeat(40),
        ownedCards: OWNED_CARDS,
        requiredMemberCardIds: [OWNED_CARDS[0]!.cardId, OWNED_CARDS[0]!.cardId],
      }).success,
    ).toBe(false);
  });

  it("accepts all public Oshi roles and rejects malformed talent or role values", () => {
    for (const role of ["member", "leader", "member-and-leader"] as const) {
      expect(
        TeamCalculatorRequestSchema.safeParse({
          schemaVersion: 4,
          rosterCommit: "a".repeat(40),
          ownedCards: OWNED_CARDS,
          requiredMemberCardIds: [],
          oshi: { talentId: "talent-0", role },
        }).success,
      ).toBe(true);
    }
    expect(
      TeamCalculatorRequestSchema.safeParse({
        schemaVersion: 4,
        rosterCommit: "a".repeat(40),
        ownedCards: OWNED_CARDS,
        requiredMemberCardIds: [],
        oshi: { talentId: "", role: "member" },
      }).success,
    ).toBe(false);
    expect(
      TeamCalculatorRequestSchema.safeParse({
        schemaVersion: 4,
        rosterCommit: "a".repeat(40),
        ownedCards: OWNED_CARDS,
        requiredMemberCardIds: [],
        oshi: { talentId: "talent-0", role: "outfit" },
      }).success,
    ).toBe(false);
  });

  it("rejects unordered averages, duplicate talents, corpus drift, and broad optimality claims", () => {
    const unordered = resultFixture();
    unordered.score.relativeUtility = { lower: 120, central: 110, upper: 100 };
    const duplicateTalent = resultFixture();
    duplicateTalent.members[1] = {
      ...duplicateTalent.members[1]!,
      talentId: duplicateTalent.members[0]!.talentId,
    };
    const corpusDrift = resultFixture();
    corpusDrift.corpus.charts[29] = { ...corpusDrift.corpus.charts[0]! };
    const overclaim = resultFixture();
    overclaim.search.canonicalCorpusOptimalityClaim = true;

    expect(TeamCalculatorResultSchema.safeParse(unordered).success).toBe(false);
    expect(TeamCalculatorResultSchema.safeParse(duplicateTalent).success).toBe(false);
    expect(TeamCalculatorResultSchema.safeParse(corpusDrift).success).toBe(false);
    expect(TeamCalculatorResultSchema.safeParse(overclaim).success).toBe(false);
    expect(TeamCalculatorResultSchema.parse(resultFixture()).members).toHaveLength(5);
  });

  it("rejects globally certified formation order and mismatched certificate claims", () => {
    const globallyCertifiedBase = structuredClone(resultFixture());
    const globallyCertified = {
      ...globallyCertifiedBase,
      search: {
        ...globallyCertifiedBase.search,
        formationOrderGloballyCertified: true,
      },
    };
    const globallyCertifiedResult = TeamCalculatorResultSchema.safeParse(globallyCertified);

    expect(globallyCertifiedResult.success).toBe(false);
    if (!globallyCertifiedResult.success) {
      expect(
        globallyCertifiedResult.error.issues.some(
          (issue) => issue.path.join(".") === "search.formationOrderGloballyCertified",
        ),
      ).toBe(true);
    }

    const mismatchedCertificate = structuredClone(resultFixture());
    mismatchedCertificate.search = {
      ...mismatchedCertificate.search,
      resultClaim: "certified-within-canonical-corpus-scope",
      certificateKind: "heuristic-bounded",
      certificateId: "c".repeat(64),
      optimalityClaim:
        "exhaustive-across-constraint-eligible-teams-leaders-and-frozen-corpus-under-canonical-order",
      optimalityGap: 0,
      candidateGenerationMode: "exhaustive",
      candidateGenerationChartCount: 0,
      candidateGenerationChartKeys: [],
      teamSetsInScope: 12,
      teamSetsConsidered: 12,
      teamSetsEvaluated: 12,
      unsearchedTeamSets: 0,
      initialLeaderTeamFormationsReranked: 12,
      searchLeaderTeamFormationsReranked: 12,
      localRefinementScope: "not-needed-exhaustive",
      localRefinementStatus: "not-needed-exhaustive",
      localRefinementIterations: 0,
      canonicalCorpusOptimalityClaim: true,
    };
    const mismatchedCertificateResult = TeamCalculatorResultSchema.safeParse(mismatchedCertificate);

    expect(mismatchedCertificateResult.success).toBe(false);
    if (!mismatchedCertificateResult.success) {
      expect(
        mismatchedCertificateResult.error.issues.some(
          (issue) => issue.message === "The public result claim must match the search certificate",
        ),
      ).toBe(true);
    }
  });

  it("keeps the displayed Member sequence, Bloom stages, and timing summary aligned", () => {
    const valid = resultFixture();
    expect(TeamCalculatorResultSchema.safeParse(valid).success).toBe(true);

    const wrongCardOrder = structuredClone(valid);
    [wrongCardOrder.formationOrder.cardIds[0], wrongCardOrder.formationOrder.cardIds[1]] = [
      wrongCardOrder.formationOrder.cardIds[1]!,
      wrongCardOrder.formationOrder.cardIds[0]!,
    ];
    const wrongSlot = structuredClone(valid);
    wrongSlot.formationOrder.members[2]!.slot = 4;
    const wrongBloom = structuredClone(valid);
    wrongBloom.formationOrder.members[3]!.bloomStage = 0;
    const wrongScenarioCount = structuredClone(valid);
    wrongScenarioCount.formationOrder.timingScenarioCount = 419;
    const impossibleSupportRange = structuredClone(valid);
    impossibleSupportRange.formationOrder.members[0]!.active.persistentSupportPermilAcrossCorpus = {
      minimum: 200,
      maximum: 100,
    };

    expect(TeamCalculatorResultSchema.safeParse(wrongCardOrder).success).toBe(false);
    expect(TeamCalculatorResultSchema.safeParse(wrongSlot).success).toBe(false);
    expect(TeamCalculatorResultSchema.safeParse(wrongBloom).success).toBe(false);
    expect(TeamCalculatorResultSchema.safeParse(wrongScenarioCount).success).toBe(false);
    expect(TeamCalculatorResultSchema.safeParse(impossibleSupportRange).success).toBe(false);
  });

  it("keeps Leader and Passive sources distinct with explicit corpus coverage", () => {
    const valid = resultFixture();
    valid.synergies = [
      {
        source: "leader",
        sourceCardId: valid.leader.cardId,
        effectGroupId: "leader-effect",
        effectKind: "all-parameters-up",
        valuePermil: 300,
        recipientAlternatives: [valid.members.map((member) => member.cardId)],
        resolution: "resolved",
        activeChartCount: 21,
        corpusChartCount: 30,
        activationSharePermil: 700,
      },
      {
        source: "passive",
        sourceCardId: valid.members[0]!.cardId,
        effectGroupId: "passive-effect",
        effectKind: "all-parameters-up",
        valuePermil: 240,
        recipientAlternatives: [[valid.members[0]!.cardId]],
        resolution: "resolved",
        activeChartCount: 30,
        corpusChartCount: 30,
        activationSharePermil: 1_000,
      },
    ];
    expect(TeamCalculatorResultSchema.safeParse(valid).success).toBe(true);

    const wrongLeaderSource = structuredClone(valid);
    wrongLeaderSource.synergies[0]!.sourceCardId = valid.members[1]!.cardId;
    const wrongPassiveSource = structuredClone(valid);
    wrongPassiveSource.synergies[1]!.sourceCardId = "card-not-in-team";
    const wrongCoverage = structuredClone(valid);
    wrongCoverage.synergies[0]!.activationSharePermil = 1_000;

    expect(TeamCalculatorResultSchema.safeParse(wrongLeaderSource).success).toBe(false);
    expect(TeamCalculatorResultSchema.safeParse(wrongPassiveSource).success).toBe(false);
    expect(TeamCalculatorResultSchema.safeParse(wrongCoverage).success).toBe(false);
  });

  it("requires Oshi fulfillment to agree with the selected Member, Leader, and role label", () => {
    const valid = resultFixture();
    valid.oshi = {
      talentId: "talent-0",
      talentName: "Talent 0",
      role: "member-and-leader",
      roleLabel: "Must include as Member and use as Leader Outfit",
      eligibleOwnedMemberCardIds: [valid.members[0]!.cardId],
      eligibleOwnedLeaderCardIds: [valid.members[0]!.cardId],
      resolution: {
        member: { status: "fulfilled", selectedCardId: valid.members[0]!.cardId },
        leader: { status: "fulfilled", selectedCardId: valid.leader.cardId },
        overallStatus: "fulfilled",
      },
    };
    expect(TeamCalculatorResultSchema.safeParse(valid).success).toBe(true);

    const wrongMember = structuredClone(valid);
    wrongMember.oshi!.resolution.member.selectedCardId = valid.members[1]!.cardId;
    const wrongLeader = structuredClone(valid);
    wrongLeader.oshi!.resolution.leader.selectedCardId = valid.members[1]!.cardId;
    const wrongLabel = structuredClone(valid);
    wrongLabel.oshi!.roleLabel = "Must include as Member";
    const illegalReplacement = structuredClone(valid);
    illegalReplacement.alternatives[0]!.cards = [
      {
        ...card("card-wrong-oshi-replacement", "talent-other"),
        bloomStage: 0,
        relativeUtility: { lower: 90, central: 100, upper: 110 },
        modeledUtilityLoss: { lower: -10.4, central: 9.6, upper: 29.6 },
        replacementImpact: replacementImpact({ lower: 90, central: 100, upper: 110 }),
      },
    ];
    illegalReplacement.alternatives[0]!.coverage = {
      selectionMethod: "bounded-two-stage-screen",
      eligibleCardCount: 1,
      coarseScreenedCardCount: 1,
      corpusProxyScreenedCardCount: 1,
      fullCorpusRerankedCardCount: 1,
      returnedCardCount: 1,
    };

    expect(TeamCalculatorResultSchema.safeParse(wrongMember).success).toBe(false);
    expect(TeamCalculatorResultSchema.safeParse(wrongLeader).success).toBe(false);
    expect(TeamCalculatorResultSchema.safeParse(wrongLabel).success).toBe(false);
    expect(TeamCalculatorResultSchema.safeParse(illegalReplacement).success).toBe(false);
  });

  it("reconciles fulfilled required Members with the displayed five-card formation", () => {
    const valid = resultFixture();
    valid.requiredMembers = {
      cardIds: [valid.members[0]!.cardId, valid.members[1]!.cardId],
      status: "fulfilled",
    };
    expect(TeamCalculatorResultSchema.safeParse(valid).success).toBe(true);

    const unselected = structuredClone(valid);
    unselected.requiredMembers!.cardIds = ["card-not-selected"];
    expect(TeamCalculatorResultSchema.safeParse(unselected).success).toBe(false);

    const lockedReplacement = structuredClone(valid);
    lockedReplacement.alternatives[0]!.coverage.eligibleCardCount = 1;
    expect(TeamCalculatorResultSchema.safeParse(lockedReplacement).success).toBe(false);
  });

  it("allows a screened replacement to outperform the selected bounded-search team", () => {
    const result = resultFixture();
    result.alternatives[0]!.cards = [
      {
        ...card("card-replacement", "talent-replacement"),
        bloomStage: 0,
        relativeUtility: { lower: 110, central: 120, upper: 130 },
        modeledUtilityLoss: { lower: -30, central: -10.4, upper: 9.6 },
        replacementImpact: replacementImpact({ lower: 110, central: 120, upper: 130 }),
      },
    ];
    result.alternatives[0]!.coverage = {
      selectionMethod: "bounded-two-stage-screen",
      eligibleCardCount: 1,
      coarseScreenedCardCount: 1,
      corpusProxyScreenedCardCount: 1,
      fullCorpusRerankedCardCount: 1,
      returnedCardCount: 1,
    };

    expect(TeamCalculatorResultSchema.safeParse(result).success).toBe(true);
    expect(result.alternatives[0]!.cards[0]!.modeledUtilityLoss.central).toBeLessThan(0);
  });

  it("reconciles paired replacement impact and rejects drifted delta or effect classes", () => {
    const valid = resultFixture();
    valid.alternatives[0]!.cards = [
      {
        ...card("card-replacement", "talent-replacement"),
        bloomStage: 0,
        relativeUtility: { lower: 110, central: 120, upper: 130 },
        modeledUtilityLoss: { lower: -30, central: -10.4, upper: 9.6 },
        replacementImpact: replacementImpact({ lower: 110, central: 120, upper: 130 }),
      },
    ];
    valid.alternatives[0]!.coverage = {
      selectionMethod: "bounded-two-stage-screen",
      eligibleCardCount: 1,
      coarseScreenedCardCount: 1,
      corpusProxyScreenedCardCount: 1,
      fullCorpusRerankedCardCount: 1,
      returnedCardCount: 1,
    };
    valid.alternatives[0]!.cards[0]!.replacementImpact.effectChanges = [
      {
        change: "lost",
        source: "passive",
        sourceCardId: valid.members[1]!.cardId,
        sourceRemainsInTeam: true,
        effectGroupId: "fixture-passive-effect",
        effectKind: "all-parameters-up",
        valuePermil: 240,
        recipientCardIdsBefore: [valid.members[1]!.cardId],
        recipientCardIdsAfter: [],
        activeChartCountBefore: 30,
        activeChartCountAfter: 0,
      },
    ];

    expect(TeamCalculatorResultSchema.safeParse(valid).success).toBe(true);

    const driftedDelta = structuredClone(valid);
    driftedDelta.alternatives[0]!.cards[0]!.replacementImpact.centralDelta += 1;
    expect(TeamCalculatorResultSchema.safeParse(driftedDelta).success).toBe(false);

    const driftedClass = structuredClone(valid);
    driftedClass.alternatives[0]!.cards[0]!.replacementImpact.effectChanges[0]!.change = "gained";
    expect(TeamCalculatorResultSchema.safeParse(driftedClass).success).toBe(false);
  });
});
