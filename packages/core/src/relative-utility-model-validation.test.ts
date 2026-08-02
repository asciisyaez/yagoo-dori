import { describe, expect, it } from "vitest";

import type { NativeUtilityInput } from "./native-utility";
import { evaluateNativeRelativeUtility } from "./native-utility";
import {
  assertRelativeUtilityModelValidationCurrent,
  relativeUtilityModelValidation,
} from "./relative-utility-model-validation";

const input: NativeUtilityInput = {
  formation: {
    leaderOutfitCardId: "card-00013-5-uniq-0002-00",
    members: [
      "card-00013-5-uniq-0002-00",
      "card-00018-5-uniq-0004-00",
      "card-00005-5-uniq-0006-00",
      "card-00004-5-uniq-0005-00",
      "card-00039-5-uniq-0032-00",
    ].map((cardId) => ({ cardId, investment: "one-copy-maximum" as const })),
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

function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...keysDeep(child)]);
}

describe("fixed relative-utility model validation", () => {
  it("cross-checks every versioned evidence and ranking artifact", () => {
    expect(() => assertRelativeUtilityModelValidationCurrent()).not.toThrow();
    expect(relativeUtilityModelValidation.releaseDecision).toEqual({
      relativeRankingAndTeamSelectionAllowed: true,
      absoluteScoreEquationDisposition: "claim-boundary-not-release-blocker",
      targetPriorityDisposition: "bounded-uncertainty-not-release-blocker",
      remainingOptimizerRequirement: "certified-full-roster-global-optimum",
    });
  });

  it("keeps missing absolute-score rules explicit instead of selecting an equation", () => {
    expect(relativeUtilityModelValidation.absoluteScoreAudit).toMatchObject({
      status: "not-validated",
      unresolvedRuleIds: [
        "combo-boundary-application-order",
        "unit-score-equation",
        "score-factor-operation-order",
        "runtime-integer-rounding",
      ],
    });
    expect(relativeUtilityModelValidation.scope.absoluteLiveScoreClaimsAllowed).toBe(false);
  });

  it("binds unknown capped-target priority to an exhaustive conservative interval policy", () => {
    const result = evaluateNativeRelativeUtility(input);
    const cappedContributions = result.components.parameterEffects.contributions.filter(
      (contribution) => contribution.recipientAlternatives.length > 1,
    );

    expect(cappedContributions.length).toBeGreaterThan(0);
    expect(relativeUtilityModelValidation.targetSelectionAudit).toMatchObject({
      resolverStatus: "unknown",
      fixedPolicy: "enumerate-all-legal-capped-recipient-subsets",
      centralPolicy: "guaranteed-minimum",
      claimsActualRecipients: false,
    });
    expect(
      cappedContributions.every(
        (contribution) =>
          contribution.relativeUnits.lower === contribution.relativeUnits.central &&
          contribution.relativeUnits.central <= contribution.relativeUnits.upper,
      ),
    ).toBe(true);
  });

  it("proves deterministic relative output while excluding absolute-score fields", () => {
    const first = evaluateNativeRelativeUtility(input);
    const second = evaluateNativeRelativeUtility(structuredClone(input));

    expect(second).toEqual(first);
    expect(first.methodologyVersion).toBe(
      relativeUtilityModelValidation.relativeModel.methodologyVersion,
    );
    expect(first.relativeUtility.lower).toBeLessThanOrEqual(first.relativeUtility.central);
    expect(first.relativeUtility.central).toBeLessThanOrEqual(first.relativeUtility.upper);
    expect(keysDeep(first)).not.toContain("absoluteScore");
    expect(keysDeep(first)).not.toContain("absoluteScoreAllowed");
  });
});
