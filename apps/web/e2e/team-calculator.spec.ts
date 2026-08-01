import { expect, test } from "@playwright/test";

const persistedCard = {
  talent: "AZKi",
  title: "A Flower in Full Bloom",
};

test("exact card ownership, Bloom, and Oshi preferences persist across reloads", async ({ isMobile, page }) => {
  await page.goto("/team-builder?q=AZKi&rarity=5", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1, name: "Build from the cards you own" })).toBeVisible();
  await expect(page.getByText(/Cards use max-level stats/)).toBeVisible();
  await expect(page.getByText(/Bloom 5 Connect bonuses depend on your Board/)).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("link", { name: "Team calculator" }).first()).toHaveAttribute("aria-current", "page");
  if (isMobile) await page.getByRole("button", { name: "Menu" }).click();

  const cardButton = page.getByRole("button", {
    name: `Add ${persistedCard.talent}, ${persistedCard.title}, 5 star card`,
  });
  await expect(cardButton).toBeVisible();
  await expect(cardButton).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Add 5 more talents" })).toBeDisabled();
  expect(await cardButton.locator("img").evaluate((image) => getComputedStyle(image).filter)).toContain(
    "grayscale(1)",
  );
  await cardButton.click();
  const selectedCardButton = page.getByRole("button", {
    name: `Remove ${persistedCard.talent}, ${persistedCard.title}, 5 star card`,
  });
  await expect(page.getByRole("button", { name: "Add 4 more talents" })).toBeDisabled();
  await expect.poll(
    () => selectedCardButton.locator("img").evaluate((image) => getComputedStyle(image).filter),
  ).toContain("grayscale(0)");

  const bloom = page.getByRole("combobox", {
    name: `${persistedCard.talent}, ${persistedCard.title} Bloom level`,
  });
  await expect(bloom).toHaveValue("0");
  await bloom.selectOption("3");
  await expect(page.getByText("B3", { exact: true })).toBeVisible();

  await page.getByRole("switch", { name: "Oshi mode" }).click();
  await page.getByRole("combobox", { name: "Oshi talent" }).selectOption({ label: "AZKi" });
  await page.getByRole("button", { name: /Both/ }).click();
  await expect(page.getByRole("switch", { name: "Oshi mode" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: /Both/ })).toHaveAttribute("aria-pressed", "true");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", {
    name: `Remove ${persistedCard.talent}, ${persistedCard.title}, 5 star card`,
  })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("combobox", {
    name: `${persistedCard.talent}, ${persistedCard.title} Bloom level`,
  })).toHaveValue("3");
  await expect(page.getByRole("switch", { name: "Oshi mode" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("combobox", { name: "Oshi talent" })).toHaveValue("chr-00013");
  await expect(page.getByRole("button", { name: /Both/ })).toHaveAttribute("aria-pressed", "true");
});

test("card filters update immediately, preserve rarity groups, and survive reload", async ({ page }) => {
  await page.goto("/team-builder", { waitUntil: "domcontentloaded" });

  await page.getByRole("searchbox", { name: "Search cards" }).fill("Subaru");
  await expect(page.locator("[class*='visibleCount']")).toHaveText("3 / 113");
  await expect(page.locator("[class*='rarityGroup'] h3")).toHaveText([
    "5★ Member cards",
    "4★ Member cards",
  ]);
  await expect(page.locator("[data-rarity='5'] > header > strong")).toHaveText("2");
  await expect(page.locator("[data-rarity='4'] > header > strong")).toHaveText("1");

  await page.getByRole("button", { name: "5★", exact: true }).click();
  await page.getByRole("combobox", { name: "Card type" }).selectOption("pure");
  await expect(page.locator("[class*='visibleCount']")).toHaveText("1 / 113");
  await expect(page.getByRole("button", { name: /Add Oozora Subaru, Vibrant Sun Splash!/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Add Airani Iofifteen/ })).toHaveCount(0);
  await expect(page).toHaveURL(/(?:\?|&)q=Subaru(?:&|$)/);
  await expect(page).toHaveURL(/(?:\?|&)rarity=5(?:&|$)/);
  await expect(page).toHaveURL(/(?:\?|&)attribute=pure(?:&|$)/);
  await expect(page.getByRole("combobox", { name: "Song" })).toHaveCount(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("searchbox", { name: "Search cards" })).toHaveValue("Subaru");
  await expect(page.getByRole("combobox", { name: "Card type" })).toHaveValue("pure");
  await expect(page.getByRole("button", { name: "5★", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "4★", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[class*='visibleCount']")).toHaveText("1 / 113");
});

test("multiple versions of one talent still count as one legal Member choice", async ({ isMobile, page }) => {
  await page.goto("/team-builder?q=Oozora%20Subaru", { waitUntil: "domcontentloaded" });

  const addSubaru = page.getByRole("button", { name: /^Add Oozora Subaru,/ });
  await expect(addSubaru).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) await addSubaru.first().click();

  const selectedRoster = page.getByRole("complementary", { name: "Selected roster" });
  await expect(selectedRoster.getByText("1 / 5 talents", { exact: true })).toBeVisible();
  const calculateButton = isMobile
    ? page.locator("[class*='mobileAction']").getByRole("button", { name: "Add 4 more talents" })
    : selectedRoster.getByRole("button", { name: "Add 4 more talents" });
  await expect(calculateButton).toBeDisabled();
});

test("card ownership and Bloom remain keyboard-usable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/team-builder?q=AZKi&rarity=5", { waitUntil: "domcontentloaded" });

  const search = page.getByRole("searchbox", { name: "Search cards" });
  await search.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("A Flower in Full Bloom");
  const card = page.getByRole("button", {
    name: `Add ${persistedCard.talent}, ${persistedCard.title}, 5 star card`,
  });
  await expect(card).toBeEnabled();
  await card.focus();
  await page.keyboard.press("Enter");

  const bloom = page.getByRole("combobox", {
    name: `${persistedCard.talent}, ${persistedCard.title} Bloom level`,
  });
  await bloom.focus();
  expect(await bloom.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await bloom.selectOption("5");
  await expect(page.getByText("B5", { exact: true })).toBeVisible();

  const selectedCard = page.getByRole("button", {
    name: `Remove ${persistedCard.talent}, ${persistedCard.title}, 5 star card`,
  });
  await selectedCard.hover();
  expect(await selectedCard.locator("img").evaluate((image) => getComputedStyle(image).transitionDuration)).toBe("0s");
  expect(await selectedCard.locator("img").evaluate((image) => getComputedStyle(image).transform)).toBe("none");
});

test("restricted storage falls back to a usable session roster", async ({ isMobile, page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage unavailable", "SecurityError");
      },
    });
  });
  await page.goto("/team-builder?q=AZKi&rarity=5", { waitUntil: "domcontentloaded" });

  const storageStatus = page.getByText("Roster changes stay on this page", { exact: true });
  if (isMobile) await expect(storageStatus).toBeAttached();
  else await expect(storageStatus).toBeVisible();
  await page.getByRole("button", {
    name: `Add ${persistedCard.talent}, ${persistedCard.title}, 5 star card`,
  }).click();
  await expect(page.getByText("B0", { exact: true })).toBeVisible();
});

test("a five-talent roster calculates a legal Leader and five Members off the main thread", async ({
  isMobile,
  page,
}) => {
  test.skip(isMobile, "One browser-worker integration run is sufficient");
  test.setTimeout(120_000);

  await page.goto("/team-builder?rarity=5", { waitUntil: "domcontentloaded" });
  const search = page.getByRole("searchbox", { name: "Search cards" });
  for (const talent of ["AZKi", "Akai Haato", "Aki Rosenthal", "Anya Melfissa", "Ayunda Risu"]) {
    await search.fill(talent);
    await page.getByRole("button", { name: new RegExp(`^Add ${talent}, .* 5 star card$`) }).click();
  }

  await expect(page.getByText("Roster ready", { exact: true })).toBeVisible();
  await page.getByRole("switch", { name: "Oshi mode" }).click();
  await page.getByRole("combobox", { name: "Oshi talent" }).selectOption({ label: "AZKi" });
  await page.getByRole("button", { name: /Both/ }).click();
  await page.getByRole("button", { name: "Calculate team", exact: true }).click();

  await expect(page.getByText("Recommended formation", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "Your strongest evaluated team" })).toBeVisible();
  await expect(page.getByText("Leader Outfit", { exact: true })).toBeVisible();
  await expect(page.getByText("Oshi lock fulfilled", { exact: true })).toBeVisible();
  await expect(page.getByText("Locked as both Member and Leader Outfit", { exact: true })).toBeVisible();
  await expect(page.getByText("Oshi", { exact: true })).toHaveCount(2);
  await expect(page.locator("a[class*='memberResult']")).toHaveCount(5);
  await expect(page.getByText("Special activation order", { exact: true })).toBeVisible();
  await expect(page.getByText("Left to right", { exact: true })).toBeVisible();
  await expect(page.getByText(/Chart timed|Timing tie/, { exact: true })).toBeVisible();
  await expect(page.locator("[class*='orderSlot']")).toHaveText([
    "Slot 1",
    "Slot 2",
    "Slot 3",
    "Slot 4",
    "Slot 5",
  ]);
  await expect(page.locator("[class*='memberTiming']")).toHaveCount(5);
  await expect(page.locator("[class*='orderSummary']")).toContainText(
    /120 placements compared|stable starting order/,
  );

  await page.getByRole("button", { name: /^Leader/ }).click();
  await page.getByRole("button", { name: "Calculate team", exact: true }).click();
  await expect(page.getByText("Locked as the Leader Outfit", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("[class*='leaderArt'] [class*='oshiResultBadge']")).toHaveCount(1);
  await expect(page.locator("a[class*='memberResult'] [class*='oshiResultBadge']")).toHaveCount(0);

  await page.getByRole("button", { name: /^Member/ }).click();
  await page.getByRole("button", { name: "Calculate team", exact: true }).click();
  await expect(page.getByText("Locked into the five-Member lineup", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("[class*='leaderArt'] [class*='oshiResultBadge']")).toHaveCount(0);
  await expect(page.locator("a[class*='memberResult'] [class*='oshiResultBadge']")).toHaveCount(1);
});
