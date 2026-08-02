import { describe, expect, it } from "vitest";

import { buildExactOptimizerDeterministicIncumbent } from "./exact-optimizer-incumbent";

const MEMBERS = [
  "card-00001-4-cmmn-0000-00",
  "card-00004-5-uniq-0005-00",
  "card-00005-5-uniq-0006-00",
  "card-00013-4-cmmn-0000-00",
  "card-00016-5-uniq-0014-00",
  "card-00018-5-uniq-0004-00",
] as const;
const LEADERS = [
  "card-00001-5-uniq-0000-00",
  "card-00013-5-uniq-0002-00",
  "card-00019-5-uniq-0016-00",
] as const;

describe("deterministic exact incumbent", () => {
  it("freezes a cross-checked fixed point without turning it into a certificate", () => {
    const input = {
      eligibleMemberCardIds: MEMBERS,
      eligibleLeaderOutfitCardIds: LEADERS,
      chartKeys: ["m0206:expert", "m0309:expert"],
      investmentLayer: "one-copy-maximum" as const,
      seed: 0x5eed,
      accountState: {
        board: {
          mode: "declared-neutral" as const,
          evidenceGrade: "verified" as const,
          evidenceRef: "fixture:exact-incumbent",
        },
      },
      maximumCandidateTeams: 2,
      existingMemberTeams: [MEMBERS.slice(0, 5)],
    };
    const first = buildExactOptimizerDeterministicIncumbent(input);
    const second = buildExactOptimizerDeterministicIncumbent(input);
    expect(second).toEqual(first);
    expect(first.completeTieSet.length).toBeGreaterThan(0);
    expect(first.frozenHash).toMatch(/^[a-f0-9]{64}$/);
  }, 30_000);
});
