import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fetchGithubRaw } from "./lib/fetch-github-raw.mjs";

// Record the current upstream chart keys separately from the historical scoring
// corpus. A missing current hash cannot prove a historical timeline is current.
const publicData = JSON.parse(await readFile("data/generated/holodori-public.json", "utf8"));
const historical = JSON.parse(await readFile("data/generated/holodori-songs.json", "utf8"));
const source = publicData.sourceSnapshots.english;
const retrievedAt = process.argv.find((arg) => arg.startsWith("--retrieved-at="))?.slice(15) ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(retrievedAt)) throw new Error("Expected --retrieved-at=YYYY-MM-DD");
const url = `${source.repository.replace("github.com", "raw.githubusercontent.com")}/${source.commit}/MusicDifficultyChart.json`;
const bytes = Buffer.from(await (await fetchGithubRaw(url, { userAgent: "Yagoo-dori chart metadata audit" })).arrayBuffer());
const rows = JSON.parse(bytes.toString("utf8"));
const historicalKeys = new Set(historical.charts.map((chart) => chart.key));
const seen = new Set();
const charts = rows.map(({ data }) => {
  const difficulty = data.difficultyType?.match(/^MusicDifficultyType_MUSIC_DIFFICULTY_TYPE_(EASY|NORMAL|HARD|EXPERT)$/)?.[1]?.toLowerCase();
  if (!difficulty || !data.musicId || !Number.isInteger(data.fullComboNoteCount)) throw new Error("Unexpected chart row; review source schema");
  if (data.chartHash != null || data.normalNoteCount != null) throw new Error("Source now provides chart metadata; review before marking it unavailable");
  const key = `${data.musicId}:${difficulty}`;
  if (seen.has(key)) throw new Error(`Duplicate current chart key ${key}`);
  seen.add(key);
  return { key, songId: data.musicId, difficulty, fullComboNoteCount: data.fullComboNoteCount, currentChartHash: null, currentTiming: "unavailable", reason: "source-omits-current-hash-and-timing", presentInHistoricalScoringSnapshot: historicalKeys.has(key) };
}).sort((a, b) => a.key.localeCompare(b.key));
const payload = { schemaVersion: 1, source: { repository: source.repository, commit: source.commit, masterVersion: source.masterVersion, table: "MusicDifficultyChart.json", sourceSha256: createHash("sha256").update(bytes).digest("hex"), retrievedAt }, historicalScoringCommit: historical.sourceSnapshot.commit, counts: { currentCharts: charts.length, currentSongs: new Set(charts.map((chart) => chart.songId)).size, currentTimingUnavailable: charts.length, alsoInHistoricalScoringSnapshot: charts.filter((chart) => chart.presentInHistoricalScoringSnapshot).length, newlyObservedChartKeys: charts.filter((chart) => !chart.presentInHistoricalScoringSnapshot).length, historicalKeysAbsentFromCurrent: [...historicalKeys].filter((key) => !seen.has(key)).length }, charts };
await writeFile("data/native/current-chart-availability-v1.json", `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload.counts));
