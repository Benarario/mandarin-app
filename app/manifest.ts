import type { MetadataRoute } from "next";

// Web App Manifest — makes the app installable to a phone home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mandarin — Personal Chinese Learning",
    short_name: "Mandarin",
    description:
      "Learn Mandarin Chinese with spaced repetition, a tap-to-define reader, and verified, never-fabricated definitions.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf3",
    theme_color: "#c2410c",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
