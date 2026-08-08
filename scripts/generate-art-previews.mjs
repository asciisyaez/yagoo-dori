import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import sharp from "sharp";

const EXPECTED_COUNT = 115;
const SOURCE_MANIFEST_PATH = "data/generated/card-art-manifest.json";
const PREVIEW_MANIFEST_PATH = "data/generated/card-art-preview-manifest.json";
const PUBLIC_ROOT = join("apps", "web", "public");
const PREVIEW_DIRECTORY = join(PUBLIC_ROOT, "game", "previews");
const GENERATOR = {
  library: "sharp",
  version: "0.35.3",
  format: "webp",
  resize: {
    width: 1024,
    height: 576,
    fit: "cover",
    position: "centre",
  },
  webp: {
    quality: 80,
    effort: 6,
  },
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const sourceManifestBytes = await readFile(SOURCE_MANIFEST_PATH);
const sourceManifest = JSON.parse(sourceManifestBytes.toString("utf8"));

if (sharp.versions.sharp !== GENERATOR.version) {
  throw new Error(
    `Preview generator requires sharp ${GENERATOR.version}, found ${sharp.versions.sharp}.`,
  );
}
if (!Array.isArray(sourceManifest.assets) || sourceManifest.assets.length !== EXPECTED_COUNT) {
  throw new Error(
    `Preview generator expected ${EXPECTED_COUNT} source illustrations, found ` +
      `${sourceManifest.assets?.length ?? 0}.`,
  );
}

sharp.cache(false);
sharp.concurrency(1);
await mkdir(PREVIEW_DIRECTORY, { recursive: true });

const previews = [];
const expectedFiles = new Set();

for (const asset of sourceManifest.assets) {
  const source = asset.illustration;
  if (!source?.localPath || !source.sha256) {
    throw new Error(`${asset.cardId}: source illustration mapping is incomplete.`);
  }

  const sourceBytes = await readFile(join(PUBLIC_ROOT, source.localPath.replace(/^\//, "")));
  const sourceHash = sha256(sourceBytes);
  if (sourceHash !== source.sha256) {
    throw new Error(`${asset.cardId}: source illustration SHA-256 does not match its manifest.`);
  }

  const filename = basename(source.localPath);
  const outputLocalPath = `/game/previews/${filename}`;
  const outputFilePath = join(PREVIEW_DIRECTORY, filename);
  const outputBytes = await sharp(sourceBytes, { animated: false })
    .resize(GENERATOR.resize.width, GENERATOR.resize.height, {
      fit: GENERATOR.resize.fit,
      position: GENERATOR.resize.position,
    })
    .webp(GENERATOR.webp)
    .toBuffer();

  await writeFile(outputFilePath, outputBytes);
  expectedFiles.add(filename);
  previews.push({
    cardId: asset.cardId,
    source: {
      path: source.localPath,
      sha256: sourceHash,
    },
    output: {
      path: outputLocalPath,
      sha256: sha256(outputBytes),
      bytes: outputBytes.length,
      width: GENERATOR.resize.width,
      height: GENERATOR.resize.height,
    },
  });
}

for (const filename of await readdir(PREVIEW_DIRECTORY)) {
  if (filename.endsWith(".webp") && !expectedFiles.has(filename)) {
    await unlink(join(PREVIEW_DIRECTORY, filename));
  }
}

const previewManifest = {
  schemaVersion: 1,
  expectedCount: EXPECTED_COUNT,
  sourceManifest: {
    path: SOURCE_MANIFEST_PATH,
    sha256: sha256(sourceManifestBytes),
    schemaVersion: sourceManifest.schemaVersion,
    retrievedAt: sourceManifest.retrievedAt,
  },
  generator: GENERATOR,
  previews,
};

await writeFile(PREVIEW_MANIFEST_PATH, `${JSON.stringify(previewManifest, null, 2)}\n`);

const totalBytes = previews.reduce((sum, preview) => sum + preview.output.bytes, 0);
console.log(
  `Generated ${previews.length} deterministic 1024x576 WebP previews ` +
    `(${totalBytes.toLocaleString("en-US")} bytes total).`,
);
