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
  schemaVersion: 3 as const,
  rosterCommit: TEAM_CALCULATOR_ROSTER_COMMIT,
  ownedCards: OWNED,
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
    schemaVersion: 3 as const,
    rosterCommit: TEAM_CALCULATOR_ROSTER_COMMIT,
    ownedCards: MULTI_VARIANT_OWNED,
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
      const anchorCardId = input.constraints?.anchorCardId;
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
      schemaVersion: 3 as const,
      rosterCommit: TEAM_CALCULATOR_ROSTER_COMMIT,
      ownedCards,
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
