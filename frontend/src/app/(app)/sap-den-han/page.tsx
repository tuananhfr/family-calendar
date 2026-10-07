import type { Metadata } from "next";
import { UpcomingPage } from "@/features/upcoming";
import { t } from "@/i18n/vi";

export const metadata: Metadata = { title: t("upcoming.title") };

export default function Page() {
  return <UpcomingPage />;
}
