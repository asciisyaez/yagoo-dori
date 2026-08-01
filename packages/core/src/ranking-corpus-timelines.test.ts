import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import benchmark from "../../../data/native/ranking-benchmark-v1.json";
import {
  RankingCorpusTimelineDataSchema,
  rankingCorpusTimelineByKey,
  rankingCorpusTimelineData,
} from "./ranking-corpus-timelines";

describe("compact exact ranking-corpus timelines", () => {
  it("contains all 30 frozen Expert charts with exact hash linkage", () => {
    expect(RankingCorpusTimelineDataSchema.safeParse(rankingCorpusTimelineData).success).toBe(true);
    const entries = [...benchmark.corpus.reference, ...benchmark.corpus.current];
    expect(entries).toHaveLength(30);
    for (const entry of entries) {
      expect(rankingCorpusTimelineByKey.get(entry.chartKey)).toMatchObject({
        key: entry.chartKey,
        expectedChartHash: entry.expectedChartHash,
        difficulty: "expert",
        feverMarkerMicroseconds: {
          chargeStart: expect.any(Number),
          chargeEnd: expect.any(Number),
          feverStart: expect.any(Number),
          feverEnd: expect.any(Number),
        },
        source: { apiRevision: 51 },
      });
    }
  });

  it("pins the exact full-corpus file used to make the projection", () => {
    const fullPath = fileURLToPath(
      new URL("../../../data/generated/holodori-chart-timelines.json", import.meta.url),
    );
    const hash = createHash("sha256").update(readFileSync(fullPath)).digest("hex");
    expect(hash).toBe(rankingCorpusTimelineData.source.fullCorpusSha256);
    expect(rankingCorpusTimelineData.counts).toEqual({
      charts: 30,
      events: 29_568,
      specialMarkers: 150,
      feverMarkers: 120,
    });
  });
});
