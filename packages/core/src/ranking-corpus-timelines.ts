import rankingTimelineJson from "../../../data/generated/holodori-ranking-corpus-timelines.json";
import { z } from "zod";

import { TIMELINE_NOTE_TYPES } from "./chart-timeline-parser";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const EventSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().min(0).max(TIMELINE_NOTE_TYPES.length - 1),
  z.union([z.literal(0), z.literal(1)]),
]);
const FiveNumbersSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);
const FeverMarkersSchema = z
  .object({
    chargeStart: z.number().int().nonnegative(),
    chargeEnd: z.number().int().nonnegative(),
    feverStart: z.number().int().nonnegative(),
    feverEnd: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (markers) =>
      markers.chargeStart <= markers.chargeEnd &&
      markers.chargeEnd <= markers.feverStart &&
      markers.feverStart <= markers.feverEnd,
    "Fever markers must be chronological",
  );

export const RankingCorpusTimelineSchema = z
  .object({
    key: z.string().regex(/^m\d{4}:expert$/),
    songId: z.string().regex(/^m\d{4}$/),
    difficulty: z.literal("expert"),
    expectedChartHash: z.string().regex(/^[a-f0-9]{32}$/),
    fullComboNoteCount: z.number().int().positive(),
    events: z.array(EventSchema).min(1),
    specialMarkerMicroseconds: FiveNumbersSchema,
    specialStartsAtCombo: FiveNumbersSchema,
    feverMarkerMicroseconds: FeverMarkersSchema,
    source: z
      .object({
        apiRevision: z.literal(51),
        susUrl: z.url(),
        susSha256: Sha256Schema,
        metadataUrl: z.url(),
        metadataSha256: Sha256Schema,
      })
      .strict(),
  })
  .strict()
  .superRefine((chart, context) => {
    if (chart.key !== `${chart.songId}:expert`) {
      context.addIssue({ code: "custom", path: ["key"], message: "Chart key mismatch" });
    }
    if (chart.events.length !== chart.fullComboNoteCount) {
      context.addIssue({ code: "custom", path: ["events"], message: "Full combo mismatch" });
    }
    if (
      chart.events.some((event, index) => index > 0 && event[0] < chart.events[index - 1]![0])
    ) {
      context.addIssue({ code: "custom", path: ["events"], message: "Events are not chronological" });
    }
    if (
      chart.specialMarkerMicroseconds.some(
        (marker, index) => index > 0 && marker <= chart.specialMarkerMicroseconds[index - 1]!,
      )
    ) {
      context.addIssue({ code: "custom", path: ["specialMarkerMicroseconds"], message: "Markers are not chronological" });
    }
    chart.specialMarkerMicroseconds.forEach((marker, index) => {
      const combo = chart.events.filter((event) => event[0] < marker).length;
      if (combo !== chart.specialStartsAtCombo[index]) {
        context.addIssue({ code: "custom", path: ["specialStartsAtCombo", index], message: "Marker combo mismatch" });
      }
    });
  });

export const RankingCorpusTimelineDataSchema = z
  .object({
    schemaVersion: z.literal(1),
    projectionVersion: z.literal("ranking-corpus-exact-timelines-v1"),
    benchmarkId: z.literal("launch-2026-07-31-matched-context-v1"),
    benchmarkEntriesSha256: z.literal(
      "9b7ddae06b00d7b797298aef76c185556f1b0e3908006c58451b1af562dc0b11",
    ),
    retrievedAt: z.iso.date(),
    source: z
      .object({
        fullCorpusFile: z.literal("data/generated/holodori-chart-timelines.json"),
        fullCorpusSha256: Sha256Schema,
        timelineTransformVersion: z.literal("exact-sus-timeline-v1"),
        apiRevision: z.literal(51),
        orderedChartSourcesSha256: Sha256Schema,
      })
      .strict(),
    noteTypeCodes: z.record(z.enum(TIMELINE_NOTE_TYPES), z.number().int().nonnegative()),
    counts: z
      .object({
        charts: z.literal(30),
        events: z.number().int().positive(),
        specialMarkers: z.literal(150),
        feverMarkers: z.literal(120),
      })
      .strict(),
    charts: z.array(RankingCorpusTimelineSchema).length(30),
  })
  .strict()
  .superRefine((data, context) => {
    if (new Set(data.charts.map((chart) => chart.key)).size !== 30) {
      context.addIssue({ code: "custom", path: ["charts"], message: "Chart keys must be unique" });
    }
    if (data.counts.events !== data.charts.reduce((sum, chart) => sum + chart.events.length, 0)) {
      context.addIssue({ code: "custom", path: ["counts", "events"], message: "Event count mismatch" });
    }
    TIMELINE_NOTE_TYPES.forEach((type, index) => {
      if (data.noteTypeCodes[type] !== index) {
        context.addIssue({ code: "custom", path: ["noteTypeCodes", type], message: "Note code drift" });
      }
    });
  });

export type RankingCorpusTimeline = z.infer<typeof RankingCorpusTimelineSchema>;
export type RankingCorpusTimelineData = z.infer<typeof RankingCorpusTimelineDataSchema>;

export const rankingCorpusTimelineData: RankingCorpusTimelineData =
  RankingCorpusTimelineDataSchema.parse(rankingTimelineJson as unknown);

export const rankingCorpusTimelineByKey = new Map(
  rankingCorpusTimelineData.charts.map((chart) => [chart.key, chart] as const),
);
