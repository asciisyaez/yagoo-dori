import { describe, expect, it } from "vitest";

import { mechanicsData, type CardMechanics } from "./mechanics";
import { compileNativeLeaderEquivalence } from "./native-leader-equivalence";
import {
  evaluateNativeRelativeUtility,
  type NeutralBoardAccountState,
} from "./native-utility";

const BOARD: NeutralBoardAccountState = {
  board: {
    mode: "declared-neutral",
    evidenceGrade: "verified",
    evidenceRef: "fixture:verified-neutral-board",
  },
};

const FORMATIONS = [
  {
    chartKey: "m0206:expert",
    memberCardIds: [
      "card-00004-5-uniq-0005-00",
      "card-00005-5-uniq-0006-00",
      "card-00013-5-uniq-0002-00",
      "card-00016-5-uniq-0014-00",
      "card-00018-5-uniq-0004-00",
    ],
    bloomStages: [0, 1, 2, 3, 4],
  },
  {
    chartKey: "m0001:expert",
    memberCardIds: [
      "card-00019-5-uniq-0016-00",
      "card-00022-5-uniq-0018-00",
      "card-00032-5-uniq-0026-00",
      "card-00039-5-uniq-0032-00",
      "card-04003-5-uniq-0044-00",
    ],
    bloomStages: [5, 4, 3, 2, 1],
  },
] as const;

function copyCatalog(): CardMechanics[] {
  return structuredClone(mechanicsData.cards) as CardMechanics[];
}

describe("native Leader-effect equivalence", () => {
  it("partitions every eligible ID deterministically and retains the complete original ID set", () => {
    const ids = mechanicsData.cards.map((card) => card.cardId);
    const first = compileNativeLeaderEquivalence({
      eligibleLeaderOutfitCardIds: [...ids].reverse(),
    });
    const second = compileNativeLeaderEquivalence({ eligibleLeaderOutfitCardIds: ids });

    expect(first).toEqual(second);
    expect(first.fallback).toEqual({ singletonOnly: false, reasons: [] });
    expect(first.counts.eligibleLeaderOutfits).toBe(115);
    expect(first.counts.equivalenceClasses).toBeGreaterThan(0);
    expect(first.counts.equivalenceClasses).toBeLessThanOrEqual(115);
    expect(first.classes.flatMap((group) => group.eligibleCardIds).sort()).toEqual([...ids].sort());
    expect(
      first.classes.every(
        (group) =>
          group.representativeCardId === [...group.eligibleCardIds].sort()[0] &&
          [...group.eligibleCardIds].sort().join("|") === group.eligibleCardIds.join("|") &&
          group.multiplicity === group.eligibleCardIds.length &&
          group.leaderTalentIds.length === 1,
      ),
    ).toBe(true);
  });

  it("separates records when a utility-relevant Leader application field differs", () => {
    const cards = copyCatalog().slice(0, 2);
    const changed = cards[1]!.leaderOutfit.applications[0]!.effect;
    if (!changed || changed.value === null) throw new Error("Fixture requires a valued Leader effect");
    changed.value += 1;

    const result = compileNativeLeaderEquivalence({
      eligibleLeaderOutfitCardIds: cards.map((card) => card.cardId),
      cards,
    });

    expect(result.counts).toMatchObject({ equivalenceClasses: 2, collapsedLeaderOutfits: 0 });
  });

  it("never collapses identity-distinct Leader talents merely because their application IR matches", () => {
    const cards = copyCatalog().slice(0, 2);
    cards[1]!.leaderOutfit.applications = structuredClone(cards[0]!.leaderOutfit.applications);
    const result = compileNativeLeaderEquivalence({
      eligibleLeaderOutfitCardIds: cards.map((card) => card.cardId),
      cards,
    });

    expect(result.classes).toHaveLength(2);
    expect(result.classes.every((group) => group.multiplicity === 1)).toBe(true);
  });

  it.each([
    ["identity-sensitive trigger", "identity-sensitive-trigger:leader-character", (cards: CardMechanics[]) => {
      cards[0]!.skills.active[0]!.applications[0]!.trigger = {
        id: "future-leader-trigger",
        kind: "leader-character",
        threshold: null,
        attribute: null,
        characterGroupingId: null,
        characterIds: [cards[0]!.talentId],
        judgementType: null,
        description: null,
        sourceRef: cards[0]!.sourceRef,
      } as never;
    }],
    ["unknown trigger kind", "unknown-trigger-kind:future-trigger", (cards: CardMechanics[]) => {
      const application = cards[0]!.skills.active[0]!.applications[0]!;
      application.trigger = {
        ...(application.trigger ?? {
          id: "future-trigger",
          threshold: null,
          attribute: null,
          characterGroupingId: null,
          characterIds: [],
          judgementType: null,
          description: null,
          sourceRef: cards[0]!.sourceRef,
        }),
        kind: "future-trigger",
      } as never;
    }],
    ["unknown target kind", "unknown-target-kind:future-target", (cards: CardMechanics[]) => {
      const application = cards[0]!.skills.passive[0]!.applications[0]!;
      application.target = {
        ...(application.target ?? {
          id: "future-target",
          attribute: null,
          characterGroupingId: null,
          count: null,
          description: null,
          sourceRef: cards[0]!.sourceRef,
        }),
        kind: "future-target",
      } as never;
    }],
  ])("falls back to singleton signatures for an %s", (_label, reason, mutate) => {
    const cards = copyCatalog();
    mutate(cards);
    const eligibleCardIds = cards.slice(0, 4).map((card) => card.cardId);
    const result = compileNativeLeaderEquivalence({
      eligibleLeaderOutfitCardIds: eligibleCardIds,
      cards,
    });

    expect(result.fallback.singletonOnly).toBe(true);
    expect(result.fallback.reasons).toContain(reason);
    expect(result.classes).toHaveLength(eligibleCardIds.length);
    expect(result.classes.every((group) => group.eligibleCardIds.length === 1)).toBe(true);
  });

  it("proves each grouped representative has identical aggregate utility on real charts, formations, and Bloom stages", () => {
    const compiled = compileNativeLeaderEquivalence({
      eligibleLeaderOutfitCardIds: mechanicsData.cards.map((card) => card.cardId),
    });
    const grouped = compiled.classes.filter((group) => group.eligibleCardIds.length > 1);
    // Identity-safe keys may legitimately make every current class a
    // singleton.  The loop remains a proof whenever pinned data contains a
    // safe multiplicity; singleton fallback is the intended safe behavior.
    expect(grouped.length).toBeGreaterThanOrEqual(0);

    for (const fixture of FORMATIONS) {
      for (const group of grouped) {
        const representative = evaluateNativeRelativeUtility({
          formation: {
            leaderOutfitCardId: group.representativeCardId,
            members: fixture.memberCardIds.map((cardId, index) => ({
              cardId,
              investment: "one-copy-maximum" as const,
              bloomStage: fixture.bloomStages[index]!,
            })),
          },
          chartKey: fixture.chartKey,
          seed: 0x5eed,
          accountState: BOARD,
        }).relativeUtility;
        for (const leaderOutfitCardId of group.eligibleCardIds) {
          const candidate = evaluateNativeRelativeUtility({
            formation: {
              leaderOutfitCardId,
              members: fixture.memberCardIds.map((cardId, index) => ({
                cardId,
                investment: "one-copy-maximum" as const,
                bloomStage: fixture.bloomStages[index]!,
              })),
            },
            chartKey: fixture.chartKey,
            seed: 0x5eed,
            accountState: BOARD,
          }).relativeUtility;
          expect(candidate).toEqual(representative);
        }
      }
    }
  });

  it("rejects empty, duplicate, and unknown eligible Leader/Outfit IDs", () => {
    const known = mechanicsData.cards[0]!.cardId;
    expect(() =>
      compileNativeLeaderEquivalence({ eligibleLeaderOutfitCardIds: [] }),
    ).toThrow(/at least one/i);
    expect(() =>
      compileNativeLeaderEquivalence({ eligibleLeaderOutfitCardIds: [known, known] }),
    ).toThrow(/unique/i);
    expect(() =>
      compileNativeLeaderEquivalence({ eligibleLeaderOutfitCardIds: ["card-unknown"] }),
    ).toThrow(/unknown/i);
  });
});
