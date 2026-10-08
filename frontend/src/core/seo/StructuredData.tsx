import { appConfig, siteUrl } from "@/core/config";
import { PUBLIC_PAGES } from "./public-pages";
import { SHARE_IMAGE_PATH } from "./metadata";

export function StructuredData() {
  const url = siteUrl("/");
  const applicationId = url + "#application";
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebApplication", "@id": applicationId, name: appConfig.appName, url, description: PUBLIC_PAGES.home.description, applicationCategory: "LifestyleApplication", operatingSystem: "Web", inLanguage: "vi", image: siteUrl(SHARE_IMAGE_PATH) },
      { "@type": "WebPage", "@id": url + "#webpage", url, name: appConfig.appName, description: PUBLIC_PAGES.home.description, inLanguage: "vi", about: { "@id": applicationId } },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\u003c") }} />;
}
