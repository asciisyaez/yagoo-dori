import { describe, expect, it } from "vitest";

import {
  SCORE_KERNEL_RULE_STATES,
  SCORE_KERNEL_SOURCE_SNAPSHOT,
  compileKnownNoteScoreKernel,
  projectKnownKernelIntegerCandidates,
  resolveComboScoreBonus,
  resolveJudgementCoefficient,
  resolveMusicScoreCoefficient,
} from "./score-kernel";

const PINNED_COMMIT = "b1f9535bbdc4473e384adab7b41a0e26e06363d7";

describe("known score kernel", () => {
  it("pins every implemented factor to the current structured snapshot", () => {
    expect(SCORE_KERNEL_SOURCE_SNAPSHOT).toMatchObject({
      commit: PINNED_COMMIT,
      methodologyVersion: "known-score-kernel-v1",
    });

    const implemented = SCORE_KERNEL_RULE_STATES.filter(
      (rule) => rule.status === "implemented-from-pinned-data",
    );
    expect(implemented.map((rule) => rule.id)).toEqual([
      "note-judgement-platform-coefficients",
      "combo-score-bonus-breakpoints",
      "music-score-coefficient",
      "auto-live-restrictions",
    ]);
    expect(implemented.every((rule) => rule.sourceRows.length > 0)).toBe(true);
  });

  it("keeps every missing absolute-score rule machine-readable and blocking", () => {
    expect(
      SCORE_KERNEL_RULE_STATES.filter((rule) => rule.status === "unresolved").map(
        (rule) => [rule.id, rule.blocksAbsoluteScore],
      ),
    ).toEqual([
      ["combo-boundary-application-order", true],
      ["unit-score-equation", true],
      ["score-factor-operation-order", true],
      ["runtime-integer-rounding", true],
    ]);
  });

  it("resolves mobile and PC judgement coefficients without flattening flick differences", () => {
    const mobile = resolveJudgementCoefficient({
      platform: "mobile",
      playMode: "manual",
      noteType: "flick",
      judgement: "perfect",
    });
    const pc = resolveJudgementCoefficient({
      platform: "pc",
      playMode: "manual",
      noteType: "flick",
      judgement: "perfect",
    });

    expect(mobile).toMatchObject({
      sourcePermil: 1_050,
      appliedPermil: 1_050,
      awardsBaseScore: true,
      source: { commit: PINNED_COMMIT, table: "LiveNote.json" },
    });
    expect(pc).toMatchObject({
      sourcePermil: 1_000,
      appliedPermil: 1_000,
      awardsBaseScore: true,
    });
  });

  it("preserves the pinned judgement ladder and null non-scoring rows", () => {
    const coefficient = (judgement: "perfect" | "great" | "good" | "bad" | "miss") =>
      resolveJudgementCoefficient({
        platform: "mobile",
        playMode: "manual",
        noteType: "normal",
        judgement,
      });

    expect(coefficient("perfect").appliedPermil).toBe(1_000);
    expect(coefficient("great").appliedPermil).toBe(800);
    expect(coefficient("good").appliedPermil).toBe(500);
    expect(coefficient("bad")).toMatchObject({
      sourcePermil: null,
      appliedPermil: 0,
      awardsBaseScore: false,
    });
    expect(coefficient("miss")).toMatchObject({
      sourcePermil: null,
      appliedPermil: 0,
      awardsBaseScore: false,
    });
  });

  it("uses continuation coefficients rather than treating every chart event as a full note", () => {
    expect(
      resolveJudgementCoefficient({
        platform: "mobile",
        playMode: "manual",
        noteType: "long-continuation",
        judgement: "perfect",
      }).appliedPermil,
    ).toBe(100);
    expect(
      resolveJudgementCoefficient({
        platform: "pc",
        playMode: "auto",
        noteType: "long-relay",
        judgement: "auto",
      }).appliedPermil,
    ).toBe(100);
  });

  it("selects the highest manual combo breakpoint not above the supplied count", () => {
    const bonusAt = (comboCountAtScoring: number) =>
      resolveComboScoreBonus({
        groupId: "live_combo-1",
        comboCountAtScoring,
        playMode: "manual",
      });

    expect(bonusAt(0)).toMatchObject({ matchedBreakpointFrom: 0, bonusPermil: 0 });
    expect(bonusAt(99)).toMatchObject({ matchedBreakpointFrom: 0, bonusPermil: 0 });
    expect(bonusAt(100)).toMatchObject({ matchedBreakpointFrom: 100, bonusPermil: 10 });
    expect(bonusAt(199)).toMatchObject({ matchedBreakpointFrom: 100, bonusPermil: 10 });
    expect(bonusAt(1_000)).toMatchObject({ matchedBreakpointFrom: 1_000, bonusPermil: 100 });
    expect(bonusAt(5_000)).toMatchObject({ matchedBreakpointFrom: 1_000, bonusPermil: 100 });
  });

  it("enforces Auto judgement and disables combo bonus at every combo count", () => {
    const kernel = compileKnownNoteScoreKernel({
      songId: "m0001",
      platform: "mobile",
      playMode: "auto",
      noteType: "normal",
      judgement: "auto",
      comboCountAtScoring: 1_000,
    });

    expect(kernel.judgement.appliedPermil).toBe(800);
    expect(kernel.combo).toMatchObject({
      matchedBreakpointFrom: null,
      bonusPermil: 0,
      multiplierPermil: 1_000,
      disabledBy: "auto-live",
      source: null,
    });
    expect(kernel.autoRestrictions).toEqual({
      usesAutoJudgementRows: true,
      comboScoreBonusEnabled: false,
      judgmentScoreDisplayed: false,
      judgmentBoostCanChangeAutoJudgement: false,
      lifeRestoreEnabled: false,
    });
  });

  it("retains the song coefficient as its sourced integer permil factor", () => {
    expect(resolveMusicScoreCoefficient("m0001")).toMatchObject({
      songId: "m0001",
      songTitle: "Shiny Smily Story (2022 ver.)",
      coefficientPermil: 4,
      source: {
        commit: PINNED_COMMIT,
        table: "Music.json",
        rowKey: "m0001",
      },
    });
  });

  it("compiles only the known music, judgement, and combo factors as an exact fraction", () => {
    const kernel = compileKnownNoteScoreKernel({
      songId: "m0001",
      platform: "mobile",
      playMode: "manual",
      noteType: "flick",
      judgement: "perfect",
      comboCountAtScoring: 100,
    });

    // 4/1000 * 1050/1000 * 1010/1000, reduced exactly.
    expect(kernel.knownFactor).toEqual({ numerator: 2_121, denominator: 500_000 });
    expect(kernel).toMatchObject({
      status: "partial-known-kernel",
      canProduceAbsoluteScore: false,
      music: { coefficientPermil: 4 },
      judgement: { appliedPermil: 1_050 },
      combo: { bonusPermil: 10, multiplierPermil: 1_010 },
      autoRestrictions: null,
    });
    expect(kernel.unresolvedRuleIds).toEqual([
      "combo-boundary-application-order",
      "unit-score-equation",
      "score-factor-operation-order",
      "runtime-integer-rounding",
    ]);
  });

  it("uses bigint integer candidates without selecting an unverified rounding rule", () => {
    const kernel = compileKnownNoteScoreKernel({
      songId: "m0001",
      platform: "mobile",
      playMode: "manual",
      noteType: "normal",
      judgement: "perfect",
      comboCountAtScoring: 100,
    });
    const projection = projectKnownKernelIntegerCandidates(925n, kernel);

    // 925 * (4/1000 * 1000/1000 * 1010/1000) = 3.737
    expect(kernel.knownFactor).toEqual({ numerator: 101, denominator: 25_000 });
    expect(projection).toMatchObject({
      status: "rounding-unresolved",
      canProduceAbsoluteScore: false,
      baseUnits: 925n,
      exactNumerator: 93_425n,
      exactDenominator: 25_000n,
      floorCandidate: 3n,
      nearestHalfUpCandidate: 4n,
      ceilCandidate: 4n,
      selectedValue: null,
    });
  });

  it("keeps a null judgement coefficient at an exact zero factor", () => {
    const kernel = compileKnownNoteScoreKernel({
      songId: "m0001",
      platform: "mobile",
      playMode: "manual",
      noteType: "normal",
      judgement: "miss",
      comboCountAtScoring: 999,
    });
    expect(kernel.knownFactor).toEqual({ numerator: 0, denominator: 1 });
    expect(projectKnownKernelIntegerCandidates(123_456n, kernel)).toMatchObject({
      floorCandidate: 0n,
      nearestHalfUpCandidate: 0n,
      ceilCandidate: 0n,
      selectedValue: null,
    });
  });

  it("rejects invented judgement rows and invalid score contexts", () => {
    expect(() =>
      resolveJudgementCoefficient({
        platform: "mobile",
        playMode: "manual",
        noteType: "flick",
        judgement: "great",
      }),
    ).toThrow(/No pinned LiveNote row/);
    expect(() =>
      resolveJudgementCoefficient({
        platform: "mobile",
        playMode: "auto",
        noteType: "normal",
        judgement: "perfect",
      }),
    ).toThrow(/must use the AUTO judgement row/);
    expect(() => resolveMusicScoreCoefficient("missing-song")).toThrow(/Unknown song/);
    expect(() =>
      resolveComboScoreBonus({
        groupId: "missing-group",
        comboCountAtScoring: 0,
        playMode: "manual",
      }),
    ).toThrow(/Unknown combo group/);
    expect(() =>
      resolveComboScoreBonus({
        groupId: "live_combo-1",
        comboCountAtScoring: -1,
        playMode: "manual",
      }),
    ).toThrow(/nonnegative safe integer/);
  });
});
