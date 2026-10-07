import { Suspense } from "react";
import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { PrintWeekPage } from "@/features/print";

export const metadata: Metadata = { title: t("print.title") };

// Outside the app shell: a printed page has no sidebar or bottom nav.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PrintWeekPage />
    </Suspense>
  );
}
