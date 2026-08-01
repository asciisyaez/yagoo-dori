import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import timelineData from "../../../../data/generated/holodori-chart-timelines.json";
import benchmark from "../../../../data/native/ranking-benchmark-v1.json";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const fullCorpusFile = join(root, "data", "generated", "holodori-chart-timelines.json");
const outputFile = join(
  root,
  "data",
  "generated",
  "holodori-ranking-corpus-timelines.json",
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

const entries = [...benchmark.corpus.reference, ...benchmark.corpus.current];
assert(entries.length === 30, `Expected 30 benchmark entries, received ${entries.length}`);
assert(new Set(entries.map((entry) => entry.chartKey)).size === 30, "Benchmark chart keys are not unique");
const chartByKey = new Map(timelineData.charts.map((chart) => [chart.key, chart]));
const charts = entries.map((entry) => {
  const chart = chartByKey.get(entry.chartKey);
  assert(chart, `Benchmark timeline is unavailable: ${entry.chartKey}`);
  assert(
    chart.upstreamChartHash === entry.expectedChartHash,
    `Benchmark chart hash drift: ${entry.chartKey}`,
  );
  return {
    key: chart.key,
    songId: chart.songId,
    difficulty: chart.difficulty,
    expectedChartHash: entry.expectedChartHash,
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

const orderedChartSourcesSha256 = sha256(
  charts
    .map(
      (chart) =>
        `${chart.key}|${chart.expectedChartHash}|${chart.source.susSha256}|${chart.source.metadataSha256}`,
    )
    .join("\n"),
);
const fullCorpusSha256 = sha256(new Uint8Array(await readFile(fullCorpusFile)));
const payload = {
  schemaVersion: 1,
  projectionVersion: "ranking-corpus-exact-timelines-v1",
  benchmarkId: benchmark.benchmarkId,
  benchmarkEntriesSha256: benchmark.corpus.entriesSha256,
  retrievedAt: timelineData.retrievedAt,
  source: {
    fullCorpusFile: "data/generated/holodori-chart-timelines.json",
    fullCorpusSha256,
    timelineTransformVersion: timelineData.transformVersion,
    apiRevision: timelineData.sourceSnapshot.apiRevision,
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
  `Projected ${payload.counts.charts} benchmark timelines with ${payload.counts.events} events; source linkage ${orderedChartSourcesSha256}.`,
);
