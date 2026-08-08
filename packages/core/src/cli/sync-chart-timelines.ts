import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import songData from "../../../../data/generated/holodori-songs.json";
import sourceManifest from "../../../../data/native/chart-timeline-source.json";
import {
  TIMELINE_NOTE_TYPE_CODES,
  countTimelineEvents,
  parseHolodoriSus,
  type ParsedTimelineEvent,
  type TimelineNoteType,
} from "../chart-timeline-parser";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const outputFile = join(root, "data", "generated", "holodori-chart-timelines.json");
const transformVersion = "exact-sus-timeline-v1";
const expectedRevision = sourceManifest.apiRevision;
const retrievedAt =
  process.argv.find((argument) => argument.startsWith("--retrieved-at="))?.split("=")[1] ??
  sourceManifest.retrievedAt;
const concurrency = Number(
  process.argv.find((argument) => argument.startsWith("--concurrency="))?.split("=")[1] ?? 12,
);

type AggregateChart = (typeof songData.charts)[number];
type ResponseStamp = {
  url: string;
  sha256: string;
  etag: string | null;
  lastModified: string | null;
  contentType: string | null;
};

type DerivedSkill = {
  skill_slot_no: number;
  skill_starts_at_combo: number;
  counts: Record<string, Record<string, number>>;
};

type DerivedMetadata = {
  total_combo: number;
  skills: DerivedSkill[];
  [key: string]: unknown;
};

const metadataCategoryByNoteType: Record<Exclude<TimelineNoteType, "damage">, string> = {
  normal: "taps",
  flick: "flicks",
  "long-start": "long_starts",
  "long-end": "long_ends",
  "long-flick-end": "long_flick_ends",
  "long-continuation": "long_continuations",
  "long-relay": "long_relays",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function fillTemplate(template: string, chart: AggregateChart): string {
  return template
    .replaceAll("{musicId}", chart.songId)
    .replaceAll("{difficulty}", chart.difficulty);
}

async function fetchPinned(url: string): Promise<{ bytes: Uint8Array; stamp: ResponseStamp }> {
  const response = await fetch(url, {
    headers: {
      accept: "*/*",
      "user-agent": "Yagoo-dori exact chart indexer (+https://github.com/asciisyaez/yagoo-dori)",
    },
  });
  assert(response.ok, `Failed ${response.status} ${response.statusText}: ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    stamp: {
      url,
      sha256: sha256(bytes),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      contentType: response.headers.get("content-type"),
    },
  };
}

async function fetchRevision(): Promise<number> {
  const response = await fetch(sourceManifest.urlTemplates.revision, {
    headers: { accept: "application/json" },
  });
  assert(response.ok, `Failed to read chart API revision: ${response.status}`);
  const payload = (await response.json()) as { revision?: unknown };
  assert(Number.isInteger(payload.revision), "Chart API revision response is invalid");
  return Number(payload.revision);
}

function parseMetadata(bytes: Uint8Array, chartKey: string): DerivedMetadata {
  const value = JSON.parse(new TextDecoder().decode(bytes)) as Partial<DerivedMetadata>;
  assert(Number.isInteger(value.total_combo), `${chartKey} metadata has no total_combo`);
  assert(Array.isArray(value.skills), `${chartKey} metadata has no skills`);
  for (const skill of value.skills) {
    assert(Number.isInteger(skill.skill_slot_no), `${chartKey} has an invalid skill slot`);
    assert(Number.isInteger(skill.skill_starts_at_combo), `${chartKey} has an invalid skill combo`);
    assert(skill.counts && typeof skill.counts === "object", `${chartKey} has invalid skill counts`);
  }
  return value as DerivedMetadata;
}

function metadataCounts(metadata: DerivedMetadata): Record<TimelineNoteType, number> {
  const result = Object.fromEntries(
    Object.keys(TIMELINE_NOTE_TYPE_CODES).map((type) => [type, 0]),
  ) as Record<TimelineNoteType, number>;
  for (const [noteType, category] of Object.entries(metadataCategoryByNoteType) as Array<
    [Exclude<TimelineNoteType, "damage">, string]
  >) {
    result[noteType] = Number(metadata[category] ?? 0) + Number(metadata[`critical_${category}`] ?? 0);
  }
  return result;
}

function validateMetadataSkillStarts(
  chartKey: string,
  events: readonly ParsedTimelineEvent[],
  markers: readonly number[],
  metadata: DerivedMetadata,
): number[] {
  const skills = [...metadata.skills].sort((left, right) => left.skill_slot_no - right.skill_slot_no);
  assert(skills.length === 5, `${chartKey} expected five derived skill rows, received ${skills.length}`);
  const startsAtCombo: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    const skill = skills[index]!;
    const marker = markers[index]!;
    assert(skill.skill_slot_no === index + 1, `${chartKey} is missing derived skill slot ${index + 1}`);
    const actualStartCombo = events.filter((event) => event.atMicroseconds < marker).length;
    assert(
      actualStartCombo === skill.skill_starts_at_combo,
      `${chartKey} slot ${index + 1} starts at combo ${actualStartCombo}, metadata says ${skill.skill_starts_at_combo}`,
    );
    startsAtCombo.push(actualStartCombo);
  }
  return startsAtCombo;
}

async function processChart(chart: AggregateChart) {
  const susUrl = fillTemplate(sourceManifest.urlTemplates.sus, chart);
  const metadataUrl = fillTemplate(sourceManifest.urlTemplates.metadata, chart);
  const [susResponse, metadataResponse] = await Promise.all([
    fetchPinned(susUrl),
    fetchPinned(metadataUrl),
  ]);
  const parsed = parseHolodoriSus(new TextDecoder().decode(susResponse.bytes));
  const metadata = parseMetadata(metadataResponse.bytes, chart.key);
  const counts = countTimelineEvents(parsed.events);

  assert(parsed.musicId === chart.songId, `${chart.key} SUS belongs to ${parsed.musicId}`);
  assert(parsed.events.length === chart.fullComboNoteCount, `${chart.key} combo count drift`);
  assert(parsed.declaredFullCombo === chart.fullComboNoteCount, `${chart.key} SUS declared combo drift`);
  assert(metadata.total_combo === chart.fullComboNoteCount, `${chart.key} metadata combo drift`);
  assert(counts.normal === chart.normalNoteCount, `${chart.key} normal-note count drift`);
  for (const noteType of Object.keys(counts) as TimelineNoteType[]) {
    assert(counts[noteType] === metadataCounts(metadata)[noteType], `${chart.key} ${noteType} metadata count drift`);
  }
  const declaredComboTotal = Object.entries(parsed.declaredCounts)
    .filter(([noteType]) => noteType !== "damage")
    .reduce((sum, [, count]) => sum + count, 0);
  assert(declaredComboTotal === chart.fullComboNoteCount, `${chart.key} SUS declared family total drift`);
  const declaredCountDisagreements = (Object.keys(counts) as TimelineNoteType[])
    .filter((noteType) => counts[noteType] !== parsed.declaredCounts[noteType])
    .map((noteType) => ({
      noteType,
      declared: parsed.declaredCounts[noteType],
      parsedAndDerived: counts[noteType],
    }));
  const source = {
    apiRevision: expectedRevision,
    retrievedAt,
    sus: susResponse.stamp,
    metadata: metadataResponse.stamp,
  };
  if (parsed.specialMarkerMicroseconds.length !== 5) {
    return {
      availability: "unavailable" as const,
      key: chart.key,
      songId: chart.songId,
      difficulty: chart.difficulty,
      upstreamChartHash: chart.chartHash,
      fullComboNoteCount: chart.fullComboNoteCount,
      parsedEventCount: parsed.events.length,
      specialMarkerCount: parsed.specialMarkerMicroseconds.length,
      reason: "source-chart-does-not-contain-five-special-markers" as const,
      source,
    };
  }
  assert(
    parsed.specialMarkerMicroseconds.every(
      (marker, index) => index === 0 || marker > parsed.specialMarkerMicroseconds[index - 1]!,
    ),
    `${chart.key} Special markers are not strictly chronological`,
  );
  const specialStartsAtCombo = validateMetadataSkillStarts(
    chart.key,
    parsed.events,
    parsed.specialMarkerMicroseconds,
    metadata,
  );

  return {
    availability: "available" as const,
    key: chart.key,
    songId: chart.songId,
    difficulty: chart.difficulty,
    level: chart.level,
    chartAssetId: chart.chartAssetId,
    upstreamChartHash: chart.chartHash,
    fullComboNoteCount: chart.fullComboNoteCount,
    normalNoteCount: chart.normalNoteCount,
    waveOffsetMicroseconds: parsed.waveOffsetMicroseconds,
    noteCounts: counts,
    declaredNoteCounts: parsed.declaredCounts,
    declaredCountDisagreements,
    events: parsed.events.map(
      (event) =>
        [
          event.atMicroseconds,
          TIMELINE_NOTE_TYPE_CODES[event.noteType],
          event.critical ? 1 : 0,
        ] as const,
    ),
    specialMarkerMicroseconds: parsed.specialMarkerMicroseconds,
    specialStartsAtCombo,
    feverMarkerMicroseconds: parsed.feverMarkerMicroseconds,
    source,
  };
}

async function mapConcurrent<T, U>(
  values: readonly T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<U>,
): Promise<U[]> {
  assert(Number.isInteger(limit) && limit > 0, `Invalid concurrency ${limit}`);
  const results = new Array<U>(values.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]!, index);
      if ((index + 1) % 25 === 0 || index + 1 === values.length) {
        console.log(`Fetched ${index + 1}/${values.length} exact charts`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

assert(/^\d{4}-\d{2}-\d{2}$/.test(retrievedAt), `Invalid --retrieved-at ${retrievedAt}`);
assert(songData.charts.length === 728, `Expected 728 aggregate charts, received ${songData.charts.length}`);
assert(new Set(songData.charts.map((chart) => chart.key)).size === 728, "Aggregate chart keys are not unique");
const revisionBefore = await fetchRevision();
assert(revisionBefore === expectedRevision, `Expected chart API revision ${expectedRevision}, received ${revisionBefore}`);

const results = await mapConcurrent(
  [...songData.charts].sort((left, right) => left.key.localeCompare(right.key)),
  concurrency,
  processChart,
);

const revisionAfter = await fetchRevision();
assert(revisionAfter === expectedRevision, `Chart API changed from revision ${expectedRevision} to ${revisionAfter}`);
const charts = results.filter((result) => result.availability === "available");
const unavailableCharts = results.filter((result) => result.availability === "unavailable");
const totalEvents = charts.reduce((sum, chart) => sum + chart.events.length, 0);
const payload = {
  schemaVersion: 1,
  transformVersion,
  retrievedAt,
  sourceSnapshot: {
    id: sourceManifest.sourceId,
    apiBaseUrl: sourceManifest.apiBaseUrl,
    apiRevision: expectedRevision,
    revisionUrl: sourceManifest.urlTemplates.revision,
    sourceLicense: sourceManifest.sourceLicense,
    parserReference: sourceManifest.parserReference,
    transformation:
      "Build-time SUS parsing with BPM and measure changes; every chart is independently reconciled against public derived metadata and pinned aggregate counts.",
  },
  counts: {
    songs: new Set(charts.map((chart) => chart.songId)).size,
    charts: charts.length,
    unavailableCharts: unavailableCharts.length,
    events: totalEvents,
    specialMarkers: charts.length * 5,
    chartsWithDeclaredCountDisagreements: charts.filter(
      (chart) => chart.declaredCountDisagreements.length > 0,
    ).length,
  },
  noteTypeCodes: TIMELINE_NOTE_TYPE_CODES,
  charts,
  unavailableCharts,
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(payload)}\n`);
console.log(
  `Pinned ${payload.counts.charts} exact charts, ${payload.counts.events} timed events, and ${payload.counts.specialMarkers} Special markers from API revision ${expectedRevision}; ${payload.counts.unavailableCharts} source charts lacked five markers.`,
);
