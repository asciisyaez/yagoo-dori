import { expect, type Page, type Request, type Response, test } from "@playwright/test";

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
  await expect(page.getByRole("heading", { level: 1, name: "Build teams for rating songs." })).toBeVisible();
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

  for (const talent of ["AZKi", "Akai Haato", "Aki Rosenthal", "Anya Melfissa", "Ayunda Risu"]) {
    await search.fill(talent);
    await page.getByRole("button", { name: new RegExp(`^Add ${talent}, .* 5 star card$`) }).click();
  }
  await expect(page.getByText("Roster ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Calculate team", exact: true }).click();
  await expect(page.getByText("Recommended formation", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "Your strongest evaluated team" })).toBeVisible();
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
