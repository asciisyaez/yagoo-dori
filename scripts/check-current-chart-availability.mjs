import { readFile } from "node:fs/promises";

const load = async (path) => JSON.parse(await readFile(path, "utf8"));
const [audit, publicData, historical] = await Promise.all([
  load("data/native/current-chart-availability-v1.json"),
  load("data/generated/holodori-public.json"),
  load("data/generated/holodori-songs.json"),
]);
const fail = (message) => { throw new Error(`Current chart audit: ${message}`); };
if (audit.schemaVersion !== 1 || audit.source?.commit !== publicData.sourceSnapshots.english.commit ||
    audit.source?.masterVersion !== publicData.sourceSnapshots.english.masterVersion ||
    !/^[0-9a-f]{64}$/.test(audit.source?.sourceSha256 ?? "") ||
    audit.historicalScoringCommit !== historical.sourceSnapshot.commit || !Array.isArray(audit.charts)) fail("source binding or schema is stale");
const historicalKeys = new Set(historical.charts.map((chart) => chart.key));
const keys = new Set();
for (const chart of audit.charts) {
  if (!chart.songId || !["easy", "normal", "hard", "expert"].includes(chart.difficulty) ||
      chart.key !== `${chart.songId}:${chart.difficulty}` || !Number.isInteger(chart.fullComboNoteCount) ||
      chart.currentChartHash !== null || chart.currentTiming !== "unavailable" ||
      chart.reason !== "source-omits-current-hash-and-timing" ||
      chart.presentInHistoricalScoringSnapshot !== historicalKeys.has(chart.key) || keys.has(chart.key)) fail(`invalid or duplicate chart ${chart.key}`);
  keys.add(chart.key);
}
const actual = {
  currentCharts: keys.size,
  currentSongs: new Set(audit.charts.map((chart) => chart.songId)).size,
  currentTimingUnavailable: audit.charts.length,
  alsoInHistoricalScoringSnapshot: audit.charts.filter((chart) => chart.presentInHistoricalScoringSnapshot).length,
  newlyObservedChartKeys: audit.charts.filter((chart) => !chart.presentInHistoricalScoringSnapshot).length,
  historicalKeysAbsentFromCurrent: [...historicalKeys].filter((key) => !keys.has(key)).length,
};
for (const [key, value] of Object.entries(actual)) if (audit.counts?.[key] !== value) fail(`incorrect ${key} count`);
console.log(`Current chart audit valid: ${actual.currentSongs} songs, ${actual.currentCharts} explicitly unavailable current timelines, ${actual.newlyObservedChartKeys} new keys.`);
