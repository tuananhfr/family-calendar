import type { Metadata } from "next";
import { StaticPageScreen } from "@/features/static-pages/StaticPageScreen";
import { STATIC_PAGES } from "@/i18n/static-pages";

export const metadata: Metadata = { title: STATIC_PAGES.terms.title };

export default function TermsPage() {
  return <StaticPageScreen page="terms" />;
}
