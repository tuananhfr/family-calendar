import type { Metadata } from "next";
import { publicPageMetadata } from "@/core/seo/metadata";
import { StaticPageScreen } from "@/features/static-pages/StaticPageScreen";

export const metadata: Metadata = publicPageMetadata("terms");

export default function TermsPage() {
  return <StaticPageScreen page="terms" />;
}
