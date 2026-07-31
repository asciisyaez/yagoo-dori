import { expect, test } from "@playwright/test";

const DISCLAIMER = "Unofficial fan site; not affiliated with COVER Corp. or QualiArts.";
const AZKI_CARD_SLUG = "azki-a-flower-in-full-bloom-card-00013-5-uniq-0002-00";

const corePublicRoutes = [
  "/",
  "/tier-list",
  "/cards",
  `/cards/${AZKI_CARD_SLUG}`,
];

test("renders the exact unofficial-site disclaimer once per public page", async ({ page }) => {
  test.setTimeout(60_000);

  for (const route of corePublicRoutes) {
    await page.goto(route);

    const footer = page.getByRole("contentinfo");
    const disclaimer = page.getByText(DISCLAIMER, { exact: true });
    await expect(disclaimer).toHaveCount(1);
    await expect(disclaimer).toBeVisible();
    await expect(footer.getByText(DISCLAIMER, { exact: true })).toHaveCount(1);
  }
});

test("desktop presents a persistent grouped sidebar for the core database tasks", async ({
  isMobile,
  page,
}) => {
  test.skip(isMobile, "Desktop sidebar assertion");
  await page.goto("/");

  const sidebar = page.locator("aside").filter({
    has: page.getByRole("navigation", { name: /primary|site/i }),
  });
  await expect(sidebar).toBeVisible();

  const primaryNavigation = sidebar.getByRole("navigation", { name: /primary|site/i });
  for (const label of [/tier list/i, /member cards|cards/i, /talents/i, /leaders/i]) {
    await expect(primaryNavigation.getByRole("link", { name: label }).first()).toBeVisible();
  }

  const position = await sidebar.evaluate((element) => getComputedStyle(element).position);
  expect(["fixed", "sticky"]).toContain(position);
});

test("tier contexts expose the full real roster without inventing four-star placements", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/tier-list");

  await expect(page.getByRole("heading", { level: 1, name: "hololive Dreams tier list" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /5★ score tier/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("59 cards shown", { exact: true })).toBeVisible();
  await expect(page.locator(".game-card-tile")).toHaveCount(59);

  await page.getByRole("tab", { name: /All 4★ \+ 5★/i }).click();
  await expect(page).toHaveURL(/(?:\?|&)view=roster(?:&|$)/);
  await expect(page.getByRole("tab", { name: /All 4★ \+ 5★/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("113 cards shown", { exact: true })).toBeVisible();
  await expect(page.locator(".game-card-tile")).toHaveCount(113);

  await page.getByRole("button", { name: "4★", exact: true }).click();
  await expect(page).toHaveURL(/(?:\?|&)rarity=4(?:&|$)/);
  await expect(page.getByText("54 cards shown", { exact: true })).toBeVisible();
  await expect(page.locator(".game-card-tile")).toHaveCount(54);
});

test("tier filters hydrate from a shareable deep link and survive reload", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(
    "/tier-list?view=roster&rarity=4&attribute=cute&generation=Gen+0&q=AZKi",
  );

  const rosterTab = page.getByRole("tab", { name: /All 4★ \+ 5★/i });
  const search = page.getByRole("searchbox", { name: "Search cards" });
  const generation = page.getByRole("combobox", { name: "Generation" });

  await expect(rosterTab).toHaveAttribute("aria-selected", "true");
  await expect(search).toHaveValue("AZKi");
  await expect(page.getByRole("button", { name: "4★", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Cute", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(generation).toHaveValue("Gen 0");
  await expect(page.locator(".tier-results-line > span")).toHaveText("1 card shown");
  await expect(page.locator(".game-card-tile")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /AZKi, Upon a Tender Melody, 4 star cute/i })).toBeVisible();

  await page.reload();
  await expect(search).toHaveValue("AZKi");
  await expect(generation).toHaveValue("Gen 0");
  await expect(page.locator(".game-card-tile")).toHaveCount(1);

  await page.getByRole("button", { name: /^Reset/ }).click();
  await expect(page).toHaveURL(/\/tier-list\?view=roster$/);
  await expect(page.getByText("113 cards shown", { exact: true })).toBeVisible();
});

test("AZKi profile renders the pinned real illustration, stats, skills, and Outfit", async ({
  page,
}) => {
  await page.goto(`/cards/${AZKI_CARD_SLUG}`);

  await expect(page.getByRole("heading", { level: 1, name: "AZKi" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "A Flower in Full Bloom" })).toBeVisible();

  const illustration = page.getByRole("img", {
    name: "A Flower in Full Bloom AZKi card illustration",
  });
  await expect(illustration).toBeVisible();
  await expect(illustration).toHaveAttribute(
    "src",
    /card-00013-5-uniq-0002-00\.webp/,
  );

  const parameters = page.locator(".parameter-comparison");
  await expect(parameters.getByText("One copy", { exact: true })).toBeVisible();
  await expect(parameters.getByText("Max Potential", { exact: true })).toBeVisible();
  for (const value of ["6,184", "6,984", "10,346", "6,803", "7,682", "11,380"]) {
    await expect(parameters.getByText(value, { exact: true })).toBeVisible();
  }

  await expect(page.getByRole("heading", { name: "Active", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Passive", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Special", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Graceful Scent" })).toBeVisible();
  await expect(page.getByText("Grants Sense UP 120% to all.", { exact: true })).toBeVisible();
});

test("public decision pages do not expose rejected research placeholders", async ({ page }) => {
  test.setTimeout(60_000);

  for (const route of corePublicRoutes) {
    await page.goto(route);
    await expect(page.locator("body")).not.toContainText(/Art pending rights/i);
    await expect(page.locator("body")).not.toContainText(/Theorycraft Beta/i);
    await expect(page.locator("body")).not.toContainText(/illustrative (?:data|PI|score)/i);
    await expect(page.locator("body")).not.toContainText(/Provisional/i);
  }
});

test("skip link provides a keyboard path into the main content", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator("#main-content")).toBeVisible();
});

test("reduced-motion preference collapses tier animation durations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tier-list");

  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

  const durations = await page.locator(".tier-band").first().evaluate((element) => {
    const style = getComputedStyle(element);
    const parse = (value: string) =>
      value.split(",").map((part) => {
        const trimmed = part.trim();
        return trimmed.endsWith("ms")
          ? Number.parseFloat(trimmed)
          : Number.parseFloat(trimmed) * 1000;
      });
    return [...parse(style.animationDuration), ...parse(style.transitionDuration)];
  });

  expect(Math.max(...durations)).toBeLessThanOrEqual(1);
});

test("mobile drawer is keyboard reachable and the database does not overflow", async ({
  isMobile,
  page,
}) => {
  test.skip(!isMobile, "Mobile navigation assertion");
  await page.goto("/");

  const bodyMetrics = await page.locator("body").evaluate((body) => ({
    clientWidth: body.clientWidth,
    scrollWidth: body.scrollWidth,
  }));
  expect(bodyMetrics.scrollWidth).toBeLessThanOrEqual(bodyMetrics.clientWidth + 1);

  const drawerTrigger = page.getByRole("button", { name: /open (?:site )?navigation|menu/i });
  await expect(drawerTrigger).toBeVisible();
  await drawerTrigger.focus();
  await page.keyboard.press("Enter");

  const mobileNavigation = page.getByRole("navigation", { name: /mobile/i });
  await expect(mobileNavigation).toBeVisible();
  for (const label of [/tier list/i, /member cards|cards/i, /talents/i, /leaders/i]) {
    const link = mobileNavigation.getByRole("link", { name: label }).first();
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  }

  await drawerTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(mobileNavigation).not.toBeVisible();
});
