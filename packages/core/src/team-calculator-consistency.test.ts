import { describe, expect, it } from "vitest";

import {
  calculateOwnedRosterTeam,
  TEAM_CALCULATOR_ROSTER_COMMIT,
} from "./team-calculator";
import type {
  TeamCalculatorOwnedCard,
  TeamCalculatorRequest,
} from "./team-calculator-contract";

type FixtureCard = TeamCalculatorOwnedCard;
type Effort = NonNullable<TeamCalculatorRequest["searchEffort"]>;

function request(
  ownedCards: readonly FixtureCard[],
  searchEffort: Effort = "thorough",
  extra: Partial<TeamCalculatorRequest> = {},
): TeamCalculatorRequest {
  return {
    schemaVersion: 5,
    rosterCommit: TEAM_CALCULATOR_ROSTER_COMMIT,
    ownedCards: [...ownedCards],
    requiredMemberCardIds: [],
    searchEffort,
    ...extra,
  };
}

type DropOneFixture = {
  id: string;
  droppedCardId: string;
  rosterCards: readonly FixtureCard[];
};

const DROP_ONE_FIXTURES: readonly DropOneFixture[] = [
  // Source fixture t1-violations-6-8.json, r-8-rand-1.
  {
    id: "r-8-rand-1",
    droppedCardId: "card-00006-5-uniq-0007-00",
    rosterCards: [
      { cardId: "card-00006-5-uniq-0007-00", bloomStage: 2 },
      { cardId: "card-00015-5-uniq-0067-00", bloomStage: 3 },
      { cardId: "card-00016-5-uniq-0014-00", bloomStage: 1 },
      { cardId: "card-00018-4-cmmn-0000-00", bloomStage: 4 },
      { cardId: "card-00026-5-uniq-0065-00", bloomStage: 1 },
      { cardId: "card-00027-5-uniq-0022-00", bloomStage: 3 },
      { cardId: "card-03005-5-uniq-0037-00", bloomStage: 3 },
      { cardId: "card-04015-5-uniq-0054-00", bloomStage: 3 },
    ],
  },
  // Source fixture t1-violations-9-11.json, r-9-5s-0.
  {
    id: "r-9-5s-0",
    droppedCardId: "card-03009-5-uniq-0041-00",
    rosterCards: [
      { cardId: "card-00005-5-uniq-0006-00", bloomStage: 1 },
      { cardId: "card-00006-5-uniq-0007-00", bloomStage: 2 },
      { cardId: "card-00012-5-uniq-0062-00", bloomStage: 2 },
      { cardId: "card-00014-5-uniq-0013-00", bloomStage: 0 },
      { cardId: "card-00021-5-uniq-0017-00", bloomStage: 2 },
      { cardId: "card-00037-5-uniq-0030-00", bloomStage: 3 },
      { cardId: "card-03009-5-uniq-0041-00", bloomStage: 1 },
      { cardId: "card-04001-4-cmmn-0000-00", bloomStage: 2 },
      { cardId: "card-04007-5-uniq-0047-00", bloomStage: 2 },
    ],
  },
  // Source fixture t1-violations-9-11.json, r-10-5s-0.
  {
    id: "r-10-5s-0",
    droppedCardId: "card-00002-5-uniq-0001-00",
    rosterCards: [
      { cardId: "card-00002-5-uniq-0001-00", bloomStage: 0 },
      { cardId: "card-00011-5-uniq-0011-00", bloomStage: 0 },
      { cardId: "card-00018-5-uniq-0068-00", bloomStage: 0 },
      { cardId: "card-00021-5-uniq-0017-00", bloomStage: 1 },
      { cardId: "card-00022-5-uniq-0018-00", bloomStage: 2 },
      { cardId: "card-00030-5-uniq-0024-00", bloomStage: 3 },
      { cardId: "card-03004-4-cmmn-0000-00", bloomStage: 1 },
      { cardId: "card-03009-5-uniq-0041-00", bloomStage: 0 },
      { cardId: "card-06002-5-uniq-0058-00", bloomStage: 3 },
      { cardId: "card-06002-5-uniq-0066-00", bloomStage: 3 },
    ],
  },
  // Source fixture t1-violations-9-11.json, r-11-rand-0.
  {
    id: "r-11-rand-0",
    droppedCardId: "card-06002-5-uniq-0058-00",
    rosterCards: [
      { cardId: "card-00002-5-uniq-0001-00", bloomStage: 1 },
      { cardId: "card-00004-4-cmmn-0000-00", bloomStage: 0 },
      { cardId: "card-00010-5-uniq-0010-00", bloomStage: 3 },
      { cardId: "card-00015-5-uniq-0003-00", bloomStage: 3 },
      { cardId: "card-00023-4-cmmn-0000-00", bloomStage: 2 },
      { cardId: "card-00035-4-cmmn-0000-00", bloomStage: 4 },
      { cardId: "card-03004-5-uniq-0036-00", bloomStage: 3 },
      { cardId: "card-04001-4-cmmn-0000-00", bloomStage: 0 },
      { cardId: "card-04016-5-uniq-0055-00", bloomStage: 0 },
      { cardId: "card-04017-5-uniq-0056-00", bloomStage: 0 },
      { cardId: "card-06002-5-uniq-0058-00", bloomStage: 2 },
    ],
  },
  // Source fixture t1-violations-12-14.json, formerly residual r-13-5s-7.
  {
    id: "r-13-5s-7",
    droppedCardId: "card-03007-5-uniq-0039-00",
    rosterCards: [
      { cardId: "card-00015-5-uniq-0003-00", bloomStage: 0 },
      { cardId: "card-00017-5-uniq-0015-00", bloomStage: 1 },
      { cardId: "card-00018-5-uniq-0068-00", bloomStage: 2 },
      { cardId: "card-00022-5-uniq-0063-00", bloomStage: 1 },
      { cardId: "card-00023-5-uniq-0019-00", bloomStage: 0 },
      { cardId: "card-00037-5-uniq-0030-00", bloomStage: 2 },
      { cardId: "card-03001-4-cmmn-0000-00", bloomStage: 2 },
      { cardId: "card-03002-4-cmmn-0000-00", bloomStage: 0 },
      { cardId: "card-03003-5-uniq-0035-00", bloomStage: 1 },
      { cardId: "card-03006-5-uniq-0038-00", bloomStage: 1 },
      { cardId: "card-03007-5-uniq-0039-00", bloomStage: 3 },
      { cardId: "card-04003-5-uniq-0044-00", bloomStage: 3 },
      { cardId: "card-06002-5-uniq-0058-00", bloomStage: 1 },
    ],
  },
  // Source fixture t1-violations-12-14.json, formerly residual r-14-rand-17.
  {
    id: "r-14-rand-17",
    droppedCardId: "card-04003-5-uniq-0044-00",
    rosterCards: [
      { cardId: "card-00005-5-uniq-0006-00", bloomStage: 2 },
      { cardId: "card-00006-5-uniq-0007-00", bloomStage: 1 },
      { cardId: "card-00021-5-uniq-0064-00", bloomStage: 1 },
      { cardId: "card-00027-5-uniq-0022-00", bloomStage: 1 },
      { cardId: "card-00037-4-cmmn-0000-00", bloomStage: 5 },
      { cardId: "card-00039-4-cmmn-0000-00", bloomStage: 2 },
      { cardId: "card-03001-4-cmmn-0000-00", bloomStage: 5 },
      { cardId: "card-03001-5-uniq-0033-00", bloomStage: 0 },
      { cardId: "card-04003-5-uniq-0044-00", bloomStage: 2 },
      { cardId: "card-04010-5-uniq-0049-00", bloomStage: 2 },
      { cardId: "card-04014-5-uniq-0053-00", bloomStage: 2 },
      { cardId: "card-04015-4-cmmn-0000-00", bloomStage: 3 },
      { cardId: "card-06002-5-uniq-0066-00", bloomStage: 0 },
      { cardId: "card-06004-4-cmmn-0000-00", bloomStage: 1 },
    ],
  },
];

type InversionFixture = {
  id: string;
  role: "member" | "leader" | "member-and-leader";
  oshiTalentId: string;
  rosterCards: readonly FixtureCard[];
};

// Source fixture t2-inversions.json, oshi-67-five-star-heavy-21, both roles.
const OSHI_67_ROSTER: readonly FixtureCard[] = [
  { cardId: "card-00005-5-uniq-0006-00", bloomStage: 2 },
  { cardId: "card-00012-5-uniq-0012-00", bloomStage: 3 },
  { cardId: "card-00014-5-uniq-0013-00", bloomStage: 2 },
  { cardId: "card-00015-5-uniq-0003-00", bloomStage: 3 },
  { cardId: "card-00015-5-uniq-0067-00", bloomStage: 0 },
  { cardId: "card-00021-5-uniq-0017-00", bloomStage: 2 },
  { cardId: "card-00021-5-uniq-0064-00", bloomStage: 0 },
  { cardId: "card-00026-4-cmmn-0000-00", bloomStage: 0 },
  { cardId: "card-00026-5-uniq-0021-00", bloomStage: 3 },
  { cardId: "card-00027-5-uniq-0022-00", bloomStage: 3 },
  { cardId: "card-00037-5-uniq-0030-00", bloomStage: 0 },
  { cardId: "card-03001-5-uniq-0033-00", bloomStage: 3 },
  { cardId: "card-03003-5-uniq-0035-00", bloomStage: 3 },
  { cardId: "card-03006-5-uniq-0038-00", bloomStage: 1 },
  { cardId: "card-03007-5-uniq-0039-00", bloomStage: 2 },
  { cardId: "card-03009-5-uniq-0041-00", bloomStage: 3 },
  { cardId: "card-04001-4-cmmn-0000-00", bloomStage: 2 },
  { cardId: "card-04010-5-uniq-0049-00", bloomStage: 3 },
  { cardId: "card-04016-5-uniq-0055-00", bloomStage: 3 },
  { cardId: "card-06003-5-uniq-0059-00", bloomStage: 2 },
  { cardId: "card-06004-5-uniq-0060-00", bloomStage: 0 },
];

const INVERSION_FIXTURES: readonly InversionFixture[] = [
  { id: "oshi-67-five-star-heavy-21/leader", role: "leader", oshiTalentId: "chr-00037", rosterCards: OSHI_67_ROSTER },
  { id: "oshi-67-five-star-heavy-21/member-and-leader", role: "member-and-leader", oshiTalentId: "chr-00037", rosterCards: OSHI_67_ROSTER },
  // Source fixture t2-inversions.json, oshi-159-five-star-heavy-18.
  {
    id: "oshi-159-five-star-heavy-18/member",
    role: "member",
    oshiTalentId: "chr-03003",
    rosterCards: [
      { cardId: "card-00007-5-uniq-0008-00", bloomStage: 1 },
      { cardId: "card-00015-5-uniq-0003-00", bloomStage: 1 },
      { cardId: "card-00015-5-uniq-0067-00", bloomStage: 1 },
      { cardId: "card-00026-5-uniq-0021-00", bloomStage: 0 },
      { cardId: "card-00030-5-uniq-0024-00", bloomStage: 1 },
      { cardId: "card-00032-5-uniq-0026-00", bloomStage: 3 },
      { cardId: "card-00034-5-uniq-0027-00", bloomStage: 0 },
      { cardId: "card-00035-5-uniq-0028-00", bloomStage: 3 },
      { cardId: "card-00039-4-cmmn-0000-00", bloomStage: 3 },
      { cardId: "card-03002-5-uniq-0034-00", bloomStage: 2 },
      { cardId: "card-03003-5-uniq-0035-00", bloomStage: 2 },
      { cardId: "card-03008-5-uniq-0040-00", bloomStage: 2 },
      { cardId: "card-03009-5-uniq-0041-00", bloomStage: 3 },
      { cardId: "card-04002-5-uniq-0043-00", bloomStage: 1 },
      { cardId: "card-04010-5-uniq-0049-00", bloomStage: 3 },
      { cardId: "card-04014-5-uniq-0053-00", bloomStage: 3 },
      { cardId: "card-04015-5-uniq-0054-00", bloomStage: 2 },
      { cardId: "card-06002-5-uniq-0058-00", bloomStage: 3 },
    ],
  },
];

type BudgetFixture = {
  id: string;
  shippedCentral: number;
  rosterCards: readonly FixtureCard[];
};

const BUDGET_FIXTURES: readonly BudgetFixture[] = [
  // Source fixture t10-nonmonotonic-budget.json, bc-25-0, shippedCentral 339978.68878.
  {
    id: "bc-25-0",
    shippedCentral: 339978.68878,
    rosterCards: [
      { cardId: "card-00001-4-cmmn-0000-00", bloomStage: 0 },
      { cardId: "card-00004-5-uniq-0005-00", bloomStage: 0 },
      { cardId: "card-00005-4-cmmn-0000-00", bloomStage: 2 },
      { cardId: "card-00010-4-cmmn-0000-00", bloomStage: 5 },
      { cardId: "card-00012-4-cmmn-0000-00", bloomStage: 1 },
      { cardId: "card-00015-5-uniq-0067-00", bloomStage: 2 },
      { cardId: "card-00016-4-cmmn-0000-00", bloomStage: 2 },
      { cardId: "card-00017-5-uniq-0015-00", bloomStage: 2 },
      { cardId: "card-00018-5-uniq-0004-00", bloomStage: 1 },
      { cardId: "card-00021-4-cmmn-0000-00", bloomStage: 4 },
      { cardId: "card-00022-4-cmmn-0000-00", bloomStage: 3 },
      { cardId: "card-00027-5-uniq-0022-00", bloomStage: 1 },
      { cardId: "card-00028-4-cmmn-0000-00", bloomStage: 5 },
      { cardId: "card-00032-5-uniq-0026-00", bloomStage: 1 },
      { cardId: "card-00039-4-cmmn-0000-00", bloomStage: 3 },
      { cardId: "card-00039-5-uniq-0032-00", bloomStage: 2 },
      { cardId: "card-03002-4-cmmn-0000-00", bloomStage: 1 },
      { cardId: "card-03002-5-uniq-0034-00", bloomStage: 2 },
      { cardId: "card-03009-4-cmmn-0000-00", bloomStage: 1 },
      { cardId: "card-03009-5-uniq-0041-00", bloomStage: 2 },
      { cardId: "card-04001-4-cmmn-0000-00", bloomStage: 3 },
      { cardId: "card-06002-4-cmmn-0000-00", bloomStage: 0 },
      { cardId: "card-06002-5-uniq-0058-00", bloomStage: 0 },
      { cardId: "card-06003-5-uniq-0059-00", bloomStage: 1 },
      { cardId: "card-06004-4-cmmn-0000-00", bloomStage: 5 },
    ],
  },
  // Source fixture t10-nonmonotonic-budget.json, bc-25-1, shippedCentral 362530.031705.
  {
    id: "bc-25-1",
    shippedCentral: 362530.031705,
    rosterCards: [
      { cardId: "card-00002-5-uniq-0001-00", bloomStage: 1 },
      { cardId: "card-00004-5-uniq-0005-00", bloomStage: 3 },
      { cardId: "card-00006-5-uniq-0007-00", bloomStage: 2 },
      { cardId: "card-00010-5-uniq-0010-00", bloomStage: 2 },
      { cardId: "card-00011-4-cmmn-0000-00", bloomStage: 5 },
      { cardId: "card-00012-5-uniq-0012-00", bloomStage: 1 },
      { cardId: "card-00013-5-uniq-0002-00", bloomStage: 1 },
      { cardId: "card-00014-4-cmmn-0000-00", bloomStage: 3 },
      { cardId: "card-00019-4-cmmn-0000-00", bloomStage: 5 },
      { cardId: "card-00023-5-uniq-0019-00", bloomStage: 1 },
      { cardId: "card-00026-5-uniq-0065-00", bloomStage: 0 },
      { cardId: "card-00031-5-uniq-0025-00", bloomStage: 2 },
      { cardId: "card-00032-5-uniq-0026-00", bloomStage: 2 },
      { cardId: "card-00035-5-uniq-0028-00", bloomStage: 0 },
      { cardId: "card-00037-5-uniq-0030-00", bloomStage: 0 },
      { cardId: "card-03004-5-uniq-0036-00", bloomStage: 3 },
      { cardId: "card-03005-5-uniq-0037-00", bloomStage: 1 },
      { cardId: "card-03007-5-uniq-0039-00", bloomStage: 1 },
      { cardId: "card-04001-5-uniq-0042-00", bloomStage: 0 },
      { cardId: "card-04003-5-uniq-0044-00", bloomStage: 0 },
      { cardId: "card-04012-5-uniq-0051-00", bloomStage: 0 },
      { cardId: "card-04014-5-uniq-0053-00", bloomStage: 0 },
      { cardId: "card-04015-5-uniq-0054-00", bloomStage: 0 },
      { cardId: "card-06002-5-uniq-0058-00", bloomStage: 1 },
      { cardId: "card-06003-5-uniq-0059-00", bloomStage: 0 },
    ],
  },
];

describe("calculator quality consistency", () => {
  it("keeps reduced-roster thorough results below their full-roster results", () => {
    for (const fixture of DROP_ONE_FIXTURES) {
      const full = calculateOwnedRosterTeam(request(fixture.rosterCards));
      const reduced = calculateOwnedRosterTeam(request(
        fixture.rosterCards.filter((card) => card.cardId !== fixture.droppedCardId),
      ));
      expect(reduced.score.relativeUtility.central, fixture.id).toBeLessThanOrEqual(
        full.score.relativeUtility.central,
      );
    }
  }, 120_000);

  it("keeps Oshi-constrained thorough results below unconstrained results", () => {
    for (const fixture of INVERSION_FIXTURES) {
      const unconstrained = calculateOwnedRosterTeam(request(fixture.rosterCards));
      const constrained = calculateOwnedRosterTeam(request(fixture.rosterCards, "thorough", {
        oshi: { talentId: fixture.oshiTalentId, role: fixture.role },
      }));
      expect(constrained.score.relativeUtility.central, fixture.id).toBeLessThanOrEqual(
        unconstrained.score.relativeUtility.central,
      );
    }
  }, 120_000);

  it("does not regress the recorded shipped budget baselines", () => {
    for (const fixture of BUDGET_FIXTURES) {
      const result = calculateOwnedRosterTeam(request(fixture.rosterCards));
      expect(result.score.relativeUtility.central, fixture.id).toBeGreaterThanOrEqual(fixture.shippedCentral);
    }
  }, 120_000);

  // The expanded roster below has 11 distinct talents: 462 Member sets x 11
  // Leaders x 30 charts = 152,460 chart evaluations, far above thorough's
  // 34,560 exact budget, so the seeded run exercises the BOUNDED path — the
  // inequality cannot follow from exhaustive monotonicity alone.
  const EXPANDED_BOUNDED_ROSTER: readonly FixtureCard[] = [
    ...DROP_ONE_FIXTURES[0]!.rosterCards,
    { cardId: "card-00007-5-uniq-0008-00", bloomStage: 1 },
    { cardId: "card-03009-5-uniq-0041-00", bloomStage: 0 },
    { cardId: "card-06002-5-uniq-0058-00", bloomStage: 1 },
  ];

  it("adopts a legal seed on the bounded path and keeps it as a lower bound", () => {
    const base = DROP_ONE_FIXTURES[0]!.rosterCards;
    const first = calculateOwnedRosterTeam(request(base));
    const seeded = calculateOwnedRosterTeam(request(EXPANDED_BOUNDED_ROSTER, "thorough", {
      seedCandidates: [{
        leaderOutfitCardId: first.leader.cardId,
        memberCardIds: first.members.map((member) => member.cardId),
      }],
    }));
    expect(seeded.search.resultClaim).toBe("bounded-search");
    expect(seeded.search.seedCandidates?.adopted).toBe(1);
    const echoed = seeded.search.seedCandidates?.evaluations[0];
    expect(echoed?.leaderOutfitCardId).toBe(first.leader.cardId);
    expect([...(echoed?.memberCardIds ?? [])].sort()).toEqual(
      first.members.map((member) => member.cardId).sort(),
    );
    expect(seeded.score.relativeUtility.central).toBeGreaterThanOrEqual(
      seeded.search.seedCandidates!.maxAdoptedCentralUtility!,
    );
    expect(seeded.score.relativeUtility.central).toBeGreaterThanOrEqual(first.score.relativeUtility.central);
  }, 120_000);

  it("is deep-equal deterministic for both effort tiers", () => {
    const roster = DROP_ONE_FIXTURES[0]!.rosterCards;
    for (const searchEffort of ["standard", "thorough"] as const) {
      const first = calculateOwnedRosterTeam(request(roster, searchEffort));
      const repeated = calculateOwnedRosterTeam(request(roster, searchEffort));
      expect(repeated).toEqual(first);
    }
  }, 120_000);

  it("keeps corpus evaluation counts within measured tier ceilings", () => {
    // Observed on the 8-card fixture: standard (bounded) 1,688 corpus
    // evaluations from the native/factory/ascent lanes; 2,000 leaves room for
    // bounded-cache drift.
    const standard = calculateOwnedRosterTeam(request(DROP_ONE_FIXTURES[0]!.rosterCards, "standard"));
    expect(standard.search.resultClaim).toBe("bounded-search");
    expect(standard.search.corpusUtilityEvaluations).toBeLessThanOrEqual(2_000);

    // The thorough ceiling must guard the BOUNDED thorough machinery
    // (factory, fan-out, leader-anchored multi-start), so it pins the 11-talent
    // bounded roster: observed 8,318 corpus evaluations; 9,500 leaves a fixed
    // margin without masking an accidental blow-up.
    const thorough = calculateOwnedRosterTeam(request(EXPANDED_BOUNDED_ROSTER, "thorough"));
    expect(thorough.search.resultClaim).toBe("bounded-search");
    expect(thorough.search.corpusUtilityEvaluations).toBeLessThanOrEqual(9_500);
  }, 120_000);
});
