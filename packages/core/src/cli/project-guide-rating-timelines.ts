import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import guideData from "../../../../data/generated/native-guides.json";
import timelineData from "../../../../data/generated/holodori-chart-timelines.json";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const fullCorpusFile = join(root, "data", "generated", "holodori-chart-timelines.json");
const outputFile = join(root, "data", "generated", "holodori-guide-rating-timelines.json");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

const chartKeys = [
  ...new Set(guideData.guides.flatMap((guide) =>
    guide.ratingSongComparisons.map((comparison) => comparison.chartKey),
  )),
].sort();
assert(chartKeys.length > 0, "Published guides contain no rating-song charts");
const chartByKey = new Map(timelineData.charts.map((chart) => [chart.key, chart]));
const charts = chartKeys.map((chartKey) => {
  const chart = chartByKey.get(chartKey);
  assert(chart, `Published guide timeline is unavailable: ${chartKey}`);
  assert(chart.difficulty === "expert", `Guide rating timeline is not Expert: ${chartKey}`);
  assert(chart.feverMarkerMicroseconds, `Guide rating timeline has no Fever markers: ${chartKey}`);
  return {
    key: chart.key,
    songId: chart.songId,
    difficulty: chart.difficulty,
    expectedChartHash: chart.upstreamChartHash,
    fullComboNoteCount: chart.fullComboNoteCount,
    events: chart.events,
    specialMarkerMicroseconds: chart.specialMarkerMicroseconds,
    specialStartsAtCombo: chart.specialStartsAtCombo,
    feverMarkerMicroseconds: chart.feverMarkerMicroseconds,
    source: {
      apiRevision: chart.source.apiRevision,
      susUrl: chart.source.sus.url,
      susSha256: chart.source.sus.sha256,
      metadataUrl: chart.source.metadata.url,
      metadataSha256: chart.source.metadata.sha256,
    },
  };
});

const orderedChartKeysSha256 = sha256(chartKeys.join("\n"));
const orderedChartSourcesSha256 = sha256(
  charts.map((chart) =>
    `${chart.key}|${chart.expectedChartHash}|${chart.source.susSha256}|${chart.source.metadataSha256}`,
  ).join("\n"),
);
const fullCorpusSha256 = sha256(new Uint8Array(await readFile(fullCorpusFile)));
const payload = {
  schemaVersion: 1,
  projectionVersion: "published-guide-rating-exact-timelines-v1",
  retrievedAt: timelineData.retrievedAt,
  source: {
    fullCorpusFile: "data/generated/holodori-chart-timelines.json",
    fullCorpusSha256,
    timelineTransformVersion: timelineData.transformVersion,
    apiRevision: timelineData.sourceSnapshot.apiRevision,
    orderedChartKeysSha256,
    orderedChartSourcesSha256,
  },
  noteTypeCodes: timelineData.noteTypeCodes,
  counts: {
    charts: charts.length,
    events: charts.reduce((sum, chart) => sum + chart.events.length, 0),
    specialMarkers: charts.length * 5,
    feverMarkers: charts.length * 4,
  },
  charts,
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload)}\n`);
console.log(
  `Projected ${payload.counts.charts} published guide rating timelines with ` +
    `${payload.counts.events} events; chart keys ${orderedChartKeysSha256}.`,
);
