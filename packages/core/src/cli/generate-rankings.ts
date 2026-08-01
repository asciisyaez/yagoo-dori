import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, parse, resolve } from "node:path";

import {
  deserializeFrozenNativeBaseline,
  generateNativeRankingSnapshot,
  nativeBaselineKey,
  SerializedFrozenNativeBaselineSchema,
  type NativeBaselineKey,
  type SerializedFrozenNativeBaseline,
} from "../native-ranking-generator";
import {
  generateNativeRankingChangelog,
  NativeComparableRankingSnapshotSchema,
  NativeRankingAttributionManifestSchema,
  type NativeComparableRankingSnapshot,
  type NativeRankingAttributionManifest,
} from "../native-ranking-changelog";

function argument(name: string): string | undefined {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const generatedAt = argument("--generated-at") ?? new Date().toISOString();
const outputPath = resolve(
  repositoryRoot,
  argument("--output") ?? "data/generated/native-rankings.json",
);
const baselineDirectory = resolve(
  repositoryRoot,
  argument("--baseline-dir") ?? "data/native/baselines",
);
const changelogOutputPath = resolve(
  repositoryRoot,
  argument("--changelog-output") ?? "data/generated/native-ranking-changelog.json",
);
const attributionPath = argument("--attribution");
const refreshBaselines = process.argv.includes("--refresh-baselines");

function readPreviousSnapshot(): NativeComparableRankingSnapshot | null {
  if (!existsSync(outputPath)) return null;
  return NativeComparableRankingSnapshotSchema.parse(
    JSON.parse(readFileSync(outputPath, "utf8")),
  );
}

function readAttributionManifest(): NativeRankingAttributionManifest | undefined {
  if (!attributionPath) return undefined;
  const filename = resolve(repositoryRoot, attributionPath);
  return NativeRankingAttributionManifestSchema.parse(
    JSON.parse(readFileSync(filename, "utf8")),
  );
}

function directJsonFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => resolve(directory, entry.name))
    .sort();
}

function readFrozenBaselines(): Map<NativeBaselineKey, SerializedFrozenNativeBaseline> {
  const result = new Map<NativeBaselineKey, SerializedFrozenNativeBaseline>();
  if (refreshBaselines || !existsSync(baselineDirectory)) {
    return result;
  }
  const ids = new Set<string>();
  for (const filename of directJsonFiles(baselineDirectory)) {
    const value = SerializedFrozenNativeBaselineSchema.parse(
      JSON.parse(readFileSync(filename, "utf8")),
    );
    deserializeFrozenNativeBaseline(value);
    const key = nativeBaselineKey(value.entityKind, value.lens);
    if (result.has(key)) throw new Error(`Multiple frozen native baselines found for ${key}`);
    if (ids.has(value.id)) throw new Error(`Duplicate frozen native baseline ID: ${value.id}`);
    ids.add(value.id);
    result.set(key, value);
  }
  if (result.size !== 0 && result.size !== 6) {
    throw new Error(`Expected zero or six frozen baselines, found ${result.size}`);
  }
  return result;
}

function clearFrozenBaselineJsonFiles(): void {
  const root = parse(baselineDirectory).root;
  if (baselineDirectory === root || baselineDirectory === repositoryRoot) {
    throw new Error(`Refusing to clear unsafe baseline directory: ${baselineDirectory}`);
  }
  for (const filename of directJsonFiles(baselineDirectory)) {
    if (dirname(filename) !== baselineDirectory) {
      throw new Error(`Refusing to clear a baseline outside ${baselineDirectory}`);
    }
    unlinkSync(filename);
  }
}

console.log(`Generating native ranking snapshot at ${generatedAt}...`);
const previousSnapshot = readPreviousSnapshot();
const attributionManifest = readAttributionManifest();
const frozenBaselines = readFrozenBaselines();
if (frozenBaselines.size > 0) {
  console.log(`Reusing ${frozenBaselines.size} frozen launch baselines.`);
}
const generated = generateNativeRankingSnapshot(
  generatedAt,
  (message) => console.log(message),
  frozenBaselines,
  undefined,
  previousSnapshot,
);
const snapshotJson = `${JSON.stringify(generated.snapshot, null, 2)}\n`;
const changelog = generateNativeRankingChangelog(
  previousSnapshot,
  generated.snapshot,
  attributionManifest,
);
const changelogJson = `${JSON.stringify(changelog, null, 2)}\n`;

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(changelogOutputPath), { recursive: true });
mkdirSync(baselineDirectory, { recursive: true });
// Refresh is intentionally delayed until generation succeeds, so a failed run
// cannot destroy the last usable baseline set. Only direct JSON files are reset.
if (refreshBaselines) clearFrozenBaselineJsonFiles();
writeFileSync(outputPath, snapshotJson, "utf8");
writeFileSync(changelogOutputPath, changelogJson, "utf8");
for (const baseline of generated.baselines) {
  writeFileSync(
    resolve(baselineDirectory, `${baseline.id}.json`),
    `${JSON.stringify(baseline, null, 2)}\n`,
    "utf8",
  );
}

const digest = createHash("sha256").update(snapshotJson).digest("hex");
console.log(`Wrote ${outputPath}`);
console.log(`Wrote ${changelogOutputPath} (${changelog.entries.length} attributed changes)`);
console.log(`Wrote ${generated.baselines.length} frozen baselines to ${baselineDirectory}`);
console.log(`Snapshot SHA-256: ${digest}`);
console.log(
  `Member entries: ${generated.snapshot.lenses.map((lens) => `${lens.label}=${lens.entries.length}`).join(", ")}`,
);
console.log(
  `Leader/Outfit entries: ${generated.snapshot.leaderOutfitLenses.map((lens) => `${lens.label}=${lens.entries.length}`).join(", ")}`,
);
