import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { ReportsScreen } from "@/features/reports/components/ReportsScreen";

export const metadata: Metadata = { title: t("reports.title") };

export default function ReportsPage() {
  return <ReportsScreen />;
}
