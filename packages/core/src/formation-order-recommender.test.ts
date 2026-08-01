import { describe, expect, it } from "vitest";

import { TEAM_CALCULATOR_CORPUS } from "./team-calculator";
import {
  FORMATION_ORDER_TINY_MARGIN_PERMIL,
  buildFormationOrderMarkerLayouts,
  formationOrderConfidenceFromGap,
  manualPerfectNoteCoefficientPermil,
  modeledComboThresholdMilliseconds,
  recommendFormationOrder,
  type FormationOrderRecommenderInput,
} from "./formation-order-recommender";
import { songContextData } from "./song-contexts";

const TIED_SPECIAL_MEMBERS = [
  { cardId: "card-00001-4-cmmn-0000-00", bloomStage: 0 as const }, // Sora
  { cardId: "card-00004-4-cmmn-0000-00", bloomStage: 0 as const }, // Aki
  { cardId: "card-00010-4-cmmn-0000-00", bloomStage: 0 as const }, // Mel
  { cardId: "card-00011-4-cmmn-0000-00", bloomStage: 0 as const }, // Matsuri
  { cardId: "card-00012-4-cmmn-0000-00", bloomStage: 0 as const }, // Subaru
] as const;

const COMBO_GATE_MEMBERS = [
  TIED_SPECIAL_MEMBERS[0],
  TIED_SPECIAL_MEMBERS[1],
  TIED_SPECIAL_MEMBERS[2],
  TIED_SPECIAL_MEMBERS[3],
  { cardId: "card-00017-5-uniq-0015-00", bloomStage: 3 as const }, // Korone: Combo 100 activation boost
] as const;

function input(
  members: FormationOrderRecommenderInput["members"],
): FormationOrderRecommenderInput {
  return {
    leaderOutfitCardId: members[0].cardId,
    members,
    corpus: TEAM_CALCULATOR_CORPUS.entries,
  };
}

describe("formation-order recommender", () => {
  it("uses deterministic ordered marker samples plus explicit stress layouts", () => {
    const first = buildFormationOrderMarkerLayouts();
    const second = buildFormationOrderMarkerLayouts();

    expect(first).toEqual(second);
    expect(first).toHaveLength(14);
    expect(first.filter((layout) => layout.family === "low-discrepancy")).toHaveLength(8);
    expect(first.filter((layout) => layout.family === "stress")).toHaveLength(6);
    expect(first.map((layout) => layout.id)).toContain("stress-late");
    for (const layout of first) {
      expect(layout.markerPositionsPermillion).toHaveLength(5);
      expect(layout.markerPositionsPermillion).toEqual(
        [...layout.markerPositionsPermillion!].sort((left, right) => left - right),
      );
      expect(new Set(layout.markerPositionsPermillion)).toHaveLength(5);
    }
    // With midpoint-uniform notes, Combo 40 begins on the 40th note, not at
    // the segment containing the 39th note.
    expect(modeledComboThresholdMilliseconds(100, 100_000, 40)).toBe(39_500);
  });

  it("checks all 120 orders against exact timed notes and five pinned Special markers per chart", () => {
    const result = recommendFormationOrder(input(COMBO_GATE_MEMBERS));
    const repeated = recommendFormationOrder(input(COMBO_GATE_MEMBERS));

    expect(result).toEqual(repeated);
    expect(result.kind).toBe("timed-corpus");
    expect(result.label).toBe("Chart-timed corpus order");
    expect(result.method.permutationsChecked).toBe(120);
    expect(result.scenarios).toMatchObject({
      count: 30,
      chartCount: 30,
      layoutCount: 1,
      lowDiscrepancyLayoutCount: 0,
      stressLayoutCount: 0,
    });
    expect(new Set(result.order)).toEqual(
      new Set(COMBO_GATE_MEMBERS.map((member) => member.cardId)),
    );

    const korone = result.components.find(
      (component) => component.cardId === "card-00017-5-uniq-0015-00",
    );
    expect(korone).toMatchObject({
      bloomStage: 3,
      active: { level: 2 },
      special: {
        level: 2,
        comboGateThresholds: [100],
      },
    });
    expect(korone!.recommendedSlot).toBeGreaterThanOrEqual(1);
    expect(result.objective.diagnostics.endClippedSpecialWindows).toBeGreaterThan(0);
    expect(result.objective.diagnostics.activationBoostedActiveChecks).toBeGreaterThan(0);
    expect(
      result.components.some(
        (component) => component.active.persistentSupportPermilAcrossCorpus.maximum > 0,
      ),
    ).toBe(true);

    expect(result.method.exactTimelineAvailable).toBe(true);
    expect(result.method.noteTimelineAvailable).toBe(true);
    expect(result.method.changesModeledTimingUtility).toBe(true);
    expect(result.method.activeConditionalBreakpoints).toBe(
      "exact-note-combo-threshold-events",
    );
    expect(result.method.persistentSupportRecipients).toBe("guaranteed-recipient-floor");
    expect(result.exactTimelineStatement).toContain("pinned timed note events");
    expect(result.exactTimelineStatement).toContain("not an absolute Live Score claim");
    expect(result.objective.perChartDiagnostics).toHaveLength(30);
    expect(
      result.objective.perChartDiagnostics.every(
        (diagnostic) =>
          diagnostic.markerMilliseconds.length === 5 &&
          /^[a-f0-9]{64}$/.test(diagnostic.timelineSusSha256) &&
          /^[a-f0-9]{64}$/.test(diagnostic.timelineMetadataSha256),
      ),
    ).toBe(true);
    expect(
      result.scenarios.charts.every(
        (chart) => chart.timelineSusSha256 !== null && chart.timelineMetadataSha256 !== null,
      ),
    ).toBe(true);
    expect(manualPerfectNoteCoefficientPermil(0)).toBe(1_000); // normal
    expect(manualPerfectNoteCoefficientPermil(1)).toBe(1_050); // flick
    expect(manualPerfectNoteCoefficientPermil(5)).toBe(100); // long continuation
    expect(
      result.objective.perChartDiagnostics.some((diagnostic) => {
        const chart = result.scenarios.charts.find(
          (candidate) => candidate.chartKey === diagnostic.chartKey,
        )!;
        return diagnostic.noteCoefficientTotalPermil !== chart.noteCount * 1_000;
      }),
    ).toBe(true);
  });

  it("uses modeled layouts only when a requested exact timeline is absent", () => {
    const corpusKeys = new Set(TEAM_CALCULATOR_CORPUS.entries.map((entry) => entry.chartKey));
    const replacement = songContextData.charts.find(
      (chart) => chart.difficulty === "expert" && !corpusKeys.has(chart.key),
    )!;
    const fallbackCorpus = [
      ...TEAM_CALCULATOR_CORPUS.entries.slice(0, -1),
      { chartKey: replacement.key, expectedChartHash: replacement.chartHash },
    ];
    const result = recommendFormationOrder({
      ...input(COMBO_GATE_MEMBERS),
      corpus: fallbackCorpus,
    });

    expect(result.kind).toBe("modeled-general");
    expect(result.scenarios).toMatchObject({ count: 420, layoutCount: 14 });
    expect(result.method).toMatchObject({
      exactTimelineAvailable: false,
      noteTimelineAvailable: false,
      changesModeledTimingUtility: false,
    });
    expect(result.objective.perChartDiagnostics).toEqual([]);
  });

  it("reports an actual order-equivalent roster and tiny synthetic gaps as indeterminate", () => {
    const result = recommendFormationOrder(input(TIED_SPECIAL_MEMBERS));

    expect(result.status).toBe("indeterminate");
    expect(result.confidence.kind).toBe("indeterminate");
    expect(result.objective.runnerUpGapBasis).toBe("tie");
    expect(result.objective.runnerUpGapPermil).toBe(0);
    expect(formationOrderConfidenceFromGap(0)).toBe("indeterminate");
    expect(formationOrderConfidenceFromGap(FORMATION_ORDER_TINY_MARGIN_PERMIL)).toBe(
      "indeterminate",
    );
    expect(
      formationOrderConfidenceFromGap(FORMATION_ORDER_TINY_MARGIN_PERMIL + 0.000_001),
    ).toBe("modeled-general");
  });
});
