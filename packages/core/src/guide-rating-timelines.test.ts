import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import guides from "../../../data/generated/native-guides.json";
import {
  GuideRatingTimelineDataSchema,
  guideRatingTimelineByKey,
  guideRatingTimelineData,
} from "./guide-rating-timelines";

describe("published guide rating-song exact timelines", () => {
  it("covers every published rating-song chart without bundling the full corpus", () => {
    expect(GuideRatingTimelineDataSchema.safeParse(guideRatingTimelineData).success).toBe(true);
    const expectedKeys = [...new Set(guides.guides.flatMap((guide) =>
      guide.ratingSongComparisons.map((comparison) => comparison.chartKey),
    ))].sort();
    expect([...guideRatingTimelineByKey.keys()].sort()).toEqual(expectedKeys);
    expect(guideRatingTimelineData.counts).toEqual({
      charts: 33,
      events: 32_527,
      specialMarkers: 165,
      feverMarkers: 132,
    });
  });

  it("pins the exact full-corpus source used for the compact projection", () => {
    const fullPath = fileURLToPath(
      new URL("../../../data/generated/holodori-chart-timelines.json", import.meta.url),
    );
    const hash = createHash("sha256").update(readFileSync(fullPath)).digest("hex");
    expect(hash).toBe(guideRatingTimelineData.source.fullCorpusSha256);
    expect(
      guideRatingTimelineData.charts.every((chart) =>
        chart.source.susSha256.length === 64 &&
        chart.source.metadataSha256.length === 64 &&
        chart.feverMarkerMicroseconds.feverEnd >= chart.feverMarkerMicroseconds.feverStart,
      ),
    ).toBe(true);
  });
});
