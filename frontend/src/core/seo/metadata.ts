import type { Metadata } from "next";
import { appConfig, siteUrl } from "@/core/config";
import { PUBLIC_PAGES, type PublicPageKey } from "./public-pages";

const home = PUBLIC_PAGES.home;
export const SHARE_IMAGE_PATH = "/social/family-calendar-v1.png";
const image = { url: siteUrl(SHARE_IMAGE_PATH), width: 1200, height: 630, type: "image/png", alt: appConfig.appName };

export const defaultMetadata: Metadata = {
  metadataBase: new URL(siteUrl("/")),
  title: { default: appConfig.appName, template: "%s · " + appConfig.appName },
  description: home.description,
  applicationName: appConfig.appName,
  // Only explicitly listed public pages opt in to indexing.
  robots: { index: false, follow: true },
  openGraph: { type: "website", locale: "vi_VN", siteName: appConfig.appName, title: home.title, description: home.description, url: siteUrl("/"), images: [image] },
  twitter: { card: "summary_large_image", title: home.title, description: home.description, images: [{ url: image.url, alt: image.alt }] },
};

export function publicPageMetadata(key: PublicPageKey): Metadata {
  const page = PUBLIC_PAGES[key];
  const description = "description" in page ? page.description : page.intro;
  const title = key === "home" ? page.title : page.title + " · " + appConfig.appName;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: siteUrl(page.path) },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    openGraph: { ...defaultMetadata.openGraph, title, description, url: siteUrl(page.path) },
    twitter: { ...defaultMetadata.twitter, title, description },
  };
}
