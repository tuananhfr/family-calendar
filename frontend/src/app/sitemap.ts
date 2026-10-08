import type { MetadataRoute } from "next";
import { siteUrl } from "@/core/config";
import { PUBLIC_PAGES } from "@/core/seo/public-pages";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(PUBLIC_PAGES).map(({ path }) => ({ url: siteUrl(path) }));
}
