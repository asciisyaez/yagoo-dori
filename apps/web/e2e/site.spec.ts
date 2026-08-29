import { expect, test } from "@playwright/test";

const DISCLAIMER = "Unofficial fan site; not affiliated with COVER Corp. or QualiArts.";
const AZKI_CARD_SLUG = "azki-a-flower-in-full-bloom-card-00013-5-uniq-0002-00";
const GOTO_OPTIONS = { waitUntil: "domcontentloaded" as const };

const corePublicRoutes = [
  "/",
  "/tier-list",
  "/cards",
  `/cards/${AZKI_CARD_SLUG}`,
];

test("renders the exact unofficial-site disclaimer once per public page", async ({ isMobile, page }) => {
  test.setTimeout(60_000);

  for (const route of corePublicRoutes) {
    await page.goto(route, GOTO_OPTIONS);

    const footer = page.getByRole("contentinfo");
    const disclaimer = page.getByText(DISCLAIMER, { exact: true });
    await expect(disclaimer).toHaveCount(1);
    await expect(disclaimer).toBeVisible();
    await expect(footer.getByText(DISCLAIMER, { exact: true })).toHaveCount(1);
    await expect(page.locator("body")).not.toContainText(/Art pending rights/i);
    await expect(page.locator("body")).not.toContainText(/AppMedia/i);
    await expect(page.locator("body")).not.toContainText(/illustrative (?:data|PI|score)/i);
    if (route === "/tier-list") {
      // The tier list deliberately discloses provisional status (UX honesty);
      // every other core route must still never leak the internal term. The
      // heading note collapses with the rest of the heading prose on mobile,
      // where the always-visible results-line marker carries the disclosure.
      await expect(page.getByText(/provisional model tiers/)).toBeVisible();
      const headingNote = page.getByText(/Model tiers, published as provisional theorycraft/);
      await expect(headingNote).toHaveCount(1);
      if (!isMobile) await expect(headingNote).toBeVisible();
    } else if (route.startsWith("/cards/")) {
      // Card profiles are direct landing pages: their tier badges must carry
      // the same provisional-model disclosure as the tier page.
      await expect(page.getByText(/provisional model tier (SS|[SABCD])\b/).first()).toBeVisible();
      const cardNote = page.getByText(/Model tiers, published as provisional theorycraft/);
      await expect(cardNote).toHaveCount(1);
      await expect(cardNote).toBeVisible();
    } else {
      await expect(page.locator("body")).not.toContainText(/Provisional/i);
    }
  }
});

test("homepage surfaces the current Gamers banner and its four featured cards", async ({ page }) => {
  await page.goto("/", GOTO_OPTIONS);

  await expect(page.getByRole("heading", { name: "Summer Survival on the Island!" })).toBeVisible();
  await expect(page.getByText("炎天下のトロピックアイランドガチャ", { exact: true })).toBeVisible();
  await expect(page.locator(".current-banner-card")).toHaveCount(4);
  for (const talentName of ["Shirakami Fubuki", "Ookami Mio", "Nekomata Okayu", "Inugami Korone"]) {
    await expect(page.locator(".current-banner-card").filter({ hasText: talentName })).toBeVisible();
  }
  await expect(page.locator(".current-banner-songs")).toContainText("We are GAMERS !!!!");
});

test("mobile drawer closes on Escape and returns focus to its trigger", async ({ isMobile, page }) => {
  test.skip(!isMobile, "Mobile drawer assertion");
  await page.goto("/", GOTO_OPTIONS);

  const openTrigger = page.getByRole("button", { name: "Open menu" });
  await openTrigger.click();
  const closeTrigger = page.getByRole("button", { name: "Close menu" });
  await expect(closeTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#mobile-navigation-panel")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator("#mobile-navigation-panel")).toHaveCount(0);
  await expect(openTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(openTrigger).toBeFocused();
});

test("desktop presents a persistent grouped sidebar for the core database tasks", async ({
  isMobile,
  page,
}) => {
  test.skip(isMobile, "Desktop sidebar assertion");
  await page.goto("/", GOTO_OPTIONS);

  const sidebar = page.locator("aside").filter({
    has: page.getByRole("navigation", { name: /primary|site/i }),
  });
  await expect(sidebar).toBeVisible();

  const primaryNavigation = sidebar.getByRole("navigation", { name: /primary|site/i });
  for (const label of [/tier list/i, /cards(?:\s*&\s*outfits)?/i, /talents/i]) {
    await expect(primaryNavigation.getByRole("link", { name: label }).first()).toBeVisible();
  }

  const position = await sidebar.evaluate((element) => getComputedStyle(element).position);
  expect(["fixed", "sticky"]).toContain(position);
});

test("native tier contexts and lenses expose the full real 4-star and 5-star roster", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/tier-list", GOTO_OPTIONS);

  await expect(page.getByRole("heading", { level: 1, name: "hololive Dreams tier list" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Member cards/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: /Standard Manual/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("124 cards shown", { exact: true })).toBeVisible();
  await expect(page.locator(".game-card-tile")).toHaveCount(124);
  await expect(page.locator(".tier-new-card-chip")).toHaveCount(4);
  for (const talentName of ["Shirakami Fubuki", "Ookami Mio", "Nekomata Okayu", "Inugami Korone"]) {
    await expect(page.getByRole("link", { name: new RegExp(`${talentName}.*New`, "i") }).first()).toBeVisible();
  }
  for (const talentName of ["Nakiri Ayame", "Himemori Luna", "Kureiji Ollie", "Mori Calliope", "Ninomae Ina'nis"]) {
    await expect(page.getByRole("link", { name: new RegExp(`${talentName}.*New`, "i") })).toHaveCount(0);
  }
  await expect(page.locator(".tier-ss .game-card-tile")).toHaveCount(0);
  await expect(page.locator(".tier-s .game-card-tile")).toHaveCount(20);
  await expect(page.locator(".tier-a .game-card-tile")).toHaveCount(26);
  await expect(page.locator(".tier-b .game-card-tile")).toHaveCount(24);
  await expect(page.locator(".tier-c .game-card-tile")).toHaveCount(54);
  await expect(page.locator(".tier-d .game-card-tile")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Theorycraft Beta");

  await page.getByRole("tab", { name: /Leader \/ Outfits/i }).click();
  await expect(page).toHaveURL(/(?:\?|&)context=outfits(?:&|$)/);
  await expect(page.getByText("124 Outfits shown", { exact: true })).toBeVisible();
  await expect(page.locator(".game-card-tile")).toHaveCount(124);
  await expect(page.locator(".tier-new-card-chip")).toHaveCount(4);

  await page.getByRole("tab", { name: /Member cards/i }).click();
  await expect(page.getByText("124 cards shown", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: /Low Investment/i }).click();
  await expect(page).toHaveURL(/(?:\?|&)lens=low-investment(?:&|$)/);
  await expect(page.getByRole("tab", { name: /Low Investment/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.getByRole("button", { name: "4★", exact: true }).click();
  await expect(page).toHaveURL(/(?:\?|&)rarity=4(?:&|$)/);
  await expect(page.getByText("54 cards shown", { exact: true })).toBeVisible();
  await expect(page.locator(".game-card-tile")).toHaveCount(54);
});

test("Leader Outfit tier context hydrates from a shareable URL", async ({ page }) => {
  await page.goto("/tier-list?context=outfits&lens=duplicate-enabled-ceiling&q=AZKi", GOTO_OPTIONS);

  await expect(page.getByRole("tab", { name: /Leader \/ Outfits/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: /Max Ceiling/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("searchbox", { name: "Search cards" })).toHaveValue("AZKi");
  await expect(page.locator(".game-card-tile")).toHaveCount(2);

  await page.reload();
  await expect(page.getByRole("tab", { name: /Leader \/ Outfits/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("searchbox", { name: "Search cards" })).toHaveValue("AZKi");
});

test("tier card quick view exposes the mechanics for each ranking context", async ({ page }) => {
  await page.goto("/tier-list?q=AZKi", GOTO_OPTIONS);

  await page.getByRole("button", { name: /Quick view AZKi, A Flower in Full Bloom/i }).click();
  const memberDialog = page.getByRole("dialog");
  await expect(memberDialog).toBeVisible();
  await expect(memberDialog.getByRole("heading", { name: "AZKi" })).toBeVisible();
  await expect(memberDialog.getByText("A Flower in Full Bloom", { exact: true })).toBeVisible();
  await expect(memberDialog.getByRole("heading", { name: "Active", exact: true })).toBeVisible();
  await expect(memberDialog.getByRole("heading", { name: "Passive", exact: true })).toBeVisible();
  await expect(memberDialog.getByRole("heading", { name: "Special", exact: true })).toBeVisible();
  await expect(memberDialog.getByText("10,346", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(memberDialog).not.toBeVisible();

  await page.getByRole("tab", { name: /Leader \/ Outfits/i }).click();
  await page.getByRole("button", { name: /Quick view AZKi, Graceful Scent/i }).click();
  const outfitDialog = page.getByRole("dialog");
  await expect(outfitDialog.getByText("Leader Outfit", { exact: true })).toBeVisible();
  await expect(outfitDialog.getByRole("heading", { name: "Leader effect" })).toBeVisible();
  await expect(outfitDialog).not.toContainText("Theorycraft Beta");
});

test("tier context and lens tabs support arrow-key selection", async ({ page }) => {
  await page.goto("/tier-list", GOTO_OPTIONS);

  const memberTab = page.getByRole("tab", { name: /Member cards/i });
  await memberTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Leader \/ Outfits/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page).toHaveURL(/(?:\?|&)context=outfits(?:&|$)/);

  const standardTab = page.getByRole("tab", { name: /Standard Manual/i });
  await standardTab.focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: /Max Ceiling/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page).toHaveURL(/(?:\?|&)lens=duplicate-enabled-ceiling(?:&|$)/);
});

test("tier filters hydrate from a shareable deep link and survive reload", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(
    "/tier-list?lens=low-investment&rarity=4&attribute=cute&generation=Gen+0&q=AZKi",
    GOTO_OPTIONS,
  );

  const lowInvestmentTab = page.getByRole("tab", { name: /Low Investment/i });
  const search = page.getByRole("searchbox", { name: "Search cards" });
  const generation = page.getByRole("combobox", { name: "Generation" });

  await expect(lowInvestmentTab).toHaveAttribute("aria-selected", "true");
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
  await expect(page).toHaveURL(/\/tier-list\?lens=low-investment$/);
  await expect(page.getByText("124 cards shown", { exact: true })).toBeVisible();
});

test("AZKi profile renders the pinned real illustration, stats, skills, and Outfit", async ({
  page,
}) => {
  await page.goto(`/cards/${AZKI_CARD_SLUG}`, GOTO_OPTIONS);

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

test("skip link provides a keyboard path into the main content", async ({ page }) => {
  await page.goto("/", GOTO_OPTIONS);

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator("#main-content")).toBeVisible();
});

test("reduced-motion preference collapses tier animation durations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tier-list", GOTO_OPTIONS);

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
  await page.goto("/", GOTO_OPTIONS);

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
  for (const label of [/tier list/i, /cards(?:\s*&\s*outfits)?/i, /talents/i]) {
    const link = mobileNavigation.getByRole("link", { name: label }).first();
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  }

  await mobileNavigation.getByRole("link", { name: /tier list/i }).click();
  await expect(page).toHaveURL(/\/tier-list$/);
  await expect(mobileNavigation).not.toBeVisible();
});
