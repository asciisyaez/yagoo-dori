import { describe, expect, it } from "vitest";

import {
  classifyGuideSongComparison,
  countGuideSongAlternatives,
  type GuideSongComparisonSummary,
} from "./guide-song-alternatives";

const STANDARD_ORDER = ["member-a", "member-b", "member-c", "member-d", "member-e"];

function comparison(
  overrides: Partial<GuideSongComparisonSummary> = {},
): GuideSongComparisonSummary {
  return {
    noteTimeline: "unavailable",
    changesReferenceFormation: false,
    orderStatus: "indeterminate",
    formationOrder: STANDARD_ORDER,
    ...overrides,
  };
}

describe("guide song alternative display classification", () => {
  it("counts an unavailable robust formation change without treating it as placement", () => {
    const unavailableFormationChange = comparison({ changesReferenceFormation: true });

    expect(
      classifyGuideSongComparison(unavailableFormationChange, STANDARD_ORDER),
    ).toBe("formation");
    expect(
      countGuideSongAlternatives([unavailableFormationChange], STANDARD_ORDER),
    ).toBe(1);
  });

  it("allows placement labels only for exact timed order changes", () => {
    const unavailableOrderChange = comparison({
      changesReferenceFormation: false,
      formationOrder: [...STANDARD_ORDER].reverse(),
    });
    const exactOrderChange = comparison({
      noteTimeline: "exact",
      orderStatus: "timed-corpus",
      formationOrder: [...STANDARD_ORDER].reverse(),
    });

    expect(
      classifyGuideSongComparison(unavailableOrderChange, STANDARD_ORDER),
    ).toBe("standard");
    expect(classifyGuideSongComparison(exactOrderChange, STANDARD_ORDER)).toBe("placement");
  });
});
