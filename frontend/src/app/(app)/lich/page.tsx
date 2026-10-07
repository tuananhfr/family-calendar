import { Suspense } from "react";
import type { Metadata } from "next";
import { t } from "@/i18n/vi";
import { CalendarScreen } from "@/features/calendar";

export const metadata: Metadata = { title: t("calendar.title") };

// useSearchParams needs a Suspense boundary under static export.
export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarScreen />
    </Suspense>
  );
}
