import { expect, type Page, type Request, type Response, test } from "@playwright/test";
import publicData from "../../../data/generated/holodori-public.json";

const basePath = process.env.YAGOO_DORI_BASE_PATH ?? "/yagoo-dori";
const previewPort = process.env.PORT ?? "3100";

function prefixed(pathname = "/") {
  const suffix = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${basePath}${suffix}`;
}

function sameOriginFailures(page: Page) {
  const failures: string[] = [];
  const isSameOrigin = (url: string) => {
    const parsed = new URL(url);
    return parsed.hostname === "127.0.0.1" && parsed.port === previewPort;
  };
  const onRequestFailed = (request: Request) => {
    const error = request.failure()?.errorText ?? "request failed";
    if (isSameOrigin(request.url()) && error !== "net::ERR_ABORTED") {
      failures.push(`${request.method()} ${request.url()} — ${error}`);
    }
  };
  const onResponse = (response: Response) => {
    if (isSameOrigin(response.url()) && response.status() >= 400) {
      failures.push(`${response.request().method()} ${response.url()} — HTTP ${response.status()}`);
    }
  };
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);
  return {
    failures,
    stop() {
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    },
  };
}

async function expectVisibleLocalImages(page: Page) {
  const imageLocator = page.locator("img");
  const imageCount = await imageLocator.count();
  expect(imageCount).toBeGreaterThan(0);
  const images = await imageLocator.evaluateAll((elements) =>
    elements.map((element) => {
      const image = element as HTMLImageElement;
      return {
        src: image.currentSrc || image.src,
      };
    }),
  );
  for (const image of images) {
    const url = new URL(image.src);
    expect(url.pathname, image.src).toMatch(new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`));
  }

  // Next keeps off-screen catalog artwork lazy. Exercise representative images
  // in the viewport rather than treating intentionally unloaded rows as broken.
  const renderedImages = page.locator("img:visible");
  const renderedImageCount = await renderedImages.count();
  expect(renderedImageCount).toBeGreaterThan(0);
  for (let index = 0; index < Math.min(renderedImageCount, 4); index += 1) {
    const image = renderedImages.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(async () => image.evaluate((element) => {
      const candidate = element as HTMLImageElement;
      return candidate.complete && candidate.naturalWidth > 0;
    })).toBe(true);
  }
}

async function expectNoLocalhostMetadata(page: Page) {
  const metadata = await page.locator("head").innerHTML();
  expect(metadata).not.toMatch(/(?:localhost|127\.0\.0\.1)/i);
  const localUrls = await page.locator('head link[href^="/"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  );
  for (const href of localUrls) expect(href).toMatch(new RegExp(`^${basePath}/`));
}

test("prefixed navigation, deep routes, metadata, and local artwork survive static hosting", async ({ page }) => {
  const network = sameOriginFailures(page);
  await page.goto(prefixed("/"), { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Know every card. Build the right five." })).toBeVisible();
  await expectNoLocalhostMetadata(page);
  await expectVisibleLocalImages(page);

  for (const name of ["Cards & Outfits", "Talents", "Tier list", "Team calculator", "Team guides"]) {
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name })).toHaveAttribute(
      "href",
      new RegExp(`^${basePath}/`),
    );
  }

  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Cards & Outfits" }).click();
  await expect(page).toHaveURL(new RegExp(`${basePath}/cards/$`));
  await expect(page.getByRole("heading", { level: 1, name: "Cards and Leader Outfits" })).toBeVisible();
  await expectVisibleLocalImages(page);

  const cardLink = page.locator("a.real-catalog-card").first();
  const cardHref = await cardLink.getAttribute("href");
  expect(cardHref).toMatch(new RegExp(`^${basePath}/cards/.+/$`));
  await cardLink.click();
  await expect(page).toHaveURL(new RegExp(`${basePath}/cards/.+/$`));
  await expect(page.locator(".card-profile-page h1")).toBeVisible();
  await expectVisibleLocalImages(page);

  await page.goto(prefixed("/guides/"), { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Build teams for each holomem’s own songs." })).toBeVisible();
  const guideLink = page.locator('a[href*="/guides/"]').filter({ has: page.locator("img") }).first();
  const guideHref = await guideLink.getAttribute("href");
  expect(guideHref).toMatch(new RegExp(`^${basePath}/guides/.+/$`));
  await guideLink.click();
  await expect(page).toHaveURL(new RegExp(`${basePath}/guides/.+/$`));
  await expect(page.locator("main h1")).toBeVisible();
  await expectVisibleLocalImages(page);
  await expectNoLocalhostMetadata(page);

  network.stop();
  expect(network.failures).toEqual([]);
});

test("team filters retain the prefix after reload and the real browser Worker returns a formation", async ({ page }) => {
  test.setTimeout(120_000);
  const network = sameOriginFailures(page);
  const workerUrls: string[] = [];
  page.on("worker", (worker) => workerUrls.push(worker.url()));

  await page.goto(prefixed("/team-builder/"), { waitUntil: "domcontentloaded" });
  const search = page.getByRole("searchbox", { name: "Search cards" });
  await search.fill("AZKi");
  await expect(page).toHaveURL(new RegExp(`${basePath}/team-builder/\\?q=AZKi$`));
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`${basePath}/team-builder/\\?q=AZKi$`));
  await expect(search).toHaveValue("AZKi");

  for (const [talent, title] of [
    ["AZKi", "A Flower in Full Bloom"],
    ["Akai Haato", "Snack-Time Rebel"],
    ["Aki Rosenthal", "Ethereal Half-Elf"],
    ["Anya Melfissa", "Couch Potato Gamer"],
    ["Ayunda Risu", "Sylvan Mischief"],
  ] as const) {
    await search.fill(talent);
    await page.getByRole("button", { name: `Add ${talent}, ${title}, 5 star card`, exact: true }).click();
  }
  await expect(page.getByText("Roster ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Calculate team", exact: true }).click();
  await expect(page.getByText("Recommended formation", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(
    page.getByRole("heading", {
      name: /Strongest team (?:across the declared roster and 30-chart benchmark|in the declared scope|found in the searched scope)/,
    }),
  ).toBeVisible();
  await expect(page.locator("a[class*='memberResult']")).toHaveCount(5);
  expect(workerUrls.some((url) => url.includes(`${basePath}/_next/static/chunks/turbopack-worker-`))).toBe(true);
  await expectVisibleLocalImages(page);
  await expectNoLocalhostMetadata(page);

  network.stop();
  expect(network.failures).toEqual([]);
});

test("legacy Leader links stay inside the repository path", async ({ page }) => {
  const slug = "azki-a-flower-in-full-bloom-card-00013-5-uniq-0002-00";
  await page.goto(prefixed(`/leaders/${slug}/`), { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(`${basePath}/cards/${slug}/#leader-outfit`);
  await expect(page.getByRole("heading", { level: 1, name: /AZKi/ })).toBeVisible();
});

test("the prefixed mobile drawer is usable and pages do not overflow", async ({ page }) => {
  const network = sameOriginFailures(page);
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto(prefixed("/cards/"), { waitUntil: "networkidle" });

  const noOverflow = async () => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  await expect.poll(noOverflow).toBe(true);

  const menu = page.getByRole("button", { name: "Menu" });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(mobileNavigation).toBeVisible();
  await mobileNavigation.getByRole("link", { name: "Tier list" }).click();
  await expect(page).toHaveURL(new RegExp(`${basePath}/tier-list/$`));
  await expect(mobileNavigation).not.toBeVisible();
  await expect.poll(noOverflow).toBe(true);
  await expectVisibleLocalImages(page);

  network.stop();
  expect(network.failures).toEqual([]);
});

test("roll upgrade rankings use a prefixed Worker and retain search URLs", async ({ page }) => {
  const network = sameOriginFailures(page);
  const workerUrls: string[] = [];
  page.on("worker", (worker) => workerUrls.push(worker.url()));
  await page.addInitScript(() => {
    localStorage.setItem("yagoo-dori:team-calculator-roster", JSON.stringify({
      version: 4, rosterCommit: "0".repeat(40),
      cards: Object.fromEntries([
        "card-00004-4-cmmn-0000-00", "card-00023-4-cmmn-0000-00", "card-00035-4-cmmn-0000-00",
        "card-03001-4-cmmn-0000-00", "card-03002-4-cmmn-0000-00", "card-04001-4-cmmn-0000-00",
      ].map((cardId) => [cardId, 0])),
      oshi: { enabled: false, talentId: null, role: "member" }, requiredMemberCardIds: [],
      playerLevel: null, boards: {},
    }));
  });
  await page.goto(prefixed("/roll-compare/"), { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-picker-card-id]")).toHaveCount(publicData.cards.length - 6);
  const ownedIds = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("yagoo-dori:team-calculator-roster")!).cards));
  const expectedIds = publicData.cards.filter((card) => !ownedIds.includes(card.id)).map((card) => card.id).sort();
  expect((await page.locator("[data-picker-card-id]").evaluateAll((elements) => elements.map((el) => el.getAttribute("data-picker-card-id")))).sort()).toEqual(expectedIds);
  expect((await page.locator("[data-pending-card-id]").evaluateAll((elements) => elements.map((el) => el.getAttribute("data-pending-card-id")))).sort()).toEqual(expectedIds);
  await page.getByRole("searchbox", { name: "Search unowned cards" }).fill("AZKi");
  await expect(page).toHaveURL(new RegExp(`${basePath}/roll-compare/\\?q=AZKi$`));
  const azkiId = "card-00013-5-uniq-0002-00";
  const pendingAzki = page.locator(`[data-pending-card-id="${azkiId}"]`);
  await pendingAzki.click();
  await expect(pendingAzki).toBeDisabled();
  await expect(page.locator(`[data-comparison-card-id="${azkiId}"]`)).toBeVisible({ timeout: 90_000 });
  await expect(pendingAzki).toHaveCount(0);
  await page.getByRole("button", { name: "Clear card search" }).click();
  await page.getByRole("button", { name: "Resume comparisons" }).click();
  const target = page.locator("button").filter({ hasText: /(?:Upgrade found|No upgrade found)/ }).first();
  await expect(target).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "Pause comparisons" }).click();
  await target.click();
  await expect(page.getByText("Verdict", { exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(prefixed("/roll-compare/"));
  expect(workerUrls.some((url) => url.includes(`${basePath}/_next/static/chunks/turbopack-worker-`))).toBe(true);
  network.stop();
  expect(network.failures).toEqual([]);
});
