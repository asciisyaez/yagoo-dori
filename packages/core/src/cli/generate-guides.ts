import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import {
  DEFAULT_GUIDE_ANCHOR_CARD_ID,
  generateNativeGuideData,
  mergeNativeGuideData,
} from "../native-guide-generator";
import { NativeGuideDataSchema } from "../native-guide-schema";

function argument(name: string): string | undefined {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function argumentsFor(name: string): string[] {
  const values: string[] = [];
  for (let index = 2; index < process.argv.length; index += 1) {
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

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const generatedAt = argument("--generated-at") ?? new Date().toISOString();
const outputPath = resolve(
  repositoryRoot,
  argument("--output") ?? "data/generated/native-guides.json",
);
const anchorCardIds = [...new Set(argumentsFor("--anchor-card-id"))].sort();
const fixedLeaderOutfitCardId = argument("--leader-outfit-card-id");
const replaceAll = process.argv.includes("--replace-all");

if (fixedLeaderOutfitCardId && anchorCardIds.length > 1) {
  throw new Error("A fixed Leader Outfit can only be used with one guide anchor per run");
}

const requestedAnchorCardIds = anchorCardIds.length > 0
  ? anchorCardIds
  : [DEFAULT_GUIDE_ANCHOR_CARD_ID];

console.log(`Generating native guide data at ${generatedAt}...`);
const generatedData = requestedAnchorCardIds.map((anchorCardId, index) => {
  console.log(`[${index + 1}/${requestedAnchorCardIds.length}] Anchor ${anchorCardId}`);
  return generateNativeGuideData(generatedAt, {
    anchorCardId,
    ...(fixedLeaderOutfitCardId ? { fixedLeaderOutfitCardId } : {}),
  }, (message) => console.log(message));
});
const existingData = !replaceAll && existsSync(outputPath)
  ? NativeGuideDataSchema.parse(JSON.parse(readFileSync(outputPath, "utf8")))
  : undefined;
const data = mergeNativeGuideData(generatedAt, generatedData, existingData);
const json = `${JSON.stringify(data, null, 2)}\n`;
mkdirSync(dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.${process.pid}.tmp`;
try {
  writeFileSync(temporaryPath, json, "utf8");
  renameSync(temporaryPath, outputPath);
} finally {
  rmSync(temporaryPath, { force: true });
}
console.log(`Wrote ${outputPath}`);
console.log(`Guide SHA-256: ${createHash("sha256").update(json).digest("hex")}`);
console.log(`Guides: ${data.guides.length}.`);
