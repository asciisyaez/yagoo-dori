import { describe, expect, it } from "vitest";

import { publicData } from "./public-data";
import {
  assertScoringEligibleCard,
  calculateCardParameters,
  mechanicsCardById,
  mechanicsData,
  MechanicsDataSchema,
} from "./mechanics";

const GOLDEN_CARD_IDS = [
  "card-00013-5-uniq-0002-00", // AZKi
  "card-00018-5-uniq-0004-00", // Hoshimachi Suisei
  "card-00005-5-uniq-0006-00", // Akai Haato
  "card-00004-5-uniq-0005-00", // Aki Rosenthal
  "card-00039-5-uniq-0032-00", // Kazama Iroha
  "card-00016-5-uniq-0014-00", // Nekomata Okayu
  "card-00001-4-cmmn-0000-00", // Tokino Sora four-star
  "card-00012-5-uniq-0062-00", // Oozora Subaru seasonal five-star
] as const;

describe("evidence-linked mechanics catalog", () => {
  it("is pinned to the same complete roster snapshot", () => {
    expect(mechanicsData.sourceSnapshot.commit).toBe(publicData.sourceSnapshots.english.commit);
    expect(mechanicsData.sourceSnapshot.masterVersion).toBe(
      publicData.sourceSnapshots.english.masterVersion,
    );
    expect(mechanicsData.cards).toHaveLength(124);
    expect(new Set(mechanicsData.cards.map((card) => card.cardId)).size).toBe(124);
    expect(mechanicsData.coverage).toMatchObject({
      cards: 124,
      mappedCards: 124,
      unresolvedReferences: [],
    });
  });

  it("keeps mechanics coverage cardinality open to reviewed roster additions", () => {
    const expanded = structuredClone(mechanicsData);
    const future = structuredClone(expanded.cards[0]!);
    future.cardId = "card-future-5-uniq-9999-00";
    future.talentId = "future-talent";
    future.leaderOutfit.talentId = future.talentId;
    future.leaderOutfit.costumeId = "costume-future-9999";
    expanded.cards.push(future);
    expanded.coverage.cards += 1;
    expanded.coverage.mappedCards += 1;

    expect(MechanicsDataSchema.safeParse(expanded).success).toBe(true);
    expanded.coverage.cards -= 1;
    expect(MechanicsDataSchema.safeParse(expanded).success).toBe(false);
  });

  it("normalizes every current effect, target, trigger, progression, Connect, and Board catalog", () => {
    expect(mechanicsData.catalogs.activeEffects).toHaveLength(52);
    expect(mechanicsData.catalogs.passiveEffects).toHaveLength(182);
    expect(mechanicsData.catalogs.targets).toHaveLength(83);
    expect(mechanicsData.catalogs.triggers).toHaveLength(215);
    expect(mechanicsData.catalogs.potentialEffects).toHaveLength(15);
    expect(mechanicsData.catalogs.connectEffects).toHaveLength(40);
    expect(mechanicsData.catalogs.connectExtents).toHaveLength(17);
    expect(mechanicsData.catalogs.boardEffects).toHaveLength(121);
    expect(mechanicsData.catalogs.boardPassiveTriggers).toHaveLength(81);
    expect(mechanicsData.catalogs.boardTargets).toHaveLength(79);
    expect(mechanicsData.catalogs.boardValueLimits).toHaveLength(2);
    expect(mechanicsData.catalogs.boardNodes).toHaveLength(324);
    expect(mechanicsData.catalogs.boardNodePositions).toHaveLength(612);
    expect(mechanicsData.catalogs.boardPointPools).toHaveLength(54);
    expect(mechanicsData.catalogs.talentBoardProfiles).toHaveLength(54);
    expect(mechanicsData.catalogs.holomemRankPoints).toHaveLength(50);
    expect(mechanicsData.catalogs.boardNodeConditions).toHaveLength(5);

    expect(new Set(mechanicsData.catalogs.activeEffects.map((effect) => effect.kind))).toEqual(
      new Set([
        "score-up",
        "score-support",
        "activation-rate-up",
        "judgement-enhance",
        "life-recovery",
      ]),
    );
    expect(new Set(mechanicsData.catalogs.passiveEffects.map((effect) => effect.kind))).toEqual(
      new Set([
        "performance-up",
        "technique-up",
        "sense-up",
        "all-parameters-up",
        "active-skill-effect-up",
      ]),
    );
  });

  it("pins Board costs, player-level gates, and per-talent rank income", () => {
    const nodes = mechanicsData.catalogs.boardNodes;
    const freeNodes = nodes.filter((node) => node.pointCost === 0);
    expect(freeNodes.map((node) => node.id)).toEqual(["S-001:1"]);

    const connectionNodes = ["S-001", "S-002", "S-003", "S-004"].map(
      (groupId) => nodes.find((node) => node.groupId === groupId && node.number === 1)!,
    );
    expect(connectionNodes.map((node) => node.pointCost)).toEqual([0, 1, 1, 1]);
    const conditionById = new Map(
      mechanicsData.catalogs.boardNodeConditions.map((condition) => [condition.id, condition.threshold]),
    );
    expect(connectionNodes.map((node) =>
      node.viewConditionGroupId ? conditionById.get(node.viewConditionGroupId) : null,
    )).toEqual([null, 10, 15, 20]);

    expect(
      nodes.reduce<Record<number, number>>((histogram, node) => {
        histogram[node.pointCost] = (histogram[node.pointCost] ?? 0) + 1;
        return histogram;
      }, {}),
    ).toEqual({ 0: 1, 1: 25, 2: 98, 3: 104, 4: 12, 5: 80, 6: 4 });
    expect(mechanicsData.catalogs.holomemRankPoints.reduce((sum, row) => sum + row.points, 0)).toBe(361);
    expect(mechanicsData.methodologyVersion).toBe("yd-mechanics-catalog-1.2.0");
  });

  it("rejects duplicate or extra Holomem Rank point rows", () => {
    const broken = structuredClone(mechanicsData);
    broken.catalogs.holomemRankPoints.push(
      structuredClone(broken.catalogs.holomemRankPoints[49]!),
    );

    expect(MechanicsDataSchema.safeParse(broken).success).toBe(false);
  });

  it("compiles the eight mechanics goldens without prose parsing", () => {
    for (const id of GOLDEN_CARD_IDS) {
      const card = mechanicsCardById.get(id);
      expect(card, id).toBeDefined();
      expect(card?.coverage.allReferencesMapped, id).toBe(true);
    }

    const azki = mechanicsCardById.get(GOLDEN_CARD_IDS[0])!;
    expect(azki.progression).toMatchObject({
      maxLevel: 80,
      oneCopy: {
        level: 80,
        activeSkillLevel: 1,
        passiveSkillLevel: 1,
        specialSkillLevel: 1,
        connectEffectLevel: 1,
        allParameterPermilUp: 0,
      },
      maxPotential: {
        level: 80,
        activeSkillLevel: 2,
        passiveSkillLevel: 2,
        specialSkillLevel: 2,
        connectEffectLevel: 2,
        allParameterPermilUp: 100,
      },
    });
    expect(azki.progression.potential.map((stage) => stage.kind)).toEqual([
      "active-skill-level-up",
      "all-parameters-up",
      "special-skill-level-up",
      "passive-skill-level-up",
      "connect-effect-level-up",
    ]);

    const active = azki.skills.active.find((level) => level.level === 2)!;
    expect(active).toMatchObject({
      cooldownMilliseconds: 20_000,
      durationMilliseconds: 7_000,
      activationProbabilityPermil: 550,
    });
    expect(active.applications).toEqual([
      expect.objectContaining({
        channel: "primary",
        combination: "base",
        effect: expect.objectContaining({ kind: "score-up", value: 600 }),
      }),
      expect.objectContaining({
        channel: "additional",
        combination: "conditional-override",
        effect: expect.objectContaining({ kind: "score-up", value: 1_200 }),
        trigger: expect.objectContaining({ kind: "life-at-least", threshold: 600 }),
      }),
    ]);

    const passive = azki.skills.passive.find((level) => level.level === 2)!;
    expect(passive.applications[0]).toMatchObject({
      effect: { kind: "sense-up", value: 430 },
      target: { kind: "character-group", characterGroupingId: "grp-gen_0", count: 2 },
    });

    const special = azki.skills.special.find((level) => level.level === 2)!;
    expect(special.applications.map((application) => application.effect)).toEqual([
      expect.objectContaining({ kind: "score-support", value: 1_450 }),
      expect.objectContaining({ kind: "activation-rate-up", value: 500 }),
    ]);
    expect(special.applications.map((application) => application.combination)).toEqual([
      "base",
      "additive",
    ]);
    expect(azki.leaderOutfit.applications[0]).toMatchObject({
      effect: { kind: "sense-up", value: 1_200 },
      target: { kind: "all" },
    });
  });

  it("reproduces verified parameters from level base, distribution, and potential", () => {
    const sora = mechanicsCardById.get(GOLDEN_CARD_IDS[6])!;
    expect(sora.parameterDistributionPermil).toEqual({
      performance: 253,
      technique: 297,
      sense: 450,
    });
    expect(calculateCardParameters(sora, 70)).toEqual({
      performance: 5_046,
      technique: 5_924,
      sense: 8_975,
    });
    expect(
      calculateCardParameters(
        sora,
        sora.progression.maxPotential.level,
        sora.progression.maxPotential.allParameterPermilUp,
      ),
    ).toEqual({
      performance: 5_551,
      technique: 6_516,
      sense: 9_872,
    });
  });

  it("models conditional Active values as replacements, never additive bonuses", () => {
    const activeAdditional = mechanicsData.cards.flatMap((card) =>
      card.skills.active.flatMap((level) =>
        level.applications.filter((application) => application.channel === "additional"),
      ),
    );
    expect(activeAdditional.length).toBeGreaterThan(0);
    expect(
      activeAdditional.every(
        (application) =>
          application.combination === "conditional-override" && application.trigger !== null,
      ),
    ).toBe(true);

    const coexistingAdditional = mechanicsData.cards.flatMap((card) => [
      ...card.skills.special.flatMap((level) =>
        level.applications.filter((application) => application.channel === "additional"),
      ),
      ...card.leaderOutfit.applications.filter(
        (application) => application.channel === "additional",
      ),
    ]);
    expect(
      coexistingAdditional.every((application) =>
        ["additive", "conditional-additive"].includes(application.combination),
      ),
    ).toBe(true);

    const leaderCoeffects = mechanicsData.cards.flatMap((card) =>
      card.leaderOutfit.applications.filter(
        (application) => application.channel === "additional",
      ).map((additional) => ({
        additional,
        primary: card.leaderOutfit.applications.find(
          (application) => application.channel === "primary",
        ),
      })),
    );
    expect(leaderCoeffects).toHaveLength(12);
    expect(
      leaderCoeffects.every(
        ({ additional, primary }) =>
          additional.combination === "conditional-additive" &&
          additional.triggerGroupId === primary?.triggerGroupId,
      ),
    ).toBe(true);
  });

  it("preserves source links and rejects incomplete mechanics as scoring inputs", () => {
    expect(mechanicsData.evidenceSources.every((source) => source.url.startsWith("https://"))).toBe(true);
    expect(mechanicsData.catalogs.activeEffects.every((effect) => effect.sourceRef)).toBe(true);
    expect(mechanicsData.catalogs.passiveEffects.every((effect) => effect.sourceRef)).toBe(true);
    expect(mechanicsData.catalogs.targets.every((target) => target.sourceRef)).toBe(true);
    expect(mechanicsData.catalogs.triggers.every((trigger) => trigger.sourceRef)).toBe(true);
    expect(mechanicsData.cards.every((card) => card.parameterSourceRefs.length === 3)).toBe(true);
    expect(mechanicsData.runtimeRules.find((rule) => rule.id === "passive-target-selection-order")).toMatchObject({
      status: "unresolved",
      blocksScoring: true,
    });

    const azki = mechanicsCardById.get(GOLDEN_CARD_IDS[0])!;
    expect(() => assertScoringEligibleCard(azki)).toThrow(/runtime-score-equation/i);
  });

  it("schema validation fails when a scored card contains an unresolved reference", () => {
    const broken = structuredClone(mechanicsData);
    broken.cards[0]!.coverage.allReferencesMapped = false;
    broken.cards[0]!.coverage.unresolvedReferenceIds = ["missing-effect"];
    broken.cards[0]!.scoringEligible = true;

    const result = MechanicsDataSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });
});
