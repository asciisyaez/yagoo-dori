import { describe, expect, it } from "vitest";

import { nativeRankingBenchmark } from "./native-ranking-benchmark";
import type {
  NativeCanonicalCandidateSearchInput,
  NativeCanonicalCandidateSearchResult,
} from "./native-search";
import {
  evaluateNativeRelativeUtility,
  type NativeUtilityInput,
  type NativeUtilityResult,
} from "./native-utility";
import { publicCards } from "./public-data";
import {
  calculateOwnedRosterTeam,
  TEAM_CALCULATOR_CORPUS,
  TEAM_CALCULATOR_ROSTER_COMMIT,
  TeamCalculatorError,
} from "./team-calculator";

const OWNED = [
  { cardId: "card-00004-5-uniq-0005-00", bloomStage: 0 as const },
  { cardId: "card-00005-5-uniq-0006-00", bloomStage: 1 as const },
  { cardId: "card-00013-5-uniq-0002-00", bloomStage: 2 as const },
  { cardId: "card-00018-5-uniq-0004-00", bloomStage: 3 as const },
  { cardId: "card-00039-5-uniq-0032-00", bloomStage: 5 as const },
] as const;

const REQUEST = {
  schemaVersion: 4 as const,
  rosterCommit: TEAM_CALCULATOR_ROSTER_COMMIT,
  ownedCards: OWNED,
  requiredMemberCardIds: [],
};

const AKI_TALENT_ID = "chr-00004";
const AKI_FIVE_STAR_ID = "card-00004-5-uniq-0005-00";
const AKI_FOUR_STAR_ID = "card-00004-4-cmmn-0000-00";
const MULTI_VARIANT_OWNED = [
  ...OWNED,
  { cardId: AKI_FOUR_STAR_ID, bloomStage: 0 as const },
  { cardId: "card-03003-5-uniq-0035-00", bloomStage: 0 as const },
] as const;

function requestWithOshi(role: "member" | "leader" | "member-and-leader") {
  return {
    schemaVersion: 4 as const,
    rosterCommit: TEAM_CALCULATOR_ROSTER_COMMIT,
    ownedCards: MULTI_VARIANT_OWNED,
    requiredMemberCardIds: [],
    oshi: { talentId: AKI_TALENT_ID, role },
  };
}

function fastEvaluator(
  score: (input: NativeUtilityInput) => number = () => 100,
): (input: NativeUtilityInput) => NativeUtilityResult {
  const templateByChart = new Map<string, NativeUtilityResult>();
  return (input) => {
    let template = templateByChart.get(input.chartKey);
    if (!template) {
      template = evaluateNativeRelativeUtility(input);
      templateByChart.set(input.chartKey, template);
    }
    const central = score(input);
    return {
      ...template,
      relativeUtility: { lower: central, central, upper: central },
      components: {
        ...template.components,
        active: {
          ...template.components.active,
          byMember: template.components.active.byMember.map((member, index) => ({
            ...member,
            cardId: input.formation.members[index]!.cardId,
          })),
        },
        special: {
          ...template.components.special,
          byFormationOrder: template.components.special.byFormationOrder.map((member, index) => ({
            ...member,
            cardId: input.formation.members[index]!.cardId,
          })),
        },
        parameterEffects: {
          ...template.components.parameterEffects,
          contributions: [],
        },
      },
    };
  };
}

describe("owned-roster team calculator", () => {
  it("averages the exact frozen 70:30 corpus deterministically without a song input", () => {
    const receivedInputs: NativeUtilityInput[] = [];
    const result = calculateOwnedRosterTeam(REQUEST, {
      evaluate: (input) => {
        receivedInputs.push(input);
        return evaluateNativeRelativeUtility(input);
      },
    });
    const repeated = calculateOwnedRosterTeam({
      ...REQUEST,
      ownedCards: [...REQUEST.ownedCards].reverse(),
    });
    const ownedById = new Map<string, number>(
      OWNED.map((ownedCard) => [ownedCard.cardId, ownedCard.bloomStage]),
    );
    const expectedCharts = [
      ...nativeRankingBenchmark.corpus.reference.map((entry) => entry.chartKey),
      ...nativeRankingBenchmark.corpus.current.map((entry) => entry.chartKey),
    ];

    expect(result).toEqual(repeated);
    expect(result).not.toHaveProperty("chart");
    expect(result.oshi).toBeNull();
    expect(TEAM_CALCULATOR_CORPUS.entries.map((entry) => entry.chartKey)).toEqual(expectedCharts);
    expect(result.corpus.entriesSha256).toBe(nativeRankingBenchmark.corpus.entriesSha256);
    expect(result.corpus.charts.map((entry) => entry.chartKey)).toEqual(expectedCharts);
    expect(new Set(receivedInputs.map((input) => input.chartKey))).toEqual(new Set(expectedCharts));
    expect(receivedInputs.every((input) => input.formation.members.every(
      (member) => member.bloomStage === ownedById.get(member.cardId),
    ))).toBe(true);
    expect(result.score.relativeUtility.central).toBeCloseTo(
      (result.score.referenceAverage.central * 21 + result.score.currentAverage.central * 9) / 30,
      5,
    );
    expect(result.leader.cardId).toSatisfy((cardId: string) => ownedById.has(cardId));
    expect(result.members).toHaveLength(5);
    expect(new Set(result.members.map((member) => member.talentId)).size).toBe(5);
    expect(result.formationOrder).toMatchObject({
      kind: "timed-corpus",
      label: "Chart-timed corpus order",
      permutationsChecked: 120,
      corpusChartCount: 30,
      markerLayoutCount: 1,
      timingScenarioCount: 30,
      exactTimelineAvailable: true,
      changesModeledTimingUtility: true,
    });
    expect(result.formationOrder.cardIds).toEqual(
      result.members.map((member) => member.cardId),
    );
    expect(result.formationOrder.members.map((member) => member.slot)).toEqual([1, 2, 3, 4, 5]);
    expect(result.formationOrder.members.map((member) => member.bloomStage)).toEqual(
      result.members.map((member) => member.bloomStage),
    );
    expect(result.search).toMatchObject({
      resultClaim: "certified-within-canonical-corpus-scope",
      certificateKind: "certified",
      teamSetsInScope: 1,
      teamSetsConsidered: 1,
      unsearchedTeamSets: 0,
      comparisonOrder: "canonical-card-id-order",
      formationOrderGloballyCertified: false,
      canonicalCorpusOptimalityClaim: true,
    });
    expect(result.score.absoluteLiveScoreAvailable).toBe(false);
  }, 30_000);

  it("addresses every result to its exact owned-card, Bloom, Oshi, and corpus scope", () => {
    const base = calculateOwnedRosterTeam(REQUEST, { evaluate: fastEvaluator() });
    const changedBloom = calculateOwnedRosterTeam(
      {
        ...REQUEST,
        ownedCards: REQUEST.ownedCards.map((ownedCard, index) =>
          index === 0 ? { ...ownedCard, bloomStage: 1 as const } : ownedCard,
        ),
      },
      { evaluate: fastEvaluator() },
    );
    const withOshi = calculateOwnedRosterTeam(
      { ...REQUEST, oshi: { talentId: AKI_TALENT_ID, role: "member" as const } },
      { evaluate: fastEvaluator() },
    );

    expect(base.search.scopeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(base.search.certificateId).toBe(base.search.scopeHash);
    expect(base.search.optimalityGap).toBe(0);
    expect(base.search.formationOrderClaim).toBe("conditional-on-selected-team");
    expect(changedBloom.search.scopeHash).not.toBe(base.search.scopeHash);
    expect(withOshi.search.scopeHash).not.toBe(base.search.scopeHash);
    expect(withOshi.search.certificateId).toBe(withOshi.search.scopeHash);
  }, 30_000);

  it("emits paired replacement evidence from cached chart evaluations", () => {
    let evaluateCalls = 0;
    const evaluatedKeys = new Set<string>();
    const evaluate = fastEvaluator();
    const result = calculateOwnedRosterTeam(
      { ...REQUEST, ownedCards: MULTI_VARIANT_OWNED },
      {
        evaluate: (input) => {
          evaluateCalls += 1;
          evaluatedKeys.add(`${input.formation.leaderOutfitCardId}|${input.formation.members.map((member) => member.cardId).join("|")}|${input.chartKey}`);
          return evaluate(input);
        },
      },
    );

    expect(result.schemaVersion).toBe(5);
    expect(result.methodologyVersion).toBe("yd-owned-roster-calculator-5.0.0");
    expect(result.search.runRecordId).toMatch(/^yd-owned-roster-run-v5-/);
    expect(result.alternatives.flatMap((group) => group.cards).length).toBeGreaterThan(0);
    for (const group of result.alternatives) {
      for (const card of group.cards) {
        const impact = card.replacementImpact;
        expect(impact.beforeCentral).toBe(result.score.relativeUtility.central);
        expect(impact.afterCentral).toBe(card.relativeUtility.central);
        expect(impact.centralDelta).toBeCloseTo(
          card.relativeUtility.central - result.score.relativeUtility.central,
          5,
        );
        expect(impact.chartsImproved + impact.chartsWorsened + impact.chartsTied).toBe(30);
        expect(impact.formationOrderAffectsValue).toBe(false);
        expect(impact.effectChanges.every((effect) =>
          effect.recipientCardIdsBefore.every((id) => result.members.some((member) => member.cardId === id)) &&
          effect.recipientCardIdsAfter.every((id) =>
            result.members.some((member) => member.cardId === id) || id === card.cardId,
          ),
        )).toBe(true);
      }
    }
    expect(evaluateCalls).toBe(result.search.corpusUtilityEvaluations);
    expect(evaluateCalls).toBe(evaluatedKeys.size);
  }, 30_000);

  it.each([
    {
      role: "member" as const,
      roleLabel: "Must include as Member" as const,
      teamSetsInScope: 10,
      leaderFormations: 70,
      memberStatus: "fulfilled" as const,
      leaderStatus: "not-required" as const,
    },
    {
      role: "leader" as const,
      roleLabel: "Must use as Leader Outfit" as const,
      teamSetsInScope: 11,
      leaderFormations: 22,
      memberStatus: "not-required" as const,
      leaderStatus: "fulfilled" as const,
    },
    {
      role: "member-and-leader" as const,
      roleLabel: "Must include as Member and use as Leader Outfit" as const,
      teamSetsInScope: 10,
      leaderFormations: 20,
      memberStatus: "fulfilled" as const,
      leaderStatus: "fulfilled" as const,
    },
  ])(
    "enforces the $role Oshi role and certifies only its constrained exact scope",
    ({ role, roleLabel, teamSetsInScope, leaderFormations, memberStatus, leaderStatus }) => {
      const result = calculateOwnedRosterTeam(requestWithOshi(role), { evaluate: fastEvaluator() });
      const oshi = result.oshi!;

      expect(oshi).toMatchObject({
        talentId: AKI_TALENT_ID,
        talentName: "Aki Rosenthal",
        role,
        roleLabel,
        eligibleOwnedMemberCardIds: [AKI_FOUR_STAR_ID, AKI_FIVE_STAR_ID],
        eligibleOwnedLeaderCardIds: [AKI_FOUR_STAR_ID, AKI_FIVE_STAR_ID],
        resolution: {
          member: { status: memberStatus },
          leader: { status: leaderStatus },
          overallStatus: "fulfilled",
        },
      });
      if (memberStatus === "fulfilled") {
        expect(result.members.find((member) => member.talentId === AKI_TALENT_ID)?.cardId).toBe(
          oshi.resolution.member.selectedCardId,
        );
      } else {
        expect(oshi.resolution.member.selectedCardId).toBeNull();
      }
      if (leaderStatus === "fulfilled") {
        expect(result.leader.talentId).toBe(AKI_TALENT_ID);
        expect(result.leader.cardId).toBe(oshi.resolution.leader.selectedCardId);
      } else {
        expect(oshi.resolution.leader.selectedCardId).toBeNull();
      }
      expect(result.search).toMatchObject({
        resultClaim: "certified-within-canonical-corpus-scope",
        optimalityClaim:
          "exhaustive-across-constraint-eligible-teams-leaders-and-frozen-corpus-under-canonical-order",
        teamSetsInScope,
        teamSetsConsidered: teamSetsInScope,
        unsearchedTeamSets: 0,
        initialLeaderTeamFormationsReranked: leaderFormations,
        searchLeaderTeamFormationsReranked: leaderFormations,
        canonicalCorpusOptimalityClaim: true,
      });
    },
    30_000,
  );

  it("evaluates every owned Oshi variant and selects the stronger modeled Member deterministically", () => {
    const evaluatedMemberSets = new Set<string>();
    const preferFourStar = fastEvaluator((input) => {
      evaluatedMemberSets.add(input.formation.members.map((member) => member.cardId).sort().join("|"));
      const containsPreferred = input.formation.members.some(
        (member) => member.cardId === AKI_FOUR_STAR_ID,
      );
      return containsPreferred ? 1_000_000 : 1;
    });
    const request = requestWithOshi("member");
    const result = calculateOwnedRosterTeam(request, { evaluate: preferFourStar });
    const repeated = calculateOwnedRosterTeam(
      { ...request, ownedCards: [...request.ownedCards].reverse() },
      { evaluate: preferFourStar },
    );

    expect(
      [...evaluatedMemberSets].some((memberIds) => memberIds.includes(AKI_FIVE_STAR_ID)),
    ).toBe(true);
    expect(
      [...evaluatedMemberSets].some((memberIds) => memberIds.includes(AKI_FOUR_STAR_ID)),
    ).toBe(true);
    expect(result.oshi?.resolution.member.selectedCardId).toBe(AKI_FOUR_STAR_ID);
    expect(result).toEqual(repeated);
  }, 30_000);

  it("keeps every displayed replacement legal under a Member Oshi constraint", () => {
    const result = calculateOwnedRosterTeam(requestWithOshi("member"), {
      evaluate: fastEvaluator(),
    });
    const oshiMemberId = result.oshi!.resolution.member.selectedCardId!;
    const oshiReplacementGroup = result.alternatives.find(
      (alternative) => alternative.replacesCardId === oshiMemberId,
    )!;

    expect(oshiReplacementGroup.cards.every((card) => card.talentId === AKI_TALENT_ID)).toBe(true);
    for (const alternative of result.alternatives) {
      const remaining = result.members.filter(
        (member) => member.cardId !== alternative.replacesCardId,
      );
      expect(
        alternative.cards.every(
          (replacement) =>
            remaining.some((member) => member.talentId === AKI_TALENT_ID) ||
            replacement.talentId === AKI_TALENT_ID,
        ),
      ).toBe(true);
    }
  }, 30_000);

  it("keeps exact required Member cards selected and returns no replacements for locked slots", () => {
    const requiredMemberCardIds = [AKI_FIVE_STAR_ID, "card-00005-5-uniq-0006-00"];
    const result = calculateOwnedRosterTeam(
      {
        ...REQUEST,
        ownedCards: MULTI_VARIANT_OWNED,
        requiredMemberCardIds,
      },
      { evaluate: fastEvaluator() },
    );

    expect(result.requiredMembers).toEqual({ cardIds: [...requiredMemberCardIds].sort(), status: "fulfilled" });
    expect(result.members.map((member) => member.cardId)).toEqual(
      expect.arrayContaining(requiredMemberCardIds),
    );
    for (const requiredCardId of requiredMemberCardIds) {
      expect(result.alternatives.find((group) => group.replacesCardId === requiredCardId)).toMatchObject({
        coverage: {
          eligibleCardCount: 0,
          coarseScreenedCardCount: 0,
          corpusProxyScreenedCardCount: 0,
          fullCorpusRerankedCardCount: 0,
          returnedCardCount: 0,
        },
        cards: [],
      });
    }
    expect(result.alternatives).toHaveLength(5);
    expect(result.methodologyVersion).toBe("yd-owned-roster-calculator-5.0.0");
  }, 30_000);

  it("treats a locked Oshi card as satisfying the Member role without reserving another slot", () => {
    const request = {
      ...requestWithOshi("member-and-leader"),
      requiredMemberCardIds: [AKI_FIVE_STAR_ID],
    };
    const result = calculateOwnedRosterTeam(request, { evaluate: fastEvaluator() });
    expect(result.requiredMembers).toEqual({ cardIds: [AKI_FIVE_STAR_ID], status: "fulfilled" });
    expect(result.oshi?.resolution.member.selectedCardId).toBe(AKI_FIVE_STAR_ID);
    expect(result.oshi?.resolution.leader.selectedCardId).toBe(result.leader.cardId);
  }, 30_000);

  it("rejects unowned, duplicate-talent, and Oshi capacity conflicts before utility evaluation", () => {
    let invoked = false;
    const dependencies = {
      evaluate: () => {
        invoked = true;
        throw new Error("must not run");
      },
    };
    expect(() => calculateOwnedRosterTeam({
      ...REQUEST,
      requiredMemberCardIds: ["card-not-owned"],
    }, dependencies)).toThrow(/must be selected in your owned roster/i);
    expect(() => calculateOwnedRosterTeam({
      ...requestWithOshi("member"),
      requiredMemberCardIds: [AKI_FIVE_STAR_ID, AKI_FOUR_STAR_ID],
    }, dependencies)).toThrow(/different talents/i);
    const capacityRequest = {
      ...REQUEST,
      ownedCards: [
        ...OWNED,
        { cardId: "card-03003-5-uniq-0035-00", bloomStage: 0 as const },
      ],
      requiredMemberCardIds: OWNED.map((ownedCard) => ownedCard.cardId),
      oshi: { talentId: "chr-03003", role: "member" as const },
    };
    expect(() => calculateOwnedRosterTeam(capacityRequest, dependencies)).toThrow(/remaining slot/i);
    expect(invoked).toBe(false);
  }, 30_000);

  it("anchors every owned Oshi variant in bounded generation and reports constrained coverage deterministically", () => {
    const ownedCards = [
      ...MULTI_VARIANT_OWNED,
      { cardId: "card-03005-5-uniq-0037-00", bloomStage: 0 as const },
      { cardId: "card-03001-5-uniq-0033-00", bloomStage: 0 as const },
    ];
    const anchorCalls: string[] = [];
    const fakeSearch = (
      input: NativeCanonicalCandidateSearchInput,
    ): NativeCanonicalCandidateSearchResult => {
      const anchorCardId = input.constraints?.anchorCardIds?.[0];
      if (!anchorCardId) throw new Error("Member Oshi candidate generation requires an anchor");
      anchorCalls.push(anchorCardId);
      const allowedMemberIds = input.constraints!.memberCardIds!;
      const selected = [anchorCardId];
      const selectedTalents = new Set([publicCards.find((card) => card.id === anchorCardId)!.talentId]);
      for (const cardId of allowedMemberIds) {
        const talentId = publicCards.find((card) => card.id === cardId)!.talentId;
        if (selectedTalents.has(talentId)) continue;
        selected.push(cardId);
        selectedTalents.add(talentId);
        if (selected.length === 5) break;
      }
      const memberCardIds = [...selected].sort() as [string, string, string, string, string];
      return {
        kind: "native-canonical-candidate-search",
        methodologyVersion: "yd-native-canonical-candidates-1.0.0",
        candidates: [
          {
            leaderOutfitCardId: input.constraints!.leaderOutfitCardIds![0]!,
            memberCardIds,
            relativeUtility: { lower: 100, central: 100, upper: 100 },
          },
        ],
        counts: {
          eligibleMemberCards: allowedMemberIds.length,
          eligibleLeaderOutfits: input.constraints!.leaderOutfitCardIds!.length,
          legalTeamSetsInScope: 70,
          teamSetsConsidered: 1,
          unsearchedTeamSets: 69,
          leaderTeamEvaluations: 1,
          utilityEvaluations: 1,
        },
      };
    };
    const request = {
      schemaVersion: 4 as const,
      rosterCommit: TEAM_CALCULATOR_ROSTER_COMMIT,
      ownedCards,
      requiredMemberCardIds: [],
      oshi: { talentId: AKI_TALENT_ID, role: "member" as const },
    };
    const result = calculateOwnedRosterTeam(request, {
      search: fakeSearch,
      evaluate: fastEvaluator(),
    });
    const repeated = calculateOwnedRosterTeam(
      { ...request, ownedCards: [...ownedCards].reverse() },
      { search: fakeSearch, evaluate: fastEvaluator() },
    );

    expect(new Set(anchorCalls)).toEqual(new Set([AKI_FOUR_STAR_ID, AKI_FIVE_STAR_ID]));
    expect(anchorCalls).toHaveLength(20);
    expect(result).toEqual(repeated);
    expect(result.oshi?.resolution.member.status).toBe("fulfilled");
    expect(result.search).toMatchObject({
      resultClaim: "bounded-search",
      certificateKind: "heuristic-bounded",
      optimalityClaim: "not-certified",
      teamSetsInScope: 70,
      canonicalCorpusOptimalityClaim: false,
    });
    expect(result.search.teamSetsConsidered).toBeLessThan(70);
    expect(result.search.unsearchedTeamSets).toBe(
      70 - result.search.teamSetsConsidered,
    );
  }, 30_000);

  it("rejects malformed and unowned Oshi talents before utility evaluation", () => {
    let invoked = false;
    const dependencies = {
      evaluate: () => {
        invoked = true;
        throw new Error("must not run");
      },
    };
    expect(() =>
      calculateOwnedRosterTeam(
        { ...REQUEST, oshi: { talentId: "", role: "member" } },
        dependencies,
      ),
    ).toThrowError(TeamCalculatorError);
    expect(() =>
      calculateOwnedRosterTeam(
        { ...REQUEST, oshi: { talentId: "chr-not-owned", role: "leader" } },
        dependencies,
      ),
    ).toThrow("Select an Oshi talent with at least one owned card");
    expect(invoked).toBe(false);
  });

  it("rejects obsolete chart-bearing requests and stale rosters before evaluation", () => {
    let invoked = false;
    expect(() =>
      calculateOwnedRosterTeam(
        { ...REQUEST, chartKey: "m0206:expert" },
        {
          evaluate: () => {
            invoked = true;
            throw new Error("must not run");
          },
        },
      ),
    ).toThrowError(TeamCalculatorError);
    expect(() =>
      calculateOwnedRosterTeam(
        { ...REQUEST, rosterCommit: "0".repeat(40) },
        {
          evaluate: () => {
            invoked = true;
            throw new Error("must not run");
          },
        },
      ),
    ).toThrowError(TeamCalculatorError);
    expect(invoked).toBe(false);
  });

  it("rejects five owned cards that cannot form five unique talents", () => {
    const variantsByTalent = new Map<string, typeof publicCards>();
    for (const card of publicCards) {
      const variants = variantsByTalent.get(card.talentId) ?? [];
      variantsByTalent.set(card.talentId, [...variants, card]);
    }
    const lowDiversity = [...variantsByTalent.values()].flatMap((cards) => cards).slice(0, 5);
    expect(new Set(lowDiversity.map((card) => card.talentId)).size).toBeLessThan(5);

    expect(() =>
      calculateOwnedRosterTeam({
        ...REQUEST,
        ownedCards: lowDiversity.map((card) => ({ cardId: card.id, bloomStage: 0 as const })),
      }),
    ).toThrow("Select cards from at least five different talents");
  });
});

// A twelve-talent roster is past TEAM_CALCULATOR_MAX_EXACT_TEAM_SETS, so these
// run on the bounded beam path with the real evaluator. Both cases failed
// before the coordinate ascent was allowed to reach a fixpoint: the backups
// panel advertised a Kazama Iroha swap worth +171.756 more than the team it was
// shown beneath, and that same missed improvement made a chr-00039 Oshi — a
// pure restriction that never enters the objective — outscore the unconstrained
// run by the identical amount.
const BOUNDED_ROSTER = [
  "card-00039-5-uniq-0032-00",
  "card-03005-5-uniq-0037-00",
  "card-00005-5-uniq-0006-00",
  "card-04003-5-uniq-0044-00",
  "card-00018-5-uniq-0004-00",
  "card-06005-5-uniq-0061-00",
  "card-00019-5-uniq-0016-00",
  "card-00014-5-uniq-0013-00",
  "card-04007-5-uniq-0047-00",
  "card-00015-5-uniq-0003-00",
  "card-00004-5-uniq-0005-00",
  "card-00013-5-uniq-0002-00",
].map((cardId) => ({ cardId, bloomStage: 0 as const }));

const BOUNDED_REQUEST = {
  schemaVersion: 4 as const,
  rosterCommit: TEAM_CALCULATOR_ROSTER_COMMIT,
  ownedCards: BOUNDED_ROSTER,
  requiredMemberCardIds: [],
};

describe("bounded owned-roster search consistency", () => {
  it("keeps required cards through bounded generation, refinement, and replacements", () => {
    const requiredMemberCardIds = BOUNDED_ROSTER.slice(0, 2).map((ownedCard) => ownedCard.cardId);
    const result = calculateOwnedRosterTeam(
      { ...BOUNDED_REQUEST, requiredMemberCardIds },
      { evaluate: fastEvaluator() },
    );
    expect(result.search.resultClaim).toBe("bounded-search");
    expect(result.members.map((member) => member.cardId)).toEqual(
      expect.arrayContaining(requiredMemberCardIds),
    );
    expect(result.alternatives).toHaveLength(5);
    for (const requiredCardId of requiredMemberCardIds) {
      const group = result.alternatives.find((alternative) => alternative.replacesCardId === requiredCardId)!;
      expect(group.cards).toEqual([]);
      expect(group.coverage.eligibleCardCount).toBe(0);
      expect(group.coverage.returnedCardCount).toBe(0);
    }
  }, 60_000);

  it("never displays a replacement that outscores the team it is offered against", () => {
    const result = calculateOwnedRosterTeam(BOUNDED_REQUEST);
    // Guard against the assertion going vacuous if the exact path ever widens.
    expect(result.search.resultClaim).toBe("bounded-search");

    const headline = result.score.relativeUtility.central;
    const improvingByLoss = result.alternatives.flatMap((group) =>
      group.cards
        .filter((card) => card.modeledUtilityLoss.central < 0)
        .map((card) => `${card.cardId} instead of ${group.replacesCardId}`),
    );
    // Checked independently of the reported loss, so a sign or subtraction
    // error in modeledUtilityLoss cannot hide the same defect.
    const improvingByUtility = result.alternatives.flatMap((group) =>
      group.cards
        .filter((card) => card.relativeUtility.central > headline)
        .map((card) => `${card.cardId} instead of ${group.replacesCardId}`),
    );

    expect(improvingByLoss).toEqual([]);
    expect(improvingByUtility).toEqual([]);
  }, 30_000);

  it("does not let an Oshi restriction outscore the unrestricted search", () => {
    const unconstrained = calculateOwnedRosterTeam(BOUNDED_REQUEST).score.relativeUtility.central;

    for (const role of ["member", "leader", "member-and-leader"] as const) {
      const constrained = calculateOwnedRosterTeam({
        ...BOUNDED_REQUEST,
        oshi: { talentId: "chr-00039", role },
      });
      // An Oshi only removes candidates, so its optimum cannot exceed the
      // unrestricted one on the same roster.
      expect(constrained.score.relativeUtility.central).toBeLessThanOrEqual(unconstrained);
    }
  }, 60_000);
});
