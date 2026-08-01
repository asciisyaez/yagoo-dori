import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

const sourceManifestPath = "data/generated/card-art-manifest.json";
const sourceManifestBytes = await readFile(sourceManifestPath);
const manifest = JSON.parse(sourceManifestBytes.toString("utf8"));
const previewManifest = JSON.parse(
  await readFile("data/generated/card-art-preview-manifest.json", "utf8"),
);
const publicData = JSON.parse(await readFile("data/generated/holodori-public.json", "utf8"));
const failures = [];
const expectedCount = publicData.counts?.total;
const expectedPreviewCount = 113;
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

const expectedPreviewGenerator = {
  library: "sharp",
  version: "0.35.3",
  format: "webp",
  resize: { width: 1024, height: 576, fit: "cover", position: "centre" },
  webp: { quality: 80, effort: 6 },
};
const sourceManifestHash = createHash("sha256").update(sourceManifestBytes).digest("hex");

if (expectedCount !== expectedPreviewCount) {
  failures.push(
    `preview roster: expected exactly ${expectedPreviewCount} cards, found ${expectedCount ?? 0}`,
  );
}
if (
  previewManifest.expectedCount !== expectedPreviewCount ||
  !Array.isArray(previewManifest.previews) ||
  previewManifest.previews.length !== expectedPreviewCount
) {
  failures.push(
    `preview manifest: expected exactly ${expectedPreviewCount} mappings, found ` +
      `${previewManifest.previews?.length ?? 0}`,
  );
}
if (JSON.stringify(previewManifest.generator) !== JSON.stringify(expectedPreviewGenerator)) {
  failures.push("preview manifest: generator settings are not the pinned 1024x576 WebP recipe");
}
if (
  previewManifest.sourceManifest?.path !== sourceManifestPath ||
  previewManifest.sourceManifest?.sha256 !== sourceManifestHash ||
  previewManifest.sourceManifest?.schemaVersion !== manifest.schemaVersion ||
  previewManifest.sourceManifest?.retrievedAt !== manifest.retrievedAt
) {
  failures.push("preview manifest: source-manifest identity is stale or incomplete");
}

const sourceIllustrations = new Map(
  (manifest.assets ?? []).map((asset) => [asset.cardId, asset.illustration]),
);
const seenPreviewCards = new Set();
const seenPreviewPaths = new Set();
const expectedPreviewFiles = new Set();

for (const preview of previewManifest.previews ?? []) {
  if (!preview.cardId || seenPreviewCards.has(preview.cardId)) {
    failures.push(`${preview.cardId ?? "unknown preview"}: duplicate or missing preview card ID`);
    continue;
  }
  seenPreviewCards.add(preview.cardId);

  const source = sourceIllustrations.get(preview.cardId);
  const expectedSourcePath = source?.localPath;
  const expectedOutputPath = expectedSourcePath?.replace(
    /^\/game\/illustrations\//,
    "/game/previews/",
  );
  if (
    !source ||
    preview.source?.path !== expectedSourcePath ||
    preview.source?.sha256 !== source.sha256
  ) {
    failures.push(`${preview.cardId}: preview source path or SHA-256 does not match the illustration`);
  }
  if (!expectedOutputPath || preview.output?.path !== expectedOutputPath) {
    failures.push(`${preview.cardId}: preview output path does not match its illustration filename`);
    continue;
  }
  if (seenPreviewPaths.has(preview.output.path)) {
    failures.push(`${preview.cardId}: duplicate preview output path ${preview.output.path}`);
  }
  seenPreviewPaths.add(preview.output.path);
  expectedPreviewFiles.add(basename(preview.output.path));

  const path = join("apps", "web", "public", preview.output.path.replace(/^\//, ""));
  try {
    const bytes = await readFile(path);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== preview.output.sha256) {
      failures.push(`${preview.cardId}: preview SHA-256 mismatch`);
    }
    if (bytes.length !== preview.output.bytes) {
      failures.push(`${preview.cardId}: preview byte-count mismatch`);
    }
    const dimensions = webpDimensions(bytes, `${preview.cardId} preview`);
    if (
      dimensions.width !== 1024 ||
      dimensions.height !== 576 ||
      preview.output.width !== 1024 ||
      preview.output.height !== 576
    ) {
      failures.push(`${preview.cardId}: preview must be exactly 1024x576`);
    }
  } catch (error) {
    failures.push(`${preview.cardId}: preview local validation failed (${error.message})`);
  }
}

const localPreviewFiles = new Set(
  (await readdir(join("apps", "web", "public", "game", "previews"))).filter((file) =>
    file.endsWith(".webp"),
  ),
);
const missingPreviews = [...expectedPreviewFiles].filter((file) => !localPreviewFiles.has(file));
const untrackedPreviews = [...localPreviewFiles].filter((file) => !expectedPreviewFiles.has(file));
if (missingPreviews.length) {
  failures.push(`preview directory: ${missingPreviews.length} manifest files missing`);
}
if (untrackedPreviews.length) {
  failures.push(`preview directory: ${untrackedPreviews.length} untracked WebP files`);
}
if (
  seenPreviewCards.size !== sourceIllustrations.size ||
  [...sourceIllustrations.keys()].some((cardId) => !seenPreviewCards.has(cardId))
) {
  failures.push("preview manifest: mappings do not cover every source illustration exactly once");
}

if (failures.length > 0) {
  console.error("Asset provenance check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Asset provenance check passed (${manifest.assets.length} icons at 300x300 and ` +
  `${manifest.assets.length} illustrations at 2282x1284 or larger; ` +
  `${previewManifest.previews.length} previews at 1024x576).`,
);
