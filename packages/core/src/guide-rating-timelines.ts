import guideTimelineJson from "../../../data/generated/holodori-guide-rating-timelines.json";
import { z } from "zod";

import { RankingCorpusTimelineSchema } from "./ranking-corpus-timelines";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const GuideRatingTimelineDataSchema = z
  .object({
    schemaVersion: z.literal(1),
    projectionVersion: z.literal("published-guide-rating-exact-timelines-v1"),
    retrievedAt: z.iso.date(),
    source: z.object({
      fullCorpusFile: z.literal("data/generated/holodori-chart-timelines.json"),
      fullCorpusSha256: Sha256Schema,
      timelineTransformVersion: z.literal("exact-sus-timeline-v1"),
      apiRevision: z.literal(51),
      orderedChartKeysSha256: Sha256Schema,
      orderedChartSourcesSha256: Sha256Schema,
    }).strict(),
    noteTypeCodes: z.record(z.string(), z.number().int().nonnegative()),
    counts: z.object({
      charts: z.number().int().positive(),
      events: z.number().int().positive(),
      specialMarkers: z.number().int().positive(),
      feverMarkers: z.number().int().positive(),
    }).strict(),
    charts: z.array(RankingCorpusTimelineSchema).min(1),
  })
  .strict()
  .superRefine((data, context) => {
    if (new Set(data.charts.map((chart) => chart.key)).size !== data.charts.length) {
      context.addIssue({ code: "custom", path: ["charts"], message: "Chart keys must be unique" });
    }
    if (data.counts.charts !== data.charts.length) {
      context.addIssue({ code: "custom", path: ["counts", "charts"], message: "Chart count mismatch" });
    }
    if (data.counts.events !== data.charts.reduce((sum, chart) => sum + chart.events.length, 0)) {
      context.addIssue({ code: "custom", path: ["counts", "events"], message: "Event count mismatch" });
    }
    if (data.counts.specialMarkers !== data.charts.length * 5) {
      context.addIssue({ code: "custom", path: ["counts", "specialMarkers"], message: "Special marker count mismatch" });
    }
    if (data.counts.feverMarkers !== data.charts.length * 4) {
      context.addIssue({ code: "custom", path: ["counts", "feverMarkers"], message: "Fever marker count mismatch" });
    }
  });

export type GuideRatingTimelineData = z.infer<typeof GuideRatingTimelineDataSchema>;

export const guideRatingTimelineData: GuideRatingTimelineData =
  GuideRatingTimelineDataSchema.parse(guideTimelineJson as unknown);

export const guideRatingTimelineByKey = new Map(
  guideRatingTimelineData.charts.map((chart) => [chart.key, chart] as const),
);
