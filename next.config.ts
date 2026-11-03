import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Font file untuk renderer desain harus ikut ter-deploy ke serverless function.
  outputFileTracingIncludes: {
    "/**/*": ["./assets/fonts/**/*"],
  },
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
