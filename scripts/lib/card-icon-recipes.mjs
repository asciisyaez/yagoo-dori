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
  "card-00002-5-uniq-0104-00": Object.freeze({
    sourceSha256: "3eb24c8e66cc5371469325590ded91334b551a5c85f3b68a3d891823fc9a26ce",
    crop: Object.freeze({ left: 30, top: 0, width: 400, height: 400 }),
    width: 300, height: 300, quality: 90, effort: 6,
    reason: "The public Holodori Lab post provides a 711x400 card illustration but no square icon; reviewed crop centers Robocosan's face and upper body without inventing badge or frame art.",
  }),
  "card-00019-5-uniq-0108-00": Object.freeze({
    sourceSha256: "ada47b11b91a4087dfbce3d633b105da978e885d26c4cb4e13165fce5ce3d731",
    crop: Object.freeze({ left: 110, top: 0, width: 400, height: 400 }),
    width: 300, height: 300, quality: 90, effort: 6,
    reason: "The public Holodori Lab post provides a 711x400 card illustration but no square icon; reviewed crop centers Pekora's face and upper body without inventing badge or frame art.",
  }),
  "card-00031-5-uniq-0105-00": Object.freeze({
    sourceSha256: "f773925b9c9cb25e2820a7fd4c65c3421b3c871f95349cf3e92ab7ee787f70cc",
    crop: Object.freeze({ left: 100, top: 0, width: 400, height: 400 }),
    width: 300, height: 300, quality: 90, effort: 6,
    reason: "The public Holodori Lab post provides a 711x400 card illustration but no square icon; reviewed crop centers Nene's face and upper body without inventing badge or frame art.",
  }),
  "card-03006-5-uniq-0107-00": Object.freeze({
    sourceSha256: "71bbeeb2274fe4495fee7c5487cb59052b3043a1962fd9fcaa92506b2bb54d1d",
    crop: Object.freeze({ left: 220, top: 0, width: 400, height: 400 }),
    width: 300, height: 300, quality: 90, effort: 6,
    reason: "The public Holodori Lab post provides a 711x400 card illustration but no square icon; reviewed crop centers Reine's face and upper body without inventing badge or frame art.",
  }),
  "card-04007-5-uniq-0106-00": Object.freeze({
    sourceSha256: "ec95321150c88cfb69cbf2f0d3be4c0de5b5474e7729447c5df1116fccc25b9c",
    crop: Object.freeze({ left: 60, top: 0, width: 400, height: 400 }),
    width: 300, height: 300, quality: 90, effort: 6,
    reason: "The public Holodori Lab post provides a 711x400 card illustration but no square icon; reviewed crop centers IRyS's face and upper body without inventing badge or frame art.",
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
