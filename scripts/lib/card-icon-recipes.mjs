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
    sourceSha256: "d70b446ced92e36776de03a986da3e4fbe37e343137496a7b932c0992e4a7273",
    crop: Object.freeze({ left: 87, top: 0, width: 1165, height: 1165 }),
    width: 300, height: 300, quality: 90, effort: 6,
    reason: "Reviewed portrait crop of the higher-resolution public Game8 illustration; no invented badge or frame.",
  }),
  "card-00019-5-uniq-0108-00": Object.freeze({
    sourceSha256: "bfb2b391eb3f2ee248899f674ea143cfa0bb5e3b081ec5fb89107478187022e9",
    crop: Object.freeze({ left: 320, top: 0, width: 1165, height: 1165 }),
    width: 300, height: 300, quality: 90, effort: 6,
    reason: "Reviewed portrait crop of the higher-resolution public Game8 illustration; no invented badge or frame.",
  }),
  "card-00031-5-uniq-0105-00": Object.freeze({
    sourceSha256: "4957a664c1bd9f83d6f58126637b6134b556c90f27c19267381cf82f13506f8b",
    crop: Object.freeze({ left: 291, top: 0, width: 1165, height: 1165 }),
    width: 300, height: 300, quality: 90, effort: 6,
    reason: "Reviewed portrait crop of the higher-resolution public Game8 illustration; no invented badge or frame.",
  }),
  "card-03006-5-uniq-0107-00": Object.freeze({
    sourceSha256: "f9e9a5d94be47376476639ae5774075e1ce9716a8b06a099fcbeb642552bf64b",
    crop: Object.freeze({ left: 641, top: 0, width: 1165, height: 1165 }),
    width: 300, height: 300, quality: 90, effort: 6,
    reason: "Reviewed portrait crop of the higher-resolution public Game8 illustration; no invented badge or frame.",
  }),
  "card-04007-5-uniq-0106-00": Object.freeze({
    sourceSha256: "09850886482de1d967cdeddbbd504fb26055880527fa28872126b8f0de8efd44",
    crop: Object.freeze({ left: 175, top: 0, width: 1165, height: 1165 }),
    width: 300, height: 300, quality: 90, effort: 6,
    reason: "Reviewed portrait crop of the higher-resolution public Game8 illustration; no invented badge or frame.",
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
