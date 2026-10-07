import { Suspense } from "react";
import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { StoragePage } from "@/features/storage";

export const metadata: Metadata = { title: t("nav.storage") };

export default function StorageRoute() {
  // useSearchParams (?folder=) needs a Suspense boundary in a static export.
  return (
    <Suspense>
      <StoragePage />
    </Suspense>
  );
}
