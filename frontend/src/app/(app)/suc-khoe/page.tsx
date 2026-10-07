import { Suspense } from "react";
import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { HealthPage } from "@/features/health";

export const metadata: Metadata = { title: t("nav.health") };

export default function HealthRoute() {
  // useSearchParams (?tab=, ?tv=) needs a Suspense boundary in a static export.
  return (
    <Suspense>
      <HealthPage />
    </Suspense>
  );
}
