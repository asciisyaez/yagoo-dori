import { describe, expect, it } from "vitest";

import { recommendFormationOrder } from "./formation-order-recommender";
import { guideRatingTimelineByKey } from "./guide-rating-timelines";

describe("exact per-song formation order evidence", () => {
  it("compares all placements on one pinned guide chart without a modeled fallback", () => {
    const timeline = guideRatingTimelineByKey.get("m0032:expert")!;
    const result = recommendFormationOrder({
      leaderOutfitCardId: "card-00012-5-uniq-0012-00",
      members: [
        { cardId: "card-00010-5-uniq-0010-00", bloomStage: 0 },
        { cardId: "card-00021-5-uniq-0017-00", bloomStage: 0 },
        { cardId: "card-06004-5-uniq-0060-00", bloomStage: 0 },
        { cardId: "card-00012-5-uniq-0062-00", bloomStage: 0 },
        { cardId: "card-00022-5-uniq-0018-00", bloomStage: 0 },
      ],
      corpus: [{ chartKey: timeline.key, expectedChartHash: timeline.expectedChartHash }],
      corpusMode: "exact-song",
      exactTimelineByKey: guideRatingTimelineByKey,
    });

    expect(result.kind).toBe("timed-corpus");
    expect(result.method).toMatchObject({
      permutationsChecked: 120,
      exactTimelineAvailable: true,
      noteTimelineAvailable: true,
      changesModeledTimingUtility: true,
    });
    expect(result.scenarios).toMatchObject({ chartCount: 1, count: 1, layoutCount: 1 });
    expect(result.objective.perChartDiagnostics).toHaveLength(1);
    expect(result.objective.perChartDiagnostics[0]).toMatchObject({
      chartKey: "m0032:expert",
      timelineSusSha256: timeline.source.susSha256,
      timelineMetadataSha256: timeline.source.metadataSha256,
    });
  });
});
