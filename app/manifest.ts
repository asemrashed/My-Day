import type { MetadataRoute } from "next";

// Bump when icons change so installed PWAs refetch (Windows caches aggressively)
const ICON_V = "4";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ThryveUp",
    short_name: "ThryveUp",
    description:
      "Organize your workflow, schedule events, manage expenses, and track loans seamlessly.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      {
        src: `/icon.ico?v=${ICON_V}`,
        sizes: "16x16 24x24 32x32 48x48 64x64 128x128 256x256",
        type: "image/x-icon",
        purpose: "any",
      },
      {
        src: `/icon-192.png?v=${ICON_V}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icon-512.png?v=${ICON_V}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `/icon-maskable-512.png?v=${ICON_V}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
