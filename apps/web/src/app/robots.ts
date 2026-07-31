import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const publicationReady = process.env.NEXT_PUBLIC_PUBLICATION_READY === "true";
  return {
    rules: publicationReady
      ? { userAgent: "*", allow: "/" }
      : { userAgent: "*", disallow: "/" },
  };
}
