import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  SHADOW_COMBO_GROUP_ID,
  SHADOW_LIVE_START_IDLE_MILLISECONDS,
  compileShadowChart,
  composeShadowCentral,
  evaluateShadowTiming,
  type ExactTimelineShadowVariant,
  type ShadowMemberProfile,
  type ShadowTimelineEvent,
} from "./exact-timeline-shadow";

// ---------------------------------------------------------------------------
// Hand-calculated fixture. Chart: 10,000 ms, four notes at 1s/3s/6s/9s with
// note types [normal, long-continuation, normal, flick]. Five Special markers
// at 2s/4s/5s/7s/8s. One live member:
//   scoreUp 100‰, cooldown 4,000 ms (checks at 4s→[4,6) and 8s→[8,10)),
//   activation probability 500‰, Active duration 2,000 ms.
// Support member (index 1): Special score support 200‰ over 5,000 ms.
// All expectations below were derived by hand from these numbers before
// running the implementation.
// ---------------------------------------------------------------------------

const CHART_DURATION_MS = 10_000;

const EXACT_EVENTS: readonly ShadowTimelineEvent[] = [
  [1_000_000, 0, 0],
  [3_000_000, 5, 0],
  [6_000_000, 0, 0],
  [9_000_000, 1, 1],
];

// Events placed exactly on the uniform midpoints (1250/3750/6250/8750 ms),
// all normal notes: exact timing must reproduce uniform timing.
const MIDPOINT_EVENTS: readonly ShadowTimelineEvent[] = [
  [1_250_000, 0, 0],
  [3_750_000, 0, 0],
  [6_250_000, 0, 0],
  [8_750_000, 0, 0],
];

const SPECIAL_MARKERS_US = [2_000_000, 4_000_000, 5_000_000, 7_000_000, 8_000_000] as const;
// Notes strictly before each marker: 1, 2, 2, 3, 3.
const SPECIAL_STARTS = [1, 2, 2, 3, 3] as const;

const VARIANTS: Record<string, ExactTimelineShadowVariant> = {
  uniformBaseline: {
    noteTiming: "uniform",
    noteWeights: "unit",
    comboBonus: "off",
    liveStartIdle: "off",
    specialWindows: "duration-coverage",
  },
  exactTiming: {
    noteTiming: "exact",
    noteWeights: "unit",
    comboBonus: "off",
    liveStartIdle: "off",
    specialWindows: "exact-markers",
  },
  exactWeighted: {
    noteTiming: "exact",
    noteWeights: "manual-perfect-coefficients",
    comboBonus: "off",
    liveStartIdle: "off",
    specialWindows: "exact-markers",
  },
  exactWeightedCombo: {
    noteTiming: "exact",
    noteWeights: "manual-perfect-coefficients",
    comboBonus: "live-combo-1",
    liveStartIdle: "off",
    specialWindows: "exact-markers",
  },
  combined: {
    noteTiming: "exact",
    noteWeights: "manual-perfect-coefficients",
    comboBonus: "live-combo-1",
    liveStartIdle: "pinned-3000ms",
    specialWindows: "exact-markers",
  },
};

function inertProfile(overrides?: Partial<{ scoreSupportPermil: number; specialDurationMilliseconds: number }>): ShadowMemberProfile {
  return {
    active: {
      scoreUpPermil: 0,
      cooldownMilliseconds: CHART_DURATION_MS,
      durationMilliseconds: 1,
      activationProbabilityPermil: 0,
      persistentSupportPermil: 0,
    },
    special: {
      durationMilliseconds: overrides?.specialDurationMilliseconds ?? 1,
      scoreSupportPermil: overrides?.scoreSupportPermil ?? 0,
      activationRateUpPermil: 0,
    },
  };
}

function liveMember(): ShadowMemberProfile {
  return {
    cardId: "live-member",
    active: {
      scoreUpPermil: 100,
      cooldownMilliseconds: 4_000,
      durationMilliseconds: 2_000,
      activationProbabilityPermil: 500,
      persistentSupportPermil: 0,
    },
    special: {
      durationMilliseconds: 1_000,
      scoreSupportPermil: 0,
      activationRateUpPermil: 0,
    },
  };
}

function fixtureProfiles(): ShadowMemberProfile[] {
  return [
    liveMember(),
    inertProfile({ scoreSupportPermil: 200, specialDurationMilliseconds: 5_000 }),
    inertProfile(),
    inertProfile(),
    // Marker 5 sits at 8s; a 5s Special runs past the chart end → clipped.
    inertProfile({ specialDurationMilliseconds: 5_000 }),
  ];
}

function chartInput(events: readonly ShadowTimelineEvent[] | undefined) {
  return {
    chartKey: "hand-fixture:expert",
    durationMilliseconds: CHART_DURATION_MS,
    fullComboNoteCount: 4,
    ...(events
      ? { events, specialMarkerMicroseconds: SPECIAL_MARKERS_US, specialStartsAtCombo: SPECIAL_STARTS }
      : {}),
  };
}

describe("exact-timeline shadow evaluator", () => {
  it("pins the idle length to the catalog rule, not prose", () => {
    expect(SHADOW_LIVE_START_IDLE_MILLISECONDS).toBe(3_000);
    expect(SHADOW_COMBO_GROUP_ID).toBe("live_combo-1");
  });

  it("scores the exact-timing hand fixture: only the 9s note is covered (12.5‰)", () => {
    // Checks [4,6) and [8,10): notes at 1s/3s/6s uncovered (a check ending AT
    // the note time does not cover it); the 9s note sees one 500‰ check.
    // Member-2's Special window is markers[1]=4s → [4s,9s): the 9s note is
    // excluded (half-open window), so value = 100 × 1000/1000 = 100 and
    // E[max] = 0.5 × 100 = 50. Timing = (1000×50)/(4×1000) = 12.5.
    const chart = compileShadowChart(chartInput(EXACT_EVENTS), VARIANTS.exactTiming!);
    const result = evaluateShadowTiming(fixtureProfiles(), chart);
    expect(result.timingPermil).toBe(12.5);
    expect(result.diagnostics.noteCount).toBe(4);
    expect(result.diagnostics.specialWindows).toBe(5);
    expect(result.diagnostics.endClippedWindows).toBe(1);
  });

  it("scores the uniform baseline hand fixture with coverage Specials (13.75‰)", () => {
    // Uniform notes 1250/3750/6250/8750 ms; only 8750 is covered (P = 0.5).
    // Member-2 coverage = 5000/10000 = 0.5 → +100‰ support on every note:
    // value = 100 × (1000+100)/1000 = 110, E[max] = 55 → 13.75‰.
    const chart = compileShadowChart(chartInput(undefined), VARIANTS.uniformBaseline!);
    const result = evaluateShadowTiming(fixtureProfiles(), chart);
    expect(result.timingPermil).toBe(13.75);
  });

  it("weights the covered flick note by the pinned manual-Perfect coefficient (16.666667‰)", () => {
    // The only scoring note (9s) is a flick. Normalization is the chart's
    // weighted note mass (weights redistribute importance, they must not
    // change the Active-vs-base scale): 1050‰ × 50 / (1000+100+1000+1050)
    // = 52,500 / 3,150 = 16.6̄ → 16.666667 at six decimals.
    const chart = compileShadowChart(chartInput(EXACT_EVENTS), VARIANTS.exactWeighted!);
    expect(chart.noteWeightsPermil).toEqual([1_000, 100, 1_000, 1_050]);
    const result = evaluateShadowTiming(fixtureProfiles(), chart);
    expect(result.timingPermil).toBe(16.666667);
  });

  it("keeps unit-weight normalization identical to the per-note mean", () => {
    // For unit weights the mass is noteCount×1000, so the weighted-mass
    // normalization must reproduce the plain per-note average production
    // uses — pinning that A′/B are unaffected by the normalization rule.
    const chart = compileShadowChart(chartInput(EXACT_EVENTS), VARIANTS.exactTiming!);
    expect(chart.noteWeightPrefixPermil.at(-1)).toBe(4_000);
    expect(evaluateShadowTiming(fixtureProfiles(), chart).timingPermil).toBe(12.5);
  });

  it("leaves low-combo charts unchanged and applies the first combo breakpoint at 100 prior notes", () => {
    // Convention under test: a note's combo count at scoring is the number
    // of notes strictly before it. The pinned live_combo-1 table grants
    // +10‰ from combo 100 — so note index 99 (99 prior) stays at 1000‰
    // and note index 100 (100 prior) becomes 1010‰.
    const lowCombo = compileShadowChart(chartInput(EXACT_EVENTS), VARIANTS.exactWeightedCombo!);
    expect(lowCombo.noteWeightsPermil).toEqual([1_000, 100, 1_000, 1_050]);

    const manyEvents: ShadowTimelineEvent[] = Array.from(
      { length: 150 },
      (_, index) => [(index + 1) * 50_000, 0, 0] as const,
    );
    const bigChart = compileShadowChart(
      {
        chartKey: "combo-fixture:expert",
        durationMilliseconds: CHART_DURATION_MS,
        fullComboNoteCount: 150,
        events: manyEvents,
        specialMarkerMicroseconds: [100_000, 200_000, 300_000, 400_000, 500_000],
      },
      VARIANTS.exactWeightedCombo!,
    );
    expect(bigChart.noteWeightsPermil[99]).toBe(1_000);
    expect(bigChart.noteWeightsPermil[100]).toBe(1_010);
    expect(bigChart.noteWeightsPermil[149]).toBe(1_010);
  });

  it("delays the Active clock by the pinned idle: the 9s note loses its check (0‰)", () => {
    // With the 3s idle the checks move to 7s→[7,9) and 11s (past the end):
    // a window ending AT 9s does not cover the 9s note, so nothing scores.
    const chart = compileShadowChart(chartInput(EXACT_EVENTS), VARIANTS.combined!);
    const result = evaluateShadowTiming(fixtureProfiles(), chart);
    expect(result.timingPermil).toBe(0);
  });

  it("reproduces uniform timing exactly when exact events sit on the uniform midpoints", () => {
    // Zero-Special profiles make the coverage-vs-marker difference value-
    // neutral, isolating pure note timing.
    const noSpecialProfiles = [liveMember(), inertProfile(), inertProfile(), inertProfile(), inertProfile()];
    const uniform = evaluateShadowTiming(
      noSpecialProfiles,
      compileShadowChart(chartInput(undefined), VARIANTS.uniformBaseline!),
    );
    const exact = evaluateShadowTiming(
      noSpecialProfiles,
      compileShadowChart(chartInput(MIDPOINT_EVENTS), VARIANTS.exactTiming!),
    );
    expect(exact.timingPermil).toBe(uniform.timingPermil);

    // And the real fixture intentionally differs between the two models.
    const uniformFull = evaluateShadowTiming(
      fixtureProfiles(),
      compileShadowChart(chartInput(undefined), VARIANTS.uniformBaseline!),
    );
    const exactFull = evaluateShadowTiming(
      fixtureProfiles(),
      compileShadowChart(chartInput(EXACT_EVENTS), VARIANTS.exactTiming!),
    );
    expect(exactFull.timingPermil).not.toBe(uniformFull.timingPermil);
  });

  it("is deterministic and invariant to reordering the inert members", () => {
    const chart = compileShadowChart(chartInput(EXACT_EVENTS), VARIANTS.exactWeighted!);
    const first = evaluateShadowTiming(fixtureProfiles(), chart);
    const second = evaluateShadowTiming(fixtureProfiles(), chart);
    expect(first).toEqual(second);

    // Members 1 and 4 carry Special windows tied to marker order, so keep
    // them in place; the zero-Special members at indices 2/3 are
    // interchangeable and must not affect the result.
    const profiles = fixtureProfiles();
    const reordered = [profiles[0]!, profiles[1]!, profiles[3]!, profiles[2]!, profiles[4]!];
    expect(evaluateShadowTiming(reordered, chart).timingPermil).toBe(first.timingPermil);
  });

  it("rejects malformed inputs instead of guessing", () => {
    expect(() => compileShadowChart(chartInput(undefined), VARIANTS.exactTiming!)).toThrow(
      /requires injected timeline events/,
    );
    const { specialMarkerMicroseconds: _dropped, ...withoutMarkers } = chartInput(EXACT_EVENTS);
    expect(() => compileShadowChart(withoutMarkers, VARIANTS.exactTiming!)).toThrow(
      /five pinned marker timestamps/,
    );
    expect(() =>
      compileShadowChart(
        { ...chartInput(EXACT_EVENTS), specialStartsAtCombo: [0, 2, 2, 3, 3] },
        VARIANTS.exactTiming!,
      ),
    ).toThrow(/does not match pinned events/);
    expect(() =>
      compileShadowChart(chartInput(EXACT_EVENTS), {
        ...VARIANTS.exactTiming!,
        specialWindows: "duration-coverage",
      }),
    ).toThrow(/Exact shadow timing requires exact-marker Specials/);
    const outOfOrder: ShadowTimelineEvent[] = [
      [2_000_000, 0, 0],
      [1_000_000, 0, 0],
      [6_000_000, 0, 0],
      [9_000_000, 0, 0],
    ];
    expect(() =>
      compileShadowChart({ ...chartInput(outOfOrder) }, VARIANTS.exactTiming!),
    ).toThrow(/chronological/);
  });

  it("composes the shadow central from production components by hand", () => {
    // 100 base + 20 parameter effects + 12.5‰ of baseTotal 4000 = 170.
    expect(
      composeShadowCentral({
        baseParametersRelativeUnitsCentral: 100,
        parameterEffectsRelativeUnitsCentral: 20,
        baseTotal: 4_000,
        shadowTimingPermil: 12.5,
      }),
    ).toBe(170);
  });

  it("exposes the required architectural boundary in source text", () => {
    const source = readFileSync(new URL("./exact-timeline-shadow.ts", import.meta.url), "utf8");
    const imports = source.match(/^import[\s\S]*?from\s+["'][^"']+["'];/gm)?.join("\n") ?? "";
    // The 28 MB corpus loader, generated-data files, and the production
    // search/optimizer stack must stay out of this module's import graph.
    expect(imports).not.toMatch(/chart-timelines"|public-data|ranking|team-calculator|exact-optimizer|data\//);
    expect(imports).toMatch(/score-kernel/);
    expect(imports).toMatch(/song-contexts/);
    expect(source).not.toMatch(new RegExp(["Math", "random"].join("\\.")));
    expect(source).not.toMatch(/toBeCloseTo/);
  });
});
