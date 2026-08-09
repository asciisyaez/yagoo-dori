import guideTimelineJson from "../../../data/generated/holodori-guide-rating-timelines.json";
import { z } from "zod";

import { RankingCorpusTimelineSchema } from "./ranking-corpus-timelines";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const GuideUnavailableTimelineSchema = z
  .object({
    availability: z.literal("unavailable"),
    key: z.string().regex(/^m\d{4}:expert$/),
    songId: z.string().regex(/^m\d{4}$/),
    difficulty: z.literal("expert"),
    expectedChartHash: z.string().regex(/^[a-f0-9]{32}$/),
    fullComboNoteCount: z.number().int().positive(),
    reason: z.enum([
      "source-chart-does-not-contain-five-special-markers",
      "source-api-unreachable-cloudflare-challenge-at-intake",
    ]),
  })
  .strict()
  .refine((chart) => chart.key === `${chart.songId}:expert`, {
    message: "Unavailable guide chart key must match the song and Expert difficulty",
    path: ["key"],
  });

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
      unavailableCharts: z.number().int().nonnegative().default(0),
    }).strict(),
    charts: z.array(RankingCorpusTimelineSchema).min(1),
    unavailableCharts: z.array(GuideUnavailableTimelineSchema).default([]),
  })
  .strict()
  .superRefine((data, context) => {
    const allKeys = [...data.charts.map((chart) => chart.key), ...data.unavailableCharts.map((chart) => chart.key)];
    if (new Set(allKeys).size !== allKeys.length) {
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
    if (data.counts.unavailableCharts !== data.unavailableCharts.length) {
      context.addIssue({
        code: "custom",
        path: ["counts", "unavailableCharts"],
        message: "Unavailable chart count mismatch",
      });
    }
  });

export type GuideRatingTimelineData = z.infer<typeof GuideRatingTimelineDataSchema>;
export type GuideUnavailableTimeline = z.infer<typeof GuideUnavailableTimelineSchema>;

export const guideRatingTimelineData: GuideRatingTimelineData =
  GuideRatingTimelineDataSchema.parse(guideTimelineJson as unknown);

export const guideRatingTimelineByKey = new Map(
  guideRatingTimelineData.charts.map((chart) => [chart.key, chart] as const),
);

export const guideRatingTimelineUnavailableByKey = new Map(
  guideRatingTimelineData.unavailableCharts.map((chart) => [chart.key, chart] as const),
);

export type GuideRatingTimelineProjection =
  | {
      availability: "exact";
      chart: GuideRatingTimelineData["charts"][number];
    }
  | {
      availability: "recorded-unavailable";
      chart: GuideUnavailableTimeline;
    };

/** Resolve one projected chart, refusing to treat an absent key as unavailable. */
export function resolveGuideRatingTimeline(
  chartKey: string,
  available = guideRatingTimelineByKey,
  unavailable = guideRatingTimelineUnavailableByKey,
): GuideRatingTimelineProjection {
  const exact = available.get(chartKey);
  const recordedUnavailable = unavailable.get(chartKey);
  if (exact && recordedUnavailable) {
    throw new Error(`Guide rating timeline has conflicting availability states: ${chartKey}`);
  }
  if (exact) return { availability: "exact", chart: exact };
  if (recordedUnavailable) return { availability: "recorded-unavailable", chart: recordedUnavailable };
  throw new Error(`Guide rating timeline projection is missing: ${chartKey}`);
}
