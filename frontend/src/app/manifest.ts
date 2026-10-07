import type { MetadataRoute } from "next";
import { withBase } from "@/core/config";

// Generated rather than a static file so start_url/scope/icons follow the build's base path.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lịch Gia Đình",
    short_name: "Lịch Gia Đình",
    lang: "vi",
    start_url: withBase("/"),
    scope: withBase("/"),
    display: "standalone",
    background_color: "#f4f7fc",
    theme_color: "#f4f7fc",
    icons: [
      { src: withBase("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: withBase("/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
  };
}
