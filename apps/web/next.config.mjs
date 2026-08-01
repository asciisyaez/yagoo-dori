import createMDX from "@next/mdx";

const withMDX = createMDX({});
const isGitHubPages = process.env.YAGOO_DORI_DEPLOY_TARGET === "github-pages";

function normalizeBasePath(value) {
  if (!value || value === "/") return "";
  const basePath = value.startsWith("/") ? value : `/${value}`;
  return basePath.replace(/\/+$/, "");
}

const basePath = isGitHubPages
  ? normalizeBasePath(process.env.YAGOO_DORI_BASE_PATH)
  : "";

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: isGitHubPages ? "export" : "standalone",
  basePath,
  trailingSlash: isGitHubPages,
  images: {
    unoptimized: isGitHubPages,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  allowedDevOrigins: ["127.0.0.1"],
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  transpilePackages: ["@yagoo-dori/core"],
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
};

export default withMDX(nextConfig);
