import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { TodayScreen } from "@/features/today";

export const metadata: Metadata = { title: t("nav.today") };

export default function TodayPage() {
  return <TodayScreen />;
}
