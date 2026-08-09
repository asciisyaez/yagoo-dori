import { expect, test } from "@playwright/test";

const basePath = process.env.YAGOO_DORI_BASE_PATH ?? "/yagoo-dori";

function prefixed(pathname: string) {
  return `${basePath}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

test("static export includes the Board planner shell and talent reference section", async ({ page }) => {
  await page.goto(prefixed("/holomem-board/"), { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Plan your Board path" })).toBeVisible();
  await expect(page.getByText("How these suggestions work", { exact: true })).toBeVisible();

  await page.goto(prefixed("/talents/azki/"), { waitUntil: "domcontentloaded" });
  const board = page.locator("#holomem-board");
  await expect(board.getByRole("heading", { level: 2, name: "AZKi's Board grid" })).toBeVisible();
  await expect(board.getByRole("heading", { level: 3, name: "Four Board connection slots" })).toBeVisible();
  await expect(board.getByRole("heading", { level: 3, name: "Variant groups for AZKi" })).toBeVisible();
  await expect(board.getByText("G-008", { exact: true })).toBeVisible();
});
