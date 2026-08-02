import { describe, expect, it } from "vitest";

import { nativeGuideData } from "./native-guide-data";
import { observedGuideSongBreakpoints } from "./guide-song-breakpoints";

describe("observed exact-song timing breakpoints", () => {
  it("publishes only meaningful adjacent exact-timeline changes", () => {
    const transitions = nativeGuideData.guides.flatMap((guide) =>
      observedGuideSongBreakpoints(guide).map((transition) => ({
        anchorCardId: guide.anchorCardId,
        ...transition,
      })),
    );

    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({
      anchorCardId: "card-00019-5-uniq-0016-00",
      kind: "placement",
      durationGapMilliseconds: 15_000,
      from: { chartKey: "m0156:expert", durationMilliseconds: 126_000 },
      to: { chartKey: "m0089:expert", durationMilliseconds: 141_000 },
    });
    expect(transitions.every(({ from, to }) =>
      from.orderStatus === "timed-corpus" &&
      to.orderStatus === "timed-corpus" &&
      from.formationOrder.join("|") !== to.formationOrder.join("|"),
    )).toBe(true);
  });

  it("does not turn an indeterminate chart into a claimed breakpoint", () => {
    const pekora = nativeGuideData.guides.find(
      (guide) => guide.anchorCardId === "card-00019-5-uniq-0016-00",
    )!;
    const shortest = [...pekora.ratingSongComparisons].sort(
      (left, right) => left.durationMilliseconds - right.durationMilliseconds,
    )[0]!;
    expect(shortest.orderStatus).toBe("indeterminate");
    expect(
      observedGuideSongBreakpoints(pekora).some(
        (transition) => transition.from.chartKey === shortest.chartKey,
      ),
    ).toBe(false);
  });
});
