import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const manifest = JSON.parse(await readFile("data/generated/card-art-manifest.json", "utf8"));
const failures = [];

for (const asset of manifest.assets) {
  if (asset.status !== "downloaded" || !asset.icon || !asset.illustration) {
    failures.push(`${asset.cardId}: missing downloaded art mappings`);
    continue;
  }
  for (const [kind, record] of Object.entries({ icon: asset.icon, illustration: asset.illustration })) {
    if (!record.localPath || !record.sourceUrl) {
      failures.push(`${asset.cardId}: ${kind} source mapping missing`);
      continue;
    }
    const path = join("apps", "web", "public", record.localPath.replace(/^\//, ""));
    try {
      const bytes = await readFile(path);
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (hash !== record.sha256) failures.push(`${asset.cardId}: ${kind} SHA-256 mismatch`);
    } catch {
      failures.push(`${asset.cardId}: ${kind} local file missing`);
    }
  }
}

if (failures.length > 0) {
  console.error("Asset provenance check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Asset provenance check passed (${manifest.assets.length * 2} locally stored game images).`);
