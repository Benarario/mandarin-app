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

// Bundle analysis is opt-in. @next/bundle-analyzer injects a `webpack` config,
// which would make the default Turbopack build fail — so we only apply it when
// ANALYZE=true (run that build with `--webpack`, see the "analyze" script).
export default async (): Promise<NextConfig> => {
  if (process.env.ANALYZE === "true") {
    const withBundleAnalyzer = (await import("@next/bundle-analyzer")).default({ enabled: true });
    return withBundleAnalyzer(nextConfig) as NextConfig;
  }
  return nextConfig;
};
