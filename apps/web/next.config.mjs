import createMDX from "@next/mdx";

const withMDX = createMDX({});

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  transpilePackages: ["@yagoo-dori/core"],
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
  },
};

export default withMDX(nextConfig);
