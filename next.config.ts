import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @node-rs/jieba is a native module used only on the server (segmentation).
  // Keep it external so the bundler never tries to bundle the .node binary.
  serverExternalPackages: ["@node-rs/jieba"],

  async headers() {
    return [
      {
        // Security headers for every route.
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The service worker must always be served fresh and as JS.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
