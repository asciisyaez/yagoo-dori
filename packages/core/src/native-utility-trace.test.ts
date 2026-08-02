import { describe, expect, it } from "vitest";

import {
  compileNativeUtilityTeamIntrinsic,
  evaluateNativeRelativeUtilityUncompressed,
  evaluateNativeRelativeUtilityWithCompiledTeam,
  evaluateNativeRelativeUtilityWithTrace,
} from "./native-utility";

const BOARD = {
  board: {
    mode: "declared-neutral" as const,
    evidenceGrade: "verified" as const,
    evidenceRef: "fixture:native-utility-trace",
  },
};

const CASES = [
  {
    leaderOutfitCardId: "card-00001-5-uniq-0000-00",
    members: [
      "card-00001-4-cmmn-0000-00",
      "card-00004-5-uniq-0005-00",
      "card-00005-5-uniq-0006-00",
      "card-00013-4-cmmn-0000-00",
      "card-00016-5-uniq-0014-00",
    ].map((cardId, index) => ({
      cardId,
      investment: "one-copy-maximum" as const,
      bloomStage: index as 0 | 1 | 2 | 3 | 4,
    })),
    chartKey: "m0206:expert",
  },
  {
    leaderOutfitCardId: "card-00019-5-uniq-0016-00",
    members: [
      "card-00018-5-uniq-0004-00",
      "card-00019-5-uniq-0016-00",
      "card-00021-5-uniq-0017-00",
      "card-00022-5-uniq-0018-00",
      "card-00039-5-uniq-0032-00",
    ].map((cardId, index) => ({
      cardId,
      investment: "duplicate-enabled-ceiling" as const,
      bloomStage: ((index + 1) % 6) as 0 | 1 | 2 | 3 | 4 | 5,
    })),
    chartKey: "m0309:expert",
  },
  {
    leaderOutfitCardId: "card-04003-5-uniq-0044-00",
    members: [
      "card-03001-4-cmmn-0000-00",
      "card-03002-4-cmmn-0000-00",
      "card-03003-4-cmmn-0000-00",
      "card-03004-4-cmmn-0000-00",
      "card-03005-4-cmmn-0000-00",
    ].map((cardId) => ({ cardId, investment: "low-investment" as const })),
    chartKey: "m0004:expert",
  },
] as const;

describe("native utility trace-preserving state-run evaluator", () => {
  it("is byte-identical to the independent uncompressed evaluator across dynamic states", () => {
    for (const fixture of CASES) {
      const input = { formation: fixture, chartKey: fixture.chartKey, seed: 0x5eed, accountState: BOARD };
      const compressed = evaluateNativeRelativeUtilityWithTrace(input);
      const uncompressed = evaluateNativeRelativeUtilityUncompressed(input);
      expect(compressed.activeTrace.mode).toBe("trace-preserving-state-runs");
      expect(compressed.activeTrace.baseStateRuns).toBeGreaterThan(0);
      expect(compressed.result).toEqual(uncompressed);
    }
  });

  it("reuses only Member-intrinsic timing across fixed Leaders", () => {
    const members = CASES[0].members;
    const intrinsic = compileNativeUtilityTeamIntrinsic(members);
    const first = evaluateNativeRelativeUtilityWithCompiledTeam(
      {
        formation: { leaderOutfitCardId: "card-00001-5-uniq-0000-00", members },
        chartKey: "m0206:expert",
        seed: 0x5eed,
        accountState: BOARD,
      },
      intrinsic,
    );
    const second = evaluateNativeRelativeUtilityWithCompiledTeam(
      {
        formation: { leaderOutfitCardId: "card-00013-5-uniq-0002-00", members },
        chartKey: "m0206:expert",
        seed: 0x5eed,
        accountState: BOARD,
      },
      intrinsic,
    );
    expect(first.activeTrace.mode).toBe("trace-preserving-state-runs");
    expect(second.activeTrace.mode).toBe("trace-preserving-state-runs");
    expect(intrinsic.activeTimingByMember).toHaveLength(5);
  });
});
