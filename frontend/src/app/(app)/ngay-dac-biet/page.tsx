import type { Metadata } from "next";
import { SpecialDaysPage } from "@/features/special-days";
import { t } from "@/i18n/vi";

export const metadata: Metadata = { title: t("specialDays.title") };

export default function Page() {
  return <SpecialDaysPage />;
}
