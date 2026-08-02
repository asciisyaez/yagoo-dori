import { describe, expect, it } from "vitest";

import {
  compileExactOptimizerTeam,
  crossCheckExactOptimizerTeamLeader,
  evaluateExactOptimizerTeamLeader,
} from "./exact-optimizer-kernel";

const BOARD = {
  board: {
    mode: "declared-neutral" as const,
    evidenceGrade: "verified" as const,
    evidenceRef: "fixture:exact-optimizer-trace-kernel",
  },
};

const MEMBERS = [
  "card-00001-4-cmmn-0000-00",
  "card-00004-5-uniq-0005-00",
  "card-00005-5-uniq-0006-00",
  "card-00013-4-cmmn-0000-00",
  "card-00016-5-uniq-0014-00",
] as const;

describe("exact optimizer trace kernel", () => {
  it("compiles Member-only state once and uses trace-preserving state runs exactly", () => {
    const team = compileExactOptimizerTeam({
      memberCardIds: [...MEMBERS].reverse(),
      investmentLayer: "one-copy-maximum",
      bloomStageByCardId: { [MEMBERS[0]]: 2, [MEMBERS[4]]: 5 },
    });
    const first = evaluateExactOptimizerTeamLeader({
      team,
      leaderOutfitCardId: "card-00001-5-uniq-0000-00",
      chartKey: "m0206:expert",
      seed: 0x5eed,
      accountState: BOARD,
    });
    const second = crossCheckExactOptimizerTeamLeader({
      team,
      leaderOutfitCardId: "card-00013-5-uniq-0002-00",
      chartKey: "m0206:expert",
      seed: 0x5eed,
      accountState: BOARD,
    });

    expect(team.members.map((member) => member.cardId)).toEqual([...MEMBERS].sort());
    expect(first.execution.mode).toBe("trace-preserving-state-runs");
    expect(first.execution.admissibility).toMatchObject({ admissible: true, reasons: [] });
    expect(first.execution.activeTrace.baseStateRuns).toBeGreaterThan(0);
    expect(second.canonicalUtility.central).toBeTypeOf("number");
  });
});
