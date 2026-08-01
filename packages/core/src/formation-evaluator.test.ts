import { describe, expect, it } from "vitest";

import { mechanicsCardById } from "./mechanics";
import { publicCardById } from "./public-data";
import { TimedChartContextSchema, songContextData } from "./song-contexts";
import {
  assertLegalFormation,
  calculateCardProgression,
  enumerateSpecialOrders,
  evaluateFormation,
  provisionalRuntimePolicy,
  resolveActiveApplications,
  resolveLeaderApplications,
  resolveTargetRecipients,
  simulateModeledActiveChecks,
  verifiedOnlyRuntimePolicy,
  type FormationInput,
  type FormationMember,
} from "./formation-evaluator";

const GEN_ZERO_MEMBERS = [
  "card-00013-5-uniq-0002-00", // AZKi / Pure
  "card-00018-5-uniq-0004-00", // Suisei / Pure
  "card-00002-5-uniq-0001-00", // Robocosan / Happy
  "card-00015-5-uniq-0003-00", // Miko / Happy
  "card-00001-5-uniq-0000-00", // Sora / Cute
] as const;

const formation: FormationInput = {
  leaderOutfitCardId: "card-00011-5-uniq-0011-00",
  members: GEN_ZERO_MEMBERS.map((cardId) => ({
    cardId,
    investment: "one-copy-maximum" as const,
  })) as unknown as FormationInput["members"],
};

const unavailableAccountState = { board: { mode: "unavailable" as const } };

function bruteForceSubsets(values: readonly number[], size: number): number[][] {
  if (size === 0) return [[]];
  if (values.length < size) return [];
  const [head, ...tail] = values;
  return [
    ...bruteForceSubsets(tail, size - 1).map((rest) => [head!, ...rest]),
    ...bruteForceSubsets(tail, size),
  ];
}

function bruteForcePermutations<T>(values: readonly T[]): T[][] {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    bruteForcePermutations([...values.slice(0, index), ...values.slice(index + 1)]).map(
      (rest) => [value, ...rest],
    ),
  );
}

describe("evidence-aware deterministic formation evaluator", () => {
  it("keeps the three investment layers separate and calculates exact pinned parameters", () => {
    const publicCard = publicCardById.get(GEN_ZERO_MEMBERS[0])!;
    const mechanics = mechanicsCardById.get(GEN_ZERO_MEMBERS[0])!;

    const low = calculateCardProgression(publicCard, mechanics, "low-investment");
    const oneCopy = calculateCardProgression(publicCard, mechanics, "one-copy-maximum");
    const ceiling = calculateCardProgression(
      publicCard,
      mechanics,
      "duplicate-enabled-ceiling",
    );

    expect(low).toMatchObject({
      layer: "low-investment",
      evidenceGrade: "verified",
      state: { level: 1, activeSkillLevel: 1, allParameterPermilUp: 0 },
      parameterBaseValue: 5_225,
      liveDeckPowerPermyriadUp: 0,
      parameters: { performance: 1_375, technique: 1_552, sense: 2_299 },
    });
    expect(oneCopy.parameters).toEqual(publicCard.parameters.oneCopyMaxLevel);
    expect(ceiling.parameters).toEqual(publicCard.parameters.maxPotential);
    expect(oneCopy.state).not.toEqual(ceiling.state);
  });

  it("requires one Leader/Outfit and exactly five ordered, unique-talent Members", () => {
    const legal = assertLegalFormation(formation);
    expect(legal.leaderOutfit.talentId).toBe("chr-00011");
    expect(legal.members.map((member) => member.publicCard.id)).toEqual(GEN_ZERO_MEMBERS);

    const leaderRepeatsMember: FormationInput = {
      ...formation,
      leaderOutfitCardId: GEN_ZERO_MEMBERS[0],
    };
    expect(() => assertLegalFormation(leaderRepeatsMember)).not.toThrow();

    expect(() =>
      assertLegalFormation({ ...formation, members: formation.members.slice(0, 4) }),
    ).toThrow(/exactly five/i);

    const repeatedTalent = [
      ...formation.members.slice(0, 4),
      { cardId: "card-00013-4-cmmn-0000-00", investment: "one-copy-maximum" },
    ] as FormationMember[];
    expect(() => assertLegalFormation({ ...formation, members: repeatedTalent })).toThrow(
      /unique talents/i,
    );
  });

  it("enumerates every plausible capped target subset and reports an interval", () => {
    const legal = assertLegalFormation(formation);
    const azki = mechanicsCardById.get(GEN_ZERO_MEMBERS[0])!;
    const target = azki.skills.passive
      .find((level) => level.level === 2)!
      .applications[0]!.target!;

    const resolution = resolveTargetRecipients(target, legal.members, 0);
    const reference = bruteForceSubsets([0, 1, 2, 3, 4], 2);

    expect(resolution).toEqual({
      status: "enumerated",
      evidenceGrade: "unresolved",
      eligibleMemberIndexes: [0, 1, 2, 3, 4],
      alternatives: reference,
      recipientCount: { minimum: 2, maximum: 2 },
      recipientIntervalByMember: [0, 1, 2, 3, 4].map((memberIndex) => ({
        memberIndex,
        minimum: 0,
        maximum: 1,
      })),
    });
    expect(resolution.alternatives).toHaveLength(10);
    expect(new Set(resolution.alternatives.map((choice) => choice.join(",")))).toEqual(
      new Set(reference.map((choice) => choice.join(","))),
    );
  });

  it("replaces an Active base value when its condition passes instead of adding it", () => {
    const legal = assertLegalFormation(formation);
    const azki = mechanicsCardById.get(GEN_ZERO_MEMBERS[0])!;
    const applications = azki.skills.active.find((level) => level.level === 2)!.applications;

    const passing = resolveActiveApplications(applications, legal, { life: 700 });
    const failing = resolveActiveApplications(applications, legal, { life: 500 });
    const unknown = resolveActiveApplications(applications, legal, {});

    expect(passing.alternatives).toHaveLength(1);
    expect(passing.alternatives[0]!.map((application) => application.effect?.value)).toEqual([
      1_200,
    ]);
    expect(failing.alternatives[0]!.map((application) => application.effect?.value)).toEqual([
      600,
    ]);
    expect(unknown.status).toBe("provisional");
    expect(
      unknown.alternatives
        .map((alternative) => alternative[0]!.effect?.value)
        .sort((left, right) => left! - right!),
    ).toEqual([600, 1_200]);
  });

  it("keeps both conditional Leader effects when their shared trigger passes", () => {
    const legal = assertLegalFormation(formation);
    const resolved = resolveLeaderApplications(
      legal.leaderOutfit.mechanics.leaderOutfit.applications,
      legal,
      {},
    );

    expect(resolved.status).toBe("resolved");
    expect(resolved.alternatives).toHaveLength(1);
    expect(resolved.alternatives[0]!.map((application) => application.effect?.kind)).toEqual([
      "all-parameters-up",
      "active-skill-effect-up",
    ]);
  });

  it("enumerates all 120 Special orders and matches a separate brute-force reference", () => {
    const expected = bruteForcePermutations([...GEN_ZERO_MEMBERS]);
    const actual = enumerateSpecialOrders([...GEN_ZERO_MEMBERS]);

    expect(actual).toHaveLength(120);
    expect(new Set(actual.map((order) => order.join(",")))).toEqual(
      new Set(expected.map((order) => order.join(","))),
    );
    expect(actual[0]).toEqual(GEN_ZERO_MEMBERS);
  });

  it("is deterministic under fixed seeds and labels activation checks as modeled", () => {
    const inputs = [
      {
        cardId: GEN_ZERO_MEMBERS[0],
        cooldownMilliseconds: 20_000,
        durationMilliseconds: 7_000,
        activationProbabilityPermil: 550,
      },
      {
        cardId: GEN_ZERO_MEMBERS[1],
        cooldownMilliseconds: 24_000,
        durationMilliseconds: 8_000,
        activationProbabilityPermil: 460,
      },
    ];

    const first = simulateModeledActiveChecks(inputs, {
      liveDurationMilliseconds: 180_000,
      trials: 100,
      seed: 0x5eed,
    });
    const second = simulateModeledActiveChecks(inputs, {
      liveDurationMilliseconds: 180_000,
      trials: 100,
      seed: 0x5eed,
    });
    const differentSeed = simulateModeledActiveChecks(inputs, {
      liveDurationMilliseconds: 180_000,
      trials: 100,
      seed: 0x5eee,
    });

    expect(first).toEqual(second);
    expect(first).not.toEqual(differentSeed);
    expect(first).toMatchObject({
      status: "provisional",
      evidenceGrade: "modeled",
      assumptions: {
        firstCheck: "one-cooldown-after-live-start",
        collisions: "independent-unstacked",
      },
    });
  });

  it("hard-fails verified-only evaluation but returns provisional, scoreless breakdowns", () => {
    const chart = songContextData.charts[0]!;
    const song = songContextData.songs.find((candidate) => candidate.id === chart.songId)!;

    expect(() =>
      evaluateFormation(formation, {
        chart,
        song,
        policy: verifiedOnlyRuntimePolicy(1),
        accountState: unavailableAccountState,
        observation: { combo: 100, life: 1_000, songSingerTalentIds: song.singerTalentIds },
      }),
    ).toThrow(/runtime-score-equation.*timed-note-events/i);

    const result = evaluateFormation(formation, {
      chart,
      song,
      policy: provisionalRuntimePolicy(1, 20),
      accountState: unavailableAccountState,
      observation: { combo: 100, life: 1_000, songSingerTalentIds: song.singerTalentIds },
    });

    expect(result.status).toBe("provisional");
    expect(result.absoluteScore).toBeNull();
    expect(result.absoluteScoreAllowed).toBe(false);
    expect(result.evidence.runtimeEquation.grade).toBe("unresolved");
    expect(result.evidence.timeline.grade).toBe("unresolved");
    expect(result.context).toEqual({
      kind: "exact-chart",
      id: chart.key,
      songId: song.id,
      songTitle: song.title,
      difficulty: chart.difficulty,
      fidelity: "aggregate",
      claimCapabilities: {
        canProduceAbsoluteScore: false,
        canClaimExactPerSongOptimum: false,
        reason: "aggregate-chart-has-no-note-timeline",
      },
    });
    expect(result.special.formations).toHaveLength(120);
    expect(result.special.currentOrder).toEqual(GEN_ZERO_MEMBERS);
    expect(result.special.windows).toBeNull();
    expect(result.members).toHaveLength(5);
    expect(result.contributions.leader).toHaveLength(2);
    expect(result.contributions.passive.some((entry) => entry.recipients?.status === "enumerated"))
      .toBe(true);
    expect(result.contributions.connect).toHaveLength(5);
    expect(result.contributions.connect.every((entry) => entry.appliedBoardContribution === null))
      .toBe(true);
    expect(result.contributions.board).toEqual({
      status: "unavailable",
      appliedContribution: null,
      neutralContributionDeclared: false,
      evidenceGrade: "unresolved",
      evidenceRef: null,
    });
    expect(result.components.accountState.board.mode).toBe("unavailable");
    expect(result.components.stacking).toMatchObject({
      status: "unapplied",
      policy: "individual-effects-only",
      evidence: { grade: "unresolved", ruleId: "effect-stacking-and-rounding" },
    });
    expect(result.components.targetCaps).toMatchObject({
      policy: "enumerate-all-eligible-subsets",
      evidence: { grade: "unresolved", ruleId: "passive-target-selection-order" },
    });
  });

  it("applies no implicit Board value and accepts only an explicitly evidenced neutral state", () => {
    const chart = songContextData.charts[0]!;
    const song = songContextData.songs.find((candidate) => candidate.id === chart.songId)!;
    const result = evaluateFormation(formation, {
      chart,
      song,
      policy: provisionalRuntimePolicy(12, 5),
      accountState: {
        board: {
          mode: "declared-neutral",
          evidenceGrade: "verified",
          evidenceRef: "fixture:verified-empty-board",
        },
      },
    });

    expect(result.blockers).not.toContain("board-account-state-unavailable");
    expect(result.contributions.board).toEqual({
      status: "declared-neutral",
      appliedContribution: 0,
      neutralContributionDeclared: true,
      evidenceGrade: "verified",
      evidenceRef: "fixture:verified-empty-board",
    });
    expect(result.contributions.connect.every((entry) => entry.appliedBoardContribution === 0))
      .toBe(true);
  });

  it("uses evidence-backed timed Special markers in the exact current formation order", () => {
    const aggregate = songContextData.charts[0]!;
    const song = songContextData.songs.find((candidate) => candidate.id === aggregate.songId)!;
    const markers = [8_000, 18_000, 31_000, 43_000, 55_000] as const;
    const timed = TimedChartContextSchema.parse({
      fidelity: "timed",
      key: aggregate.key,
      songId: aggregate.songId,
      difficulty: aggregate.difficulty,
      level: aggregate.level,
      chartAssetId: aggregate.chartAssetId,
      chartHash: aggregate.chartHash,
      events: [
        {
          atMilliseconds: 1_000,
          noteType: "normal",
          comboDelta: 1,
          scoreCoefficientPermilMultiply: 1_000,
          lifeReductionOnMiss: 0,
        },
      ],
      specialMarkerMilliseconds: markers,
      source: aggregate.sources.aggregate,
    });

    const result = evaluateFormation(formation, {
      chart: timed,
      song,
      policy: provisionalRuntimePolicy(22, 5),
      accountState: unavailableAccountState,
    });

    expect(result.context).toMatchObject({ id: timed.key, fidelity: "timed" });
    expect(result.special.windows?.map((window) => window.memberCardId)).toEqual(
      GEN_ZERO_MEMBERS,
    );
    expect(result.special.windows?.map((window) => window.startsAtMilliseconds)).toEqual(markers);
    expect(result.components.timing.specialWindows).toBe("verified");
  });
});
