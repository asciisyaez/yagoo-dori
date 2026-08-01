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
      songs: 176,
      charts: 704,
      unavailableCharts: 4,
      events: 405_819,
      specialMarkers: 3_520,
      chartsWithDeclaredCountDisagreements: 1,
    });
    expect(chartTimelineData.charts).toHaveLength(704);
    expect(chartTimelineData.unavailableCharts.map((chart) => chart.key).sort()).toEqual([
      "m9999:easy",
      "m9999:expert",
      "m9999:hard",
      "m9999:normal",
    ]);
    expect(
      chartTimelineData.unavailableCharts.every(
        (chart) => chart.specialMarkerCount === 2 && chart.parsedEventCount === chart.fullComboNoteCount,
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
