import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { generateNativeGuideData } from "../native-guide-generator";

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
  argument("--output") ?? "data/generated/native-guides.json",
);
const anchorCardId = argument("--anchor-card-id");
const fixedLeaderOutfitCardId = argument("--leader-outfit-card-id");

console.log(`Generating native guide data at ${generatedAt}...`);
const data = generateNativeGuideData(generatedAt, {
  ...(anchorCardId ? { anchorCardId } : {}),
  ...(fixedLeaderOutfitCardId ? { fixedLeaderOutfitCardId } : {}),
}, (message) => console.log(message));
const json = `${JSON.stringify(data, null, 2)}\n`;
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, json, "utf8");
console.log(`Wrote ${outputPath}`);
console.log(`Guide SHA-256: ${createHash("sha256").update(json).digest("hex")}`);
console.log(`Guides: ${data.guides.length}; publication state: Theorycraft Beta.`);
