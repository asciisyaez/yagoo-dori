import sharp from "sharp";
import { createHash } from "node:crypto";

// Exact reviewed crops of local public originals. No invented badges or frame art.
export const cardIconRecipes = Object.freeze({
  "card-04014-5-uniq-0094-00": Object.freeze({
    sourceSha256: "53a29bea1744d33f214caf40c6e3820a51efe605d7670444ddc632f479b56923",
    crop: Object.freeze({ left: 300, top: 0, width: 1165, height: 1165 }),
    width: 300, height: 300, quality: 90, effort: 6,
    reason: "AppMedia's square icon embeds the wrong Cute badge; Game8's 185px icon uses a different frame. Use a square portrait of the verified Beaming Sandcastle illustration without either embedded badge.",
  }),
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
