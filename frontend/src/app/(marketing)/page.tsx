import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/components/LandingPage";
import { t } from "@/i18n/vi";

export const metadata: Metadata = { title: { absolute: t("appName") }, description: t("landing.description") };

export default function HomePage() {
  return <LandingPage />;
}
