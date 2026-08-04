import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  canonicalExactOptimizerPartialStateBytes,
  canonicalExactOptimizerPartialStateKey,
  createExactOptimizerPartialState,
  encodeBinary64,
  enumerateExactOptimizerLegalSuffixes,
  resumeExactOptimizerAccumulatorRuns,
  resumeExactOptimizerSuffix,
  serializeExactOptimizerAccumulatorCheckpoint,
  serializeExactOptimizerAccumulatorLedger,
  serializeExactOptimizerPartialState,
  serializeExactOptimizerPartialStateSuffix,
  type Binary64Bits,
  type ExactOptimizerPartialState,
  type PartialStateAccumulatorCheckpoint,
  type PartialStateAccumulatorLedger,
  type PartialStateAccumulatorRun,
  type SerializedPartialState,
} from "./exact-optimizer-partial-state";

const LEADER_A = "card-00001-5-uniq-0000-00";
const LEADER_B = "card-00013-5-uniq-0002-00";
const MEMBERS_A = [
  "card-00001-4-cmmn-0000-00",
  "card-00004-5-uniq-0005-00",
  "card-00005-5-uniq-0006-00",
  "card-00013-4-cmmn-0000-00",
  "card-00016-5-uniq-0014-00",
];
const MEMBERS_B = [
  "card-00001-4-cmmn-0000-00",
  "card-00004-5-uniq-0005-00",
  "card-00005-5-uniq-0006-00",
  "card-00013-4-cmmn-0000-00",
  "card-00018-5-uniq-0004-00",
];

function stateSerialized(
  leaderOutfitCardId: string,
  orderedMemberCardIds: readonly string[],
): SerializedPartialState {
  return serializeExactOptimizerPartialState(
    createExactOptimizerPartialState({ leaderOutfitCardId, orderedMemberCardIds }),
  );
}

function bits(value: number): Binary64Bits {
  return encodeBinary64(value);
}

function point(value: number): Readonly<{ lower: Binary64Bits; upper: Binary64Bits }> {
  return { lower: bits(value), upper: bits(value) };
}

function checkpoint(
  passName: PartialStateAccumulatorCheckpoint["passName"],
  runCursor = 0,
  noteCursor = 0,
  value = 0,
  enclosures = {
    lower: point(value),
    central: point(value),
    upper: point(value),
  },
): string {
  return serializeExactOptimizerAccumulatorCheckpoint({
    schemaVersion: 1,
    passName,
    runCursor,
    noteCursor,
    enclosures,
    fallbackReasons: [],
  });
}

function run(
  passName: PartialStateAccumulatorRun["passName"],
  runIndex: number,
  noteIndex: number,
  multiplicity: number,
  lower: number,
  central: number,
  upper: number,
): PartialStateAccumulatorRun {
  return {
    passName,
    runIndex,
    noteIndex,
    multiplicity,
    contributions: {
      lower: bits(lower),
      central: bits(central),
      upper: bits(upper),
    },
  };
}

function ledger(
  passName: PartialStateAccumulatorLedger["passName"],
  runs: readonly PartialStateAccumulatorRun[],
): string {
  return serializeExactOptimizerAccumulatorLedger({
    schemaVersion: 1,
    passName,
    runs,
  });
}

function parsedState(serialized: SerializedPartialState): ExactOptimizerPartialState & Record<string, any> {
  return JSON.parse(serialized) as ExactOptimizerPartialState & Record<string, any>;
}

function mutationDiverges(
  serialized: SerializedPartialState,
  mutate: (state: Record<string, any>) => void,
): boolean {
  const mutated = parsedState(serialized);
  mutate(mutated);
  try {
    return canonicalExactOptimizerPartialStateKey(mutated as ExactOptimizerPartialState) !==
      canonicalExactOptimizerPartialStateKey(serialized);
  } catch {
    return true;
  }
}

describe("exact optimizer partial state", () => {
  it("resumes prefixes to byte-identical full-formation state across depths and orders", () => {
    const orders = [
      MEMBERS_A,
      [...MEMBERS_A].reverse(),
      [MEMBERS_A[2]!, MEMBERS_A[0]!, MEMBERS_A[4]!, MEMBERS_A[1]!, MEMBERS_A[3]!],
    ];
    for (const order of orders) {
      const fromScratch = stateSerialized(LEADER_A, order);
      for (const depth of [0, 1, 3, 5]) {
        const prefix = stateSerialized(LEADER_A, order.slice(0, depth));
        const suffix = serializeExactOptimizerPartialStateSuffix({
          memberCardIds: order.slice(depth),
        });
        const resumed = resumeExactOptimizerSuffix(prefix, suffix);
        expect(resumed.serializedState).toBe(fromScratch);
        expect(canonicalExactOptimizerPartialStateBytes(resumed.serializedState)).toEqual(
          canonicalExactOptimizerPartialStateBytes(fromScratch),
        );
      }
    }
  });

  it("enumerates the pinned legal suffix set without changing the state boundary", () => {
    const empty = stateSerialized(LEADER_A, []);
    const suffixes = enumerateExactOptimizerLegalSuffixes(empty);
    expect(suffixes).toHaveLength(56 * 120);
    const completed = resumeExactOptimizerSuffix(
      empty,
      serializeExactOptimizerPartialStateSuffix({ memberCardIds: MEMBERS_A }),
    );
    expect(completed.completion).toBe("complete-awaiting-fixed-leader-resolution");
    expect(completed.state.arithmetic.status).toBe("not-started");
  });

  it("separates distinct leaders, orders, members, and chart context", () => {
    const leaderA = stateSerialized(LEADER_A, MEMBERS_A);
    const leaderB = stateSerialized(LEADER_B, MEMBERS_A);
    const reversed = stateSerialized(LEADER_A, [...MEMBERS_A].reverse());
    const distinctMember = stateSerialized(LEADER_A, MEMBERS_B);
    const chartMutation = parsedState(leaderA);
    (chartMutation as any).chartContext.chartOrderSignature = "mutated-chart-order";

    expect(canonicalExactOptimizerPartialStateBytes(leaderA)).not.toEqual(
      canonicalExactOptimizerPartialStateBytes(leaderB),
    );
    expect(canonicalExactOptimizerPartialStateBytes(leaderA)).not.toEqual(
      canonicalExactOptimizerPartialStateBytes(reversed),
    );
    expect(canonicalExactOptimizerPartialStateBytes(leaderA)).not.toEqual(
      canonicalExactOptimizerPartialStateBytes(distinctMember),
    );
    expect(canonicalExactOptimizerPartialStateBytes(leaderA)).not.toEqual(
      canonicalExactOptimizerPartialStateBytes(chartMutation as ExactOptimizerPartialState),
    );
  });

  it("detects mutation of each declared continuation-sensitive dimension", () => {
    const base = stateSerialized(LEADER_A, MEMBERS_A.slice(0, 1));
    const mutations: readonly [string, (state: Record<string, any>) => void][] = [
      ["remaining action set", (state) => state.prefix.remainingActionIds.splice(0, 1)],
      ["selected count", (state) => { state.prefix.selectedCount += 1; }],
      ["five-star budget", (state) => { state.prefix.remainingFiveStarBudget -= 1; }],
      ["card and talent identity", (state) => { state.prefix.orderedMembers[0].talentId = "mutated-talent"; }],
      ["investment and Bloom", (state) => { state.prefix.orderedMembers[0].bloomStage = 1; }],
      ["attribute and group counts", (state) => { state.prefix.attributeCounts.cute += 1; }],
      ["Leader trigger truth", (state) => { state.leaderAndTriggerFacts.reason = "mutated-trigger"; }],
      ["singer and chart signature", (state) => { delete state.chartContext.chartKey; }],
      ["capped-target eligibility", (state) => { state.leaderAndTriggerFacts.reason = "mutated-target"; }],
      ["Member parameters", (state) => { state.memberFacts.progressionStateAndParametersBySlot[0].parameters.performance += 1; }],
      ["Active timing and probability", (state) => { state.memberFacts.activeTimingBySlot[0].cooldownMilliseconds = 1; }],
      ["Persistent support", (state) => { state.memberFacts.activeValueAndProbabilityLedger.reason = "mutated-support"; }],
      ["Special support and activation", (state) => { state.specialFacts.reason = "mutated-special"; }],
      ["ordered accumulator cursor", (state) => { state.arithmetic.cursor.noteIndex += 1; }],
      ["tie and finalist continuation", (state) => { state.comparison.prefixTieKey = "mutated-tie"; }],
    ];
    for (const [label, mutate] of mutations) {
      expect(mutationDiverges(base, mutate), label).toBe(true);
    }
  });

  it("continues certifiable runs at every checkpoint with identical endpoint bits and canonical units", () => {
    const runs = [
      run("active-base", 0, 0, 3, 0.125, 0.25, 0.5),
      run("active-base", 1, 3, 2, 0.0625, 0.125, 0.25),
      run("active-base", 2, 5, 4, 0.03125, 0.0625, 0.125),
    ];
    const initial = checkpoint("active-base");
    const uninterrupted = resumeExactOptimizerAccumulatorRuns(
      initial as any,
      ledger("active-base", runs) as any,
    );
    for (let boundary = 0; boundary <= runs.length; boundary += 1) {
      const prefix = resumeExactOptimizerAccumulatorRuns(
        initial as any,
        ledger("active-base", runs.slice(0, boundary)) as any,
      );
      const continued = resumeExactOptimizerAccumulatorRuns(
        prefix.serializedCheckpoint,
        ledger("active-base", runs.slice(boundary)) as any,
      );
      expect(continued.enclosures).toEqual(uninterrupted.enclosures);
      expect(continued.canonical).toEqual(uninterrupted.canonical);
      expect(continued.serializedCheckpoint).toBe(uninterrupted.serializedCheckpoint);
    }
    expect(uninterrupted.canonical.central.kind).toBe("bulk-certified-reference-equivalent");
  });

  it("preserves fallback-reason and canonical-boundary-overlap ledgers", () => {
    const fallbackRuns = [
      run("active-special-support", 0, 0, 2, Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE),
    ];
    const fallbackResult = resumeExactOptimizerAccumulatorRuns(
      checkpoint("active-special-support") as any,
      ledger("active-special-support", fallbackRuns) as any,
    );
    expect(fallbackResult.fallbackReasons).toContain("subnormal-assumption-not-proven");
    expect(fallbackResult.canonical.central.kind).toBe("ordered-replay-required");
    expect(fallbackResult.canonical.central.fallbackReason).toBe("subnormal-assumption-not-proven");

    const overlapResult = resumeExactOptimizerAccumulatorRuns(
      checkpoint(
        "active-special-activation",
        0,
        0,
        0,
        {
          lower: { lower: bits(4.12500049), upper: bits(4.12500049) },
          central: { lower: bits(4.12500049), upper: bits(4.12500051) },
          upper: { lower: bits(4.12500051), upper: bits(4.12500051) },
        },
      ) as any,
      ledger(
        "active-special-activation",
        [run("active-special-activation", 0, 0, 1, 0, 0, 0)],
      ) as any,
    );
    expect(overlapResult.canonical.central).toMatchObject({
      kind: "ordered-replay-required",
      fallbackReason: "canonical-boundary-overlap",
    });
  });

  it("rejects a non-constant ledger run instead of replaying fabricated values", () => {
    const nonConstant: PartialStateAccumulatorRun = {
      passName: "active-base",
      runIndex: 0,
      noteIndex: 0,
      multiplicity: 2,
      contributions: { lower: bits(1), central: bits(1), upper: bits(1) },
      expectedContributions: { lower: bits(2), central: bits(2), upper: bits(2) },
    };
    expect(() =>
      resumeExactOptimizerAccumulatorRuns(
        checkpoint("active-base") as any,
        ledger("active-base", [nonConstant]) as any,
      ),
    ).toThrowError(/not constant/);
  });

  it("keeps accumulator resumption outside the reference-evaluator import graph", () => {
    const source = readFileSync(new URL("./exact-optimizer-partial-state.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from ["']\.\/(?:formation-evaluator|native-utility|exact-optimizer-kernel)["']/);
    expect(source).not.toMatch(/evaluateFormation|evaluateNativeRelativeUtility/);

    const result = resumeExactOptimizerAccumulatorRuns(
      checkpoint("active-base") as any,
      ledger("active-base", [run("active-base", 0, 0, 1, 0.125, 0.25, 0.5)]) as any,
    );
    expect(result.enclosures.central.lower).toBe(bits(0.25));
    expect(result.enclosures.central.upper).toBe(bits(0.25));
  });
});
