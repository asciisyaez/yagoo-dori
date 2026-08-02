import type { NativeGuide } from "./native-guide-schema";

type RatingSongComparison = NativeGuide["ratingSongComparisons"][number];

export type ObservedGuideSongBreakpoint = Readonly<{
  kind: "formation" | "placement";
  from: RatingSongComparison;
  to: RatingSongComparison;
  durationGapMilliseconds: number;
}>;

function formationSignature(comparison: RatingSongComparison): string {
  return [
    comparison.leaderOutfitCardId,
    [...comparison.members].sort().join("|"),
  ].join("|");
}

function placementSignature(comparison: RatingSongComparison): string {
  return comparison.formationOrder.join("|");
}

/**
 * Finds recommendation changes between adjacent, duration-sorted published charts.
 * Both sides must clear the exact-timeline tiny-margin gate; indeterminate rows
 * cannot establish a breakpoint. Different charts also have different note
 * patterns, so callers must present these as observed transitions rather than a
 * universal duration threshold.
 */
export function observedGuideSongBreakpoints(
  guide: Pick<NativeGuide, "ratingSongComparisons">,
): readonly ObservedGuideSongBreakpoint[] {
  const rows = [...guide.ratingSongComparisons].sort(
    (left, right) =>
      left.durationMilliseconds - right.durationMilliseconds ||
      left.chartKey.localeCompare(right.chartKey),
  );
  const transitions: ObservedGuideSongBreakpoint[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const from = rows[index - 1]!;
    const to = rows[index]!;
    if (from.orderStatus !== "timed-corpus" || to.orderStatus !== "timed-corpus") continue;
    const formationChanged = formationSignature(from) !== formationSignature(to);
    const placementChanged = placementSignature(from) !== placementSignature(to);
    if (!formationChanged && !placementChanged) continue;
    transitions.push({
      kind: formationChanged ? "formation" : "placement",
      from,
      to,
      durationGapMilliseconds: to.durationMilliseconds - from.durationMilliseconds,
    });
  }
  return transitions;
}
