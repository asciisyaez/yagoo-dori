import { nativeGuideData, publicCards } from "@yagoo-dori/core";
import type { MetadataRoute } from "next";

import { talentRecords } from "./talents/talent-records";

const siteUrl = (
  process.env.YAGOO_DORI_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

const STATIC_ROUTES = [
  "/",
  "/cards/",
  "/talents/",
  "/tier-list/",
  "/team-builder/",
  "/holomem-board/",
  "/guides/",
  "/methodology/",
  "/leaders/",
  "/synergies/",
  "/sources/",
] as const;

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = STATIC_ROUTES.map((route) => ({ url: `${siteUrl}${route}` }));
  const cardEntries = publicCards.map((card) => ({ url: `${siteUrl}/cards/${card.slug}/` }));
  const leaderEntries = publicCards.map((card) => ({ url: `${siteUrl}/leaders/${card.slug}/` }));
  const talentEntries = talentRecords.map((talent) => ({ url: `${siteUrl}/talents/${talent.slug}/` }));
  const guideEntries = nativeGuideData.guides.map((guide) => ({ url: `${siteUrl}/guides/${guide.slug}/` }));
  return [...staticEntries, ...cardEntries, ...leaderEntries, ...talentEntries, ...guideEntries];
}
