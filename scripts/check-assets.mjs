import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

const manifest = JSON.parse(await readFile("data/generated/card-art-manifest.json", "utf8"));
const publicData = JSON.parse(await readFile("data/generated/holodori-public.json", "utf8"));
const failures = [];
const expectedCount = publicData.counts?.total;
const requiredDimensions = {
  icon: { width: 300, height: 300 },
  illustration: { width: 2282, height: 1284 },
};

function webpDimensions(bytes, label) {
  if (
    bytes.length < 30 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  ) {
    throw new Error(`${label}: expected a WebP image`);
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = bytes.toString("ascii", offset, offset + 4);
    const chunkLength = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (chunkType === "VP8X" && chunkLength >= 10) {
      return {
        width: 1 + bytes.readUIntLE(dataOffset + 4, 3),
        height: 1 + bytes.readUIntLE(dataOffset + 7, 3),
      };
    }
    if (chunkType === "VP8L" && chunkLength >= 5 && bytes[dataOffset] === 0x2f) {
      return {
        width: 1 + bytes[dataOffset + 1] + ((bytes[dataOffset + 2] & 0x3f) << 8),
        height:
          1 +
          ((bytes[dataOffset + 2] & 0xc0) >> 6) +
          (bytes[dataOffset + 3] << 2) +
          ((bytes[dataOffset + 4] & 0x0f) << 10),
      };
    }
    if (
      chunkType === "VP8 " &&
      chunkLength >= 10 &&
      bytes[dataOffset + 3] === 0x9d &&
      bytes[dataOffset + 4] === 0x01 &&
      bytes[dataOffset + 5] === 0x2a
    ) {
      return {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    offset = dataOffset + chunkLength + (chunkLength % 2);
  }

  throw new Error(`${label}: WebP dimensions could not be decoded`);
}

if (!Number.isSafeInteger(expectedCount) || expectedCount <= 0) {
  failures.push("public dataset: invalid total card count");
}
if (
  manifest.expectedCounts?.cards !== expectedCount ||
  manifest.expectedCounts?.icons !== expectedCount ||
  manifest.expectedCounts?.illustrations !== expectedCount
) {
  failures.push("manifest: declared asset counts do not match the normalized roster");
}
if (!Array.isArray(manifest.assets) || manifest.assets.length !== expectedCount) {
  failures.push(`manifest: expected ${expectedCount} card records, found ${manifest.assets?.length ?? 0}`);
}

const seenCardIds = new Set();
const seenLocalPaths = new Set();
const seenSourceUrls = new Set();
const seenHashes = { icon: new Set(), illustration: new Set() };
const expectedFiles = { icon: new Set(), illustration: new Set() };

for (const asset of manifest.assets ?? []) {
  if (seenCardIds.has(asset.cardId)) failures.push(`${asset.cardId}: duplicate manifest record`);
  seenCardIds.add(asset.cardId);

  if (asset.status !== "downloaded" || !asset.icon || !asset.illustration) {
    failures.push(`${asset.cardId}: missing downloaded art mappings`);
    continue;
  }
  if (!asset.talentId || !asset.retrievedAt) {
    failures.push(`${asset.cardId}: card-level talent or retrieval metadata missing`);
  }

  for (const [kind, record] of Object.entries({ icon: asset.icon, illustration: asset.illustration })) {
    const expectedClass = kind === "icon" ? "card-icon" : "card-illustration";
    if (
      !record.localPath ||
      !record.sourcePage ||
      !record.sourceUrl ||
      !record.retrievedAt ||
      !record.sha256 ||
      !record.assetClass
    ) {
      failures.push(`${asset.cardId}: ${kind} provenance mapping missing`);
      continue;
    }
    if (record.assetClass !== expectedClass) {
      failures.push(`${asset.cardId}: ${kind} asset class is ${record.assetClass}, expected ${expectedClass}`);
    }
    if (record.cardId !== asset.cardId || record.talentId !== asset.talentId) {
      failures.push(`${asset.cardId}: ${kind} card/talent identity mismatch`);
    }
    if (record.retrievedAt !== asset.retrievedAt) {
      failures.push(`${asset.cardId}: ${kind} retrieval date mismatch`);
    }
    if (seenLocalPaths.has(record.localPath)) {
      failures.push(`${asset.cardId}: duplicate local path ${record.localPath}`);
    }
    if (seenSourceUrls.has(record.sourceUrl)) {
      failures.push(`${asset.cardId}: duplicate source URL ${record.sourceUrl}`);
    }
    if (seenHashes[kind].has(record.sha256)) {
      failures.push(`${asset.cardId}: duplicate ${kind} binary ${record.sha256}`);
    }
    seenLocalPaths.add(record.localPath);
    seenSourceUrls.add(record.sourceUrl);
    seenHashes[kind].add(record.sha256);
    expectedFiles[kind].add(basename(record.localPath));

    const path = join("apps", "web", "public", record.localPath.replace(/^\//, ""));
    try {
      const bytes = await readFile(path);
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (hash !== record.sha256) failures.push(`${asset.cardId}: ${kind} SHA-256 mismatch`);
      if (bytes.length !== record.bytes) failures.push(`${asset.cardId}: ${kind} byte-count mismatch`);

      const dimensions = webpDimensions(bytes, `${asset.cardId} ${kind}`);
      if (dimensions.width !== record.width || dimensions.height !== record.height) {
        failures.push(`${asset.cardId}: ${kind} manifest dimensions do not match the local file`);
      }
      const required = requiredDimensions[kind];
      const dimensionsValid = kind === "icon"
        ? dimensions.width === required.width && dimensions.height === required.height
        : dimensions.width >= required.width && dimensions.height >= required.height;
      if (!dimensionsValid) {
        failures.push(
          `${asset.cardId}: ${kind} is ${dimensions.width}x${dimensions.height}; ` +
          `${kind === "icon" ? "required" : "minimum"} ${required.width}x${required.height}`,
        );
      }
    } catch (error) {
      failures.push(`${asset.cardId}: ${kind} local validation failed (${error.message})`);
    }
  }
}

for (const [kind, directory] of Object.entries({
  icon: join("apps", "web", "public", "game", "cards"),
  illustration: join("apps", "web", "public", "game", "illustrations"),
})) {
  const localFiles = new Set((await readdir(directory)).filter((file) => file.endsWith(".webp")));
  const missing = [...expectedFiles[kind]].filter((file) => !localFiles.has(file));
  const untracked = [...localFiles].filter((file) => !expectedFiles[kind].has(file));
  if (missing.length) failures.push(`${kind} directory: ${missing.length} manifest files missing`);
  if (untracked.length) failures.push(`${kind} directory: ${untracked.length} untracked WebP files`);
}

if (failures.length > 0) {
  console.error("Asset provenance check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Asset provenance check passed (${manifest.assets.length} icons at 300x300 and ` +
  `${manifest.assets.length} illustrations at 2282x1284 or larger).`,
);
