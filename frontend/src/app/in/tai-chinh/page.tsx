import { Suspense } from "react";
import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { FinancePrintPage } from "@/features/finance";

export const metadata: Metadata = { title: t("finance.report.print") };

// Outside the app shell like /in: a printed report has no sidebar or bottom nav.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <FinancePrintPage />
    </Suspense>
  );
}
