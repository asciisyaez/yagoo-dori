import type { NativeGuide } from "@yagoo-dori/core";

type GuideSongComparison = NativeGuide["ratingSongComparisons"][number];

export type GuideSongComparisonSummary = Pick<
  GuideSongComparison,
  "noteTimeline" | "changesReferenceFormation" | "orderStatus" | "formationOrder"
>;

export type GuideSongAlternativeKind = "formation" | "placement" | "standard";

export function classifyGuideSongComparison(
  comparison: GuideSongComparisonSummary,
  standardFormationOrder: readonly string[],
): GuideSongAlternativeKind {
  if (comparison.changesReferenceFormation) return "formation";
  if (
    comparison.noteTimeline === "exact" &&
    comparison.orderStatus === "timed-corpus" &&
    comparison.formationOrder.join("|") !== standardFormationOrder.join("|")
  ) {
    return "placement";
  }
  return "standard";
}

export function countGuideSongAlternatives(
  comparisons: readonly GuideSongComparisonSummary[],
  standardFormationOrder: readonly string[],
) {
  return comparisons.filter(
    (comparison) => classifyGuideSongComparison(comparison, standardFormationOrder) !== "standard",
  ).length;
}
