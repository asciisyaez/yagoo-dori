import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { renderReviewedCardIcon } from "./card-icon-recipes.mjs";

test("Bijou portrait uses its pinned illustration and rejects changed source bytes", async () => {
  const id = "card-04014-5-uniq-0094-00";
  const original = await readFile(`apps/web/public/game/illustrations/${id}.webp`);
  const icon = await renderReviewedCardIcon(id, original);
  const metadata = await sharp(icon).metadata();
  assert.equal(metadata.width, 300);
  assert.equal(metadata.height, 300);
  assert.deepEqual(icon, await readFile(`apps/web/public/game/cards/${id}.webp`));
  await assert.rejects(renderReviewedCardIcon(id, Buffer.from("wrong source")), /source changed/);
});
