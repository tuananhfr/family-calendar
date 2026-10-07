import { Suspense } from "react";
import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { HealthPrintPage } from "@/features/health";

export const metadata: Metadata = { title: t("health.report.title") };

// Outside the app shell like /in: a printed report has no sidebar or bottom nav.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <HealthPrintPage />
    </Suspense>
  );
}
