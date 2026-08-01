import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { rebaseNativeGuideDataSnapshot } from "../native-guide-generator";
import { NativeGuideDataSchema } from "../native-guide-schema";
import { nativeRankingChangelogData } from "../native-ranking-changelog-data";

function argument(name: string): string | undefined {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const outputPath = resolve(
  repositoryRoot,
  argument("--output") ?? "data/generated/native-guides.json",
);
const generatedAt = argument("--generated-at") ?? new Date().toISOString();
const existing = NativeGuideDataSchema.parse(JSON.parse(readFileSync(outputPath, "utf8")));
const rebased = rebaseNativeGuideDataSnapshot(
  generatedAt,
  existing,
  nativeRankingChangelogData,
);
const json = `${JSON.stringify(rebased, null, 2)}\n`;
mkdirSync(dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.${process.pid}.tmp`;
try {
  writeFileSync(temporaryPath, json, "utf8");
  renameSync(temporaryPath, outputPath);
} finally {
  rmSync(temporaryPath, { force: true });
}
console.log(`Rebased ${rebased.guides.length} guides to ${nativeRankingChangelogData.to.snapshotId}.`);
console.log(`Guide SHA-256: ${createHash("sha256").update(json).digest("hex")}`);
