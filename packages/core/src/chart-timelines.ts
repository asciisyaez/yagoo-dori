import timelineJson from "../../../data/generated/holodori-chart-timelines.json";
import { z } from "zod";

import { TIMELINE_NOTE_TYPES, type TimelineNoteType } from "./chart-timeline-parser";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const DifficultySchema = z.enum(["easy", "normal", "hard", "expert"]);
const TimelineNoteTypeSchema = z.enum(TIMELINE_NOTE_TYPES);
const EventSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().min(0).max(TIMELINE_NOTE_TYPES.length - 1),
  z.union([z.literal(0), z.literal(1)]),
]);
const NoteCountsSchema = z.record(TimelineNoteTypeSchema, z.number().int().nonnegative());
const ResponseStampSchema = z
  .object({
    url: z.url(),
    sha256: Sha256Schema,
    etag: z.string().nullable(),
    lastModified: z.string().nullable(),
    contentType: z.string().nullable(),
  })
  .strict();
const SourceSchema = z
  .object({
    apiRevision: z.literal(51),
    retrievedAt: z.iso.date(),
    sus: ResponseStampSchema,
    metadata: ResponseStampSchema,
  })
  .strict();
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
const FiveNumbersSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);
const DisagreementSchema = z
  .object({
    noteType: TimelineNoteTypeSchema,
    declared: z.number().int().nonnegative(),
    parsedAndDerived: z.number().int().nonnegative(),
  })
  .strict()
  .refine((row) => row.declared !== row.parsedAndDerived, "Disagreement values must differ");

export const ExactChartTimelineSchema = z
  .object({
    availability: z.literal("available"),
    key: z.string().regex(/^m\d{4}:(easy|normal|hard|expert)$/),
    songId: z.string().regex(/^m\d{4}$/),
    difficulty: DifficultySchema,
    level: z.number().int().positive(),
    chartAssetId: z.string().min(1),
    upstreamChartHash: z.string().regex(/^[a-f0-9]{32}$/),
    fullComboNoteCount: z.number().int().positive(),
    normalNoteCount: z.number().int().nonnegative(),
    waveOffsetMicroseconds: z.number().int(),
    noteCounts: NoteCountsSchema,
    declaredNoteCounts: NoteCountsSchema,
    declaredCountDisagreements: z.array(DisagreementSchema),
    events: z.array(EventSchema).min(1),
    specialMarkerMicroseconds: FiveNumbersSchema,
    specialStartsAtCombo: FiveNumbersSchema,
    feverMarkerMicroseconds: FeverMarkersSchema.nullable(),
    source: SourceSchema,
  })
  .strict()
  .superRefine((chart, context) => {
    if (chart.key !== `${chart.songId}:${chart.difficulty}`) {
      context.addIssue({ code: "custom", path: ["key"], message: "Chart key mismatch" });
    }
    if (chart.events.length !== chart.fullComboNoteCount) {
      context.addIssue({ code: "custom", path: ["events"], message: "Full combo count mismatch" });
    }
    if (
      chart.events.some(
        (event, index) => index > 0 && event[0] < chart.events[index - 1]![0],
      )
    ) {
      context.addIssue({ code: "custom", path: ["events"], message: "Events are not chronological" });
    }
    if (
      chart.specialMarkerMicroseconds.some(
        (marker, index) => index > 0 && marker <= chart.specialMarkerMicroseconds[index - 1]!,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["specialMarkerMicroseconds"],
        message: "Special markers are not strictly chronological",
      });
    }
    const counts = Object.fromEntries(TIMELINE_NOTE_TYPES.map((type) => [type, 0])) as Record<
      TimelineNoteType,
      number
    >;
    for (const [, code] of chart.events) counts[TIMELINE_NOTE_TYPES[code]!] += 1;
    for (const type of TIMELINE_NOTE_TYPES) {
      if (counts[type] !== chart.noteCounts[type]) {
        context.addIssue({ code: "custom", path: ["noteCounts", type], message: `${type} count mismatch` });
      }
    }
    if (counts.normal !== chart.normalNoteCount) {
      context.addIssue({ code: "custom", path: ["normalNoteCount"], message: "Normal-note count mismatch" });
    }
    chart.specialMarkerMicroseconds.forEach((marker, index) => {
      const startsAtCombo = chart.events.filter((event) => event[0] < marker).length;
      if (startsAtCombo !== chart.specialStartsAtCombo[index]) {
        context.addIssue({
          code: "custom",
          path: ["specialStartsAtCombo", index],
          message: "Special combo index mismatch",
        });
      }
    });
    const disagreements = new Map(
      chart.declaredCountDisagreements.map((row) => [row.noteType, row]),
    );
    for (const type of TIMELINE_NOTE_TYPES) {
      const differs = chart.declaredNoteCounts[type] !== chart.noteCounts[type];
      if (differs !== disagreements.has(type)) {
        context.addIssue({
          code: "custom",
          path: ["declaredCountDisagreements"],
          message: `Declared ${type} disagreement ledger mismatch`,
        });
      }
    }
  });

export const UnavailableChartTimelineSchema = z
  .object({
    availability: z.literal("unavailable"),
    key: z.string().regex(/^m\d{4}:(easy|normal|hard|expert)$/),
    songId: z.string().regex(/^m\d{4}$/),
    difficulty: DifficultySchema,
    upstreamChartHash: z.string().regex(/^[a-f0-9]{32}$/),
    fullComboNoteCount: z.number().int().positive(),
    parsedEventCount: z.number().int().positive(),
    specialMarkerCount: z.number().int().nonnegative(),
    reason: z.literal("source-chart-does-not-contain-five-special-markers"),
    source: SourceSchema,
  })
  .strict()
  .refine((chart) => chart.key === `${chart.songId}:${chart.difficulty}`, "Chart key mismatch")
  .refine((chart) => chart.parsedEventCount === chart.fullComboNoteCount, "Parsed event count mismatch")
  .refine((chart) => chart.specialMarkerCount !== 5, "Unavailable chart unexpectedly has five markers")
  .or(
    // Charts whose source .sus could not be retrieved at intake: nothing was
    // parsed, so every parsed counter is exactly zero. No scrape-protection
    // bypass is permitted; these convert to exact timelines when the source
    // becomes reachable again.
    z
      .object({
        availability: z.literal("unavailable"),
        key: z.string().regex(/^m\d{4}:(easy|normal|hard|expert)$/),
        songId: z.string().regex(/^m\d{4}$/),
        difficulty: DifficultySchema,
        upstreamChartHash: z.string().regex(/^[a-f0-9]{32}$/),
        fullComboNoteCount: z.number().int().positive(),
        parsedEventCount: z.literal(0),
        specialMarkerCount: z.literal(0),
        reason: z.literal("source-api-unreachable-cloudflare-challenge-at-intake"),
        source: z
          .object({
            api: z.string().url(),
            note: z.string().min(1),
          })
          .strict(),
      })
      .strict()
      .refine((chart) => chart.key === `${chart.songId}:${chart.difficulty}`, "Chart key mismatch"),
  );

export const ChartTimelineDataSchema = z
  .object({
    schemaVersion: z.literal(1),
    transformVersion: z.literal("exact-sus-timeline-v1"),
    retrievedAt: z.iso.date(),
    sourceSnapshot: z
      .object({
        id: z.literal("holodori-best-chart-corpus-r51"),
        apiBaseUrl: z.url(),
        apiRevision: z.literal(51),
        revisionUrl: z.url(),
        sourceLicense: z.null(),
        parserReference: z
          .object({
            repository: z.url(),
            commit: z.literal("0d31cd7710fe5f68933211ad312813d984542f41"),
            license: z.literal("MIT"),
            files: z.array(z.string().min(1)).min(1),
          })
          .strict(),
        transformation: z.string().min(1),
      })
      .strict(),
    counts: z
      .object({
        songs: z.number().int().nonnegative(),
        charts: z.number().int().nonnegative(),
        unavailableCharts: z.number().int().nonnegative(),
        events: z.number().int().nonnegative(),
        specialMarkers: z.number().int().nonnegative(),
        chartsWithDeclaredCountDisagreements: z.number().int().nonnegative(),
      })
      .strict(),
    noteTypeCodes: z.record(TimelineNoteTypeSchema, z.number().int().nonnegative()),
    charts: z.array(ExactChartTimelineSchema),
    unavailableCharts: z.array(UnavailableChartTimelineSchema),
  })
  .strict()
  .superRefine((data, context) => {
    const all = [...data.charts, ...data.unavailableCharts];
    const uniqueKeys = new Set(all.map((chart) => chart.key));
    if (uniqueKeys.size !== all.length) {
      context.addIssue({ code: "custom", path: ["charts"], message: "Chart keys must be unique" });
    }
    const expectedCounts = {
      songs: new Set(data.charts.map((chart) => chart.songId)).size,
      charts: data.charts.length,
      unavailableCharts: data.unavailableCharts.length,
      events: data.charts.reduce((sum, chart) => sum + chart.events.length, 0),
      specialMarkers: data.charts.length * 5,
      chartsWithDeclaredCountDisagreements: data.charts.filter(
        (chart) => chart.declaredCountDisagreements.length > 0,
      ).length,
    };
    for (const [key, expected] of Object.entries(expectedCounts)) {
      if (data.counts[key as keyof typeof expectedCounts] !== expected) {
        context.addIssue({ code: "custom", path: ["counts", key], message: `${key} count mismatch` });
      }
    }
    TIMELINE_NOTE_TYPES.forEach((type, index) => {
      if (data.noteTypeCodes[type] !== index) {
        context.addIssue({ code: "custom", path: ["noteTypeCodes", type], message: "Note code drift" });
      }
    });
  });

export type ExactChartTimeline = z.infer<typeof ExactChartTimelineSchema>;
export type UnavailableChartTimeline = z.infer<typeof UnavailableChartTimelineSchema>;
export type ChartTimelineData = z.infer<typeof ChartTimelineDataSchema>;

export const chartTimelineData: ChartTimelineData = ChartTimelineDataSchema.parse(
  timelineJson as unknown,
);

export const chartTimelineByKey = new Map(
  chartTimelineData.charts.map((chart) => [chart.key, chart] as const),
);

export function decodeTimelineEvent(
  event: ExactChartTimeline["events"][number],
): { atMicroseconds: number; noteType: TimelineNoteType; critical: boolean } {
  return {
    atMicroseconds: event[0],
    noteType: TIMELINE_NOTE_TYPES[event[1]]!,
    critical: event[2] === 1,
  };
}
