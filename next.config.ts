import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles:
        process.env.APP_ROLE === "public"
          ? [{ source: "/", destination: "/experience" }]
          : [],
      afterFiles: [],
      fallback: [],
    };
  },
  distDir: process.env.APP_ROLE === "public" ? ".next-public" : ".next",
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
