import { expect, test } from "@playwright/test";

const GUIDES = [
  {
    talent: "AZKi",
    cardTitle: "A Flower in Full Bloom",
    standardLeaderCardTitle: "A Flower in Full Bloom",
    guideSlug: "azki-a-flower-in-full-bloom-team-guide",
    cardSlug: "azki-a-flower-in-full-bloom-card-00013-5-uniq-0002-00",
  },
  {
    talent: "Usada Pekora",
    cardTitle: "Playful Rabbit Field",
    standardLeaderCardTitle: "Playful Rabbit Field",
    guideSlug: "usada-pekora-playful-rabbit-field-card-00019-5-uniq-0016-00-team-guide",
    cardSlug: "usada-pekora-playful-rabbit-field-card-00019-5-uniq-0016-00",
  },
  {
    talent: "Oozora Subaru",
    cardTitle: "Vibrant Sun Splash!",
    standardLeaderCardTitle: "Duckling Noon Jam",
    guideSlug: "oozora-subaru-vibrant-sun-splash-card-00012-5-uniq-0062-00-team-guide",
    cardSlug: "oozora-subaru-vibrant-sun-splash-card-00012-5-uniq-0062-00",
  },
  {
    talent: "Shirogane Noel",
    cardTitle: "Serene Wave Knight",
    standardLeaderCardTitle: "Serene Wave Knight",
    guideSlug: "shirogane-noel-serene-wave-knight-card-00022-5-uniq-0063-00-team-guide",
    cardSlug: "shirogane-noel-serene-wave-knight-card-00022-5-uniq-0063-00",
  },
  {
    talent: "Shiranui Flare",
    cardTitle: "Sparks at Sunset",
    standardLeaderCardTitle: "Sparks at Sunset",
    guideSlug: "shiranui-flare-sparks-at-sunset-card-00021-5-uniq-0064-00-team-guide",
    cardSlug: "shiranui-flare-sparks-at-sunset-card-00021-5-uniq-0064-00",
  },
  {
    talent: "Tsunomaki Watame",
    cardTitle: "Floatie Float Time",
    standardLeaderCardTitle: "Floatie Float Time",
    guideSlug: "tsunomaki-watame-floatie-float-time-card-00026-5-uniq-0065-00-team-guide",
    cardSlug: "tsunomaki-watame-floatie-float-time-card-00026-5-uniq-0065-00",
  },
  {
    talent: "Otonose Kanade",
    cardTitle: "Breezy Smile Chords",
    standardLeaderCardTitle: "Breezy Smile Chords",
    guideSlug: "otonose-kanade-breezy-smile-chords-card-06002-5-uniq-0066-00-team-guide",
    cardSlug: "otonose-kanade-breezy-smile-chords-card-06002-5-uniq-0066-00",
  },
] as const;

const AZKI_GUIDE = GUIDES[0];
const PEKORA_GUIDE = GUIDES[1];
const SUBARU_GUIDE = GUIDES[2];
const DISCLAIMER = "Unofficial fan site; not affiliated with COVER Corp. or QualiArts.";

test("guide library lists every generated exact-card build", async ({ isMobile, page }) => {
  await page.goto("/guides", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { level: 1, name: "Build teams for rating songs." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Build around a 5★ Member" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(GUIDES.length);
  await expect(page.locator("body")).not.toContainText(/AppMedia|Art pending rights/i);

  for (const guide of GUIDES) {
    const card = page.getByRole("article").filter({
      has: page.getByRole("heading", { level: 2, name: guide.talent, exact: true }),
    });
    await expect(card).toHaveCount(1);
    await expect(card.getByText(guide.cardTitle, { exact: true })).toBeVisible();
    await expect(card.getByText("Recommended Leader", { exact: true })).toBeVisible();
    await expect(
      card.getByText(`5★ card · ${guide.standardLeaderCardTitle}`, { exact: true }),
    ).toBeVisible();

    const lineup = card.getByRole("list", {
      name: `${guide.talent} standard Member lineup`,
    });
    await expect(lineup.getByRole("listitem")).toHaveCount(5);

    await expect(
      card.getByRole("link", {
        name: `Open ${guide.talent} ${guide.cardTitle} team guide`,
        exact: true,
      }),
    ).toHaveAttribute("href", `/guides/${guide.guideSlug}`);
  }

  if (isMobile) {
    const dimensions = await page.locator("body").evaluate((body) => ({
      clientWidth: body.clientWidth,
      scrollWidth: body.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  }

  await page
    .getByRole("link", {
      name: `Open ${AZKI_GUIDE.talent} ${AZKI_GUIDE.cardTitle} team guide`,
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`/guides/${AZKI_GUIDE.guideSlug}$`));
  await expect(page.getByRole("heading", { level: 1, name: AZKI_GUIDE.talent })).toBeVisible();
});

for (const guide of GUIDES) {
  test(`${guide.talent} guide route, profile link, and mobile layout are ready`, async ({
    isMobile,
    page,
  }) => {
    await page.goto(`/guides/${guide.guideSlug}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: guide.talent })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: guide.cardTitle })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open anchor card" })).toHaveAttribute(
      "href",
      `/cards/${guide.cardSlug}`,
    );
    await expect(
      page.locator("#formation-standard").getByRole("list", { name: /Member lineup/i }),
    ).toHaveCount(1);
    await expect(
      page
        .locator("#formation-standard")
        .getByText(`5★ Leader card · ${guide.standardLeaderCardTitle}`, { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator("#formation-standard")
        .getByRole("list", { name: /Member lineup/i })
        .getByRole("listitem"),
    ).toHaveCount(5);

    if (isMobile) {
      const dimensions = await page.locator("body").evaluate((body) => ({
        clientWidth: body.clientWidth,
        scrollWidth: body.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      await expect(page.getByRole("navigation", { name: "Guide sections" })).toBeVisible();
    }

    await page.goto(`/cards/${guide.cardSlug}`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("link", { name: new RegExp(`${guide.talent}.*team guide`, "i") }),
    ).toHaveAttribute("href", `/guides/${guide.guideSlug}`);
  });
}

test("Pekora keeps Leader and Passive recipients separate at each skill level", async ({ page }) => {
  await page.goto(`/guides/${PEKORA_GUIDE.guideSlug}`, { waitUntil: "domcontentloaded" });

  const standard = page.locator("#formation-standard");
  const standardLeader = standard.locator("li").filter({ hasText: "Usada Pekora · Leader" });
  const standardPassive = standard.locator("li").filter({ hasText: "Usada Pekora · Passive" });
  await expect(standardLeader).toContainText("Grants All Stats UP 30% to all");
  await expect(standardLeader).toContainText(
    "Affected: Usada Pekora, Tsunomaki Watame, Yukihana Lamy, Shishiro Botan, Fuwawa Abyssgard",
  );
  await expect(standardPassive).toContainText("Grants All Stats UP 24% to self");
  await expect(standardPassive).toContainText("Affected: Usada Pekora");

  const standardPekoraTiming = standard.getByRole("row").filter({ hasText: "Usada Pekora" });
  await expect(standardPekoraTiming).toContainText("For 11s, Score UP 95%");
  await expect(standardPekoraTiming).toContainText("Grants Score Support Effect of 95%");

  const premium = page.locator("#formation-premium");
  const premiumPassive = premium.locator("li").filter({ hasText: "Usada Pekora · Passive" });
  await expect(premiumPassive).toContainText("Grants All Stats UP 32% to self");
  const premiumPekoraTiming = premium.getByRole("row").filter({ hasText: "Usada Pekora" });
  await expect(premiumPekoraTiming).toContainText("For 12s, Score UP 105%");
  await expect(premiumPekoraTiming).toContainText("Grants Score Support Effect of 115%");
});

test("Subaru guide distinguishes the summer Member from its recommended Leader card", async ({ page }) => {
  await page.goto(`/guides/${SUBARU_GUIDE.guideSlug}`, { waitUntil: "domcontentloaded" });

  const standard = page.locator("#formation-standard");
  await expect(standard.getByText("Oozora Subaru · Duckie Bounce!", { exact: true })).toBeVisible();
  await expect(standard.getByText("5★ Leader card · Duckling Noon Jam", { exact: true })).toBeVisible();
  await expect(standard.locator('img[src*="card-00012-5-uniq-0012-00.webp"]')).toBeVisible();
  const lineup = standard.getByRole("list", { name: /Member lineup/i });
  const summerMemberArt = lineup.locator('img[alt*="Vibrant Sun Splash!"]');
  await expect(summerMemberArt).toHaveAttribute(
    "src",
    /card-00012-5-uniq-0062-00\.webp/,
  );
});

test("generated guide renders three legal formations and decision details", async ({ page }) => {
  await page.goto(`/guides/${AZKI_GUIDE.guideSlug}`, { waitUntil: "domcontentloaded" });

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
  await expect(
    page.locator("#formation-standard [aria-label$='static parameter calculation']"),
  ).toBeVisible();
  await expect(page.getByText("Effective static pool", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practical swaps" }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Active and Special timing" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Use one build unless the chart changes the answer" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Most rating songs" })).toBeVisible();
  await expect(page.locator("#rating-song-comparisons article")).toHaveCount(1);
  await expect(page.getByText("Standard build", { exact: true })).toBeVisible();

  await expect(page.getByText(DISCLAIMER, { exact: true })).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText(
    /AppMedia|globally optimal|canonical display|heuristic coverage|unavailable|unresolved/i,
  );
});
