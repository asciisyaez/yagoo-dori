import { describe, expect, it } from "vitest";

import {
  assertBloomStage,
  calculateCardProgression,
  resolveCardInvestmentState,
  type BloomStage,
} from "./formation-evaluator";
import { mechanicsData } from "./mechanics";
import { publicCardById } from "./public-data";

const BLOOM_STAGES = [0, 1, 2, 3, 4, 5] as const satisfies readonly BloomStage[];

describe("exact per-card Bloom progression", () => {
  it("implements every Bloom step and pins B0/B5 to both published investment endpoints", () => {
    expect(mechanicsData.cards.length).toBeGreaterThan(0);

    for (const mechanics of mechanicsData.cards) {
      const publicCard = publicCardById.get(mechanics.cardId);
      expect(publicCard, mechanics.cardId).toBeDefined();

      const states = BLOOM_STAGES.map((stage) =>
        resolveCardInvestmentState(mechanics, "one-copy-maximum", stage),
      );
      expect(states, mechanics.cardId).toEqual([
        {
          level: mechanics.progression.maxLevel,
          activeSkillLevel: 1,
          passiveSkillLevel: 1,
          specialSkillLevel: 1,
          connectEffectLevel: 1,
          allParameterPermilUp: 0,
        },
        {
          level: mechanics.progression.maxLevel,
          activeSkillLevel: 2,
          passiveSkillLevel: 1,
          specialSkillLevel: 1,
          connectEffectLevel: 1,
          allParameterPermilUp: 0,
        },
        {
          level: mechanics.progression.maxLevel,
          activeSkillLevel: 2,
          passiveSkillLevel: 1,
          specialSkillLevel: 1,
          connectEffectLevel: 1,
          allParameterPermilUp: 100,
        },
        {
          level: mechanics.progression.maxLevel,
          activeSkillLevel: 2,
          passiveSkillLevel: 1,
          specialSkillLevel: 2,
          connectEffectLevel: 1,
          allParameterPermilUp: 100,
        },
        {
          level: mechanics.progression.maxLevel,
          activeSkillLevel: 2,
          passiveSkillLevel: 2,
          specialSkillLevel: 2,
          connectEffectLevel: 1,
          allParameterPermilUp: 100,
        },
        {
          level: mechanics.progression.maxLevel,
          activeSkillLevel: 2,
          passiveSkillLevel: 2,
          specialSkillLevel: 2,
          connectEffectLevel: 2,
          allParameterPermilUp: 100,
        },
      ]);
      expect(states[0], `${mechanics.cardId} B0`).toEqual(mechanics.progression.oneCopy);
      expect(states[5], `${mechanics.cardId} B5`).toEqual(mechanics.progression.maxPotential);

      const bloomZero = calculateCardProgression(
        publicCard!,
        mechanics,
        "duplicate-enabled-ceiling",
        0,
      );
      const bloomFive = calculateCardProgression(
        publicCard!,
        mechanics,
        "one-copy-maximum",
        5,
      );
      expect(bloomZero.parameters, `${mechanics.cardId} B0 parameters`).toEqual(
        publicCard!.parameters.oneCopyMaxLevel,
      );
      expect(bloomFive.parameters, `${mechanics.cardId} B5 parameters`).toEqual(
        publicCard!.parameters.maxPotential,
      );
      expect(bloomZero.bloomStage).toBe(0);
      expect(bloomFive.bloomStage).toBe(5);
    }
  });

  it("rejects fractional and out-of-range Bloom stages", () => {
    for (const invalid of [-1, 0.5, 6, Number.NaN]) {
      expect(() => assertBloomStage(invalid)).toThrow(/integer from 0 through 5/i);
    }
  });
});
