import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { cardIconRecipes, renderReviewedCardIcon } from "./card-icon-recipes.mjs";

test("Bijou uses the verified Happy card icon rather than a temporary portrait crop", async () => {
  const id = "card-04014-5-uniq-0094-00";
  const manifest = JSON.parse(await readFile("data/generated/card-art-manifest.json", "utf8"));
  const publicData = JSON.parse(await readFile("data/generated/holodori-public.json", "utf8"));
  const record = manifest.assets.find((asset) => asset.cardId === id);
  const card = publicData.cards.find((entry) => entry.id === id);
  const icon = await readFile(`apps/web/public${record.icon.localPath}`);
  const metadata = await sharp(icon).metadata();
  assert.equal(card.attribute, "happy");
  assert.equal(record.icon.sourceUrl, "https://appmedia.jp/wp-content/uploads/2026/10/100705_5slpv.webp");
  assert.equal(createHash("sha256").update(icon).digest("hex"), record.icon.sha256);
  assert.equal(metadata.width, 300);
  assert.equal(metadata.height, 300);
  assert.equal(cardIconRecipes[id], undefined);
  await assert.rejects(renderReviewedCardIcon(id, icon), /No reviewed icon recipe/);
});
