import sharp from "sharp";
import { createHash } from "node:crypto";

// Exact reviewed crops of local public originals. No invented badges or frame art.
export const cardIconRecipes = Object.freeze({
});

export async function renderReviewedCardIcon(cardId, sourceBytes) {
  const recipe = cardIconRecipes[cardId];
  if (!recipe) throw new Error(`No reviewed icon recipe for ${cardId}`);
  const sourceHash = createHash("sha256").update(sourceBytes).digest("hex");
  if (sourceHash !== recipe.sourceSha256) throw new Error(`${cardId}: icon recipe source changed; review the crop again`);
  if (sharp.versions.sharp !== "0.35.5") throw new Error("Reviewed icons require sharp 0.35.5");
  return sharp(sourceBytes).extract(recipe.crop).resize(recipe.width, recipe.height)
    .webp({ quality: recipe.quality, effort: recipe.effort }).toBuffer();
}
