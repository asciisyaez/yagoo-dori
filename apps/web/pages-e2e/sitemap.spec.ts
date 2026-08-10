import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const basePath = process.env.YAGOO_DORI_BASE_PATH ?? "/yagoo-dori";
const outDir = path.join(__dirname, "..", "out");

function sitemapLocs(): { locs: string[]; siteUrl: string } {
  const xml = readFileSync(path.join(outDir, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const root = locs.find((loc) => new URL(loc).pathname === `${basePath}/`);
  if (!root) throw new Error("sitemap has no root entry under the expected base path");
  return { locs, siteUrl: root.replace(/\/$/, "") };
}

function exportedRoutePathname(loc: string): string {
  const pathname = new URL(loc).pathname;
  if (!pathname.startsWith(`${basePath}/`)) throw new Error(`sitemap URL is missing the base path: ${loc}`);
  return pathname.slice(basePath.length);
}

test("sitemap lists only real exported pages, exactly once, with no redirect stubs", () => {
  const { locs } = sitemapLocs();

  expect(new Set(locs).size).toBe(locs.length);
  expect(locs.length).toBeGreaterThan(250);

  const pathnames = locs.map(exportedRoutePathname);
  // Redirect-only families and dead indexes must not be advertised.
  expect(pathnames.filter((pathname) => pathname.startsWith("/leaders"))).toEqual([]);
  expect(pathnames.filter((pathname) => pathname === "/synergies/")).toEqual([]);
  // The real detail families must be present.
  expect(pathnames.some((pathname) => /^\/skills\/[^/]+\/$/.test(pathname))).toBe(true);
  expect(pathnames.some((pathname) => /^\/synergies\/[^/]+\/$/.test(pathname))).toBe(true);
  // The base path must appear exactly once (never doubled).
  for (const loc of locs) {
    expect(new URL(loc).pathname.split(basePath).length).toBe(2);
  }
  // Every advertised URL resolves to an exported page.
  for (const pathname of pathnames) {
    const file = pathname === "/"
      ? path.join(outDir, "index.html")
      : path.join(outDir, pathname.replace(/\/$/, ""), "index.html");
    expect(existsSync(file), `missing export for sitemap entry ${pathname}`).toBe(true);
  }
});

test("exported canonicals are route-specific and leader stubs canonicalize to card pages", () => {
  const { siteUrl } = sitemapLocs();
  const canonicalOf = (relative: string): string | null => {
    const html = readFileSync(path.join(outDir, relative), "utf8");
    return html.match(/<link rel="canonical" href="([^"]+)"\/?>/)?.[1] ?? null;
  };

  // Route-specific canonicals (guards the layout-level relative canonical).
  expect(canonicalOf("index.html")).toBe(`${siteUrl}/`);
  expect(canonicalOf(path.join("tier-list", "index.html"))).toBe(`${siteUrl}/tier-list/`);
  const cardSlug = readdirSync(path.join(outDir, "cards"), { withFileTypes: true })
    .find((entry) => entry.isDirectory())?.name;
  expect(cardSlug).toBeTruthy();
  expect(canonicalOf(path.join("cards", cardSlug ?? "", "index.html"))).toBe(`${siteUrl}/cards/${cardSlug}/`);

  // Leader redirect stubs must claim their card target, with the base path intact.
  const leaderSlug = readdirSync(path.join(outDir, "leaders"), { withFileTypes: true })
    .find((entry) => entry.isDirectory())?.name;
  expect(leaderSlug).toBeTruthy();
  expect(canonicalOf(path.join("leaders", leaderSlug ?? "", "index.html"))).toBe(`${siteUrl}/cards/${leaderSlug}/`);
});
