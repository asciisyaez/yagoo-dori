import { expect, test } from "@playwright/test";

const GUIDE_SLUG = "azki-a-flower-in-full-bloom-team-guide";
const DISCLAIMER = "Unofficial fan site; not affiliated with COVER Corp. or QualiArts.";

test("guide library opens a real generated team guide", async ({ page }) => {
  await page.goto("/guides");

  await expect(page.getByRole("heading", { level: 1, name: "Teams for rating songs." })).toBeVisible();
  await expect(page.getByRole("heading", { name: /AZKi.*team guide/i })).toBeVisible();
  await expect(page.getByText(/Leader Outfit/i).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/AppMedia|Art pending rights/i);

  await page.getByRole("link", { name: /Open team guide/i }).click();
  await expect(page).toHaveURL(new RegExp(`/guides/${GUIDE_SLUG}$`));
  await expect(page.getByRole("heading", { level: 1, name: "AZKi" })).toBeVisible();
});

test("generated guide renders three legal formations and decision details", async ({ page }) => {
  await page.goto(`/guides/${GUIDE_SLUG}`);

  for (const [sectionId, label] of [
    ["formation-premium", /Bloom 5.*Member lineup/i],
    ["formation-standard", /Bloom 0.*Member lineup/i],
    ["formation-accessible-4-star", /4★ core.*Member lineup/i],
  ] as const) {
    const section = page.locator(`#${sectionId}`);
    await expect(section).toBeVisible();
    const order = section.getByRole("list", { name: label });
    await expect(order.locator(":scope > li")).toHaveCount(5);
  }

  const accessibleOrder = page
    .locator("#formation-accessible-4-star")
    .getByRole("list", { name: /4★ core.*Member lineup/i });
  await expect(accessibleOrder.locator('img[alt*="4 star"]')).toHaveCount(4);
  await expect(accessibleOrder.locator('img[alt*="5 star"]')).toHaveCount(1);

  await expect(page.getByRole("heading", { name: "Why this lineup works" }).first()).toBeVisible();
  await expect(page.locator("#formation-standard [aria-label$='static parameter calculation']")).toBeVisible();
  await expect(page.getByText("Effective static pool", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practical swaps" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active and Special timing" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Use one build unless the chart changes the answer" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Most rating songs" })).toBeVisible();
  await expect(page.locator("#rating-song-comparisons article")).toHaveCount(1);
  await expect(page.getByText("Standard build", { exact: true })).toBeVisible();

  await expect(page.getByText(DISCLAIMER, { exact: true })).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText(/AppMedia|globally optimal|canonical display|heuristic coverage|unavailable|unresolved/i);
});

test("guide remains within the mobile viewport", async ({ isMobile, page }) => {
  test.skip(!isMobile, "Mobile guide layout assertion");
  await page.goto(`/guides/${GUIDE_SLUG}`);

  const dimensions = await page.locator("body").evaluate((body) => ({
    clientWidth: body.clientWidth,
    scrollWidth: body.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  await expect(page.getByRole("navigation", { name: "Guide sections" })).toBeVisible();
  await expect(page.getByRole("list", { name: /^Bloom 0.*Member lineup$/i })).toBeVisible();
});
