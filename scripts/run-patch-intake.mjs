import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const generatedDirectory = join(root, "data", "generated");
const manifestPath = join(root, "data", "native", "patch-intake-manifest-v1.json");
const pnpmCommand = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "pnpm";
const startedAt = Date.now();

const syncCommands = [
  { name: "data:sync:public", output: "data/generated/holodori-public.json", args: ["--skip-art"] },
  { name: "data:sync:mechanics", output: "data/generated/holodori-mechanics.json", args: [] },
  { name: "data:sync:songs", output: "data/generated/holodori-songs.json", args: [] },
  { name: "data:sync:timelines", output: "data/generated/holodori-chart-timelines.json", args: [] },
];

const pinFiles = [
  {
    path: "scripts/sync-public-data.mjs",
    fields: ["sources.english.commit", "sources.japanese.commit", "sources.*.masterVersion"],
  },
  {
    path: "scripts/sync-mechanics-data.mjs",
    fields: ["sourceSnapshot.commit", "sourceSnapshot.masterVersion"],
  },
  {
    path: "packages/core/src/song-contexts.test.ts",
    fields: ["pinned source commit literal"],
  },
  {
    path: "packages/core/src/score-kernel.test.ts",
    fields: ["pinned source commit literal"],
  },
  {
    path: "packages/core/src/native-published-data.test.ts",
    fields: ["pinned source commit literal"],
  },
  {
    path: "scripts/check-assets.mjs",
    fields: ["expected icon/illustration/preview counts"],
  },
  {
    path: "scripts/sync-song-data.mjs",
    fields: ["sourceSnapshot.commit", "sourceSnapshot.masterVersion"],
  },
  {
    path: "data/native/chart-timeline-source.json",
    fields: ["sourceId", "apiRevision", "parserReference.commit"],
  },
  {
    path: "data/native/ranking-benchmark-v1.json",
    fields: ["benchmarkId", "corpus.entriesSha256", "corpus.reference", "corpus.current"],
  },
];

const testCountPinFiles = {
  "holodori-public.json": ["packages/core/src/public-data.test.ts"],
  "holodori-mechanics.json": ["packages/core/src/mechanics.test.ts"],
  "holodori-songs.json": ["packages/core/src/song-contexts.test.ts"],
  "holodori-chart-timelines.json": ["packages/core/src/chart-timelines.test.ts"],
  "holodori-ranking-corpus-timelines.json": ["packages/core/src/ranking-corpus-timelines.test.ts"],
  "holodori-guide-rating-timelines.json": ["packages/core/src/guide-rating-timelines.test.ts"],
};

function argumentValue(name) {
  const argument = process.argv.find((value) => value.startsWith(`${name}=`));
  return argument?.slice(name.length + 1);
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function canonicalize(value) {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function snapshotGeneratedFiles() {
  const entries = await readdir(generatedDirectory, { withFileTypes: true });
  const snapshot = new Map();
  for (const entry of entries.filter((candidate) => candidate.isFile() && candidate.name.endsWith(".json")).sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = `data/generated/${entry.name}`;
    const bytes = await readFile(join(generatedDirectory, entry.name));
    snapshot.set(relativePath, { bytes, sha256: sha256(bytes) });
  }
  return snapshot;
}

function snapshotsEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const [path, entry] of left) {
    if (right.get(path)?.sha256 !== entry.sha256) return false;
  }
  return true;
}

function parseSnapshot(snapshot) {
  return new Map(
    [...snapshot].map(([path, entry]) => [path, {
      ...entry,
      json: JSON.parse(entry.bytes.toString("utf8")),
    }]),
  );
}

function rowIdentity(collection, row, index) {
  const id = row.id ?? row.cardId ?? row.key ?? row.slug;
  return id === undefined ? `${collection}[${index}]` : String(id);
}

function datasetView(value) {
  if (!value || typeof value !== "object") {
    return { rows: new Map(), rowCounts: {}, declaredCounts: null };
  }

  const rows = new Map();
  const rowCounts = {};
  for (const [collection, collectionValue] of Object.entries(value)) {
    if (!Array.isArray(collectionValue)) continue;
    rowCounts[collection] = collectionValue.length;
    if (!collectionValue.every((row) => row && typeof row === "object" && !Array.isArray(row))) continue;

    for (const [index, row] of collectionValue.entries()) {
      const id = rowIdentity(collection, row, index);
      const rowKey = `${collection}:${id}`;
      rows.set(rows.has(rowKey) ? `${rowKey}#${index}` : rowKey, { id, row });
    }
  }

  return {
    rows,
    rowCounts,
    declaredCounts: {
      ...(value.counts && typeof value.counts === "object" ? { counts: value.counts } : {}),
      ...(value.coverage && typeof value.coverage === "object" ? { coverage: value.coverage } : {}),
    },
  };
}

function diffDataset(path, beforeValue, afterValue) {
  const before = datasetView(beforeValue);
  const after = datasetView(afterValue);
  const addedIds = new Set();
  const removedIds = new Set();
  let changedRowCount = 0;

  for (const [rowKey, { id, row }] of after.rows) {
    const previous = before.rows.get(rowKey);
    if (!previous) {
      addedIds.add(id);
    } else if (canonicalize(previous.row) !== canonicalize(row)) {
      changedRowCount += 1;
    }
  }
  for (const [rowKey, { id }] of before.rows) {
    if (!after.rows.has(rowKey)) removedIds.add(id);
  }

  return {
    path,
    changed: canonicalize(beforeValue) !== canonicalize(afterValue),
    addedIds: [...addedIds].sort((left, right) => left.localeCompare(right)),
    removedIds: [...removedIds].sort((left, right) => left.localeCompare(right)),
    changedRowCount,
    countsBefore: {
      rows: before.rowCounts,
      declared: before.declaredCounts,
    },
    countsAfter: {
      rows: after.rowCounts,
      declared: after.declaredCounts,
    },
  };
}

function getJson(snapshot, path) {
  return snapshot.get(path)?.json;
}

function changedCountPinFiles(datasets) {
  return [...new Set(
    datasets
      .filter((dataset) => canonicalize(dataset.countsBefore) !== canonicalize(dataset.countsAfter))
      .flatMap((dataset) => testCountPinFiles[dataset.path.replace("data/generated/", "")] ?? []),
  )].sort((left, right) => left.localeCompare(right));
}

function cardList(snapshot) {
  const cards = getJson(snapshot, "data/generated/holodori-public.json")?.cards ?? [];
  return cards
    .map((card) => ({
      id: card.id,
      talent: card.talentName ?? card.talentId,
      rarity: card.rarity,
      firstSeenAt: card.firstSeenAt,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function pinFileBytes() {
  return new Map(await Promise.all(
    pinFiles.map(async ({ path }) => [path, await readFile(join(root, path))]),
  ));
}

function pinFilesEqual(before, after) {
  if (before.size !== after.size) return false;
  for (const [path, bytes] of before) {
    if (!after.has(path) || !bytes.equals(after.get(path))) return false;
  }
  return true;
}

async function runPnpm(command, extraArgs = []) {
  const args = [command, ...extraArgs];
  console.log(`\n> pnpm ${args.join(" ")}`);
  const processArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm.cmd", ...args]
    : args;
  await execFileAsync(pnpmCommand, processArgs, { cwd: root, stdio: "inherit" });
}

const requestedRetrievedAt = argumentValue("--retrieved-at");
if (requestedRetrievedAt !== undefined && !isIsoDate(requestedRetrievedAt)) {
  throw new Error(`Invalid --retrieved-at ${JSON.stringify(requestedRetrievedAt)}; expected YYYY-MM-DD.`);
}

const beforeSnapshot = await snapshotGeneratedFiles();
const beforeJson = parseSnapshot(beforeSnapshot);
// A pin bump means this run ingests a NEW upstream snapshot: new rows must
// be stamped with a fresh date, never the previous artifact's retrievedAt.
// Each dataset carries its OWN pinned commit in its own sync script, so the
// comparison is per dataset; an unchanged pin keeps the existing date so
// idempotence/no-op re-syncs stay byte-stable.
const freshDate = new Date().toISOString().slice(0, 10);
async function datasetRetrievedAt(scriptPath, artifactPath, commitOf) {
  if (requestedRetrievedAt !== undefined) return requestedRetrievedAt;
  const pinnedCommit = (await readFile(join(root, scriptPath), "utf8"))
    .match(/commit:\s*"([0-9a-f]{40})"/)?.[1] ?? null;
  const existing = getJson(beforeJson, artifactPath);
  if (!existing) return freshDate;
  const existingCommit = commitOf(existing) ?? null;
  const pinChanged = pinnedCommit !== null && existingCommit !== null && pinnedCommit !== existingCommit;
  return pinChanged ? freshDate : existing.retrievedAt ?? freshDate;
}
const publicRetrievedAt = await datasetRetrievedAt(
  "scripts/sync-public-data.mjs",
  "data/generated/holodori-public.json",
  (artifact) => artifact.sourceSnapshots?.english?.commit,
);
const mechanicsRetrievedAt = await datasetRetrievedAt(
  "scripts/sync-mechanics-data.mjs",
  "data/generated/holodori-mechanics.json",
  (artifact) => artifact.sourceSnapshot?.commit,
);
const songsRetrievedAt = await datasetRetrievedAt(
  "scripts/sync-song-data.mjs",
  "data/generated/holodori-songs.json",
  (artifact) => artifact.sourceSnapshot?.commit,
);
// The first pass must run with art enabled so a genuinely new card's icon,
// illustration, and preview are fetched and the manifest covers the new
// roster; --skip-art is only safe on the idempotence re-pass.
const publicArgsFirstPass = [`--retrieved-at=${publicRetrievedAt}`];
const publicArgsRepass = ["--skip-art", `--retrieved-at=${publicRetrievedAt}`];

// The GitHub-pinned syncs must succeed; the chart-timeline API is served
// behind intermittent scrape protection (recorded-unavailable convention),
// so its failure downgrades to an explicit skip in the manifest rather than
// aborting the whole intake. The operator retries that stage later.
let timelineStage = { status: "synced", reasonCode: null };
let timelineStageError = null;

const API_UNAVAILABLE_PATTERN = /Failed to read chart API revision|HTTP 403|Cloudflare|ENOTFOUND|ECONNRESET|ETIMEDOUT/i;

async function runSyncPass(publicArgs) {
  await runPnpm("data:sync:public", publicArgs);
  await runPnpm("data:sync:mechanics", [`--retrieved-at=${mechanicsRetrievedAt}`]);
  await runPnpm("data:sync:songs", [`--retrieved-at=${songsRetrievedAt}`]);
  if (timelineStage.status !== "synced") return;
  try {
    await runPnpm("data:sync:timelines");
  } catch (error) {
    const text = error instanceof Error ? `${error.message}\n${error.stderr ?? ""}\n${error.stdout ?? ""}` : String(error);
    if (!API_UNAVAILABLE_PATTERN.test(text)) throw error;
    timelineStage = { status: "skipped-api-unavailable", reasonCode: "chart-api-unreachable" };
    timelineStageError = text.split("\n").find((line) => API_UNAVAILABLE_PATTERN.test(line))?.slice(0, 200) ?? text.slice(0, 200);
  }
}

const pinBytesBefore = await pinFileBytes();
await runSyncPass(publicArgsFirstPass);
await runPnpm("assets:previews", []);
const firstPassSnapshot = await snapshotGeneratedFiles();
await runSyncPass(publicArgsRepass);
const finalSnapshot = await snapshotGeneratedFiles();
// An accepted timeline skip must leave every timeline artifact byte-identical
// to its pre-intake state - a partially written corpus must never pass.
if (timelineStage.status !== "synced") {
  for (const [file, entry] of beforeSnapshot) {
    if (!/timeline/i.test(file)) continue;
    if (finalSnapshot.get(file)?.sha256 !== entry.sha256) {
      throw new Error(`Timeline sync was skipped but ${file} changed - partial write detected.`);
    }
  }
}
const finalJson = parseSnapshot(finalSnapshot);
const pinBytesAfter = await pinFileBytes();

const datasets = [...new Set([...beforeJson.keys(), ...finalJson.keys()])]
  .sort((left, right) => left.localeCompare(right))
  .map((path) => diffDataset(path, getJson(beforeJson, path) ?? null, getJson(finalJson, path) ?? null));
const changedDatasets = datasets.filter((dataset) => dataset.changed);
const countPinFiles = changedCountPinFiles(datasets);
const idempotenceStable = snapshotsEqual(firstPassSnapshot, finalSnapshot);
const pinsUnchanged = pinFilesEqual(pinBytesBefore, pinBytesAfter);
const finalCards = cardList(finalJson);

const deterministicManifest = {
  schemaVersion: 1,
  id: "patch-intake-manifest-v1",
  methodologyVersion: "yd-patch-intake-v1",
  retrievedAt: {
    public: publicRetrievedAt,
    mechanics: mechanicsRetrievedAt,
    songs: songsRetrievedAt,
    timelines: getJson(finalJson, "data/generated/holodori-chart-timelines.json")?.retrievedAt ?? null,
  },
  timelineStage: { status: timelineStage.status, reasonCode: timelineStage.reasonCode },
  pinFiles,
  syncCommands: syncCommands.map(({ name, output }) => ({ name, output })),
  datasets,
  cards: finalCards,
  idempotence: {
    checked: true,
    unchangedPinFiles: pinsUnchanged,
    stableAcrossConsecutiveSyncPasses: idempotenceStable,
  },
  regeneration: {
    required: ["pnpm rankings:generate"],
  },
  testCountPinFiles: countPinFiles,
};
const deterministicDigest = sha256(Buffer.from(canonicalize(deterministicManifest), "utf8"));
const manifest = {
  ...deterministicManifest,
  deterministicDigest,
  runtimeMetadata: {
    generatedAt: new Date().toISOString(),
    elapsedMilliseconds: Date.now() - startedAt,
    changedDatasetCount: changedDatasets.length,
    timelineStageError,
  },
};

await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log("\nPatch intake summary");
console.log(`Datasets changed: ${changedDatasets.length === 0 ? "none" : changedDatasets.map((dataset) => dataset.path).join(", ")}`);
console.log(`Cards in final snapshot: ${finalCards.length}.`);
console.log(`Idempotence: ${idempotenceStable && pinsUnchanged ? "PASS" : "FAIL"} (two consecutive sync passes on unchanged pin files).`);
console.log(`Manifest: data/native/patch-intake-manifest-v1.json (${deterministicDigest}).`);
console.log("Pinned commit/revision files (manual edits only):");
for (const { path, fields } of pinFiles) console.log(`- ${path}: ${fields.join(", ")}`);
console.log("Operator-owned regeneration: pnpm rankings:generate (deliberately separate from intake). Guides remain outside Batch F1.");
console.log(`Test files with moved count pins: ${countPinFiles.length === 0 ? "none" : countPinFiles.join(", ")}`);
if (timelineStage.status !== "synced") {
  console.log(`WARNING: chart-timeline sync ${timelineStage.status} [${timelineStage.reasonCode}] (${timelineStageError}); the committed timeline corpus was left untouched - retry pnpm data:sync:timelines when the API is reachable.`);
}

if (!idempotenceStable || !pinsUnchanged) {
  process.exitCode = 1;
}
