import { Suspense } from "react";
import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { FinancePage } from "@/features/finance";

export const metadata: Metadata = { title: t("nav.finance") };

export default function FinanceRoute() {
  // useSearchParams (?tab=, ?thang=) needs a Suspense boundary in a static export.
  return (
    <Suspense>
      <FinancePage />
    </Suspense>
  );
}
