import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import guides from "../../../data/generated/native-guides.json";
import {
  GuideUnavailableTimelineSchema,
  GuideRatingTimelineDataSchema,
  guideRatingTimelineByKey,
  guideRatingTimelineData,
  guideRatingTimelineUnavailableByKey,
  resolveGuideRatingTimeline,
} from "./guide-rating-timelines";

describe("published guide rating-song exact timelines", () => {
  it("covers every published rating-song chart without bundling the full corpus", () => {
    expect(GuideRatingTimelineDataSchema.safeParse(guideRatingTimelineData).success).toBe(true);
    const expectedKeys = [...new Set(guides.guides.flatMap((guide) =>
      guide.ratingSongComparisons.map((comparison) => comparison.chartKey),
    ))].sort();
    expect([
      ...guideRatingTimelineByKey.keys(),
      ...guideRatingTimelineUnavailableByKey.keys(),
    ].sort()).toEqual(expectedKeys);
    expect(guideRatingTimelineData.counts).toEqual({
      charts: guideRatingTimelineData.charts.length,
      events: guideRatingTimelineData.charts.reduce((sum, chart) => sum + chart.events.length, 0),
      specialMarkers: guideRatingTimelineData.charts.length * 5,
      feverMarkers: guideRatingTimelineData.charts.length * 4,
      unavailableCharts: guideRatingTimelineData.unavailableCharts.length,
    });
    // Literal intake tripwire: the schema already reconciles counts against the
    // file's own contents, so without pinned sizes a projector run that drops or
    // duplicates charts would stay self-consistent and pass silently.
    expect(guideRatingTimelineData.charts).toHaveLength(41);
    expect(guideRatingTimelineData.unavailableCharts).toHaveLength(3);
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

  it("distinguishes recorded-unavailable charts from unknown projection keys", () => {
    const exact = guideRatingTimelineData.charts[0]!;
    const unavailable = GuideUnavailableTimelineSchema.parse({
      availability: "unavailable",
      key: "m0325:expert",
      songId: "m0325",
      difficulty: "expert",
      expectedChartHash: "0".repeat(32),
      fullComboNoteCount: 1,
      reason: "source-api-unreachable-cloudflare-challenge-at-intake",
    });
    const available = new Map([[exact.key, exact]]);
    const recordedUnavailable = new Map([[unavailable.key, unavailable]]);

    expect(resolveGuideRatingTimeline(exact.key, available, recordedUnavailable)).toEqual({
      availability: "exact",
      chart: exact,
    });
    expect(resolveGuideRatingTimeline(unavailable.key, available, recordedUnavailable)).toEqual({
      availability: "recorded-unavailable",
      chart: unavailable,
    });
    expect(() => resolveGuideRatingTimeline("m0999:expert", available, recordedUnavailable)).toThrow(
      /projection is missing/i,
    );
    expect(() => resolveGuideRatingTimeline(
      exact.key,
      available,
      new Map([[exact.key, unavailable]]),
    )).toThrow(/conflicting availability/i);
  });
});
