import type { MetadataRoute } from "next";

import { sitePath } from "@/lib/site-path";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const publicationReady = process.env.NEXT_PUBLIC_PUBLICATION_READY === "true";
  return {
    rules: publicationReady
      ? { userAgent: "*", allow: sitePath("/") }
      : { userAgent: "*", disallow: sitePath("/") },
  };
}
