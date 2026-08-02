import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  AGGREGATE_UNIFORM_NOTE_TIMING_MODEL_ID,
  AGGREGATE_SPECIAL_COVERAGE_MODEL_ID,
  STANDARD_MANUAL_AP_FULL_LIFE_CONTEXT_ID,
  divideUtilityIntervals,
  evaluateNativeCentralUtility,
  expectedMaximum,
  expectedMaximumFive,
  evaluateNativeRelativeUtility,
  type NativeUtilityInput,
  type UtilityInterval,
} from "./native-utility";

const CARD_IDS = {
  azki: "card-00013-5-uniq-0002-00",
  suisei: "card-00018-5-uniq-0004-00",
  haato: "card-00005-5-uniq-0006-00",
  aki: "card-00004-5-uniq-0005-00",
  iroha: "card-00039-5-uniq-0032-00",
  pekora: "card-00019-5-uniq-0016-00",
} as const;

function member(cardId: string): NativeUtilityInput["formation"]["members"][number] {
  return { cardId, investment: "one-copy-maximum" };
}

const input: NativeUtilityInput = {
  formation: {
    leaderOutfitCardId: CARD_IDS.azki,
    members: [
      member(CARD_IDS.azki),
      member(CARD_IDS.suisei),
      member(CARD_IDS.haato),
      member(CARD_IDS.aki),
      member(CARD_IDS.iroha),
    ],
  },
  chartKey: "m0206:expert",
  seed: 0x5eed,
  accountState: {
    board: {
      mode: "declared-neutral",
      evidenceGrade: "verified",
      evidenceRef: "fixture:verified-neutral-board",
    },
  },
};

function expectInterval(interval: UtilityInterval): void {
  expect(interval.lower).toBeLessThanOrEqual(interval.central);
  expect(interval.central).toBeLessThanOrEqual(interval.upper);
  expect(Number.isFinite(interval.lower)).toBe(true);
  expect(Number.isFinite(interval.central)).toBe(true);
  expect(Number.isFinite(interval.upper)).toBe(true);
}

function objectKeysDeep(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(objectKeysDeep);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, nested]) => [key, ...objectKeysDeep(nested)]);
}

describe("native expected-maximum equality grouping", () => {
  const equalEntries = [
    { value: 10, probability: 0.2 },
    { value: 10, probability: 0.3 },
    { value: 7, probability: 0.4 },
  ] as const;

  function expectedMaximumFiveFor(entries: readonly { value: number; probability: number }[]): number {
    const values = new Float64Array(5);
    const probabilities = new Float64Array(5);
    entries.forEach((entry, index) => {
      values[index] = entry.value;
      probabilities[index] = entry.probability;
    });
    return expectedMaximumFive(
      values,
      probabilities,
      new Uint8Array(5),
    );
  }

  it("groups exactly equal values in both evaluators", () => {
    const expected =
      10 * (1 - (1 - 0.2) * (1 - 0.3)) +
      7 * (1 - 0.2) * (1 - 0.3) * 0.4;

    expect(expectedMaximum(equalEntries)).toBeCloseTo(expected, 12);
    expect(expectedMaximumFiveFor(equalEntries)).toBeCloseTo(expected, 12);
  });

  it("does not collapse nearby unequal values into an arbitrary epsilon tie", () => {
    const nearbyEntries = [
      { value: 10, probability: 0.2 },
      { value: 10 - 0.0000000005, probability: 0.3 },
      { value: 7, probability: 0.4 },
    ] as const;
    const strictExpected =
      10 * 0.2 +
      (10 - 0.0000000005) * (1 - 0.2) * 0.3 +
      7 * (1 - 0.2) * (1 - 0.3) * 0.4;
    const epsilonCollapsed =
      10 * (1 - (1 - 0.2) * (1 - 0.3)) +
      7 * (1 - 0.2) * (1 - 0.3) * 0.4;

    expect(strictExpected).toBeLessThan(epsilonCollapsed);
    expect(expectedMaximum(nearbyEntries)).toBeCloseTo(strictExpected, 12);
    expect(expectedMaximumFiveFor(nearbyEntries)).toBeCloseTo(strictExpected, 12);
  });
});

describe("site-owned provisional native utility", () => {
  it.each([
    input,
    { ...input, chartKey: "m0004:expert" },
    {
      ...input,
      formation: {
        ...input.formation,
        leaderOutfitCardId: CARD_IDS.pekora,
        members: input.formation.members.map((entry, index) => ({
          ...entry,
          investment: "low-investment" as const,
          bloomStage: index as 0 | 1 | 2 | 3 | 4,
        })),
      },
    },
  ])("keeps the exact-search central kernel identical to the published utility", (candidate) => {
    expect(evaluateNativeCentralUtility(candidate)).toBe(
      evaluateNativeRelativeUtility(candidate).relativeUtility.central,
    );
  });

  it.each([
    {
      label: "positive numerator",
      numerator: { lower: 2, central: 4, upper: 6 },
      expected: { lower: 0.25, central: 1, upper: 3 },
    },
    {
      label: "negative numerator",
      numerator: { lower: -6, central: -4, upper: -2 },
      expected: { lower: -3, central: -1, upper: -0.25 },
    },
    {
      label: "cross-zero numerator",
      numerator: { lower: -6, central: 1, upper: 8 },
      expected: { lower: -3, central: 0.25, upper: 4 },
    },
  ])("divides a $label using all positive-denominator endpoints", ({ numerator, expected }) => {
    expect(
      divideUtilityIntervals(numerator, { lower: 2, central: 4, upper: 8 }),
    ).toEqual(expected);
  });

  it("rejects interval division through a zero denominator", () => {
    expect(() =>
      divideUtilityIntervals(
        { lower: -1, central: 0, upper: 1 },
        { lower: 0, central: 1, upper: 2 },
      ),
    ).toThrow(/strictly-positive denominator/i);
  });

  it("is deterministic and binds every result to the exact standard-manual chart context", () => {
    const first = evaluateNativeRelativeUtility(input);
    const second = evaluateNativeRelativeUtility(structuredClone(input));

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: "provisional-relative-utility",
      methodologyVersion: "yd-native-utility-1.0.0",
      status: "provisional",
      context: {
        id: `${STANDARD_MANUAL_AP_FULL_LIFE_CONTEXT_ID}@m0206:expert`,
        chartKey: "m0206:expert",
        songId: "m0206",
        difficulty: "expert",
        fidelity: "aggregate",
        playMode: "manual",
        judgement: "perfect",
        life: 1_000,
        timingModelId: AGGREGATE_UNIFORM_NOTE_TIMING_MODEL_ID,
      },
    });
    expect(first.assumptions.map((assumption) => assumption.id)).toEqual(
      expect.arrayContaining([
        STANDARD_MANUAL_AP_FULL_LIFE_CONTEXT_ID,
        AGGREGATE_UNIFORM_NOTE_TIMING_MODEL_ID,
        AGGREGATE_SPECIAL_COVERAGE_MODEL_ID,
        "corroborated-score-support-add-then-multiply-v1",
        "recipient-allocation-enumerated-interval-v1",
        "parameter-effect-additive-scenario-v1",
        "active-overlap-conservative-interval-v1",
        "active-first-check-at-cooldown-model-v1",
        "special-activation-rate-additive-capped-model-v1",
      ]),
    );
  });

  it("reports transparent exact and provisional components with bounded uncertainty", () => {
    const result = evaluateNativeRelativeUtility(input);

    expect(result.components.baseParameters.byMember).toHaveLength(5);
    expect(result.components.baseParameters.evidenceGrade).toBe("verified");
    expect(result.components.parameterEffects.contributions.length).toBeGreaterThan(0);
    expect(result.components.persistentScoreSupport.formula).toMatchObject({
      evidenceGrade: "corroborated",
      ruleId: "score-support-combination",
      expression: "activeUpPermil * (1000 + summedSupportPermil) / 1000",
    });
    expect(result.components.special.byFormationOrder).toHaveLength(5);
    expect(
      result.components.special.byFormationOrder.every(
        (entry) => entry.modeledNoteCoverage > 0 && entry.modeledNoteCoverage < 1,
      ),
    ).toBe(true);

    expectInterval(result.relativeUtility);
    expectInterval(result.components.baseParameters.relativeUnits);
    expectInterval(result.components.parameterEffects.relativeUnits);
    expectInterval(result.components.active.relativeUnits);
    expectInterval(result.components.special.relativeUnits);

    const parameterContributions = result.components.parameterEffects.contributions;
    expect(result.components.parameterEffects.relativeUnits.lower).toBeCloseTo(
      parameterContributions.reduce(
        (total, contribution) => total + contribution.relativeUnits.lower,
        0,
      ),
      6,
    );
    expect(result.components.parameterEffects.relativeUnits.central).toBeCloseTo(
      parameterContributions.reduce(
        (total, contribution) => total + contribution.relativeUnits.central,
        0,
      ),
      6,
    );
    expect(result.components.parameterEffects.relativeUnits.upper).toBeCloseTo(
      parameterContributions.reduce(
        (total, contribution) => total + contribution.relativeUnits.upper,
        0,
      ),
      6,
    );
    expect(result.components.parameterEffects.relativeUnits.central).toBe(
      result.components.parameterEffects.relativeUnits.lower,
    );
    expect(
      result.components.persistentScoreSupport.byMember.every(
        (memberSupport) => memberSupport.supportPermil.central === memberSupport.supportPermil.lower,
      ),
    ).toBe(true);
  });

  it("uses the conditional Active override at full Life instead of adding base and override", () => {
    const result = evaluateNativeRelativeUtility(input);
    const azki = result.components.active.byMember.find(
      (entry) => entry.cardId === CARD_IDS.azki,
    )!;

    expect(azki).toMatchObject({
      baseUpPermil: 500,
      conditionalOverrideUpPermil: 1_000,
      selectedAtFullComboPermil: { lower: 1_000, central: 1_000, upper: 1_000 },
      activationProbabilityPermil: 550,
      cooldownMilliseconds: 20_000,
      durationMilliseconds: 7_000,
    });
    expect(azki.selectedAtFullComboPermil.central).not.toBe(1_500);
  });

  it("models real Special activation-rate coverage centrally without raising its lower bound", () => {
    const result = evaluateNativeRelativeUtility(input);
    const activationRate = result.components.special.activationRate;
    const azkiSpecial = result.components.special.byFormationOrder.find(
      (entry) => entry.cardId === CARD_IDS.azki,
    )!;
    const azkiActive = result.components.active.byMember.find(
      (entry) => entry.cardId === CARD_IDS.azki,
    )!;
    const suiseiActive = result.components.active.byMember.find(
      (entry) => entry.cardId === CARD_IDS.suisei,
    )!;

    expect(azkiSpecial.activationRateUpPermil).toBe(400);
    expectInterval(azkiSpecial.modeledActivationRateCoveragePermil);
    expect(azkiSpecial.modeledActivationRateCoveragePermil.lower).toBe(0);
    expect(azkiSpecial.modeledActivationRateCoveragePermil.central).toBeGreaterThan(0);
    expectInterval(azkiActive.modeledActiveNoteCoverageInterval);
    expect(azkiActive.modeledActiveNoteCoverageInterval.lower).toBe(
      azkiActive.modeledActiveNoteCoverage,
    );
    expect(azkiActive.modeledActiveNoteCoverageInterval.central).toBeGreaterThan(
      azkiActive.modeledActiveNoteCoverageInterval.lower,
    );
    expect(azkiActive.modeledActiveNoteCoverageInterval.upper).toBeLessThanOrEqual(1);
    expect(suiseiActive.modeledActiveNoteCoverageInterval.central).toBeGreaterThanOrEqual(
      suiseiActive.modeledActiveNoteCoverageInterval.lower,
    );
    expect(activationRate.operation).toBe("additive-permil-capped-at-1000");
    expect(activationRate.relativeUnits.lower).toBe(0);
    expect(activationRate.relativeUnits.central).toBeGreaterThan(0);
    expect(result.components.special.relativeUnits.central).toBeGreaterThan(
      result.components.special.scoreSupportRelativeUnits.central,
    );

    const ceiling = evaluateNativeRelativeUtility({
      ...input,
      formation: {
        ...input.formation,
        members: input.formation.members.map((entry) => ({
          ...entry,
          investment: "duplicate-enabled-ceiling" as const,
        })),
      },
    });
    const ceilingAzkiActive = ceiling.components.active.byMember.find(
      (entry) => entry.cardId === CARD_IDS.azki,
    )!;
    const ceilingAzkiSpecial = ceiling.components.special.byFormationOrder.find(
      (entry) => entry.cardId === CARD_IDS.azki,
    )!;
    expect(
      ceilingAzkiActive.activationProbabilityPermil + ceilingAzkiSpecial.activationRateUpPermil,
    ).toBe(1_050);
    expect(ceilingAzkiActive.modeledActiveNoteCoverageInterval.central).toBeGreaterThan(
      ceilingAzkiActive.modeledActiveNoteCoverageInterval.lower,
    );
  });

  it("does not misattribute Active-overlap uncertainty when real Specials have no activation-rate effect", () => {
    const zeroActivationCardIds = [
      "card-00001-5-uniq-0000-00",
      CARD_IDS.haato,
      "card-00006-5-uniq-0007-00",
      "card-00007-5-uniq-0008-00",
      "card-00010-5-uniq-0010-00",
    ];
    const result = evaluateNativeRelativeUtility({
      ...input,
      formation: {
        leaderOutfitCardId: zeroActivationCardIds[0]!,
        members: zeroActivationCardIds.map(member),
      },
    });

    expect(
      result.components.special.byFormationOrder.every(
        (entry) => entry.activationRateUpPermil === 0,
      ),
    ).toBe(true);
    expect(result.components.special.activationRate.relativeUnits).toEqual({
      lower: 0,
      central: 0,
      upper: 0,
    });
  });

  it("does not assume a combo-gated Special passes when its marker timestamp is unavailable", () => {
    const conditionalCardId = "card-00017-5-uniq-0015-00";
    const result = evaluateNativeRelativeUtility({
      ...input,
      chartKey: "m0035:expert",
      formation: {
        leaderOutfitCardId: conditionalCardId,
        members: [
          member(conditionalCardId),
          member(CARD_IDS.azki),
          member(CARD_IDS.suisei),
          member(CARD_IDS.haato),
          member(CARD_IDS.aki),
        ],
      },
    });

    expect(result.context.noteCount).toBe(596);
    expect(result.components.special.byFormationOrder[0]).toMatchObject({
      cardId: conditionalCardId,
      slot: 1,
      activationRateUpPermil: 0,
    });
  });

  it("does not invent a formation-order score advantage without rainbow-marker timestamps", () => {
    const forward = evaluateNativeRelativeUtility(input);
    const reversed = evaluateNativeRelativeUtility({
      ...input,
      formation: {
        ...input.formation,
        members: [...input.formation.members].reverse(),
      },
    });

    expect(reversed.relativeUtility).toEqual(forward.relativeUtility);
    expect(
      forward.components.special.byFormationOrder.every(
        (special) =>
          special.modeledStartsAtMilliseconds === null &&
          special.modeledEndsAtMilliseconds === null,
      ),
    ).toBe(true);
    expect(forward.uncertainty.specialTiming).toBe(AGGREGATE_SPECIAL_COVERAGE_MODEL_ID);
  });

  it("rejects editorial fields and has no dependency on legacy ranking or public editorial modules", () => {
    expect(() =>
      evaluateNativeRelativeUtility({ ...input, editorialTier: "SS" } as NativeUtilityInput),
    ).toThrow(/editorial inputs are forbidden/i);
    expect(() =>
      evaluateNativeRelativeUtility({
        ...input,
        accountState: {
          board: { ...input.accountState.board, evidenceRef: "appmedia:SS" },
        },
      }),
    ).toThrow(/editorial inputs are forbidden/i);

    const source = readFileSync(new URL("./native-utility.ts", import.meta.url), "utf8");
    const imports = source.match(/^import[\s\S]*?from\s+["'][^"']+["'];/gm)?.join("\n") ?? "";
    expect(imports).not.toMatch(/public-data|ranking|data\/rankings/i);
  });

  it("requires an explicitly evidenced neutral Board instead of assuming zero", () => {
    expect(() =>
      evaluateNativeRelativeUtility({
        ...input,
        accountState: { board: { mode: "unavailable" } },
      } as unknown as NativeUtilityInput),
    ).toThrow(/explicitly evidenced neutral Board/i);

    expect(evaluateNativeRelativeUtility(input).components.board).toEqual({
      evidenceGrade: "verified",
      evidenceRef: "fixture:verified-neutral-board",
      relativeUnits: { lower: 0, central: 0, upper: 0 },
    });
  });

  it("allows a relevant Gen 0 partner to improve the native parameter-effect utility", () => {
    const synergistic = evaluateNativeRelativeUtility(input);
    const unrelated = evaluateNativeRelativeUtility({
      ...input,
      formation: {
        ...input.formation,
        members: [
          member(CARD_IDS.azki),
          member(CARD_IDS.pekora),
          member(CARD_IDS.haato),
          member(CARD_IDS.aki),
          member(CARD_IDS.iroha),
        ],
      },
    });

    expect(synergistic.components.parameterEffects.relativeUnits.central).toBeGreaterThan(
      unrelated.components.parameterEffects.relativeUnits.central,
    );
  });

  it("never exposes an absolute-score field", () => {
    const result = evaluateNativeRelativeUtility(input);
    expect(objectKeysDeep(result)).not.toContain("absoluteScore");
    expect(objectKeysDeep(result)).not.toContain("absoluteScoreAllowed");
  });
});
