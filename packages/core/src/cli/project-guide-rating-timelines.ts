import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import guideData from "../../../../data/generated/native-guides.json";
import timelineData from "../../../../data/generated/holodori-chart-timelines.json";
import { expertChartKey, selectGuideRatingSongs } from "../native-guide-generator";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const fullCorpusFile = join(root, "data", "generated", "holodori-chart-timelines.json");
const outputFile = join(root, "data", "generated", "holodori-guide-rating-timelines.json");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function argumentsFor(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    const value = process.argv[index]!;
    if (value === name) {
      const next = process.argv[index + 1];
      if (!next || next.startsWith("--")) throw new Error(`${name} requires a value`);
      values.push(next);
      index += 1;
    } else if (value.startsWith(`${name}=`)) {
      values.push(value.slice(name.length + 1));
    }
  }
  return values.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}

// Published guides are otherwise the only source of chart keys, so a guide for a
// brand-new anchor can never bootstrap: generating it needs timelines that only
// get projected once it exists. Naming the anchor here projects exactly the
// charts its guide will ask for, via the generator's own selection rule.
const anchorCardIds = [...new Set(argumentsFor("--anchor-card-id"))].sort();
const fixedLeaderOutfitCardId = argumentsFor("--leader-outfit-card-id")[0];

const chartKeys = [
  ...new Set([
    ...guideData.guides.flatMap((guide) =>
      guide.ratingSongComparisons.map((comparison) => comparison.chartKey),
    ),
    ...anchorCardIds.flatMap((anchorCardId) =>
      selectGuideRatingSongs(anchorCardId, fixedLeaderOutfitCardId).songs.map((song) =>
        expertChartKey(song.id),
      ),
    ),
  ]),
].sort();
assert(chartKeys.length > 0, "Published guides contain no rating-song charts");
const chartByKey = new Map(timelineData.charts.map((chart) => [chart.key, chart]));
const unavailableChartByKey = new Map(
  timelineData.unavailableCharts.map((chart) => [chart.key, chart]),
);
const unavailableReasonByKey = new Map(
  timelineData.unavailableCharts.map((chart) => [chart.key, chart.reason]),
);
const charts = chartKeys.flatMap((chartKey) => {
  const chart = chartByKey.get(chartKey);
  const unavailableChart = unavailableChartByKey.get(chartKey);
  const unavailableReason = unavailableReasonByKey.get(chartKey);
  assert(
    Boolean(chart) !== Boolean(unavailableChart),
    `Guide rating timeline has conflicting or missing availability: ${chartKey}` +
      (unavailableReason ? ` (${unavailableReason})` : " (not present in the pinned corpus)"),
  );
  if (chart) {
    assert(chart.difficulty === "expert", `Guide rating timeline is not Expert: ${chartKey}`);
    assert(chart.feverMarkerMicroseconds, `Guide rating timeline has no Fever markers: ${chartKey}`);
    return [{
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
    }];
  }
  assert(unavailableChart, `Guide rating timeline is unavailable: ${chartKey}`);
  assert(unavailableChart.difficulty === "expert", `Guide rating timeline is not Expert: ${chartKey}`);
  return [];
});
const unavailableCharts = chartKeys.flatMap((chartKey) => {
  const unavailableChart = unavailableChartByKey.get(chartKey);
  if (!unavailableChart) return [];
  return [{
    availability: "unavailable" as const,
    key: unavailableChart.key,
    songId: unavailableChart.songId,
    difficulty: unavailableChart.difficulty,
    expectedChartHash: unavailableChart.upstreamChartHash,
    fullComboNoteCount: unavailableChart.fullComboNoteCount,
    reason: unavailableChart.reason,
  }];
});

const orderedChartKeysSha256 = sha256(chartKeys.join("\n"));
const orderedChartSourcesSha256 = sha256(
  chartKeys.map((chartKey) => {
    const chart = chartByKey.get(chartKey);
    if (chart) {
      return `${chart.key}|${chart.upstreamChartHash}|${chart.source.sus.sha256}|${chart.source.metadata.sha256}`;
    }
    const unavailable = unavailableChartByKey.get(chartKey)!;
    return `${unavailable.key}|${unavailable.upstreamChartHash}|${unavailable.reason}`;
  }).join("\n"),
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
    unavailableCharts: unavailableCharts.length,
  },
  charts,
  unavailableCharts,
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload)}\n`);
console.log(
  `Projected ${payload.counts.charts} published guide rating timelines with ` +
    `${payload.counts.events} events; chart keys ${orderedChartKeysSha256}.`,
);
