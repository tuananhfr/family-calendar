import type { Metadata } from "next";
import { publicPageMetadata } from "@/core/seo/metadata";
import { StaticPageScreen } from "@/features/static-pages/StaticPageScreen";

export const metadata: Metadata = publicPageMetadata("help");

export default function HelpPage() {
  return <StaticPageScreen page="help" />;
}
