import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { OnboardingScreen } from "@/features/onboarding";

export const metadata: Metadata = { title: t("nav.onboarding") };

export default function OnboardingPage() {
  return <OnboardingScreen />;
}
