import { Suspense } from "react";
import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { SettingsPage } from "@/features/settings";

export const metadata: Metadata = { title: t("settings.title") };

export default function Page() {
  // useSearchParams (the ?tab= deep link) needs a Suspense boundary in a static export.
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  );
}
