import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { mechanicsData } from "./mechanics";
import {
  searchNativeCanonicalCandidates,
  searchNativeLegalTeams,
  type NativeSearchInput,
} from "./native-search";
import {
  evaluateNativeRelativeUtility,
  type NeutralBoardAccountState,
  type UtilityInterval,
} from "./native-utility";

const CARD = {
  sora4: "card-00001-4-cmmn-0000-00",
  aki5: "card-00004-5-uniq-0005-00",
  haato5: "card-00005-5-uniq-0006-00",
  azki4: "card-00013-4-cmmn-0000-00",
  azki5: "card-00013-5-uniq-0002-00",
  okayu5: "card-00016-5-uniq-0014-00",
  suisei5: "card-00018-5-uniq-0004-00",
  pekora5: "card-00019-5-uniq-0016-00",
  iroha5: "card-00039-5-uniq-0032-00",
} as const;

const FIXTURE_MEMBER_IDS = [
  CARD.sora4,
  CARD.aki5,
  CARD.haato5,
  CARD.azki4,
  CARD.azki5,
  CARD.okayu5,
  CARD.suisei5,
  CARD.pekora5,
  CARD.iroha5,
] as const;

const TIED_LEADERS = [CARD.aki5, CARD.azki5] as const;
const BOARD: NeutralBoardAccountState = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "fixture:verified-neutral-board",
  },
};

const BASE_INPUT: NativeSearchInput = {
  chartKey: "m0206:expert",
  seed: 0x5eed,
  investmentLayer: "one-copy-maximum",
  accountState: BOARD,
  constraints: {
    anchorCardId: CARD.azki5,
    memberCardIds: FIXTURE_MEMBER_IDS,
    leaderOutfitCardIds: TIED_LEADERS,
  },
  strategy: {
    mode: "exact",
    maxTeamSets: 100,
    auditedFinalists: 2,
    alternativesPerSlot: 2,
  },
};

const mechanicsById = new Map(mechanicsData.cards.map((card) => [card.cardId, card]));

type BruteCandidate = {
  leaderOutfitCardId: string;
  memberCardIds: string[];
  relativeUtility: UtilityInterval;
};

function independentCombinations(values: readonly string[], count: number): string[][] {
  const result: string[][] = [];
  const visit = (start: number, selected: string[]): void => {
    if (selected.length === count) {
      result.push([...selected]);
      return;
    }
    for (let index = start; index <= values.length - (count - selected.length); index += 1) {
      selected.push(values[index]!);
      visit(index + 1, selected);
      selected.pop();
    }
  };
  visit(0, []);
  return result;
}

function independentPermutations(values: readonly string[]): string[][] {
  if (values.length <= 1) return [[...values]];
  return values.flatMap((value, index) =>
    independentPermutations([...values.slice(0, index), ...values.slice(index + 1)]).map(
      (tail) => [value, ...tail],
    ),
  );
}

function independentlyEvaluate(
  leaderOutfitCardId: string,
  memberCardIds: readonly string[],
): BruteCandidate {
  return {
    leaderOutfitCardId,
    memberCardIds: [...memberCardIds],
    relativeUtility: evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId,
        members: memberCardIds.map((cardId) => ({
          cardId,
          investment: "one-copy-maximum" as const,
        })),
      },
      chartKey: "m0206:expert",
      seed: 0x5eed,
      accountState: BOARD,
    }).relativeUtility,
  };
}

function compareBruteCandidates(left: BruteCandidate, right: BruteCandidate): number {
  if (left.relativeUtility.central !== right.relativeUtility.central) {
    return right.relativeUtility.central - left.relativeUtility.central;
  }
  if (left.relativeUtility.lower !== right.relativeUtility.lower) {
    return right.relativeUtility.lower - left.relativeUtility.lower;
  }
  if (left.relativeUtility.upper !== right.relativeUtility.upper) {
    return right.relativeUtility.upper - left.relativeUtility.upper;
  }
  return `${left.leaderOutfitCardId}|${left.memberCardIds.join("|")}`.localeCompare(
    `${right.leaderOutfitCardId}|${right.memberCardIds.join("|")}`,
  );
}

function independentBruteForce(): BruteCandidate[] {
  const sortedMembers = [...FIXTURE_MEMBER_IDS].sort();
  const legalTeams = independentCombinations(sortedMembers, 5).filter((memberCardIds) => {
    if (!memberCardIds.includes(CARD.azki5)) return false;
    const talents = memberCardIds.map((cardId) => mechanicsById.get(cardId)!.talentId);
    return new Set(talents).size === 5;
  });
  return legalTeams
    .flatMap((memberCardIds) =>
      [...TIED_LEADERS]
        .sort()
        .map((leaderOutfitCardId) => independentlyEvaluate(leaderOutfitCardId, memberCardIds)),
    )
    .sort(compareBruteCandidates);
}

describe("native legal-team search", () => {
  it("generates deterministic canonical beam candidates without formation-order audits", () => {
    const { strategy: _strategy, ...base } = BASE_INPUT;
    const input = {
      ...base,
      strategy: {
        mode: "beam" as const,
        beamWidth: 8,
        finalistTeamCount: 3,
        leadersPerTeam: 1,
      },
    };
    const result = searchNativeCanonicalCandidates(input);

    expect(result).toEqual(searchNativeCanonicalCandidates(input));
    expect(result.candidates).toHaveLength(result.counts.teamSetsConsidered);
    expect(result.counts.leaderTeamEvaluations).toBe(
      result.counts.teamSetsConsidered * result.counts.eligibleLeaderOutfits,
    );
    expect(result.counts.utilityEvaluations).toBe(result.counts.leaderTeamEvaluations);
    expect(result).not.toHaveProperty("auditedFinalists");
  });

  it("matches an independent real-card winner and returns a strict local fixed point", () => {
    const brute = independentBruteForce();
    const initiallyAudited = brute
      .slice(0, 2)
      .flatMap((candidate) =>
        independentPermutations(candidate.memberCardIds).map((order) =>
          independentlyEvaluate(candidate.leaderOutfitCardId, order),
        ),
      )
      .sort(compareBruteCandidates);
    const result = searchNativeLegalTeams(BASE_INPUT);
    const initialWinner = initiallyAudited[0]!;

    expect(result.certificate).toMatchObject({
      kind: "certified",
      optimalityClaim: "exhaustive-within-canonical-aggregate-order-scope",
      teamSetsInScope: 35,
      teamSetsConsidered: 35,
      unsearchedTeamSets: 0,
      formationOrder: {
        selection: "best-modeled-order-among-audited-finalists",
        auditedLeaderTeamCandidates: 2,
        totalLeaderTeamCandidates: 70,
        unauditedLeaderTeamCandidates: 68,
        globalBestOrderCertified: false,
      },
    });
    expect(result.counts.leaderTeamEvaluations).toBe(70);
    expect(result.best.leaderOutfitCardId).toBe(initialWinner.leaderOutfitCardId);
    expect(result.best.members.map((member) => member.cardId)).toEqual(
      initialWinner.memberCardIds,
    );
    expect(result.best.relativeUtility).toEqual(initialWinner.relativeUtility);

    expect(result.certificate.localRefinement).toMatchObject({
      status: "fixed-point",
      scope: "one-member-swap-or-leader-change",
      selection: "strict-central-coordinate-ascent",
      iterations: 0,
      globalOptimalityClaim: false,
    });

    const bestOrder = result.best.members.map((member) => member.cardId);
    const bestCentral = result.best.relativeUtility.central;
    for (const [slot, replacedCardId] of bestOrder.entries()) {
      if (replacedCardId === CARD.azki5) continue;
      const otherIds = bestOrder.filter((_, index) => index !== slot);
      const otherTalents = new Set(otherIds.map((cardId) => mechanicsById.get(cardId)!.talentId));
      for (const cardId of FIXTURE_MEMBER_IDS) {
        const card = mechanicsById.get(cardId)!;
        if (
          cardId === replacedCardId ||
          otherIds.includes(cardId) ||
          otherTalents.has(card.talentId)
        ) {
          continue;
        }
        const neighbor = [...bestOrder];
        neighbor[slot] = cardId;
        expect(independentlyEvaluate(result.best.leaderOutfitCardId, neighbor).relativeUtility.central)
          .toBeLessThanOrEqual(bestCentral + 0.000_001);
      }
    }
    for (const leaderOutfitCardId of TIED_LEADERS) {
      expect(independentlyEvaluate(leaderOutfitCardId, bestOrder).relativeUtility.central)
        .toBeLessThanOrEqual(bestCentral + 0.000_001);
    }
    expect(
      result.replacementsBySlot.flatMap((slot) => slot.alternatives)
        .every((alternative) => alternative.intervalLoss.central >= -0.000_001),
    ).toBe(true);
  });

  it("evaluates every eligible Leader/Outfit for every finalist and audits all 120 orders", () => {
    const result = searchNativeLegalTeams(BASE_INPUT);
    const expectedLeaders = [...TIED_LEADERS].sort();

    expect(result.leaderCoverageByFinalistTeam).toHaveLength(35);
    expect(
      result.leaderCoverageByFinalistTeam.every(
        (coverage) =>
          JSON.stringify(coverage.evaluatedLeaderOutfitCardIds) === JSON.stringify(expectedLeaders),
      ),
    ).toBe(true);
    expect(result.counts).toMatchObject({
      eligibleLeaderOutfits: 2,
      auditedFinalists: 2,
      formationOrdersAudited: 240,
      localRefinementIterations: 0,
      localImprovingCandidatesAudited: 0,
      localFormationOrdersAudited: 0,
    });
    expect(result.auditedFinalists).toHaveLength(2);
    for (const audit of result.auditedFinalists) {
      expect(audit).toMatchObject({
        status: "indeterminate-aggregate-context",
        evaluatedOrders: 120,
        distinctOrders: 120,
        recommendedOrder: null,
      });
      expect(audit.modeledBestOrder).toHaveLength(5);
      expect(audit.modeledBestRelativeUtility.central).toBe(audit.centralRange.maximum);
      expect(audit.intervalEnvelope.lower).toBeLessThanOrEqual(audit.centralRange.mean);
      expect(audit.centralRange.mean).toBeLessThanOrEqual(audit.intervalEnvelope.upper);
    }
    expect(result.best.orderAudit).toEqual(result.auditedFinalists[0]);
    expect(result.best.members.map((member) => member.cardId)).toEqual(
      result.best.orderAudit.modeledBestOrder,
    );
    expect(result.best.relativeUtility).toEqual(
      result.best.orderAudit.modeledBestRelativeUtility,
    );
    expect(result.best.recipients.length).toBeGreaterThan(0);
    expect(result.best.timing.active).toHaveLength(5);
    expect(result.best.timing.special).toHaveLength(5);
  });

  it("certifies formation-order optimality only when exact search audits every leader/team pair", () => {
    const result = searchNativeLegalTeams({
      ...BASE_INPUT,
      constraints: {
        anchorCardId: CARD.azki5,
        memberCardIds: [CARD.aki5, CARD.haato5, CARD.azki5, CARD.okayu5, CARD.suisei5],
        leaderOutfitCardIds: TIED_LEADERS,
      },
      strategy: {
        mode: "exact",
        maxTeamSets: 2,
        auditedFinalists: 2,
        alternativesPerSlot: 1,
      },
    });

    expect(result.counts).toMatchObject({
      legalTeamSetsInScope: 1,
      leaderTeamEvaluations: 2,
      auditedFinalists: 2,
      formationOrdersAudited: 240,
    });
    expect(result.certificate).toMatchObject({
      kind: "certified",
      formationOrder: {
        auditedLeaderTeamCandidates: 2,
        totalLeaderTeamCandidates: 2,
        unauditedLeaderTeamCandidates: 0,
        globalBestOrderCertified: true,
      },
      localRefinement: {
        status: "globally-certified",
        iterations: 0,
        globalOptimalityClaim: true,
      },
    });
  });

  it("enforces anchor, fixed Leader/Outfit, unique talents, rarity, five-star cap, and investment", () => {
    const result = searchNativeLegalTeams({
      ...BASE_INPUT,
      constraints: {
        anchorCardId: CARD.azki5,
        fixedLeaderOutfitCardId: CARD.iroha5,
        memberCardIds: FIXTURE_MEMBER_IDS,
        leaderOutfitCardIds: [CARD.aki5, CARD.azki5, CARD.iroha5],
        memberRarities: [5, 4],
        leaderRarities: [5],
        maxFiveStarMembers: 4,
      },
      strategy: {
        mode: "exact",
        maxTeamSets: 100,
        auditedFinalists: 1,
        alternativesPerSlot: 1,
      },
    });

    expect(result.counts).toMatchObject({
      legalTeamSetsInScope: 20,
      finalistTeamSets: 20,
      eligibleLeaderOutfits: 1,
      leaderTeamEvaluations: 20,
      formationOrdersAudited: 120,
    });
    expect(result.best.leaderOutfitCardId).toBe(CARD.iroha5);
    expect(result.best.members.some((member) => member.cardId === CARD.azki5)).toBe(true);
    expect(result.best.members.filter((member) => member.rarity === 5).length).toBeLessThanOrEqual(4);
    expect(new Set(result.best.members.map((member) => member.talentId))).toHaveLength(5);
    expect(result.best.members.every((member) => member.investment === "one-copy-maximum")).toBe(true);
    const anchorSlot = result.replacementsBySlot.find(
      (slot) => slot.replacedCardId === CARD.azki5,
    )!;
    expect(anchorSlot).toMatchObject({ anchored: true, alternatives: [] });
    expect(result.replacementsBySlot.some((slot) => slot.alternatives.length > 0)).toBe(true);
  });

  it("applies exact per-card Bloom stages without weakening legal-team constraints", () => {
    const memberCardIds = [CARD.sora4, CARD.aki5, CARD.haato5, CARD.azki5, CARD.okayu5] as const;
    const bloomStageByCardId = {
      [CARD.sora4]: 0,
      [CARD.aki5]: 1,
      [CARD.haato5]: 2,
      [CARD.azki5]: 3,
      [CARD.okayu5]: 4,
    } as const;
    const result = searchNativeLegalTeams({
      ...BASE_INPUT,
      bloomStageByCardId,
      constraints: {
        fixedLeaderOutfitCardId: CARD.azki5,
        memberCardIds,
        leaderOutfitCardIds: [CARD.azki5],
      },
      strategy: {
        mode: "exact",
        maxTeamSets: 1,
        auditedFinalists: 1,
        alternativesPerSlot: 1,
      },
    });

    expect(result.constraints.bloomStageByCardId).toEqual(bloomStageByCardId);
    expect(result.best.members.map((member) => [member.cardId, member.bloomStage])).toEqual(
      result.best.members.map((member) => [
        member.cardId,
        bloomStageByCardId[member.cardId as keyof typeof bloomStageByCardId],
      ]),
    );
    expect(new Set(result.best.members.map((member) => member.talentId))).toHaveLength(5);
    expect(result.best.orderAudit.recommendedOrder).toBeNull();

    const direct = evaluateNativeRelativeUtility({
      formation: {
        leaderOutfitCardId: result.best.leaderOutfitCardId,
        members: result.best.members.map((member) => ({
          cardId: member.cardId,
          investment: "one-copy-maximum" as const,
          bloomStage: bloomStageByCardId[member.cardId as keyof typeof bloomStageByCardId],
        })),
      },
      chartKey: BASE_INPUT.chartKey,
      seed: BASE_INPUT.seed,
      accountState: BOARD,
    });
    expect(result.best.relativeUtility).toEqual(direct.relativeUtility);
    expect(result.best.recipients.every((recipient) => recipient.valuePermil >= 0)).toBe(true);
  });

  it("starts exact and beam enumeration with every plural Member anchor", () => {
    const anchorCardIds = [CARD.azki5, CARD.okayu5] as const;
    const { anchorCardId: _legacyAnchor, ...baseConstraints } = BASE_INPUT.constraints!;
    const exact = searchNativeLegalTeams({
      ...BASE_INPUT,
      constraints: {
        ...baseConstraints,
        anchorCardIds,
      },
      strategy: {
        mode: "exact",
        maxTeamSets: 100,
        auditedFinalists: 1,
        alternativesPerSlot: 2,
      },
    });
    expect(exact.constraints.anchorCardId).toBe(CARD.azki5);
    expect(exact.constraints.anchorCardIds).toEqual([...anchorCardIds].sort());
    expect(exact.counts.legalTeamSetsInScope).toBe(20);
    expect(exact.best.members.map((member) => member.cardId)).toEqual(
      expect.arrayContaining([...anchorCardIds]),
    );
    const anchoredReplacementGroups = exact.replacementsBySlot.filter((slot) =>
      anchorCardIds.includes(slot.replacedCardId as typeof anchorCardIds[number]),
    );
    expect(anchoredReplacementGroups).toHaveLength(anchorCardIds.length);
    expect(anchoredReplacementGroups.every(
      (slot) => slot.anchored && slot.alternatives.length === 0,
    )).toBe(true);

    const beam = searchNativeCanonicalCandidates({
      ...BASE_INPUT,
      constraints: {
        ...baseConstraints,
        anchorCardIds,
      },
      strategy: {
        mode: "beam",
        beamWidth: 18,
        finalistTeamCount: 4,
        leadersPerTeam: 1,
      },
    });
    expect(beam.candidates.length).toBeGreaterThan(0);
    expect(beam.candidates.every((candidate) =>
      anchorCardIds.every((cardId) => candidate.memberCardIds.includes(cardId)),
    )).toBe(true);
  });

  it("rejects ambiguous, duplicate, excluded, and cap-conflicting plural anchors", () => {
    const withAnchors = (anchorCardIds: readonly string[]) => ({
      ...BASE_INPUT,
      constraints: (() => {
        const { anchorCardId: _legacyAnchor, ...withoutLegacy } = BASE_INPUT.constraints!;
        return { ...withoutLegacy, anchorCardIds };
      })(),
    });
    expect(() => searchNativeLegalTeams({
      ...BASE_INPUT,
      constraints: { ...BASE_INPUT.constraints, anchorCardId: CARD.azki5, anchorCardIds: [] },
    })).toThrow(/cannot be used together/i);
    expect(() => searchNativeLegalTeams(withAnchors([CARD.azki5, CARD.azki5]))).toThrow(/duplicate cards/i);
    expect(() => searchNativeLegalTeams(withAnchors([CARD.azki4, CARD.azki5]))).toThrow(/duplicate Member talents/i);
    expect(() => searchNativeLegalTeams(withAnchors([CARD.azki5, "card-00026-5-uniq-0021-00"]))).toThrow(/allowlist or rarity/i);
    expect(() => searchNativeLegalTeams({
      ...withAnchors([CARD.azki5, CARD.okayu5]),
      constraints: { ...withAnchors([CARD.azki5, CARD.okayu5]).constraints, maxFiveStarMembers: 1 },
    })).toThrow(/maxFiveStarMembers/i);
  });

  it("rejects unknown, fractional, and out-of-range per-card Bloom stages", () => {
    expect(() =>
      searchNativeLegalTeams({
        ...BASE_INPUT,
        bloomStageByCardId: { [CARD.sora4]: 2.5 } as never,
      }),
    ).toThrow(/integer from 0 through 5/i);
    expect(() =>
      searchNativeLegalTeams({
        ...BASE_INPUT,
        bloomStageByCardId: { [CARD.sora4]: 6 } as never,
      }),
    ).toThrow(/integer from 0 through 5/i);
    expect(() =>
      searchNativeLegalTeams({
        ...BASE_INPUT,
        bloomStageByCardId: { "card-unknown": 0 },
      }),
    ).toThrow(/unknown Bloom-stage card/i);
  });

  it("is deterministic and independent of caller allowlist order", () => {
    const first = searchNativeLegalTeams({
      ...BASE_INPUT,
      strategy: {
        mode: "beam",
        beamWidth: 18,
        finalistTeamCount: 6,
        auditedFinalists: 1,
        alternativesPerSlot: 1,
      },
    });
    const second = searchNativeLegalTeams({
      ...BASE_INPUT,
      constraints: {
        ...BASE_INPUT.constraints,
        memberCardIds: [...FIXTURE_MEMBER_IDS].reverse(),
        leaderOutfitCardIds: [...TIED_LEADERS].reverse(),
        memberRarities: [5, 4],
        leaderRarities: [5, 4],
      },
      strategy: {
        mode: "beam",
        beamWidth: 18,
        finalistTeamCount: 6,
        auditedFinalists: 1,
        alternativesPerSlot: 1,
      },
    });

    expect(first).toEqual(second);
    expect(first.certificate).toMatchObject({
      kind: "heuristic-bounded",
      optimalityClaim: "not-certified",
    });
    expect(first.certificate.unsearchedTeamSets).toBeGreaterThan(0);
  });

  it("recovers the same mechanics-driven local optimum from a bounded beam screen", () => {
    const result = searchNativeLegalTeams({
      ...BASE_INPUT,
      strategy: {
        mode: "beam",
        beamWidth: 18,
        finalistTeamCount: 8,
        auditedFinalists: 1,
        alternativesPerSlot: 1,
      },
    });
    const winningMembers = result.best.members.map((member) => member.cardId).sort();

    expect(winningMembers).toEqual(
      [CARD.aki5, CARD.pekora5, CARD.azki5, CARD.okayu5, CARD.suisei5].sort(),
    );
    expect(winningMembers).not.toContain(CARD.haato5);
    expect(winningMembers).not.toContain(CARD.iroha5);
    expect(result.certificate.kind).toBe("heuristic-bounded");
    expect(result.certificate.localRefinement.status).toBe("fixed-point");
    expect(result.certificate.localRefinement.globalOptimalityClaim).toBe(false);
  });

  it("runs deterministic beam search over the full current roster without claiming optimality", () => {
    const result = searchNativeLegalTeams({
      chartKey: "m0206:expert",
      seed: 0x5eed,
      investmentLayer: "one-copy-maximum",
      accountState: BOARD,
      strategy: {
        mode: "beam",
        beamWidth: 12,
        finalistTeamCount: 2,
        auditedFinalists: 1,
        alternativesPerSlot: 1,
      },
    });

    expect(result.counts).toMatchObject({
      eligibleMemberCards: 124,
      eligibleLeaderOutfits: 124,
      finalistTeamSets: 2,
      leaderTeamEvaluations: 248,
    });
    expect(result.counts.formationOrdersAudited).toBeGreaterThanOrEqual(120);
    expect(result.counts.localFormationOrdersAudited).toBeGreaterThan(0);
    expect(result.counts.legalTeamSetsInScope).toBeGreaterThan(100_000_000);
    expect(result.certificate).toMatchObject({
      kind: "heuristic-bounded",
      optimalityClaim: "not-certified",
      teamSetsConsidered: 2,
    });
    expect(result.best.members).toHaveLength(5);
    expect(new Set(result.best.members.map((member) => member.talentId))).toHaveLength(5);
  // The same full-roster proof takes roughly one minute on GitHub's shared
  // Linux runners. Keep the production-sized coverage and give slower runners
  // enough headroom instead of shrinking the roster under test.
  }, 120_000);

  it("rejects oversized exhaustive searches and editorial inputs and imports no editorial or legacy ranking module", () => {
    expect(() =>
      searchNativeLegalTeams({
        chartKey: "m0206:expert",
        seed: 0x5eed,
        investmentLayer: "one-copy-maximum",
        accountState: BOARD,
        strategy: { mode: "exact", maxTeamSets: 100 },
      }),
    ).toThrow(/narrow the allowlist or use beam mode/i);

    expect(() =>
      searchNativeLegalTeams({ ...BASE_INPUT, editorialTier: "SS" } as NativeSearchInput),
    ).toThrow(/editorial inputs are forbidden/i);

    const source = readFileSync(new URL("./native-search.ts", import.meta.url), "utf8");
    const imports = source.match(/^import[\s\S]*?from\s+["'][^"']+["'];/gm)?.join("\n") ?? "";
    expect(imports).not.toMatch(/public-data|ranking|data\//i);
    expect(imports).toMatch(/native-utility/);
  });
});
