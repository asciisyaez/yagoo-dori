import { describe, expect, it } from "vitest";

import { songContextData } from "./song-contexts";
import {
  ChartTimelineDataSchema,
  chartTimelineByKey,
  chartTimelineData,
  decodeTimelineEvent,
} from "./chart-timelines";

describe("pinned exact chart timeline corpus", () => {
  it("loads every source chart with an exact five-marker timeline or an explicit exclusion", () => {
    expect(ChartTimelineDataSchema.safeParse(chartTimelineData).success).toBe(true);
    expect(chartTimelineData.sourceSnapshot).toMatchObject({
      apiRevision: 51,
      parserReference: {
        commit: "0d31cd7710fe5f68933211ad312813d984542f41",
        license: "MIT",
      },
    });
    expect(chartTimelineData.counts).toEqual({
      songs: 175,
      charts: 699,
      unavailableCharts: 53,
      events: 402_632,
      specialMarkers: 3_495,
      chartsWithDeclaredCountDisagreements: 1,
    });
    expect(chartTimelineData.charts).toHaveLength(699);
    expect(chartTimelineData.unavailableCharts.map((chart) => chart.key).sort()).toEqual([
      "m0318:easy",
      "m0323:easy",
      "m0323:expert",
      "m0323:hard",
      "m0323:normal",
      "m0324:easy",
      "m0324:expert",
      "m0324:hard",
      "m0324:normal",
      "m0325:easy",
      "m0325:expert",
      "m0325:hard",
      "m0325:normal",
      "m0332:easy",
      "m0332:expert",
      "m0332:hard",
      "m0332:normal",
      "m0333:easy",
      "m0333:expert",
      "m0333:hard",
      "m0333:normal",
      "m0334:easy",
      "m0334:expert",
      "m0334:hard",
      "m0334:normal",
      "m0335:easy",
      "m0335:expert",
      "m0335:hard",
      "m0335:normal",
      "m0336:easy",
      "m0336:expert",
      "m0336:hard",
      "m0336:normal",
      "m0337:easy",
      "m0337:expert",
      "m0337:hard",
      "m0337:normal",
      "m0346:easy",
      "m0346:expert",
      "m0346:hard",
      "m0346:normal",
      "m0347:easy",
      "m0347:expert",
      "m0347:hard",
      "m0347:normal",
      "m0353:easy",
      "m0353:expert",
      "m0353:hard",
      "m0353:normal",
      "m9999:easy",
      "m9999:expert",
      "m9999:hard",
      "m9999:normal",
    ]);

    expect(
      chartTimelineData.unavailableCharts.every((chart) =>
        chart.reason === "source-chart-does-not-contain-five-special-markers"
          ? chart.specialMarkerCount === 2 && chart.parsedEventCount === chart.fullComboNoteCount
          : chart.reason === "source-api-unreachable-cloudflare-challenge-at-intake" &&
            chart.specialMarkerCount === 0 &&
            chart.parsedEventCount === 0,
      ),
    ).toBe(true);
  });

  it("reconciles exact events and source hashes to all pinned aggregate charts", () => {
    const aggregateByKey = new Map(songContextData.charts.map((chart) => [chart.key, chart]));
    for (const chart of chartTimelineData.charts) {
      const aggregate = aggregateByKey.get(chart.key);
      expect(aggregate).toBeDefined();
      expect(chart.upstreamChartHash).toBe(aggregate!.chartHash);
      expect(chart.fullComboNoteCount).toBe(aggregate!.fullComboNoteCount);
      expect(chart.normalNoteCount).toBe(aggregate!.normalNoteCount);
      expect(chart.events).toHaveLength(aggregate!.fullComboNoteCount);
      expect(chart.source.sus.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(chart.source.metadata.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(chart.specialMarkerMicroseconds).toHaveLength(5);
    }
    expect(chartTimelineData.charts.length + chartTimelineData.unavailableCharts.length).toBe(
      songContextData.charts.length,
    );
  });

  it("preserves the sole declared-versus-derived disagreement instead of silently merging it", () => {
    const disagreements = chartTimelineData.charts.filter(
      (chart) => chart.declaredCountDisagreements.length > 0,
    );
    expect(disagreements).toHaveLength(1);
    expect(disagreements[0]).toMatchObject({
      key: "m0094:expert",
      declaredCountDisagreements: [
        { noteType: "long-end", declared: 105, parsedAndDerived: 102 },
        { noteType: "long-flick-end", declared: 46, parsedAndDerived: 49 },
      ],
    });
  });

  it("provides locally decoded exact event and Special timing without runtime network access", () => {
    const sparks = chartTimelineByKey.get("m0049:expert");
    expect(sparks).toBeDefined();
    expect(sparks!.specialMarkerMicroseconds).toEqual([
      9_090_909,
      27_272_727,
      43_636_364,
      60_000_000,
      85_454_545,
    ]);
    expect(decodeTimelineEvent(sparks!.events[0]!)).toEqual({
      atMicroseconds: expect.any(Number),
      noteType: expect.any(String),
      critical: expect.any(Boolean),
    });
  });
});
