import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { generateResearchRanking } from "../ranking";

const first = JSON.stringify(generateResearchRanking(), null, 2);
const second = JSON.stringify(generateResearchRanking(), null, 2);

if (first !== second) {
  console.error("Ranking generation is not deterministic.");
  process.exit(1);
}

const digest = createHash("sha256").update(first).digest("hex");
const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1) {
  const requested = process.argv[outputIndex + 1];
  if (!requested) throw new Error("--output requires a repository-relative JSON path");
  const outputPath = resolve(requested);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${first}\n`, "utf8");
  console.log(`Wrote ranking snapshot: ${requested}`);
}
console.log(`Deterministic ranking snapshot validated.`);
console.log(`SHA-256: ${digest}`);
console.log(`Entries: ${generateResearchRanking().entries.length}`);
console.log("Snapshot remains Theorycraft Beta and research-only.");
