import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { cardIconRecipes, renderReviewedCardIcon } from "./lib/card-icon-recipes.mjs";
const manifestPath = "data/generated/card-art-manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
for (const asset of manifest.assets) {
  const recipe = cardIconRecipes[asset.cardId];
  if (!recipe) continue;
  const bytes = await renderReviewedCardIcon(asset.cardId, await readFile(`apps/web/public${asset.illustration.localPath}`));
  await writeFile(`apps/web/public${asset.icon.localPath}`, bytes);
  asset.icon = {
    ...asset.icon,
    sourcePage: asset.illustration.sourcePage, sourceUrl: asset.illustration.sourceUrl,
    retrievedAt: asset.illustration.retrievedAt,
    matchMethod: "reviewed-illustration-portrait-crop",
    transformation: { recipe: asset.cardId, sourceSha256: recipe.sourceSha256, library: "sharp", version: "0.35.5", crop: recipe.crop, width: recipe.width, height: recipe.height, quality: recipe.quality, effort: recipe.effort },
    width: recipe.width, height: recipe.height, bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log("Applied reviewed card-icon recipes; regenerate previews to bind the updated manifest.");
