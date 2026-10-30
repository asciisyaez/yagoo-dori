import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const checker = resolve("scripts/check-current-chart-availability.mjs");
test("current chart audit rejects stale sources and invented timing evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "yagoo-chart-audit-"));
  const source = { commit: "a".repeat(40), masterVersion: "b".repeat(64), sourceSha256: "c".repeat(64) };
  const charts = [
    { key: "m1:expert", songId: "m1", difficulty: "expert", fullComboNoteCount: 100, currentChartHash: null, currentTiming: "unavailable", reason: "source-omits-current-hash-and-timing", presentInHistoricalScoringSnapshot: true },
    { key: "m2:expert", songId: "m2", difficulty: "expert", fullComboNoteCount: 200, currentChartHash: null, currentTiming: "unavailable", reason: "source-omits-current-hash-and-timing", presentInHistoricalScoringSnapshot: false },
  ];
  const valid = { schemaVersion: 1, source, historicalScoringCommit: "d".repeat(40), counts: { currentCharts: 2, currentSongs: 2, currentTimingUnavailable: 2, alsoInHistoricalScoringSnapshot: 1, newlyObservedChartKeys: 1, historicalKeysAbsentFromCurrent: 0 }, charts };
  const auditPath = join(root, "data/native/current-chart-availability-v1.json");
  const run = () => execFileSync(process.execPath, [checker], { cwd: root, stdio: "pipe" });
  try {
    await mkdir(join(root, "data/native"), { recursive: true });
    await mkdir(join(root, "data/generated"), { recursive: true });
    await writeFile(join(root, "data/generated/holodori-public.json"), JSON.stringify({ sourceSnapshots: { english: source } }));
    await writeFile(join(root, "data/generated/holodori-songs.json"), JSON.stringify({ sourceSnapshot: { commit: valid.historicalScoringCommit }, charts: [{ key: "m1:expert" }] }));
    await writeFile(auditPath, JSON.stringify(valid));
    assert.doesNotThrow(run);
    const badTiming = structuredClone(valid); badTiming.charts[1].currentChartHash = "invented";
    await writeFile(auditPath, JSON.stringify(badTiming)); assert.throws(run, /invalid or duplicate chart/);
    const badPin = structuredClone(valid); badPin.source.commit = "e".repeat(40);
    await writeFile(auditPath, JSON.stringify(badPin)); assert.throws(run, /source binding or schema is stale/);
    const duplicate = structuredClone(valid); duplicate.charts[1] = duplicate.charts[0];
    await writeFile(auditPath, JSON.stringify(duplicate)); assert.throws(run, /invalid or duplicate chart/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
