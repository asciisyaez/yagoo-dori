import type { MetadataRoute } from "next";

import { sitePath } from "@/lib/site-path";

export const dynamic = "force-static";

const siteUrl = (
  process.env.YAGOO_DORI_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  const publicationReady = process.env.NEXT_PUBLIC_PUBLICATION_READY === "true";
  return {
    rules: publicationReady
      ? { userAgent: "*", allow: sitePath("/") }
      : { userAgent: "*", disallow: sitePath("/") },
    ...(publicationReady ? { sitemap: `${siteUrl}/sitemap.xml` } : {}),
  };
}
